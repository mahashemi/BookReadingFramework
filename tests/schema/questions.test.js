const test = require("node:test");
const assert = require("node:assert/strict");
const { readJson, canonicalBooks, bookRoot } = require("../helpers");

test("every canonical book has a non-empty canonical question bank", () => {
  for (const book of canonicalBooks()) {
    const root = bookRoot(book);
    const bank = readJson(root + "/" + book.data.questions);
    assert.ok(Array.isArray(bank.questions), root + ": questions must be an array");
    assert.ok(bank.questions.length > 0, root + ": canonical question bank is empty");
  }
});

test("question-bank references resolve to canonical units", () => {
  for (const book of canonicalBooks()) {
    const root = bookRoot(book);
    const data = readJson(root + "/" + book.data.chunks);
    const bank = readJson(root + "/" + book.data.questions);
    const unitIds = new Set(data.units.map(u => u.id));
    const questionIds = new Set();

    for (const q of bank.questions) {
      assert.equal(typeof q.id, "string", root + ": question missing id");
      assert.ok(!questionIds.has(q.id), root + ": duplicate question id " + q.id);
      questionIds.add(q.id);
      assert.equal(typeof q.type, "string", root + ": question missing type " + q.id);
      assert.equal(typeof q.prompt, "string", root + ": question missing prompt " + q.id);
      assert.equal(typeof q.answer, "string", root + ": question missing answer " + q.id);

      if (q.unit_id !== undefined) {
        assert.ok(unitIds.has(q.unit_id), root + ": question " + q.id + " references unknown unit " + q.unit_id);
      }
      if (q.unit_ids !== undefined) {
        assert.ok(Array.isArray(q.unit_ids), root + ": question " + q.id + " unit_ids must be an array");
        for (const unitId of q.unit_ids) {
          assert.ok(unitIds.has(unitId), root + ": question " + q.id + " references unknown unit " + unitId);
        }
      }
      assert.ok(q.unit_id !== undefined || q.unit_ids !== undefined, root + ": question " + q.id + " has no unit reference");
    }
  }
});


test("Book 02 Session 2 deep-reading questions live in the canonical question bank", () => {
  const root = "Library/Book 02 - Survey of the Lives of the Infallible Imams";
  const bank = readJson(root + "/exam_bank/questions.json");
  const data = readJson(root + "/data/chunks.json");
  const unit = data.units.find(u => u.id === "u06");
  assert.ok(unit, "canonical Chapter 4 unit u06 must exist");
  const chunkIds = new Set(unit.chunks.map(chunk => chunk.id));
  const questions = bank.questions.filter(q => q.unit_id === "u06" && q.session === "Session 2");
  assert.ok(questions.length >= 20, "Session 2 deep-reading questions should be in the canonical bank");

  const ids = new Set();
  const categories = new Set();
  for (const q of questions) {
    assert.ok(!ids.has(q.id), "duplicate Session 2 question id " + q.id);
    ids.add(q.id);
    assert.equal(typeof q.prompt, "string");
    assert.ok(q.prompt.length > 40, "question should require more than recall");
    assert.equal(typeof q.answer, "string");
    assert.ok(q.answer.length > 100, "model answer should show the reasoning");
    assert.ok(chunkIds.has(q.source_chunk_id), "unknown source chunk " + q.source_chunk_id);
    assert.ok(Array.isArray(q.source_chunk_ids) && q.source_chunk_ids.includes(q.source_chunk_id));
    assert.ok(q.source_url.startsWith("https://al-islam.org/"));
    categories.add(q.category);
  }
  for (const category of ["Concept deepening", "Istidlal", "Unit synthesis"]) {
    assert.ok(categories.has(category), "missing question category " + category);
  }
});
