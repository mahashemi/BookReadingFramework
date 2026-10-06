const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function registeredBooks() {
  return readJson("assets/books.json").books || [];
}

function canonicalBooks() {
  return registeredBooks().filter(book => book.status !== "legacy");
}

function bookRoot(book) {
  return book.dir.replace(/\/$/, "");
}

module.exports = {
  ROOT,
  readText,
  readJson,
  exists,
  registeredBooks,
  canonicalBooks,
  bookRoot
};
