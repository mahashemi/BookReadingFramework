Al-Islam source-section index
==============================

The refresh script retains only source heading titles and stable HTML IDs, not the book's full prose. It updates existing chunk-level source_url fields rather than inventing a parallel schema.

From the repository root, run python3 scripts/refresh_al_islam_anchors.py --write to refresh the local reference/al-islam/sections.json index and improve section-level links. Run python3 scripts/refresh_al_islam_anchors.py --strict to verify fragments against the live source pages.

Al-Islam.org's copyright notice says hosted content is for non-commercial use with permission from the copyright holders. Do not publish a verbatim audiobook or full-text mirror without the required rights. Listen & Learn is a source-grounded paraphrase and learning commentary, not a replacement for the original edition.
