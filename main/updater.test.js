const test = require("node:test");
const assert = require("node:assert/strict");
const { notesToText } = require("./updater");

test("notesToText turns GitHub release HTML into plain text", () => {
  const html = "<h2>Novidades</h2><ul><li>Fotografias &amp; pastas</li><li>Som novo</li></ul>";
  assert.equal(notesToText(html), "Novidades\n• Fotografias & pastas\n• Som novo");
});

test("notesToText drops tags, so nothing can be injected", () => {
  assert.equal(notesToText('<img src=x onerror="alert(1)">Olá<script>x</script>'), "Oláx");
});

test("notesToText handles lists of notes, empty input and very long notes", () => {
  assert.equal(notesToText([{ note: "<p>A</p>" }, { note: "<p>B</p>" }]), "A\n\nB");
  assert.equal(notesToText(null), "");
  assert.equal(notesToText("x".repeat(5000)).length, 2000);
});
