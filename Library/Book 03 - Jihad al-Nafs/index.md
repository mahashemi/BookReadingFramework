# Book 03 — Jihad bil-Nafs

This folder applies the **Deep-Reading Framework v1.6** to Ayatollah Mazaheri's *Jihad bil-Nafs*.

## Source → study → exam pipeline

```
Authoritative scanned source
        ↓
source/                         page-addressable Persian transcription
        ↓
data/chunks.json                canonical learning chunks + source traceability
data/glossary.json              canonical key terms and names
        ↓
study_guide/                    interactive study + spaced review
        ↓
exam_bank/questions.json        single master question universe
        ├── unit tests
        ├── cumulative/interleaved exams
        └── simulated / worst-case papers
        ↓
mind_maps/                      whole-book + unit visual review
teaching_materials/             teaching guide, lecture outline, script, slides
```

## Reading units

The source manifest in `reference/ablibrary/chapters.json` defines **25 numbered گفتار**. The learning layer uses those source-defined units; it does not infer or rename chapter boundaries.

The separate `source/chapter-00.html` is retained as the pre-unit/source-front-matter page and is not counted as a learning unit.

## Source authority

The scanned source remains authoritative. The Persian transcription in `source/` is a source layer, not a translation. Learning summaries, questions, glossary entries, and teaching material will be separate derived layers and must retain source traceability.

## Learning philosophy

This book will follow the BookReadingFramework pipeline rather than creating a second application architecture:

**source passage → concept → explanation → evidence/example → implication → retrieval question → interleaved practice**

The master question universe will remain the only canonical question store. Generated tests and exam pages will reference question IDs rather than duplicate question text.
