# BookReadingFramework

A reusable, data-driven framework for deep reading, active recall, exam preparation, and teaching — every idea traceable back to the exact passage it came from.

## Learning Hub

**[Open the learning hub →](https://mahashemi.github.io/BookReadingFramework/)**

Browse by book, then by learning unit: source map, concepts with their original passages, a glossary of key terms and names, practice questions, full assessments, and teaching materials — all rendered live from the data files in this repository, not hand-written pages that can drift out of date.

## Books

### Book 02 — A Survey into the Lives of the Infallible Imams
*Ayatullah Murtadha Mutahhari, translated by Zainab Muhammadi 'Araqi*

Fully built on the current architecture: 13 learning units, 160 source-linked concepts, a 52-entry glossary, an interactive mind map, a 1,192-question bank (the single source of truth for every quiz, unit test, and exam), an interactive study guide with spaced review, and a Beamer teaching deck.

- [Study guide](<Library/Book 02 - Survey of the Lives of the Infallible Imams/study_guide/study.html>)
- [Unit tests](<Library/Book 02 - Survey of the Lives of the Infallible Imams/exam_bank/unit_tests.html>) · [Full-book exam](<Library/Book 02 - Survey of the Lives of the Infallible Imams/exam_bank/full_book_exam_generator.html>) · [Interleaved exam](<Library/Book 02 - Survey of the Lives of the Infallible Imams/exam_bank/interleaved_exam_generator.html>)
- [Teaching deck (PDF)](<Library/Book 02 - Survey of the Lives of the Infallible Imams/teaching_materials/main.pdf>)

The pedagogical layer lives in `data/study_book02.json`; every question lives in exactly one place, `exam_bank/questions.json`, which the study guide and every exam tool fetch live.

### Book 01 — Polarization Around the Character of 'Ali ibn Abi Talib
*Ayatullah Murtadha Mutahhari*

Predates the current data-driven architecture — no `data/` folder, no `mind_maps/`. Its [study guide](<Library/Book 01 - Polarization Around _Ali/study_guide/study_guide_attraction_polarization.html>) and [exam papers](<Library/Book 01 - Polarization Around _Ali/exam_bank/exam_papers_bank.html>) are self-contained interactive HTML. Bringing it onto the current architecture is the main open item for this project.

## Framework

See [`Library/00_FRAMEWORK.md`](Library/00_FRAMEWORK.md) for the full methodology — currently v1.3.
