const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appPath = path.join(__dirname, "..", "assets", "app.js");
const app = fs.readFileSync(appPath, "utf8");

test("app.js keeps the renderer entry points intact", () => {
  assert.match(app, /function library\(manifest, live\)/);
  assert.match(app, /function bookHome\(meta, data, qd, gl\)/);
  assert.match(app, /function unitPage\(meta, data, qd, gl, id(?:, cf)?\)/);
  assert.match(app, /async function main\(\)/);
});

test("unitPage defines its own manifest-link helper", () => {
  const start = app.indexOf("function unitPage(");
  const end = app.indexOf("/* ---------- legacy book landing", start);
  assert.ok(start >= 0 && end > start, "unitPage function must be present");
  const unitPage = app.slice(start, end);
  assert.match(unitPage, /const L = k => meta\.links\?\.\[k\]/);
  assert.doesNotMatch(unitPage, /L\s*=\s*undefined/);
});

test("source links have a canonical fallback", () => {
  assert.match(app, /const sourceHref = u\.source_url \|\| \(dir \+ \(u\.source_file \|\| ''\)\)/);
  assert.match(app, /c\.source_url \|\| sourceHref/);
});

test("optional modules stay guarded", () => {
  assert.match(app, /meta\.links\?\.\[k\]/);
  assert.match(app, /meta\.links\?\.mindMap/);
  assert.match(app, /meta\.links\?\.unitTests/);
  assert.match(app, /meta\.links\?\.fullBookExam/);
});

test("runtime error boundary remains user-visible", () => {
  assert.match(app, /The learning data could not be loaded/);
  assert.match(app, /catch \(e\)/);
});

test("footer attribution uses the canonical capitalized name", () => {
  assert.match(app, /Seyed Mohammad Abuzar/);
  assert.doesNotMatch(app, /seyed mohammad abuzar/);
});


test("library ordering and book taxonomy are explicit and deterministic", () => {
  const manifestPath = path.join(__dirname, "..", "assets", "books.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const books = manifest.books;
  assert.equal(books.length, 3);
  assert.deepEqual(books.map(b => b.order), [1, 2, 3]);
  assert.deepEqual(books.map(b => b.id), ["book01", "book02", "book03"]);
  assert.deepEqual(books.map(b => b.primary_category), ["Akhlaq", "Islamic History", "Akhlaq"]);
  for (const book of books) {
    assert.ok(Array.isArray(book.subjects) && book.subjects.length > 0, book.id + " must have subject metadata");
  }
  assert.match(app, /const books = \[\.\.\.manifest\.books\]\.sort/);
  assert.match(app, /b\.primary_category \|\| 'Unclassified'/);
});

test("counterfactual answers render safe inline HTTPS references", () => {
  assert.match(app, /const linkedText = value =>/);
  assert.match(app, /linkedText\(x\.answer\)/);
  assert.match(app, /target="_blank" rel="noopener"/);
});


const narrationPath = path.join(__dirname, "..", "assets", "narration.js");
const narration = fs.readFileSync(narrationPath, "utf8");

test("narration player keeps source-map identifiers out of the transcript and spoken text", () => {
  assert.match(narration, /const sourceMapStart = md\.search\(\/\^#\{2,6\}\\s\+\(\?:source map/);
  assert.match(narration, /script\.sections\.filter\(s => !\/\^\(\?:source map/);
  assert.match(narration, /if \(\/\^\(\?:source map/);
  assert.match(narration, /Source-map IDs and editorial notes are kept out/);
});

test("narration converts editorial section labels into listener-friendly transitions", () => {
  assert.match(narration, /A broader point to consider\./);
  assert.match(narration, /Now, pause and reflect\./);
  assert.match(narration, /As we move forward, keep this question in mind\./);
  assert.match(narration, /spokenSubheading\(title\)/);
  assert.match(narration, /function speechPieces\(text, maxChars = 1100\)/);
  assert.match(narration, /state\.utterances\.forEach\(u\\s*=>\\s*window\.speechSynthesis\.speak\(u\)\)/);
});

test("narration normalizes common markdown and spoken-list punctuation", () => {
  assert.match(narration, /replace\(\/\^\\s\*\[-\+\*\]\\s\+/);
  assert.match(narration, /replace\(\/Mu\['’\]awiyah/);
  assert.match(narration, /replace\(\/Qur\['’\]an/);
  assert.match(narration, /replace\(\/Ja\['’\]far/);
  assert.match(narration, /replace\(\/al-\['’\]/);
});

test("every declared narration keeps source IDs in its editorial source-map section", () => {
  const manifestPath = path.join(__dirname, "..", "audio", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const book of Object.values(manifest.books)) {
    for (const entry of Object.values(book.units)) {
      const scriptPath = path.join(__dirname, "..", entry.script);
      const script = fs.readFileSync(scriptPath, "utf8");
      const sourceMapStart = script.search(/^#{2,6}\s+(?:source map|نقشه(?:‌| )منبع|نقشه(?:‌| )منابع)\s*$/im);
      assert.ok(sourceMapStart >= 0, entry.script + " must retain its English or Persian provenance map");
      const learningText = script.slice(0, sourceMapStart);
      assert.doesNotMatch(learningText, /\bb0[123]-u\d{2}-\d{3}\b/, entry.script + " must not narrate opaque chunk IDs");
      if (entry.script !== "audio/book02/scripts/u00.md") {
        assert.ok(learningText.length >= 1800, entry.script + " is unusually short for a Listen & Learn script; review source-concept coverage rather than defaulting to a summary");
      }
    }
  }
});
