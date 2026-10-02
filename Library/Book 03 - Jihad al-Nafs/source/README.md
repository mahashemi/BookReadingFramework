# Book 03 — Jihad al-Nafs — Source Transcription

This directory is the **source layer** for Book 03. It contains a page-addressable Persian OCR transcription of the supplied 130-page PDF.

## Authority and accuracy

- The supplied scanned PDF is the authoritative source.
- The HTML files are an OCR transcription layer, not a proofread or translated edition.
- Page boundaries are preserved with `data-pdf-page` attributes and stable `pdf-page-###` anchors.
- OCR wording has **not** been silently corrected based on general knowledge or interpretation.
- Arabic quotations and Persian text are retained in the OCR output as transcribed.
- Later learning-framework work should cite these source pages rather than treating the OCR as independent evidence.

## Chapter map

| گفتار | عنوان | PDF start page |
|---:|---|---:|
| 1 | تعلیم و تربیت | 1 |
| 2 | گناه و تعدیل غرائز | 6 |
| 3 | جهاد با نفس | 11 |
| 4 | انسان ملکوتی | 16 |
| 5 | نفس اماره | 21 |
| 6 | صبر | 27 |
| 7 | ملکه صبر | 31 |
| 8 | آثار صبر | 36 |
| 9 | توبه (1) | 42 |
| 10 | توبه (2) | 47 |
| 11 | توبه (3) | 53 |
| 12 | سعه صدر (1) | 56 |
| 13 | سعه صدر (2) | 62 |
| 14 | کفاره گناه | 66 |
| 15 | بندگی خدا | 70 |
| 16 | فعالیت، استقامت و توجه به جوانب کار | 75 |
| 17 | اخلاص | 80 |
| 18 | نمازشب | 84 |
| 19 | پناه بردن به قرآن | 90 |
| 20 | فوائد دعا | 96 |
| 21 | دعا | 104 |
| 22 | توسل به اهل‌بیت (علیهم‌السلام) | 108 |
| 23 | یاد خدا | 114 |
| 24 | توکل بر خدا | 119 |

## Extraction

The supplied PDF has a damaged/unusable Persian text layer, so the source pages were rendered and OCRed from the page images using Tesseract with Persian and Arabic language data. This was necessary to obtain searchable Persian text while preserving page provenance.

The PDF remains the authority. This source layer will be proofread against the scan before we use passages for translation, concepts, questions, or other learning-framework material.
