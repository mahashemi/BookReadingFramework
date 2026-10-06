const test = require("node:test");
const assert = require("node:assert/strict");
const { readText, canonicalBooks, bookRoot } = require("../helpers");

test("canonical study guides and mind maps contain no stale legacy data paths", () => {
  for (const book of canonicalBooks()) {
    const root = bookRoot(book);
    const studyPath = root + "/" + (book.links.studyGuide || "study_guide/study.html");
    const mindMapPath = root + "/" + (book.links.mindMap || "mind_maps/book02_interactive.html");

    const study = readText(studyPath);
    const mindMap = readText(mindMapPath);

    assert.doesNotMatch(study, /study_book[A-Za-z0-9_-]*\.json/, book.id + ": stale study JSON reference");
    assert.doesNotMatch(mindMap, /study_book[A-Za-z0-9_-]*\.json/, book.id + ": stale study JSON reference");
    assert.doesNotMatch(study, /\bu\.concepts\b/, book.id + ": stale concepts field reference");
    assert.doesNotMatch(study, /\bu\.terms\b/, book.id + ": stale terms field reference");
    assert.doesNotMatch(mindMap, /\bu\.concepts\b/, book.id + ": stale concepts field reference");
    assert.doesNotMatch(mindMap, /\bu\.terms\b/, book.id + ": stale terms field reference");
  }
});

test("the shared hub renderer (assets/app.js) contains no stale legacy data paths", () => {
  // assets/app.js renders the library page and every book's hub/unit pages --
  // it is not book-specific, so it's checked once here rather than per book,
  // but it's exactly as important to keep clean as study.html and the mind
  // map above: this is the file a browser actually loads for every /book/ URL.
  const app = readText("assets/app.js");
  assert.doesNotMatch(app, /study_book[A-Za-z0-9_-]*\.json/, "assets/app.js: stale study JSON reference");
  assert.doesNotMatch(app, /\bu\.concepts\b/, "assets/app.js: stale concepts field reference");
  assert.doesNotMatch(app, /\bu\.terms\b/, "assets/app.js: stale terms field reference");
  assert.doesNotMatch(app, /\bclaim_examples\b/, "assets/app.js: stale claim_examples field reference");
});
