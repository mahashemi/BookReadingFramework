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

The exam layer contains unit tests, 3-unit tests, half-book tests, full-book tests, simulated Years 1–20, and a Hard/Worst-case paper. The written portion is sampled across learning skills rather than by question type alone.

The 20 simulated years deliberately reuse the same master universe. They are practice papers, not predictions of an actual exam.


## Revision workflow

Revisit units in reverse reading order, beginning with Chapter 8, Part 2. For each unit, re-read its original Al-Islam.org source, write exam-ready model answers, retain a source locator for every question, and replace that unit's older question set through a revision file. Objective answers remain concise; written answers must be sufficiently developed to reproduce in an examination.
