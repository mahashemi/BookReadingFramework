const test = require("node:test");
const assert = require("node:assert/strict");
const { exists, registeredBooks, canonicalBooks, bookRoot } = require("../helpers");

test("every manifest entry points to existing files", () => {
  for (const book of registeredBooks()) {
    const root = bookRoot(book);

    if (book.status !== "legacy") {
      assert.ok(exists(root + "/" + book.data.chunks), book.id + ": missing chunks data");
      assert.ok(exists(root + "/" + book.data.questions), book.id + ": missing question bank");
      assert.ok(exists(root + "/" + book.data.glossary), book.id + ": missing glossary");
    }

    for (const [name, relativePath] of Object.entries(book.links || {})) {
      assert.ok(exists(root + "/" + relativePath), book.id + ": manifest link '" + name + "' points to missing file: " + relativePath);
    }
  }
});

test("canonical books use the declared data architecture", () => {
  for (const book of canonicalBooks()) {
    assert.equal(book.data.chunks, "data/chunks.json", book.id + ": unexpected chunks path");
    assert.equal(book.data.questions, "exam_bank/questions.json", book.id + ": unexpected questions path");
    assert.equal(book.data.glossary, "data/glossary.json", book.id + ": unexpected glossary path");
  }
});
