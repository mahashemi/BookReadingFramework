# Book 02 — A Survey into the Lives of the Infallible Imams

This folder applies the **Deep Reading Framework v1.8** to Ayatullah Murtadha Mutahhari's *A Survey into the Lives of the Infallible Imams*.

## Source → study → exam pipeline

```
Al-Islam source
   ↓
data/chunks.json              canonical source-understanding chunks + Akhlaq lessons
   ↓
study guide                   interactive study + spaced review
   ↓
exam_bank/questions.json      base master question universe
   + exam_bank/revisions/      source-checked unit overrides
   ├── unit tests
   ├── cumulative/interleaved exams
   └── simulated / worst-case papers
   ↓
mind maps + teaching materials
```

## Reading units

13 reading units are covered: Foreword; Introduction; Chapter 1; Chapter 2 Sessions 1–2; Chapters 3–7; and Chapter 8 Parts 1–2.

## Akhlaq layer

Each unit now includes a concise **Akhlaq lesson** identifying the character quality the material can cultivate in the reader, with evidence chunk IDs. These are derived learning interpretations, not quotations attributed to Mutahhari.

## Exam philosophy

The actual exam may be short; this library deliberately is not. The master bank over-prepares through:

**source fact → precise recall → distinction → explanation → claim/example → cross-unit synthesis → interleaved full papers → hard/worst-case paper**

All generated exams draw from the same question IDs rather than creating a separate question universe for each paper.

## Practice and assessment

- [Unit Practice & Assessment](exam_bank/unit_tests.html) — choose a unit, attempt objective questions, write answers before revealing model responses, and self-assess written work.
- [Full-book Practice Exam Generator](exam_bank/full_book_exam_generator.html) — unit, cumulative, full-book, simulated-year, and hard papers.
- [Interleaved Exam Generator](exam_bank/interleaved_exam_generator.html) — mixed-unit mock papers.
- [Study Guide](study_guide/study.html) — concepts, source-linked questions, model answers, and spaced review.
