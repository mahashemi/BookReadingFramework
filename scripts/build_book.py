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
</head>
<body>
<main class="shell">
<article class="source-transcription" data-source-book="{book}" data-source-volume="{volume}">
<h1>{title}</h1>
{body}
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
        for line_no, raw in enumerate(text.splitlines(), 1):
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


def is_arabic_quote(line: str) -> bool:
    chars = ARABIC.findall(line)
    if len(chars) < 12:
        return False
    persian_specific = len(re.findall(r"[پچژگ]", line))
    return len(chars) >= max(12, persian_specific * 4)


def render_page(page: int, text: str, printed_page: str | None = None) -> str:
    label = f"صفحه چاپی {printed_page}" if printed_page else f"صفحه منبع {page}"
    out = [f'<div class="pdf-page-marker" data-source-internal-page="{page}">{html.escape(label)}</div>']
    lines = source_lines(text)
    paragraph = []

    def flush() -> None:
        if paragraph:
            value = " ".join(paragraph).strip()
            if value:
                klass = "source-arabic" if is_arabic_quote(value) else "source-page"
                out.append(f'<p class="{klass}">{html.escape(value)}</p>')
            paragraph.clear()

    for line in lines:
        if HEADING.match(line):
            flush()
            out.append(f"<h2>{html.escape(line)}</h2>")
        else:
            paragraph.append(line)
    flush()
    return "\n".join(out)


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
                body.append(render_page(p, pages[p], printed))

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
