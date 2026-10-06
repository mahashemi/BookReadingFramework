# Book 03 — Jihad al-Nafs — Source Transcription

This directory is the **source layer** for Book 03. It contains a page-addressable Persian OCR transcription of the supplied 130-page PDF.

## Source authority

- The supplied scanned PDF is the **authoritative source**.
- The HTML files are a searchable transcription layer, **not** a proofread or translated edition.
- Every source page retains its PDF page number through data-pdf-page and a stable pdf-page-### anchor.
- Arabic quotations and Persian prose are retained as source text; later normalization or translation must not be treated as part of the original.
- When OCR is ambiguous, the scan must be checked rather than silently reconstructing the author's intended wording.

## Why these files are split this way

The book itself is organized into **25 explicitly numbered گفتار**. The split points are therefore source-defined: each HTML file begins at one of those گفتار headings and continues until the page immediately before the next گفتار.

So:

- **25 گفتار = from the book itself.**
- chapter-01.html … chapter-25.html = our **filesystem naming convention** for those source units; the book does not call them “chapters”.
- The numeric file names are not a claim that the author used English/Arabic numerals.
- The visible HTML headings have been aligned with the wording seen in the source (for example, گفتار اول, گفتار شانزدهم, گفتار بیست و سه).
- Page 1 contains both the publisher's introduction and the beginning of گفتار اول; that is why the first source unit includes both rather than inventing a page boundary that does not exist.

## Source map

| Source unit | Title | PDF start page |
|---|---|---:|
| گفتار اول | تعلیم و تربیت | 1 |
| گفتار دوم | گناه و تعدیل غرائز | 6 |
| گفتار سوم | جهاد با نفس | 11 |
| گفتار چهارم | انسان ملکوتی | 16 |
| گفتار پنجم | نفس اماره | 21 |
| گفتار ششم | صبر | 27 |
| گفتار هفتم | ملکه صبر | 31 |
| گفتار هشتم | آثار صبر | 36 |
| گفتار نهم | توبه (1) | 42 |
| گفتار دهم | توبه (2) | 47 |
| گفتار یازدهم | توبه (3) | 53 |
| گفتار دوازدهم | سعه صدر (1) | 56 |
| گفتار سیزدهم | سعه صدر (2) | 62 |
| گفتار چهاردهم | کفاره گناه | 66 |
| گفتار پانزدهم | بندگی خدا | 70 |
| گفتار شانزدهم | فعالیت، استقامت و توجه به جوانب کار | 75 |
| گفتار هفدهم | اخلاص | 80 |
| گفتار هجدهم | نمازشب | 84 |
| گفتار نوزدهم | پناه بردن به قرآن | 90 |
| گفتار بیستم | فوائد دعا | 96 |
| گفتار بیست و یک | دعا | 104 |
| گفتار بیست و دو | توسل به اهل‌بیت (علیهم‌السلام) | 108 |
| گفتار بیست و سه | یاد خدا | 114 |
| گفتار بیست و چهار | توکل بر خدا | 119 |

## OCR audit

The PDF's embedded Persian text layer is damaged/unusable, so the pages were rendered and OCRed from their images using Persian and Arabic OCR data.

A first systematic audit has corrected high-confidence, mechanically identifiable OCR failures, including:

- the recurring loss of the Persian می‌ prefix (for example, ی‌خواهند → می‌خواهند);
- recurring OCR substitutions such as بيدا → پیدا, جه → چه, اكر → اگر, جني → چنین, and other directly recognizable cases.

These are **transcription corrections**, not interpretations of the author's argument. More ambiguous words should continue to be checked against the scanned page before being used in the learning framework.
