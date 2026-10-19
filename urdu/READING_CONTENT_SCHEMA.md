# Urdu reading-content markup convention

Every Urdu chapter or source-session page must expose the actual readable prose in one primary reading element. This is the stable contract for scrapers, reading mode, narration, and future audio work.

## Stable identifiers

Use a permanent semantic identifier, unique across the site. The metadata value and the readable element's DOM ID must match exactly. Do not derive IDs at runtime or from visible titles.

```html
<meta name="reading-content-id" content="book02-ch02-session01-reading">

<article
  id="book02-ch02-session01-reading"
  data-reading-content="primary"
  data-reading-series="book02-ch2"
  aria-label="اصل مطالعے کا متن">
  <!-- Actual source translation or clearly labelled study-guide text -->
</article>
```

- Each HTML page must contain exactly one `[data-reading-content="primary"]` element.
- The ID must be unique across pages and stable if the title or filename changes.
- A consolidated chapter uses one primary element for the full chapter, preserving source sections in order.
- Keep the page title, byline, source links, reading-time estimate, editorial-status notes, footnote bodies, navigation, and footer outside the primary element.
- Mark inline footnote links and other non-spoken annotations with `data-reading-skip="true"`; keep their clickable behavior.
- Preserve headings, paragraphs, quotations, poetry, Qur'anic verses, and source-text order. Do not flatten everything before removing skipped descendants.
- A scraper can select `[data-reading-content="primary"]`, read its unique `id`, then omit descendants matching `[data-reading-skip="true"]`.
- Do not mark substantive source text or quotations as skipped merely because they are difficult to synthesize.
- Study summaries and guides must remain clearly labelled and must not be presented as full translations.

## Coverage status

Chapter 1 is consolidated in `book02/chapter-01.html` under `book02-ch01-reading`. The remaining existing chapter pages are being migrated to this contract. Stable IDs do not imply that prose has been source-verified or that multi-part drafts have already been consolidated.

This markup is scraper groundwork only; it does not create audio files or claim that narration has been tested.
