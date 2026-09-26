# Book 02 — Teaching Materials

Teacher-facing material for **A Survey into the Lives of the Infallible Imams**.

## Use this folder by purpose

### Teach the book
- **BOOK02_TEACHING_GUIDE.md** — complete teaching architecture, session blocks, warnings, and high-value questions.
- **BOOK02_TALK_SCRIPT_AND_EXAM_QUESTIONS.md** — speaker-ready explanations for 8 teaching sessions plus exam bridges.

### Build a lesson / lecture
- **BOOK02_LECTURE_OUTLINE.md** — 60-minute whole-book overview.

### Present
- **main.tex + talkstyle.sty + sections/*.tex** — the Beamer deck, split into one file per teaching block (mirrors the Book 01 / Polarization deck's own structure). Compile with `pdflatex main.tex` (run twice). Includes comparison tables (jihad categories, the five al-Hassan/al-Husayn contrasts, Ma'mun's five motive theories, wilayat al-ja'ir) and TikZ mind maps (essence vs. expression, the three rival theories of justice, the Mahdism historical chain, the whole-book chain). Speaker-only answers to the `\qaframe` questions are in the notes page (`pdflatex` + a PDF viewer with presenter mode, or just read `main.log`-free source directly).
  - Previous single-file `BOOK02_TEACHING_DECK.tex` and its build artifacts (`.aux/.log/.out/.fls/.fdb_latexmk`) are removed: that file never actually compiled (a fatal `enumitem`/beamer `enumerate` conflict — see the fix note in `talkstyle.sty`), and this multi-file version replaces it entirely.
  - `BOOK02_SLIDE_CONTENT.md` is removed: it was the raw markdown draft of the old deck's content, now fully superseded by the actual compiled deck above.

### Teach from the framework
The recurring method is:

**Problem → Claim → Explanation → Example/Evidence → Distinction → Implication → Exam Question**

This mirrors the Book 01 teaching approach while adapting it to the much larger Book 02 structure.

## Source alignment

Teaching material is derived from:

`data/chunks.json` → `data/study_book02.json` → teaching materials

The master question universe remains in:

`exam_bank/questions.json`

The teaching files should explain and organize the source; they should not become a disconnected second version of the book.

## Suggested workflow

**Student preparation:** study guide → unit questions → spaced review → unit tests → cumulative exams.

**Teacher preparation:** teaching guide → lecture outline → slide content → speaker script → Beamer deck.

**Final exam preparation:** master question universe → 20 simulated years → hard/worst-case paper → identify weak units → spaced review.
