#!/usr/bin/env python3
"""Deterministically build readable chapter HTML from Ahlulbayt source pages.

No LLM, OCR, semantic rewriting, or chapter-boundary guessing is performed
during the build. Chapter ranges come only from chapters.json.

Typical workflow:
  1. download_ablibrary_book.py
  2. build_book.py discover --source <reference-dir>
  3. inspect chapters.json
  4. build_book.py build --source <reference-dir> --output <chapter-dir>
  5. validate_book.py --source <reference-dir> --output <chapter-dir>
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

KNOWN_SOURCE_GAPS = {179}

FA_RTL = re.compile(r"[\u0600-\u06ff]")
ARABIC = re.compile(r"[\u0621-\u064a]")
PERSIAN_SPECIFIC = re.compile(r"[پچژگ]")
HEADING = re.compile(r"^\s*(گفتار\s+.+?)\s*$")

DEFAULT_TEMPLATE = """<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="../../../assets/style.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@100..900&display=swap" rel="stylesheet">
</head>
<body class="source-reading">
<main class="shell source-shell">
<article class="source-transcription" data-source-book="{book}" data-source-volume="{volume}">
<header class="source-chapter-header">
  <div class="source-eyebrow">جهاد با نفس</div>
  <h1 class="source-chapter-title">{title}</h1>
  <div class="source-chapter-rule" aria-hidden="true"></div>
