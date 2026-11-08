const test = require("node:test");
const assert = require("node:assert/strict");
const { readJson, exists } = require("../helpers");

const root = "Library/Book 02 - Survey of the Lives of the Infallible Imams";
const revisionFiles = [
  "chapter-8-part-2.json",
  "chapter-8-part-1.json",
  "chapter-7.json",
  "chapter-6-session-2.json",
  "chapter-6-session-1.json",
  "chapter-5.json",
  "chapter-4.json",
  "chapter-3.json",
  "chapter-2-session-2.json",
  "chapter-2-session-1.json",
  "chapter-1.json",
  "introduction.json"
];

test("Book 02 reverse-order revision bank is complete, source-traceable, and exam-ready", () => {
  const chunks = readJson(root + "/data/chunks.json");
  const unitIds = new Set(chunks.units.map(unit => unit.id));
  const chunkIds = new Set(chunks.units.flatMap(unit => unit.chunks.map(chunk => chunk.id)));
  const seen = new Set();
  let total = 0;

  for (const file of revisionFiles) {
    const path = root + "/exam_bank/revisions/" + file;
    assert.ok(exists(path), "missing revision file: " + file);
    const revision = readJson(path);
    assert.equal(revision.book_id, "book02", file + " has wrong book id");
    assert.ok(revision.source && revision.source.url.startsWith("https://al-islam.org/"), file + " needs its original source URL");
    assert.ok(Array.isArray(revision.replace_unit_ids) && revision.replace_unit_ids.length, file + " must explicitly replace old unit questions");
    assert.ok(Array.isArray(revision.questions) && revision.questions.length >= 20, file + " needs a substantive question set");

    const unitTitle = revision.questions[0].unit_title;
    for (const q of revision.questions) {
      total++;
      assert.equal(typeof q.id, "string", file + " question missing id");
      assert.ok(!seen.has(q.id), "duplicate revision question id: " + q.id);
      seen.add(q.id);
      assert.equal(typeof q.prompt, "string");
      assert.ok(q.prompt.length >= 35, q.id + " prompt is too short");
      assert.equal(typeof q.answer, "string");
      assert.ok(q.answer.length >= 20, q.id + " answer is missing or too short");
      assert.ok(unitIds.has(q.unit_id), q.id + " references an unknown reading unit");
      assert.ok(revision.replace_unit_ids.includes(q.unit_id), q.id + " is outside its declared replacement unit");
      assert.ok(q.source_url && q.source_url.startsWith("https://al-islam.org/"), q.id + " needs a source URL");
      assert.ok(q.source_chunk_id, q.id + " needs a source chunk id");
      assert.ok(chunkIds.has(q.source_chunk_id), q.id + " references an unknown canonical source chunk");
      assert.ok(q.source_locator, q.id + " needs a human-readable source locator");
      if (q.type === "SHORT" || q.type === "LONG") {
        assert.ok(q.answer.split(/\\s+/).length >= 35, q.id + " written model answer is too brief for exam preparation");
      }
      if (q.type === "MCQ" || q.type === "FILL") {
        assert.ok(Array.isArray(q.options) && q.options.length >= 3, q.id + " objective question needs at least three options");
        assert.ok(q.options.includes(q.answer), q.id + " answer must match one option exactly");
      }
    }
    assert.ok(unitTitle, file + " has no unit title");
  }
  assert.equal(total, 344, "the 12 revised units should retain the audited 344-question set");
});

test("Book 02 unit and mock practice pages enforce attempt-first answers and objective marking", () => {
  const root = "Library/Book 02 - Survey of the Lives of the Infallible Imams/exam_bank/";
  const unit = require("fs").readFileSync(root + "unit_tests.html", "utf8");
  const mock = require("fs").readFileSync(root + "full_book_exam_generator.html", "utf8");
  const interleaved = require("fs").readFileSync(root + "interleaved_exam_generator.html", "utf8");
  for (const [name, html] of [["unit", unit], ["mock", mock], ["interleaved", interleaved]]) {
    assert.match(html, /Attempt this question first/, name + " must require an attempt before revealing a model answer");
    assert.match(html, /Mark objective answers|Mark objective answers/, name + " must support objective scoring");
    assert.match(html, /source_url/, name + " must preserve source links");
  }
  assert.match(unit, /sort\(unitSort\)/, "unit practice should start with the latest reading unit");
  assert.match(mock, /Final Seven Reading Units/, "half-book practice should start from the latest units");
});
