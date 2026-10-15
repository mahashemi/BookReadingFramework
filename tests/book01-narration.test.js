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


test("Book 02 introduction narration develops each of its five concepts", () => {
  const script = fs.readFileSync(path.join(root, "audio", "book02", "scripts", "u01.md"), "utf8");
  assert.match(script, /## A closer walk through the source/);
  assert.match(script, /### Why the Imams’ different approaches can appear contradictory/);
  assert.match(script, /### How a rich tradition can guide followers and still require careful interpretation/);
  assert.match(script, /### Why inherited custom is not automatically a religious obligation/);
  assert.match(script, /### Imam al-Sadiq on clothing, circumstance, and the spirit of religion/);
  assert.match(script, /### Imam ‘Ali’s explanation of the beard-dyeing instruction/);
  assert.ok(script.length >= 6000, "introduction narration should include the detailed concept walkthrough");
});


test("Book 02 Session 1 narration distinguishes all three jurisprudential cases of jihad", () => {
  const script = fs.readFileSync(path.join(root, "audio", "book02", "scripts", "u03.md"), "utf8");
  assert.match(script, /The cases for jihad in the Shi‘ah jurisprudence — Offensive jihad and authorization/);
  assert.match(script, /The cases for jihad in the Shi‘ah jurisprudence — Defense against an attack/);
  assert.match(script, /The cases for jihad in the Shi‘ah jurisprudence — Personal defense and differing levels of risk/);
  assert.match(script, /This completes the chapter['’]s three-way distinction/);
});


test("Book 02 detailed narration walkthroughs have one section per canonical concept", () => {
  const book = JSON.parse(fs.readFileSync(path.join(root, "Library", "Book 02 - Survey of the Lives of the Infallible Imams", "data", "chunks.json"), "utf8"));
  const bookManifest = manifest.books.book02;
  for (const unit of book.units) {
    if (unit.id === "u00") continue; // The foreword is one short framing concept, not a chapter walkthrough.
    const entry = bookManifest.units[unit.id];
    const script = fs.readFileSync(path.join(root, entry.script), "utf8");
    const walkthrough = script.split("## A closer walk through the source")[1]?.split(/\n## (?:Bringing the thread together|Source map)/)[0];
    assert.ok(walkthrough, unit.id + " has no detailed concept walkthrough");
    const sectionCount = [...walkthrough.matchAll(/^###\s+.+$/gm)].length;
    assert.equal(sectionCount, unit.chunks.length, unit.id + " walkthrough headings do not cover every canonical concept exactly once");
  }
});


test("Book 01 closing unit contains source-grounded concepts, not a truncation placeholder", () => {
  const book = JSON.parse(fs.readFileSync(path.join(root, "Library", "Book 01 - Polarization Around _Ali", "data", "chunks.json"), "utf8"));
  const unit = book.units.find(item => item.id === "u24");
  const script = fs.readFileSync(path.join(root, "audio", "book01", "scripts", "u24.md"), "utf8");
  assert.ok(unit);
  assert.doesNotMatch(script, /coverage note|source text was truncated/i);
  for (const chunk of unit.chunks) assert.ok(script.includes(chunk.title), "narration omits concept title: " + chunk.id);
  const sourceMap = script.split("## Source map")[1] || "";
  const ids = [...sourceMap.matchAll(/b01-u24-\\d{3}/g)].map(match => match[0]);
  assert.deepEqual([...ids].sort(), unit.chunks.map(chunk => chunk.id).sort());
});
