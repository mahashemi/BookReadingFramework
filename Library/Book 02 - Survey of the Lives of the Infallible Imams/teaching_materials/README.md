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

**Fresh PDF build:** every PR compiles `main.tex` twice and uploads the resulting `main.pdf` as the `book02-teaching-deck` workflow artifact. Download that artifact from the PR's **Checks → Compile Book 02 teaching deck** run to review the compiled slides; do not assume a stale checked-in PDF reflects current source edits.

## Chapter-coverage audit

The teaching deck has been checked against the canonical unit inventory in `data/chunks.json`. It covers the Introduction and every numbered chapter, with explicit visual divider slides at each source-chapter boundary.

| Source chapter | Deck location |
|---|---|
| Introduction: comparison of the Imams' methods | `sections/00_intro.tex` |
| Chapter 1: 'Ali's Struggles | `sections/01_ali.tex` |
| Chapter 2: Imam al-Hassan's Pacifism (Sessions 1–2) | `sections/02_hassan.tex` |
| Chapter 3: Zayn al-'Abidin | `sections/03_spiritual_resistance.tex` |
| Chapter 4: al-Sadiq and vicegerency | `sections/04_political_openings.tex` |
| Chapter 5: Musa al-Kazim's martyrdom | `sections/03_spiritual_resistance.tex` |
| Chapter 6: al-Rida as crown prince (Sessions 1–2) | `sections/04_political_openings.tex` |
| Chapter 7: al-Hassan al-'Askari | `sections/05_askari.tex` |
| Chapter 8, Part 1: Universal Justice | `sections/06_justice_mahdi.tex` |
| Chapter 8, Part 2: The Promised al-Mahdi | `sections/06_justice_mahdi.tex` |

Chapters 3/5 and 4/6 share thematic source files, but the presentation marks each source chapter separately. Chapter 8's two parts are also separated. The Foreword is intentionally omitted from the teaching sequence; the Introduction is the conceptual starting point. Whole-book retrieval slides and the speaker script/teaching guide provide synthesis beyond the slide text.

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
