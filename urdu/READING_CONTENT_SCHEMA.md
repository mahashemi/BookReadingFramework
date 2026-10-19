# Urdu reading-content markup convention

Use this convention for Urdu source translations so reading mode, narration, and future audio generation can select the actual text without reading navigation, footnotes, or editorial metadata aloud.

## Stable identifiers

Give each installment a permanent, semantic ID. Do not derive it from the visible title, a filename that may change, or a generated runtime value.

```html
<meta name="reading-content-id" content="book02-ch01-part01-reading">

<article
  id="book02-ch01-part01-reading"
  data-reading-content="primary"
  data-reading-series="book02-ch01"
  data-reading-part="1"
  aria-label="اصل مطالعے کا متن">
  <!-- The chapter's actual headings and prose only -->
</article>
```

Use the same pattern for other installments, changing the book/chapter/part identifiers consistently. The DOM `id` and `reading-content-id` metadata must match.

## Exclude peripherals from narration

- Keep site navigation, page title/byline, source links, editorial-status notes, and footer outside the primary reading article.
- Mark inline footnote links and other non-spoken annotations with `data-reading-skip="true"`. They can remain clickable on the page but should be omitted from generated speech.
- Put footnote bodies in a separate footnotes section/page, not inside the primary reading article.
- For a future reading/audio extractor, select the element matching `[data-reading-content="primary"]`, then omit descendants matching `[data-reading-skip="true"]`. Preserve headings and paragraph order; do not flatten everything into one string before excluding peripherals.
- Do not mark substantive author text, quotations, Qur'anic verses, poetry, or references that are part of the actual reading as skipped merely because they are difficult to synthesize. Editorial notes about the draft's status are peripherals.

## Current coverage

Chapter 1 translation installments 1–3 use:
- `book02-ch01-part01-reading`
- `book02-ch01-part02-reading`
- `book02-ch01-part03-reading`

This is markup groundwork only; it does not yet create audio files or a reading-mode interface.
