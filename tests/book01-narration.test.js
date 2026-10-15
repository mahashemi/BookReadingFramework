const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "audio", "manifest.json"), "utf8"));

test("Book 01 exposes all 24 substantial narration scripts", () => {
  const units = manifest.books.book01.units;
  assert.equal(Object.keys(units).length, 24);
  for (const [unitId, entry] of Object.entries(units)) {
    const script = fs.readFileSync(path.join(root, entry.script), "utf8");
    assert.ok(script.length >= 1800, unitId + " narration is too short");
    assert.match(script, /## Source map/);
    assert.match(script, /## Deep Reading Insight/);
    assert.match(script, /## Reflection/);
  }
});


test("Book 02 narration source maps cover every canonical concept exactly once", () => {
  const book = JSON.parse(fs.readFileSync(path.join(root, "Library", "Book 02 - Survey of the Lives of the Infallible Imams", "data", "chunks.json"), "utf8"));
  const bookManifest = manifest.books.book02;
  assert.equal(Object.keys(bookManifest.units).length, book.units.length);
  for (const unit of book.units) {
    const entry = bookManifest.units[unit.id];
    assert.ok(entry, unit.id + " is missing from the audio manifest");
    const script = fs.readFileSync(path.join(root, entry.script), "utf8");
    const sourceMap = script.match(/^## Source map\s*\n([\s\S]*)$/m);
    assert.ok(sourceMap, unit.id + " narration has no source map");
    const ids = [...sourceMap[1].matchAll(/b02-u\d{2}-\d{3}/g)].map(match => match[0]);
    assert.equal(new Set(ids).size, ids.length, unit.id + " repeats a source-map ID");
    assert.deepEqual([...ids].sort(), unit.chunks.map(chunk => chunk.id).sort(), unit.id + " source map does not match canonical concepts");
  }
});


test("Book 02 Session 1 narration distinguishes all three jurisprudential cases of jihad", () => {
  const script = fs.readFileSync(path.join(root, "audio", "book02", "scripts", "u03.md"), "utf8");
  assert.match(script, /The cases for jihad in the Shi‘ah jurisprudence — Offensive jihad and authorization/);
  assert.match(script, /The cases for jihad in the Shi‘ah jurisprudence — Defense against an attack/);
  assert.match(script, /The cases for jihad in the Shi‘ah jurisprudence — Personal defense and differing levels of risk/);
  assert.match(script, /This completes the chapter’s three-way distinction/);
});
