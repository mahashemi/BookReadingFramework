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
  assert.match(narration, /function transcriptSections\(script\)/);
  assert.match(narration, /function transcriptHeading\(section\)/);
  assert.match(narration, /narration-reading-time/);
  assert.match(narration, /Estimated reading time: about/);
  assert.match(narration, /The spoken content matches the transcript below/);
});

test("narration converts editorial section labels into listener-friendly transitions", () => {
  assert.match(narration, /A broader point to consider\./);
  assert.match(narration, /Now, pause and reflect\./);
  assert.match(narration, /As we move forward, keep this question in mind\./);
  assert.match(narration, /spokenSubheading\(title\)/);
  assert.match(narration, /function speechPieces\(text, maxChars = 1100\)/);
  assert.match(narration, /const speakNext\s*=\s*\(\)\s*=>/);
  assert.match(narration, /window\.speechSynthesis\.speak\(utterance\)/);
  assert.doesNotMatch(narration, /state\.utterances\.forEach\(u=>window\.speechSynthesis\.speak\(u\)\)/);
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


test("Istidlal questions visibly link to their prerequisite concept", () => {
  assert.match(app, /Read this concept first:/);
  assert.match(app, /x\.concept_chunk_id/);
  assert.match(app, /conceptUnit\?\.chunks\?\.find/);
  assert.match(app, /#concept-/);
});

test("every Book 02 Istidlal question maps to a canonical concept in its stated unit", () => {
  const bookDir = path.join(__dirname, "..", "Library", "Book 02 - Survey of the Lives of the Infallible Imams");
  const bank = JSON.parse(fs.readFileSync(path.join(bookDir, "counterfactuals", "all-chapters.json"), "utf8"));
  const book = JSON.parse(fs.readFileSync(path.join(bookDir, "data", "chunks.json"), "utf8"));
  const units = new Map(book.units.map(unit => [unit.id, unit]));
  assert.equal(bank.counterfactuals.length, 72);
  for (const question of bank.counterfactuals) {
    const unit = units.get(question.unit_id);
    assert.ok(unit, question.id + " must reference an existing reading unit");
    const concept = unit.chunks.find(chunk => chunk.id === question.concept_chunk_id);
    assert.ok(concept, question.id + " must reference a canonical concept in the same unit");
    assert.ok(concept.title.trim(), question.id + " prerequisite concept must have a readable title");
  }
});


test("narration playback is cancelled and rebuilt when the selected unit changes", () => {
  assert.match(narration, /state\.currentKey !== key/);
  assert.match(narration, /panel\?\.remove\(\)/);
  assert.match(narration, /state\.loadingKey === key/);
  assert.match(narration, /cache: 'no-store'/);
  assert.match(narration, /narration:routechange/);
});
test("Book 01 and Book 02 concept links carry source-section fragments", () => {
  for (const [bookId, folder] of [["book01","Book 01 - Polarization Around _Ali"],["book02","Book 02 - Survey of the Lives of the Infallible Imams"]]) {
    const file = path.join(__dirname, "..", "Library", folder, "data", "chunks.json");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const unit of data.units) for (const chunk of unit.chunks || []) {
      assert.ok(chunk.source_url.startsWith("https://al-islam.org/"), bookId + " " + chunk.id);
      assert.ok(chunk.source_url.includes("#"), bookId + " " + chunk.id);
    }
  }
});


test("Book 02 peace concepts link to the corresponding original source subsections", () => {
  const file = path.join(__dirname, "..", "Library", "Book 02 - Survey of the Lives of the Infallible Imams", "data", "chunks.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const unit = data.units.find(u => u.id === "u03");
  const expected = {
    "b02-u03-002": "the-holy-prophet-s-and-peace",
    "b02-u03-003": "ali-and-peace",
    "b02-u03-004": "the-cases-for-jihad-in-the-shiah-jurisprudence",
    "b02-u03-005": "fighting-rebels",
    "b02-u03-006": "peace-in-the-shiah-jurisprudence"
  };
  for (const [id, fragment] of Object.entries(expected)) {
    const concept = unit.chunks.find(c => c.id === id);
    assert.ok(concept, id + " exists");
    assert.equal(new URL(concept.source_url).hash.slice(1), fragment, id + " links to its source subsection");
  }
});
