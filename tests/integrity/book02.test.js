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
