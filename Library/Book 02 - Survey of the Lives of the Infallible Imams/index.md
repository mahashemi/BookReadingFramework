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
exam_bank/questions.json      single master question universe
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
