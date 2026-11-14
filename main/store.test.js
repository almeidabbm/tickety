const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { MAX_PHOTO_BYTES, openStore } = require("./store");

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

function setup({ seed = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tickety-"));
  const dir = path.join(root, "userData");
  const seedDir = path.join(root, "seed");
  fs.mkdirSync(seedDir);
  for (const name of seed) fs.writeFileSync(path.join(seedDir, name), JPEG);
  const trashed = [];
  const trash = async (file) => {
    trashed.push(file);
    fs.unlinkSync(file);
  };
  const open = () => openStore({ dir, seedDir, trash });
  return { dir, open, trashed, photosDir: path.join(dir, "backgrounds") };
}

test("defaults on first run", () => {
  const { open } = setup();
  assert.deepEqual(open().getState(), { ticket: 1, sound: true, photos: [] });
});

test("corrupt state file falls back to defaults", () => {
  const { dir, open } = setup();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "state.json"), "{not json");
  assert.deepEqual(open().getState(), { ticket: 1, sound: true, photos: [] });
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ ticket: 500, sound: "yes", photos: "x" }));
  assert.deepEqual(open().getState(), { ticket: 1, sound: true, photos: [] });
});

test("ticket and sound persist across a reload, written atomically", () => {
  const { dir, open } = setup();
  const store = open();
  store.setTicket(42);
  store.next();
  store.setSound(false);
  assert.deepEqual(open().getState(), { ticket: 43, sound: false, photos: [] });
  assert.ok(!fs.existsSync(path.join(dir, "state.json.tmp")));
});

test("next and back wrap around", () => {
  const store = setup().open();
  assert.equal(store.back().ticket, 99);
  assert.equal(store.next().ticket, 1);
});

test("setTicket rejects anything but 1..99", () => {
  const store = setup().open();
  for (const bad of [0, 100, 1.5, "abc", null]) assert.throws(() => store.setTicket(bad));
  assert.equal(store.getState().ticket, 1);
});

test("seeding copies only images and skips .DS_Store", () => {
  const { open, photosDir } = setup({ seed: ["a.jpeg", "b.png", ".DS_Store", "notes.txt"] });
  assert.deepEqual(open().getState().photos.sort(), ["a.jpeg", "b.png"]);
  assert.deepEqual(fs.readdirSync(photosDir).sort(), ["a.jpeg", "b.png"]);
});

test("load reconciles the photo list with files on disk", () => {
  const { dir, open, photosDir } = setup({ seed: ["a.jpeg", "b.jpeg"] });
  open();
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ photos: ["gone.jpeg", "b.jpeg", "b.jpeg"] }));
  fs.writeFileSync(path.join(photosDir, "c.jpeg"), JPEG);
  assert.deepEqual(open().getState().photos, ["b.jpeg", "a.jpeg", "c.jpeg"]);
});

test("addPhotos saves valid files and reports refused ones", () => {
  const { open, photosDir } = setup({ seed: ["a.jpeg"] });
  const store = open();
  const { state, refused } = store.addPhotos([
    { name: "new.png", data: JPEG },
    { name: "doc.pdf", data: JPEG },
    { name: "huge.jpg", data: Buffer.alloc(MAX_PHOTO_BYTES + 1) },
    { name: "a.jpeg", data: JPEG },
    { name: "../../x.jpg", data: JPEG },
    { name: "..\\..\\y.jpg", data: JPEG },
  ]);
  assert.deepEqual(state.photos, ["a.jpeg", "new.png", "a (2).jpeg", "x.jpg", "y.jpg"]);
  assert.equal(refused.length, 2);
  assert.match(refused[0], /doc\.pdf/);
  assert.match(refused[1], /huge\.jpg/);
  assert.deepEqual(fs.readdirSync(photosDir).sort(), ["a (2).jpeg", "a.jpeg", "new.png", "x.jpg", "y.jpg"]);
  assert.deepEqual(open().getState().photos, state.photos);
});

