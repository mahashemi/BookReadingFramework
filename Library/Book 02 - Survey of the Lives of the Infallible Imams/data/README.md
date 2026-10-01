# Data

- `chunks.json` = 160 source-understanding chunks.
- `meta.json` = source inventory and extraction status.
- `study_book02.json` = structured pedagogical layer: concepts, terms/topics, key phrases, and cross-unit connections. It does **not** embed questions -- those live only in `../exam_bank/questions.json`, which `study.html` fetches separately and merges in at load time. Keeping the question bank in exactly one file is deliberate: two earlier copies (this file, and one hardcoded inside an exam_bank HTML tool) had already drifted out of sync with each other before this was cleaned up.

**Known gap: `claim_examples` is not genuine content yet.** Each unit also carries a `claim_examples` array (claim/reasoning/evidence/lesson, one per concept) that the framework calls for as a real, distinct pedagogical layer. In this book it isn't one: `reasoning` duplicates the matching concept's `explanation` verbatim in all 160 entries, `evidence` is either the same duplicate or a truncated prefix of it in all 160, and `lesson` is the identical boilerplate sentence in all 160 ("Preserve the source's exact distinction and connect evidence back to the claim."). It adds no information beyond `concepts`, so the learning hub (`/book/unit.html`) doesn't render it -- showing a student the same duplicated line 160 times would be worse than not showing it. The field is left in the file rather than deleted, so a future pass can populate it with genuine, distinct reasoning/evidence/lesson content per concept without a schema change; until that happens, don't build a new view on top of `claim_examples` assuming it holds real content.

Keep source extraction separate from pedagogical rendering. Do not invent missing source content.
