const test = require("node:test");
const assert = require("node:assert/strict");
const { readText, readJson, exists } = require("../helpers");

const root = "Library/Book 02 - Survey of the Lives of the Infallible Imams";

test("Book 02 no longer depends on the removed study_book02.json", () => {
  assert.equal(exists(root + "/data/study_book02.json"), false);
  for (const relativePath of [
    root + "/study_guide/study.html",
    root + "/mind_maps/book02_interactive.html"
  ]) {
    const text = readText(relativePath);
    assert.equal(text.includes("study_book02.json"), false, relativePath + " still references removed study_book02.json");
  }
});

test("Book 02 pages use the canonical nested chunks architecture", () => {
  const study = readText(root + "/study_guide/study.html");
  const mindMap = readText(root + "/mind_maps/book02_interactive.html");

  assert.match(study, /data\/chunks\.json/);
  assert.match(study, /u\.chunks/);
  assert.doesNotMatch(study, /u\.concepts/);
  assert.doesNotMatch(study, /u\.terms/);
  assert.doesNotMatch(study, /claim_examples/);

  assert.match(mindMap, /\.\.\/data\/chunks\.json/);
  assert.match(mindMap, /u\.chunks/);
  assert.doesNotMatch(mindMap, /study_book02\.json/);
  assert.doesNotMatch(mindMap, /u\.concepts/);
  assert.doesNotMatch(mindMap, /u\.terms/);
  assert.doesNotMatch(mindMap, /claim_examples/);
});

test("Book 02 page data references match the manifest", () => {
  const manifest = readJson("assets/books.json");
  const book = manifest.books.find(b => b.id === "book02");
  assert.ok(book, "Book 02 missing from manifest");
  assert.equal(book.data.chunks, "data/chunks.json");
  assert.equal(book.data.questions, "exam_bank/questions.json");
  assert.equal(book.data.glossary, "data/glossary.json");
});


test("Book 02 Chapter 1 counterfactual Istidlal bank is complete and traceable", () => {
  const manifest = readJson("assets/books.json");
  const book = manifest.books.find(b => b.id === "book02");
  assert.equal(book.data.counterfactuals, "counterfactuals/chapter-01.json");

  const root = "Library/Book 02 - Survey of the Lives of the Infallible Imams/";
  const bank = readJson(root + book.data.counterfactuals);
  assert.equal(bank.book_id, "book02");
  assert.equal(bank.counterfactuals.length, 34);
  assert.equal(bank.coverage.concepts_covered, 13);

  const counts = new Map();
  for (const item of bank.counterfactuals) {
    assert.match(item.id, /^cf-u02-/);
    assert.equal(item.unit_id, "u02");
    assert.match(item.skill, /^counterfactual-istidlal$/);
    assert.ok(item.prompt.length >= 80, item.id + " prompt is too short");
    assert.ok(item.answer.length >= 120, item.id + " answer is too short");
    assert.ok(item.istidlal_takeaway.length >= 30, item.id + " takeaway is too short");
    assert.ok(item.source_ids.length >= 2, item.id + " needs multiple sources");
    for (const sourceId of item.source_ids) assert.ok(bank.source_catalog[sourceId], item.id + " has unknown source " + sourceId);
    counts.set(item.concept_chunk_id, (counts.get(item.concept_chunk_id) || 0) + 1);
  }
  assert.equal(counts.size, 13);
  for (const [chunkId, count] of counts) assert.ok(count >= 2, chunkId + " has fewer than 2 counterfactuals");
});
