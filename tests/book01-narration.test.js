const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "audio", "manifest.json"), "utf8"));

test("Book 01 exposes all 24 substantial narration scripts", () => {
  const units = manifest.books.book01.units;
  assert.equal(Object.keys(units).length, 24);
  for (const [unitId, entry] of Object.entries(units)) {
    const script = fs.readFileSync(path.join(root, entry.script), "utf8");
    assert.ok(script.length >= 1800, unitId + " narration is too short");
    assert.match(script, /## Source map/);
    assert.match(script, /## Deep Reading Insight/);
    assert.match(script, /## Reflection/);
  }
});
