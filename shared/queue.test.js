const test = require("node:test");
const assert = require("node:assert/strict");
const { advanceTicket, nextBackgroundName, isImageFile } = require("./queue");

test("advanceTicket counts up and wraps after 99", () => {
  assert.equal(advanceTicket(1), 2);
  assert.equal(advanceTicket(98), 99);
  assert.equal(advanceTicket(99), 1);
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
