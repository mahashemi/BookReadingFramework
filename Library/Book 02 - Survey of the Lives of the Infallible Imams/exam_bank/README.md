# Exam Bank

The Book 02 master question universe contains **1,192 questions** spanning all 13 reading units (including a restored FILL type -- fill-in-the-blank presented as multiple choice, matching how real exams do cloze questions).

This is intentionally concept-first. The question skills are:
- comprehension
- reasoning
- evidence
- connection
- listener challenge
- concept check
- synthesis
- retrieval

The bank is not meant to be a list of section-title questions. Most questions force the learner to explain meaning, reconstruct reasoning, connect multiple ideas, interpret examples, or answer a plausible objection.

`questions.json` is the base master bank. Source-checked revision files under `revisions/` can replace the questions for specific units using their `replace_unit_ids` list. The active bank is the base bank with those unit questions removed and the revision questions inserted. All study and exam interfaces must apply the same merge so a revised unit cannot silently retain stale questions.

The exam layer contains unit tests, 3-unit tests, half-book tests, full-book tests, simulated Years 1–20, and a Hard/Worst-case paper. The written portion is sampled across learning skills rather than by question type alone. The Unit Practice & Assessment page now supports active recall: objective items can be marked automatically, written responses are composed before model answers are revealed, and each written answer has a self-assessment checklist for accuracy, essential details, source faithfulness, and exam structure. Units are presented in reverse reading order, beginning with Chapter 8, Part 2.

The 20 simulated years deliberately reuse the same master universe. They are practice papers, not predictions of an actual exam.


## Revision workflow

Revisit units in reverse reading order, beginning with Chapter 8, Part 2. The current revision pass has completed Chapter 8 Part 2, Chapter 8 Part 1, Chapter 7, Chapter 6 Sessions 2 and 1, Chapter 5, Chapter 4, Chapter 3, Chapter 2 Sessions 2 and 1, Chapter 1, and the Introduction. The Foreword is publisher front matter rather than a teaching chapter, so it is not padded with artificial exam questions. For each unit, re-read its original Al-Islam.org source, write exam-ready model answers, retain a source locator for every question, and replace that unit's older question set through a revision file. Objective answers remain concise; written answers must be sufficiently developed to reproduce in an examination. A source audit of all 12 revision files confirms that every active revised question has a prompt, model answer, source URL, and source chunk reference. Revised units contain 20–30 questions each, with written model answers averaging approximately 81–101 words; shorter answers are reserved for objective retrieval items.
