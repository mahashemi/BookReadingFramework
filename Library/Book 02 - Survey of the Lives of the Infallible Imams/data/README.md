# Data

- `chunks.json` is the **single canonical learning-data file** for Book 02.
- It contains the 13 learning units and 160 chunks. Each chunk stores the learning text once, its source section title, source page URL, and importance where available.
- Unit-level terms, key phrases, and cross-unit connections live in the same file.
- Concepts are derived from the chunks; there is no second concept/explanation copy.
- Questions remain in `../exam_bank/questions.json` as the single question-bank source of truth.
- `meta.json` remains the source inventory and extraction-status file.

The old `study_book02.json` layer was removed because its concept explanations duplicated the chunk text, and its `claim_examples` reasoning/evidence fields duplicated or truncated that same text. Those fields are intentionally not carried forward until they can contain genuinely distinct pedagogical content.

**Duplication rule:** one canonical piece of content should have one home. Derived views should reference chunks rather than copy their text. Future migrations should validate for duplicate text and redundant fields before publishing.
