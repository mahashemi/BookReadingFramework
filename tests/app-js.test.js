const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appPath = path.join(__dirname, "..", "assets", "app.js");
const app = fs.readFileSync(appPath, "utf8");

test("app.js keeps the renderer entry points intact", () => {
  assert.match(app, /function library\(manifest, live\)/);
  assert.match(app, /function bookHome\(meta, data, qd, gl\)/);
  assert.match(app, /function unitPage\(meta, data, qd, gl, id(?:, cf)?\)/);
  assert.match(app, /async function main\(\)/);
});

test("unitPage defines its own manifest-link helper", () => {
  const start = app.indexOf("function unitPage(");
  const end = app.indexOf("/* ---------- legacy book landing", start);
  assert.ok(start >= 0 && end > start, "unitPage function must be present");
  const unitPage = app.slice(start, end);
  assert.match(unitPage, /const L = k => meta\.links\?\.\[k\]/);
  assert.doesNotMatch(unitPage, /L\s*=\s*undefined/);
});

test("source links have a canonical fallback", () => {
  assert.match(app, /const sourceHref = u\.source_url \|\| \(dir \+ \(u\.source_file \|\| ''\)\)/);
  assert.match(app, /c\.source_url \|\| sourceHref/);
});

test("optional modules stay guarded", () => {
  assert.match(app, /meta\.links\?\.\[k\]/);
  assert.match(app, /meta\.links\?\.mindMap/);
  assert.match(app, /meta\.links\?\.unitTests/);
  assert.match(app, /meta\.links\?\.fullBookExam/);
});

test("runtime error boundary remains user-visible", () => {
  assert.match(app, /The learning data could not be loaded/);
  assert.match(app, /catch \(e\)/);
});

test("footer attribution uses the canonical capitalized name", () => {
  assert.match(app, /Seyed Mohammad Abuzar/);
  assert.doesNotMatch(app, /seyed mohammad abuzar/);
});


test("library ordering and book taxonomy are explicit and deterministic", () => {
  const manifestPath = path.join(__dirname, "..", "assets", "books.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const books = manifest.books;
  assert.equal(books.length, 3);
  assert.deepEqual(books.map(b => b.order), [1, 2, 3]);
  assert.deepEqual(books.map(b => b.id), ["book01", "book02", "book03"]);
  assert.deepEqual(books.map(b => b.primary_category), ["Akhlaq", "Islamic History", "Akhlaq"]);
  for (const book of books) {
    assert.ok(Array.isArray(book.subjects) && book.subjects.length > 0, book.id + " must have subject metadata");
  }
  assert.match(app, /const books = \[\.\.\.manifest\.books\]\.sort/);
  assert.match(app, /b\.primary_category \|\| 'Unclassified'/);
});