</header>
<div class="source-content">
{body}
</div>
</article>
</main>
<script src="../../../assets/reader.js"></script>
</body>
</html>
"""


def norm(s: str) -> str:
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


def natural_page_number(path: Path) -> int:
    m = re.search(r"(\d+)", path.stem)
    if not m:
        raise ValueError(f"Cannot determine page number from {path}")
    return int(m.group(1))


def load_pages(source: Path) -> dict[int, str]:
    text_dir = source / "text"
    if not text_dir.is_dir():
        raise SystemExit(f"Missing source text directory: {text_dir}")
    pages = {}
    for p in sorted(text_dir.glob("page-*.txt"), key=natural_page_number):
        pages[natural_page_number(p)] = p.read_text(encoding="utf-8")
    if not pages:
        raise SystemExit(f"No page-*.txt files found in {text_dir}")
    return pages


def find_headings(pages: dict[int, str]) -> list[dict]:
    found = []
    seen = set()
    for page, text in pages.items():
        prose = text.split("\nهامش\n", 1)[0]
        for line_no, raw in enumerate(prose.splitlines(), 1):
            line = norm(raw)
            if not line or not HEADING.match(line):
                continue
            if len(line) > 180:
                continue
            # A chapter title should be a standalone short line, not a prose
            # sentence containing the word "گفتار".
            if line.count(" ") > 18:
                continue
            key = (page, line)
            if key not in seen:
                seen.add(key)
                found.append({"start_internal_page": page, "title": line, "source_line": line_no})
    return found


def discover(source: Path) -> Path:
    pages = load_pages(source)
    headings = find_headings(pages)
    if not headings:
        raise SystemExit("No standalone 'گفتار ...' headings were found.")

    chapters = []
    for i, item in enumerate(headings):
        start = item["start_internal_page"]
        end = (headings[i + 1]["start_internal_page"] - 1
               if i + 1 < len(headings) else max(pages))
        if end < start:
            raise SystemExit(f"Invalid discovered range for {item['title']!r}.")
        chapters.append({
            "number": i + 1,
            "title": item["title"],
            "start_internal_page": start,
            "end_internal_page": end,
            "discovered_from": {
                "page": start,
                "line": item["source_line"],
            },
        })

    manifest = {
        "schema_version": 1,
        "book": {
            "title": "Jihad bil-Nafs",
            "author": "Ayatollah Mazaheri",
            "source": "Ahlulbayt Library",
        },
        "volumes": [{
            "id": "vol-1-and-2",
            "label": "Jild 1–2",
            "chapters": chapters,
        }],
        "notes": [
            "Deterministically discovered from standalone 'گفتار ...' lines.",
            "Review this manifest once; build uses it exactly and never guesses.",
            "If a heading is missed or false-positive, edit the range/title here.",
        ],
    }
    out = source / "chapters.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out} ({len(chapters)} chapters).")
    for c in chapters:
        print(f"{c['number']:>3}: pages {c['start_internal_page']}–{c['end_internal_page']}  {c['title']}")
    return out


def load_manifest(source: Path) -> dict:
    path = source / "chapters.json"
    if not path.exists():
        raise SystemExit(f"Missing {path}. Run: build_book.py discover --source {source}")
    return json.loads(path.read_text(encoding="utf-8"))


def source_lines(text: str) -> list[str]:
    return [norm(x) for x in text.splitlines() if norm(x)]


ARABIC_DIACRITICS = re.compile(r"[\u064b-\u065f\u0670]")
ARABIC_MARKERS = (
    "الله", "رسول", "النبي", "الذين", "الذي", "التي", "هذا", "هذه",
    "ذلك", "تلك", "إن", "أن", "يا", "ابن", "بن", "قال", "قلت",
    "عليه", "عليهم", "عليها", "منه", "فيه", "به", "صلى", "وسلم",
)


def is_arabic(line: str, *, quoted: bool = False) -> bool:
    """Conservative Arabic classifier for source transcription."""
    text = norm(line)
    if not text:
        return False
    chars = ARABIC.findall(text)
    if len(chars) < 5:
        return False
    if PERSIAN_SPECIFIC.search(text):
        return False
    if ARABIC_DIACRITICS.search(text):
        return True
    if any(marker in text for marker in ARABIC_MARKERS):
        return True
    if quoted:
        return True
    return len(chars) >= 12


def split_footnotes(lines: list[str]) -> tuple[list[str], list[str]]:
    for i, line in enumerate(lines):
        if re.match(r"^\s*هامش\s*$", line):
            return lines[:i], lines[i + 1:]
    return lines, []


def render_footnotes(lines: list[str]) -> str:
    if not lines:
        return ""
    items = "".join(f"<li>{html.escape(line)}</li>" for line in lines if line)
    if not items:
        return ""
    return (
        '<aside class="source-footnotes" aria-label="حاشیه‌ها">'
        '<div class="source-footnotes-title">هامش</div>'
        f"<ol>{items}</ol></aside>"
    )


def render_mixed_paragraph(line: str) -> str:
    """Render Persian prose while visually separating inline Arabic quotations."""
    parts: list[str] = []
    pos = 0
    for match in re.finditer(r"«([^»]+)»", line):
        before = line[pos:match.start()]
        quoted = match.group(1)
        if before:
            parts.append(html.escape(before))
        if is_arabic(quoted, quoted=True):
            parts.append(
                '<span class="source-arabic-inline" lang="ar" dir="rtl">'
                f'«{html.escape(quoted)}»</span>'
            )
        else:
            parts.append(html.escape(match.group(0)))
        pos = match.end()
    if pos < len(line):
        parts.append(html.escape(line[pos:]))
    return (
        '<p class="source-persian" lang="fa" dir="rtl">'
        + "".join(parts)
        + "</p>"
    )


def render_text_blocks(lines: list[str]) -> str:
    """Render source paragraphs, including mixed Persian/Arabic paragraphs."""
    out: list[str] = []
    for line in lines:
        if HEADING.match(line):
            out.append(
                f'<h2 class="source-subheading">{html.escape(line)}</h2>'
            )
        elif is_arabic(line):
            out.append(
                '<blockquote class="source-arabic" lang="ar" dir="rtl">'
                f'<div>{html.escape(line)}</div></blockquote>'
            )
        else:
            out.append(render_mixed_paragraph(line))
    return "\n".join(out)


def render_page(
    page: int,
    text: str,
    printed_page: str | None = None,
    *,
    chapter_title: str | None = None,
) -> str:
    label = f"صفحه {printed_page}" if printed_page else f"صفحه منبع {page}"
    lines = source_lines(text)

    # The chapter title is already rendered once as the document heading.
    # Suppress only exact duplicates from the source page; preserve everything else.
    if chapter_title:
        chapter_title = norm(chapter_title)
        lines = [line for line in lines if norm(line) != chapter_title]

    prose, footnotes = split_footnotes(lines)
    body = render_text_blocks(prose)
    notes = render_footnotes(footnotes)

    return (
        f'<section id="source-page-{page:04d}" class="source-page" '
        f'data-source-internal-page="{page}">'
        f'<div class="pdf-page-marker" role="doc-pagebreak" '
        f'aria-label="{html.escape(label)}"><span>{html.escape(label)}</span></div>'
        f'{body}{notes}</section>'
    )


def build(source: Path, output: Path) -> None:
    pages = load_pages(source)
    manifest = load_manifest(source)
    output.mkdir(parents=True, exist_ok=True)

    total = 0
    for volume in manifest.get("volumes", []):
        for chapter in volume.get("chapters", []):
            n = int(chapter["number"])
            start = int(chapter["start_internal_page"])
            end = int(chapter["end_internal_page"])
            if start > end:
                raise SystemExit(f"Chapter {n}: start > end.")
            missing = [
                p for p in range(start, end + 1)
                if p not in pages and p not in KNOWN_SOURCE_GAPS
            ]
            if missing:
                raise SystemExit(f"Chapter {n}: missing source pages {missing}")

            body = []
            for p in range(start, end + 1):
                if p not in pages:
                    continue
                meta_file = source / "pages" / f"page-{p:04d}.json"
                printed = None
                if meta_file.exists():
                    meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    printed = meta.get("printed_page")
                body.append(render_page(p, pages[p], printed, chapter_title=chapter["title"]))

            title = chapter["title"]
            volume_label = volume.get("label", volume.get("id", ""))
            document = DEFAULT_TEMPLATE.format(
                title=html.escape(title),
                book=html.escape(manifest["book"]["title"]),
                volume=html.escape(volume_label),
                body="\n".join(body),
            )
            target = output / f"chapter-{n:02d}.html"
            target.write_text(document, encoding="utf-8")
            total += 1

    print(f"Built {total} chapters into {output}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_discover = sub.add_parser("discover")
    p_discover.add_argument("--source", type=Path, required=True)

    p_build = sub.add_parser("build")
    p_build.add_argument("--source", type=Path, required=True)
    p_build.add_argument("--output", type=Path, required=True)

    args = parser.parse_args()
    if args.command == "discover":
        discover(args.source)
    else:
        build(args.source, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
