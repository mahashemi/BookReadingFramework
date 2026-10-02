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
