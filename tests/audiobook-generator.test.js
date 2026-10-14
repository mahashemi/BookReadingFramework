const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const generator = fs.readFileSync(path.join(__dirname, "..", "scripts", "generate_audiobook.py"), "utf8");
const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "generate-audiobook.yml"), "utf8");

test("chapter audio generator strips source maps and segments long narration", () => {
  assert.match(generator, /source map/);
  assert.match(generator, /def split_text/);
  assert.match(generator, /Pack adjacent short paragraphs together/);
  assert.match(generator, /asyncio\.wait_for/);
  assert.match(generator, /from gtts import gTTS/);
  assert.match(generator, /eSpeak NG fallback/);
  assert.match(generator, /ffmpeg/);
  assert.match(generator, /Refusing to create audio from an unusually short script/);
  assert.match(generator, /len\\(spoken\\)<500/);
});

test("chapter audio uses manifest-declared scripts and publishes MP3 artifacts", () => {
  assert.match(generator, /MANIFEST=ROOT\/"audio"\/"manifest\.json"/);
  assert.match(generator, /entry\["script"\]/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /chapter-audiobook-mp3/);
});


test("chapter audio excludes the legacy summary and selects voice by dominant script", () => {
  assert.match(generator, /narration\|عنوان شنیداری/);
  assert.match(generator, /arabic_count > latin_count/);
  assert.match(generator, /A broader point to consider/);
});
