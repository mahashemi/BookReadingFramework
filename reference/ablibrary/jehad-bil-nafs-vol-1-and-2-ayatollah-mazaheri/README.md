# Ahlulbayt source reference

Canonical retrieval/reference material for **Jihad bil-Nafs — Ayatollah Mazaheri**.

The HTML downloaded from Ahlulbayt Library is retained as provenance. The extracted
text is the deterministic input to chapter generation. Generated chapter HTML is
an artifact and must never be edited as the source of truth.

## Parallel download

From the repository root:

```bash
python3 scripts/download_ablibrary_book.py \
  --book-id 17168 \
  --start-page 1 \
  --max-pages 500 \
  --workers 8 \
  --output reference/ablibrary/jehad-bil-nafs-vol-1-and-2-ayatollah-mazaheri
```

The downloader is resumable. Increase `--workers` only as far as the source
server tolerates; the default delay/retry behavior is intentionally conservative.

## Deterministic chapter build

First discover candidate chapter headings:

```bash
python3 scripts/build_book.py discover \
  --source reference/ablibrary/jehad-bil-nafs-vol-1-and-2-ayatollah-mazaheri
```

**Review `chapters.json` once.** This is the explicit boundary contract.

Then build:

```bash
python3 scripts/build_book.py build \
  --source reference/ablibrary/jehad-bil-nafs-vol-1-and-2-ayatollah-mazaheri \
  --output "Library/Book 03 - Jihad al-Nafs/source"
```

Finally:

```bash
python3 scripts/validate_book.py \
  --source reference/ablibrary/jehad-bil-nafs-vol-1-and-2-ayatollah-mazaheri \
  --output "Library/Book 03 - Jihad al-Nafs/source"
```

The builder performs no semantic correction. It preserves source page order,
records page markers, escapes HTML safely, and applies only deterministic
presentation rules.


## Normalize an existing download

If the pages have already been downloaded, enrich the existing page JSON files
from the retained Ahlulbayt HTML without making network requests:

```bash
python3 scripts/normalize_ablibrary_source.py \
  --source reference/ablibrary \
  --keep-from 8 \
  --trim
```

This extracts the site's `data-abl-content="footnote"` citations into
`references[]` and `reference_count`, removes internal pages 1–7
(pre-Muqaddama), updates `manifest.json`, and audits HTML/text/JSON coverage.

The audit is expected to flag any genuinely missing source page. Do not invent
or reconstruct a missing page from surrounding text; re-download it from
Ahlulbayt first.

After normalization:

```bash
python3 scripts/validate_book.py \
  --source reference/ablibrary \
  --output "Library/Book 03 - Jihad al-Nafs/source"
```
