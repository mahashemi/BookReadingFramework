const test = require("node:test");
const assert = require("node:assert/strict");
const { readJson, canonicalBooks, bookRoot } = require("../helpers");

test("every canonical glossary is internally consistent", () => {
  for (const book of canonicalBooks()) {
    const root = bookRoot(book);
    const data = readJson(root + "/" + book.data.chunks);
    const glossary = readJson(root + "/" + book.data.glossary);

    assert.ok(Array.isArray(glossary.entries), root + ": glossary.entries must be an array");

    const unitIds = new Set(data.units.map(u => u.id));
    const chunkIds = new Set(data.units.flatMap(u => u.chunks.map(c => c.id)));
    const terms = new Set();

    for (const entry of glossary.entries) {
      assert.equal(typeof entry.term, "string", root + ": glossary entry missing term");
      assert.ok(!terms.has(entry.term), root + ": duplicate glossary term " + entry.term);
      terms.add(entry.term);

      assert.equal(typeof entry.gloss, "string", root + ": glossary entry missing gloss: " + entry.term);
      assert.ok(Array.isArray(entry.units), root + ": glossary units must be an array: " + entry.term);
      assert.ok(Array.isArray(entry.source_chunk_ids), root + ": glossary source_chunk_ids must be an array: " + entry.term);

      for (const unitId of entry.units) {
        assert.ok(unitIds.has(unitId), root + ": glossary references unknown unit " + unitId);
      }
      for (const chunkId of entry.source_chunk_ids) {
        assert.ok(chunkIds.has(chunkId), root + ": glossary references unknown chunk " + chunkId);
      }
    }
  }
});
