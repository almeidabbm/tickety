const test = require("node:test");
const assert = require("node:assert/strict");
const {
  advanceTicket,
  previousTicket,
  parseTicket,
  nextBackgroundName,
  isImageFile,
} = require("./queue");

test("advanceTicket counts up and wraps after 99", () => {
  assert.equal(advanceTicket(1), 2);
  assert.equal(advanceTicket(98), 99);
  assert.equal(advanceTicket(99), 1);
});

test("previousTicket counts down and wraps before 1", () => {
  assert.equal(previousTicket(2), 1);
  assert.equal(previousTicket(99), 98);
  assert.equal(previousTicket(1), 99);
});

test("parseTicket accepts whole numbers 1..99 only", () => {
  assert.equal(parseTicket(1), 1);
  assert.equal(parseTicket(99), 99);
  assert.equal(parseTicket("42"), 42);
  assert.equal(parseTicket(" 7 "), 7);
  for (const bad of [0, 100, -1, 1.5, NaN, Infinity, "", "abc", "4.2", "1e1", null, undefined, true, [5], {}]) {
    assert.equal(parseTicket(bad), null, `expected null for ${String(bad)}`);
  }
});

test("nextBackgroundName rotates through the list", () => {
  const bgs = ["a.jpeg", "b.jpeg", "c.jpeg"];
  assert.equal(nextBackgroundName(bgs, "a.jpeg"), "b.jpeg");
  assert.equal(nextBackgroundName(bgs, "c.jpeg"), "a.jpeg");
  assert.equal(nextBackgroundName(bgs, "missing.jpeg"), "a.jpeg");
  assert.equal(nextBackgroundName([], "a.jpeg"), undefined);
});

test("isImageFile keeps images and drops system files", () => {
  assert.ok(isImageFile("background.jpeg"));
  assert.ok(isImageFile("photo.PNG"));
  assert.ok(!isImageFile(".DS_Store"));
  assert.ok(!isImageFile("notes.txt"));
  assert.ok(!isImageFile("._background.jpeg"));
});

test("isSoundFile keeps common audio formats and drops the rest", () => {
  const { isSoundFile } = require("./queue");
  for (const ok of ["a.mp3", "b.WAV", "c.ogg", "d.m4a", "e.aac", "f.oga"]) assert.ok(isSoundFile(ok), ok);
  for (const bad of ["a.txt", ".hidden.mp3", "mp3", "a.mp3.exe"]) assert.ok(!isSoundFile(bad), bad);
});
