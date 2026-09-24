# Study Guide

`study.html` is the reusable Book 02 renderer.

It loads `../data/study_book02.json` and provides 13 reading-unit accordions, concepts, terms/topics, key phrases, claim → reasoning → evidence → lesson, hidden answers, MCQ choices before reveal, self-marking, cumulative scoring, total-book progress, and a Day 1 → 3 → 7 → 16 → 35 spaced-review tracker.

The question bank contains **1,032 concept-first questions**. The UI shows each question's learning skill so the learner knows whether they are practicing comprehension, reasoning, evidence, connection, listener challenge, concept checking, synthesis, or retrieval.

Use GitHub Pages or another web server because browser security may block JSON `fetch()` from a `file://` URL.
