# The Deep-Reading Framework
### A repeatable pipeline for turning any book into long-term memory
*Version 1.1 — generic, data-driven framework; validated on Book 01 and Book 02*

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
For every chapter/reading-unit, extract five things:
- **Key Concepts** — the claims and ideas, in the author's logic, not just topic labels
- **Key Terms & Names** — anything a reader would need to look up, with a one-line gloss
- **Key Quotes** — the sentences worth memorizing verbatim (usually the author's own claim-statements, not the illustrating examples)
- **Questions** — tagged by type (see Module 4), designed to test understanding rather than recognition, designed to test understanding rather than recognition

**The claim → example pattern.** Most serious non-fiction authors argue by stating a general claim, then proving it with a story, statistic, or historical case. Once you spot this pattern in a book, extraction becomes mechanical: the claim is the quote/slide material, the example is what you narrate or explain. Look for it explicitly in Module 2.

**Deep-understanding rule.** A question should usually force the learner to combine at least two elements: cause + consequence, claim + evidence, comparison + reason, event + interpretation, or concept + application. Avoid questions whose answer is merely a section title or one isolated fact.

**Deep-understanding rule.** A question should usually force the learner to combine at least two elements: cause + consequence, claim + evidence, comparison + reason, event + interpretation, or concept + application. Avoid questions whose answer is merely a section title or one isolated fact.

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

Question design should be layered:
1. **Recall** — names, sequence, precise terminology.
2. **Comprehension** — explain what the author means in your own words.
3. **Reasoning** — explain why the author reaches the conclusion.
4. **Evidence** — show how a story/example supports the claim.
5. **Connection** — connect two or more ideas/reading units.
6. **Listener challenge** — answer a plausible objection or misconception raised during teaching.

The master universe should be dominated by levels 2–6. Recall is necessary, but it must not become the study method itself.

Question design should be layered:
1. **Recall** — names, sequence, precise terminology.
2. **Comprehension** — explain what the author means in your own words.
3. **Reasoning** — explain why the author reaches the conclusion.
4. **Evidence** — show how a story/example supports the claim.
5. **Connection** — connect two or more ideas/reading units.
6. **Listener challenge** — answer a plausible objection or misconception raised during teaching.

The master universe should be dominated by levels 2–6. Recall is necessary, but it must not become the study method itself.

Build the bank *once*, deep enough to draw from repeatedly (target: 100+ items for a book this size; for exam-heavy preparation, build an intentionally exhaustive master universe rather than a representative sample). Every other module (exam papers, spaced review) draws from this single bank rather than duplicating content — one source of truth.

### Module 5 — Spaced Review Tracker
A simple, no-extra-app tracker embedded directly in the study guide HTML:
- Each chapter shows **last reviewed** and **next due** dates
- Suggested intervals: **Day 1 → Day 3 → Day 7 → Day 16 → Day 35** (roughly doubling — the standard spacing curve)
- A chapter you mark "reviewed" today automatically calculates its next due date
- Persisted in the browser via `localStorage`, so it survives closing and reopening the file — no login, no separate app

### Module 6 — Interleaved Practice Exams
Generate multiple full papers by **shuffling and cycling through the Module 4 bank**, not writing new questions each time. Mix chapters/reading-units within every paper — never one paper per chapter. This is what makes practice resemble the actual exam experience.

### Question-bank architecture
The **master question universe is the source of truth**:
```
UNIT
 ├── Study material
 ├── Questions
 └── Unit test

QUESTION BANK
 ├── Unit questions
 ├── Cumulative questions
 └── Master universe

EXAM GENERATOR
 ├── Unit test
 ├── 3-unit test
 ├── Half-book test
 ├── Full-book test
 ├── Simulated Year 1...Year 20
 └── Hard / Worst-case paper
```
Every generated paper should reference existing question IDs rather than duplicate question text.

## Module 6A — Exhaustive / Worst-Case Exam Preparation
The goal is not merely to predict the real paper. Build enough coverage that an unfamiliar question is still answerable. For each reading-unit, cover:
- every major concept and sub-concept
- key terms, names, places, events and sequence
- important claim statements
- claim → reasoning → example → lesson
- distinctions and apparent contradictions
- cross-unit connections
- recall, explanation and synthesis questions
- plausible MCQ distractors and fill-in-the-blank variants

Then generate many **interleaved simulated papers** from the same master universe.

### Module 6C — Teaching-First Concept Questions
Teaching material and exam preparation should share the same conceptual question universe. For each major idea, create at least one question that a listener could naturally ask:
- “Why does that follow?”
- “How is this different from the previous case?”
- “What would happen if the circumstances changed?”
- “Isn't this example actually evidence for the opposite?”
- “What exactly is the author trying to prove with this story?”

These questions are not filler. They bridge live discussion, comprehension, and exam mastery.

### Module 6C — Teaching-First Concept Questions
Teaching material and exam preparation should share the same conceptual question universe. For each major idea, create at least one question that a listener could naturally ask:
- “Why does that follow?”
- “How is this different from the previous case?”
- “What would happen if the circumstances changed?”
- “Isn't this example actually evidence for the opposite?”
- “What exactly is the author trying to prove with this story?”

These questions are not filler. They are a bridge between teaching discussion and exam mastery. If the real exam has a small number of questions, practice should still be much larger so that the learner is prepared for the worst case.

## Module 6B — Generic Study Engine
Use a locked separation of concerns:
```
Source
  ↓
Structured JSON
  ↓
Generic study engine
  ↓
Book-specific rendering
  ↓
study.html / exam.html
```

A book data file should contain:
- `book_id`
- reading units
- concepts
- terms
- quotes
- claim/example structures
- questions and answers
- difficulty / importance
- source traceability
- cross-unit connections

The same engine must be able to render Book 01, Book 02 and future books by changing `book_id` / data, without copying the study logic.

The study UI should support, where applicable:
- chapter/unit accordion
- key concepts, terms and quotes
- claim → reasoning → example → lesson
- click-to-reveal answers
- self-marking and running score
- progress bar and total score
- unit tests and cumulative tests
- spaced-review tracking
- dark/light mode
- responsive/mobile layout


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

## Source-of-Truth and Traceability

Never invent source content to fill a missing field. If extraction is incomplete, return to the source and acquire the missing material before building the study layer. Keep raw source chunks separate from the final pedagogical JSON.

Recommended layers:
```
data/chunks.json        ← source-understanding layer
data/meta.json          ← source inventory/status
data/study_bookXX.json  ← structured pedagogical layer
study_guide/            ← rendered study experience
exam_bank/              ← master questions + generated exams
mind_maps/              ← visual review
teaching_materials/     ← teaching outputs
```

Each extracted item should retain enough source information to trace it back to its reading-unit/source page.

---

## Reusing This Framework

To run this pipeline on a new book, the working instruction is:

> "Apply the Deep-Reading Framework (see 00_FRAMEWORK.md) to [book title/URL]. Confirm the chapter/reading-unit count with me before building Modules 2–7, since scope varies a lot by book."

Everything after that follows the modules above in order.

---

## Repository Folder Structure (website-ready)

```
📁 Library
  📄 00_FRAMEWORK.md                    ← this file
  📁 Book 01 - Polarization Around 'Ali
      📄 index.md
      📁 study_guide      (chapter-by-chapter HTML)
      📁 mind_maps        (static + interactive)
      📁 exam_bank        (master question universe + generated papers)
      📁 teaching_materials (outline, script, slides)
  📁 Book 02 - Survey of the Lives of the Infallible Imams
      📄 data/                         ← source + structured JSON
      📁 study_guide
      📁 mind_maps
      📁 exam_bank
      📁 teaching_materials
```

Every future book just adds one more numbered folder with the identical internal structure — this is what makes a public website trivial later: each book folder = one page, `index.md` = the landing content.
