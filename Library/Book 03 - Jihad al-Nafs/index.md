# Book 03 — Jihad bil-Nafs

This folder applies the **Deep Reading Framework v1.8** to Ayatollah Mazaheri's *Jihad bil-Nafs*.

## Source → study → exam pipeline

```
Authoritative scanned source
        ↓
source/                         page-addressable Persian transcription
        ↓
data/chunks.json                canonical learning chunks + source traceability + Akhlaq lessons
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
teaching_materials/             teaching guide and related learning material
```

## Reading units

The source manifest in `reference/ablibrary/chapters.json` defines **25 numbered گفتار**. The learning layer uses those source-defined units; it does not infer or rename chapter boundaries.

The separate `source/chapter-00.html` is retained as the pre-unit/source-front-matter page and is not counted as a learning unit.

## Akhlaq layer

Each unit includes a concise **Akhlaq lesson**: the moral/character formation conveyed by the unit, backed by explicit evidence chunk IDs. The lesson is a derived learning interpretation and must not be presented as if it were the author's exact wording.

## Source authority

The scanned source remains authoritative. The Persian transcription in `source/` is a source layer, not a translation. Learning summaries, questions, glossary entries, and teaching material remain separate derived layers and retain source traceability.

## Learning philosophy

This book follows the Deep Reading pipeline rather than creating a second application architecture:

**source passage → concept → explanation → evidence/example → implication → Akhlaq lesson → retrieval question → interleaved practice**

The master question universe remains the only canonical question store. Generated tests and exam pages reference question IDs rather than duplicate question text.
