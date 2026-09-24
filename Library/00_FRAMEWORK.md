# The Deep-Reading Framework
### A repeatable pipeline for turning any book into long-term memory
*Version 1.0 — built from "Polarization Around the Character of 'Ali ibn Abi Talib" (Mutahhari)*

---

## Why this works (the learning science, briefly)

Four things reliably move information from "read once" into durable long-term memory. Everything in this framework exists to force one of these:

| Principle | What it means | Where it shows up here |
|---|---|---|
| **Active recall** | Retrieving an answer from memory beats re-reading it | Click-to-reveal Q&A banks |
| **Spaced repetition** | Review at growing intervals, not all at once | The review tracker (Module 5) |
| **Interleaving** | Mixing topics in practice beats blocking by topic | Exam papers mix chapters, not one-per-paper |
| **Dual coding** | Visual + verbal encoding beats verbal alone | Mind maps (Module 3) |

If a study method doesn't map to one of these four, it's probably just re-reading in disguise — useful for a first pass, not for retention.

---

## The Pipeline — 7 Modules

### Module 1 — Full-Text Acquisition
Read the *entire* book before extracting anything. Partial coverage produces confident-sounding gaps — the single biggest risk in this whole process. If a source is split across editions, uploads, or missing chapters, actively search/fetch the rest before starting Module 2. Verify page/chapter counts against the book's own table of contents.

### Module 2 — Chapter-by-Chapter Extraction
For every chapter/reading-unit, extract four things:
- **Key Concepts** — the claims and ideas, in the author's logic, not just topic labels
- **Key Terms & Names** — anything a reader would need to look up, with a one-line gloss
- **Key Quotes** — the sentences worth memorizing verbatim (usually the author's own claim-statements, not the illustrating examples)
- **Questions** — tagged by type (see Module 4)

**The claim → example pattern.** Most serious non-fiction authors argue by stating a general claim, then proving it with a story, statistic, or historical case. Once you spot this pattern in a book, extraction becomes mechanical: the claim is the quote/slide material, the example is what you narrate or explain. Look for it explicitly in Module 2.

### Module 3 — Mind Maps (Dual Coding)
Two layers, per your preference:
- **Static** — one clean diagram per chapter or per part, for fast visual review (good for the night-before-exam scan)
- **Interactive** — a single expandable map of the *whole book*, root node → parts → chapters → key concepts, so relationships between chapters are visible (which a chapter-by-chapter document can't show)

Build the interactive one as one HTML file with a collapsible tree (or the Visualizer's diagram module for a single static overview). The static ones can be simple SVGs, one per chapter, gridded into a single reference page.

### Module 4 — Tagged Question Bank
Every question gets one of four tags:
- **MCQ** — multiple choice, tests recognition
- **FILL** — fill-in-the-blank, tests precise recall (names, numbers, terms)
- **SHORT** — 4–6 sentence answer, tests explanation
- **LONG** — essay-length, tests synthesis across multiple chapters

Build the bank *once*, deep enough to draw from repeatedly (target: 100+ items for a book this size). Every other module (exam papers, spaced review) draws from this single bank rather than duplicating content — one source of truth.

### Module 5 — Spaced Review Tracker
A simple, no-extra-app tracker embedded directly in the study guide HTML:
- Each chapter shows **last reviewed** and **next due** dates
- Suggested intervals: **Day 1 → Day 3 → Day 7 → Day 16 → Day 35** (roughly doubling — the standard spacing curve)
- A chapter you mark "reviewed" today automatically calculates its next due date
- Persisted in the browser via `localStorage`, so it survives closing and reopening the file — no login, no separate app

### Module 6 — Interleaved Practice Exams
Generate multiple full papers by **shuffling and cycling through the Module 4 bank**, not writing new questions each time. Mix chapters within every paper — never one paper per chapter. This is what makes practice resemble the actual exam experience (which never tests chapters in isolation) and is one of the most evidence-backed techniques in the entire framework.

### Module 7 — Book Index Page
One `index.md` per book, linking every module, plus:
- 2–3 line summary of the book's core argument
- Author + context (1 paragraph)
- A "start here" reading order for someone new to the material

This is what turns a folder of study files into something a future website can render as a landing page with zero rework.

---

## Genre Adaptation Notes

The pipeline is the same; the *emphasis* shifts:

| Genre | Adjust |
|---|---|
| **Philosophy / theology** (like this book) | Heavy on Module 2's claim→example pattern; LONG questions carry real weight |
| **History / biography** | Add a **timeline** as a Module 3 supplement; MCQ/FILL questions on dates, names, sequence matter more |
| **Language learning** (e.g. Arabic sarf/nahw) | Module 4 shifts toward **drill-based recall** (conjugation tables, pattern recognition) rather than essay questions; spaced review (Module 5) becomes the *primary* module, not a supplement — this is closer to vocabulary acquisition than argument comprehension |
| **Novels / literary fiction** | Module 2 shifts from "concepts" to **plot, character arcs, and motifs**; Module 4's LONG questions become literary analysis rather than argument reconstruction |

We'll build genre-specific templates properly once we've run this pipeline on 2–3 books and can see what actually differs in practice, rather than guessing upfront.

---

## Reusing This Framework

To run this pipeline on a new book, the working instruction is:

> "Apply the Deep-Reading Framework (see 00_FRAMEWORK.md) to [book title/URL]. Confirm the chapter/reading-unit count with me before building Modules 2–7, since scope varies a lot by book."

Everything after that follows the modules above in order.

---

## Google Drive Folder Structure (website-ready)

```
📁 Learning Library
  📄 00_FRAMEWORK.md                    ← this file
  📁 Book 01 - Polarization Around 'Ali
      📄 index.md
      📁 study_guide      (chapter-by-chapter HTML)
      📁 mind_maps        (static + interactive)
      📁 exam_bank        (26 papers HTML + the 30Q hard exam)
      📁 teaching_materials (outline, script, slides)
  📁 Book 02 - Survey of the Lives of the Infallible Imams
      (same structure, once built)
```

Every future book just adds one more numbered folder with the identical internal structure — this is what makes a public website trivial later: each book folder = one page, `index.md` = the landing content.
