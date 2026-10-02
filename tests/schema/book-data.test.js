const test = require("node:test");
const assert = require("node:assert/strict");
const { readJson, canonicalBooks, bookRoot } = require("../helpers");

test("every canonical book has valid canonical learning data", () => {
  for (const book of canonicalBooks()) {
    const root = bookRoot(book);
    const data = readJson(root + "/" + book.data.chunks);

    assert.equal(typeof data.book_id, "string", root + ": missing book_id");
    assert.equal(data.book_id, book.id, root + ": book_id does not match manifest");
    assert.ok(Array.isArray(data.units), root + ": units must be an array");
    assert.ok(data.units.length > 0, root + ": canonical book must have at least one unit");

    const unitIds = new Set();
    const chunkIds = new Set();
    let chunkCount = 0;

    for (const unit of data.units) {
      assert.equal(typeof unit.id, "string", root + ": unit missing id");
      assert.ok(!unitIds.has(unit.id), root + ": duplicate unit id " + unit.id);
      unitIds.add(unit.id);

      assert.equal(typeof unit.title, "string", root + ": unit missing title " + unit.id);
      assert.ok(Array.isArray(unit.chunks), root + ": unit.chunks must be an array: " + unit.id);

      for (const chunk of unit.chunks) {
        chunkCount++;
        assert.equal(typeof chunk.id, "string", root + ": chunk missing id in " + unit.id);
        assert.ok(!chunkIds.has(chunk.id), root + ": duplicate chunk id " + chunk.id);
        chunkIds.add(chunk.id);

        assert.equal(typeof chunk.title, "string", root + ": chunk missing title " + chunk.id);
        assert.equal(typeof chunk.text, "string", root + ": chunk missing text " + chunk.id);
        assert.equal(typeof chunk.order, "number", root + ": chunk missing numeric order " + chunk.id);
        assert.equal(typeof chunk.source_url, "string", root + ": chunk missing source_url " + chunk.id);
        assert.ok(chunk.source_url.length > 0, root + ": empty source_url " + chunk.id);
        assert.doesNotThrow(() => new URL(chunk.source_url), root + ": invalid source_url " + chunk.id);
        assert.ok(["high", "medium", "low"].includes(chunk.importance), root + ": invalid importance " + chunk.id);
      }
    }

    assert.ok(chunkCount > 0, root + ": canonical book must have at least one chunk");
  }
});

test("canonical learning data does not contain removed parallel chunk schemas", () => {
  for (const book of canonicalBooks()) {
    const data = readJson(bookRoot(book) + "/" + book.data.chunks);
    assert.equal(Object.prototype.hasOwnProperty.call(data, "chunks"), false, book.id + ": top-level chunks must not exist");
    for (const unit of data.units) {
      assert.equal(Object.prototype.hasOwnProperty.call(unit, "concepts"), false, book.id + ": legacy concepts field remains");
      assert.equal(Object.prototype.hasOwnProperty.call(unit, "terms"), false, book.id + ": legacy terms field remains");
      assert.equal(Object.prototype.hasOwnProperty.call(unit, "claim_examples"), false, book.id + ": legacy claim_examples field remains");
      assert.ok(Array.isArray(unit.chunks), book.id + ": canonical chunks must remain nested under units");
    }
  }
});