test("reorderPhotos accepts only a permutation", () => {
  const store = setup({ seed: ["a.jpeg", "b.jpeg"] }).open();
  const [first, second] = store.getState().photos;
  assert.deepEqual(store.reorderPhotos([second, first]).photos, [second, first]);
  for (const bad of [[first], [first, first], [first, "z.jpeg"], [first, second, "z.jpeg"], "a.jpeg"]) {
    assert.throws(() => store.reorderPhotos(bad));
  }
  assert.deepEqual(store.getState().photos, [second, first]);
});

test("removePhoto trashes the file and drops it from the list", async () => {
  const { open, trashed, photosDir } = setup({ seed: ["a.jpeg", "b.jpeg"] });
  const store = open();
  const state = await store.removePhoto("a.jpeg");
  assert.deepEqual(state.photos, ["b.jpeg"]);
  assert.deepEqual(trashed, [path.join(photosDir, "a.jpeg")]);
  await assert.rejects(store.removePhoto("a.jpeg"));
  await assert.rejects(store.removePhoto("../state.json"));
});

test("a failed save leaves the ticket unchanged in memory and on disk", () => {
  const { dir, open } = setup();
  const store = open();
  store.setTicket(10);
  fs.mkdirSync(path.join(dir, "state.json.tmp")); // writing the temp file now fails
  assert.throws(() => store.next());
  assert.equal(store.getState().ticket, 10);
  fs.rmdirSync(path.join(dir, "state.json.tmp"));
  assert.equal(store.next().ticket, 11);
  assert.equal(open().getState().ticket, 11);
});

test("a photo that fails to write is refused, the rest of the batch is kept", () => {
  const { photosDir, open } = setup();
  const store = open();
  fs.mkdirSync(path.join(photosDir, "blocked.jpg")); // occupied by a directory, so the write fails
  const { state, refused } = store.addPhotos([
    { name: "ok.jpg", data: JPEG },
    { name: "blocked.jpg", data: JPEG },
    { name: "also-ok.jpg", data: JPEG },
  ]);
  assert.deepEqual(state.photos.sort(), ["also-ok.jpg", "blocked (2).jpg", "ok.jpg"].sort());
  assert.equal(refused.length, 0);
});

test("a name already in the list is never reused, whatever its case", () => {
  const { photosDir, open } = setup();
  const store = open();
  store.addPhotos([{ name: "a.jpg", data: JPEG }]);
  fs.unlinkSync(path.join(photosDir, "a.jpg")); // file gone from disk but still listed
  const { state } = store.addPhotos([{ name: "A.JPG", data: JPEG }]);
  assert.equal(new Set(state.photos.map((n) => n.toLowerCase())).size, state.photos.length);
  assert.doesNotThrow(() => store.reorderPhotos([...state.photos].reverse()));
});

test("re-adding a name while it is being removed keeps the new photo", async () => {
  const { open } = setup();
  const store = open();
  store.addPhotos([{ name: "a.jpg", data: JPEG }]);
  const removing = store.removePhoto("a.jpg");
  const { state } = store.addPhotos([{ name: "a.jpg", data: JPEG }]);
  await removing;
  assert.equal(store.getState().photos.length, 1);
  assert.ok(state.photos.includes(store.getState().photos[0]));
});

test("Windows reserved device names are renamed", () => {
  const { open } = setup();
  const { state } = open().addPhotos([
    { name: "CON.jpg", data: JPEG },
    { name: "nul.png", data: JPEG },
    { name: "com1.jpeg", data: JPEG },
  ]);
  for (const name of state.photos) assert.ok(!/^(con|prn|aux|nul|com\d|lpt\d)\./i.test(name), name);
});

test("a write error is reported in Portuguese without the file path", () => {
  const { dir, open } = setup();
  const store = open();
  fs.mkdirSync(path.join(dir, "state.json.tmp"));
  assert.throws(() => store.next(), (error) => !error.message.includes(dir) && /guardar/i.test(error.message));
});
