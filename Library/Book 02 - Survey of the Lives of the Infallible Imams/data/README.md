# Data

- `chunks.json` is the **single canonical learning-data file** for Book 02.
- It contains the 13 learning units and 160 learning chunks. Chunks are nested directly under the unit they belong to, so the data hierarchy is explicit: **book → unit → chunk**.
- Each unit stores its structural metadata, key phrases, cross-unit connections, and its canonical `chunks[]` learning objects. Each chunk stores its learning text once, its source section title, source page URL, and importance where available.
- The glossary is separate: `glossary.json` is the single canonical home for term definitions and their traceability metadata.
- Concepts are rendered directly from each unit's `chunks[]`; there is no second concept/explanation copy.
- Questions remain in `../exam_bank/questions.json` as the single question-bank source of truth.
- `meta.json` remains the source inventory and extraction-status file.

The old `study_book02.json` layer was removed because its concept explanations duplicated the chunk text, and its `claim_examples` reasoning/evidence fields duplicated or truncated that same text. Those fields are intentionally not carried forward until they can contain genuinely distinct pedagogical content.

**Duplication rule:** one canonical piece of content should have one home. Derived views should reference the unit's canonical chunks rather than copy their text. Future migrations should validate for duplicate text and redundant fields before publishing.
