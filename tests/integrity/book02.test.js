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
  assert.equal(book.data.counterfactuals, "counterfactuals/all-chapters.json");

  const root = "Library/Book 02 - Survey of the Lives of the Infallible Imams/";
  const bank = readJson(root + book.data.counterfactuals);
  assert.equal(bank.book_id, "book02");
  assert.equal(bank.counterfactuals.length, 29, "keep a concise curated set across every chapter");
  assert.equal(bank.coverage.concepts_covered, 29);

  const chunks = readJson(root + "data/chunks.json");
  const canonicalChunkIds = new Set(chunks.units.flatMap(unit => unit.chunks.map(chunk => chunk.id)));
  const canonicalUnitByChunk = new Map(chunks.units.flatMap(unit => unit.chunks.map(chunk => [chunk.id, unit.id])));
  const expectedUnits = chunks.units.filter(unit => /^u(?:0[1-9]|1[0-2])$/.test(unit.id)).map(unit => unit.id);
  for (const unitId of expectedUnits) assert.ok(bank.counterfactuals.some(item => item.unit_id === unitId), unitId + " has no Istidlal questions");
  const counts = new Map();
  for (const item of bank.counterfactuals) {
    assert.ok(canonicalChunkIds.has(item.concept_chunk_id), item.id + " references an unknown canonical chunk");
    assert.equal(canonicalUnitByChunk.get(item.concept_chunk_id), item.unit_id, item.id + " references a chunk in another unit");
    assert.match(item.skill, /^counterfactual-istidlal$/);
    assert.ok(item.prompt.length >= 80, item.id + " prompt is too short");
    assert.ok(item.answer.length >= 120, item.id + " answer is too short");
    assert.ok(item.answer.includes("](https://"), item.id + " needs an inline clickable reference");
    assert.ok(item.istidlal_takeaway.length >= 30, item.id + " takeaway is too short");
    assert.ok(item.source_ids.length >= 2, item.id + " needs multiple sources");
    for (const sourceId of item.source_ids) {
      assert.ok(bank.source_catalog[sourceId], item.id + " has unknown source " + sourceId);
      assert.ok(bank.source_catalog[sourceId].url.startsWith("https://"), sourceId + " must use HTTPS");
    }
    counts.set(item.concept_chunk_id, (counts.get(item.concept_chunk_id) || 0) + 1);
  }
  assert.equal(counts.size, 29, "each curated question should anchor a distinct concept chunk");
  assert.ok(bank.counterfactuals.some(item => item.source_ids.some(id => id.startsWith("quran-"))), "include Qur'anic evidence where relevant");
  assert.ok(bank.counterfactuals.some(item => item.source_ids.some(id => id.startsWith("nahj-"))), "include hadith evidence where relevant");
  assert.equal(bank.coverage.selection_policy, "Curated for distinct learning value; no quota per concept.");
});


test("Book 02 Counterfactual Istidlal is rendered in the shared unit experience", () => {
  const app = readText("assets/app.js");
  assert.match(app, /counterfactual-istidlal/);
  assert.match(app, /meta\.data\.counterfactuals/);
  assert.match(app, /Reveal the reasoning/);
  assert.match(app, /istidlal_takeaway/);
  assert.match(app, /source_catalog/);
});

test("Book 02 teaching deck clearly separates the source chapters", () => {
  const root = "Library/Book 02 - Survey of the Lives of the Infallible Imams/teaching_materials/";
  const main = readText(root + "main.tex");
  assert.match(main, /\\newcommand\{\\chapterdivider\}/);

  const deck = [
    "sections/00_intro.tex",
    "sections/01_ali.tex",
    "sections/02_hassan.tex",
    "sections/03_spiritual_resistance.tex",
    "sections/04_political_openings.tex",
    "sections/05_askari.tex",
    "sections/06_justice_mahdi.tex"
  ].map(path => readText(root + path)).join("\n");

  for (const label of [
    "\\chapterdivider{Introduction}",
    "\\chapterdivider{Chapter 1}",
    "\\chapterdivider{Chapter 2}",
    "\\chapterdivider{Chapter 3}",
    "\\chapterdivider{Chapter 4}",
    "\\chapterdivider{Chapter 5}",
    "\\chapterdivider{Chapter 6}",
    "\\chapterdivider{Chapter 7}",
    "\\chapterdivider{Chapter 8 — Part 1}",
    "\\chapterdivider{Chapter 8 — Part 2}"
  ]) assert.ok(deck.includes(label), "missing chapter divider: " + label);
});

test("Book 02 deck teaches the missing core topics identified in the completeness audit", () => {
  const root = "Library/Book 02 - Survey of the Lives of the Infallible Imams/teaching_materials/sections/";
  const political = readText(root + "04_political_openings.tex");
  const justice = readText(root + "06_justice_mahdi.tex");
  assert.match(political, /The Double Letter: Who Was Really Being Offered Power/);
  assert.match(political, /What Is Certain—and What Is Interpretation/);
  assert.match(justice, /The Promised Age: Justice in Public Life/);
  assert.match(justice, /Long Life and al-Qa'im/);
  assert.match(justice, /Evidence, Claimants, and Political Appropriation/);
});
