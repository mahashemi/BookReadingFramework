# Data

- `chunks.json` = 160 source-understanding chunks.
- `meta.json` = source inventory and extraction status.
- `study_book02.json` = structured pedagogical layer: concepts, terms/topics, key phrases, claim → reasoning → evidence → lesson, and cross-unit connections. It does **not** embed questions -- those live only in `../exam_bank/questions.json`, which `study.html` fetches separately and merges in at load time. Keeping the question bank in exactly one file is deliberate: two earlier copies (this file, and one hardcoded inside an exam_bank HTML tool) had already drifted out of sync with each other before this was cleaned up.

Keep source extraction separate from pedagogical rendering. Do not invent missing source content.
