# Study Guide

`study.html` is the reusable Book 02 renderer.

It loads `../data/study_book02.json` for the pedagogical layer (concepts, terms/topics, key phrases, claim → reasoning → evidence → lesson, cross-unit connections), and separately fetches `../exam_bank/questions.json` for every question, merging the two client-side by `unit_id` (per-unit questions) and `unit_ids` (cross-unit synthesis questions). `exam_bank/questions.json` is the only place a question exists in this project -- `study_book02.json` no longer embeds its own copy, so there's nothing left for the two to drift out of sync on.

The UI provides 13 reading-unit accordions, hidden answers, MCQ/FILL choices before reveal, self-marking, cumulative scoring, total-book progress, and a Day 1 → 3 → 7 → 16 → 35 spaced-review tracker.

The question bank contains **1,192 questions** (MCQ, FILL, SHORT, LONG). The UI shows each question's learning skill so the learner knows whether they are practicing comprehension, reasoning, evidence, connection, listener challenge, concept checking, synthesis, or retrieval.

Use GitHub Pages or another web server because browser security may block JSON `fetch()` from a `file://` URL.
