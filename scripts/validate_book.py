#!/usr/bin/env python3
"""Validate deterministic Jihad bil-Nafs source/chapter generation."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

MARKER = re.compile(r'data-source-internal-page="(\d+)"')
KNOWN_SOURCE_GAPS = {179}


def norm(s: str) -> str:
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


def load_manifest(source: Path) -> dict:
    path = source / "chapters.json"
    if not path.exists():
        raise SystemExit(f"Missing manifest: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    failures = []
    pages = {}
    for p in sorted((args.source / "text").glob("page-*.txt")):
        m = re.search(r"(\d+)", p.stem)
        if m:
            pages[int(m.group(1))] = norm(p.read_text(encoding="utf-8"))

    html_pages = {
        int(re.search(r"(\d+)", p.stem).group(1))
        for p in (args.source / "html").glob("page-*.html")
        if re.search(r"(\d+)", p.stem)
    }
    json_pages = {
        int(re.search(r"(\d+)", p.stem).group(1))
        for p in (args.source / "pages").glob("page-*.json")
        if re.search(r"(\d+)", p.stem)
    }
    text_pages = set(pages)
    if html_pages != text_pages:
        failures.append(
            f"Source HTML/text mismatch: html-only={sorted(html_pages-text_pages)}, "
            f"text-only={sorted(text_pages-html_pages)}"
        )
    if json_pages != text_pages:
        failures.append(
            f"Source JSON/text mismatch: json-only={sorted(json_pages-text_pages)}, "
            f"text-only={sorted(text_pages-json_pages)}"
        )

    manifest = load_manifest(args.source)
    chapters = [c for v in manifest.get("volumes", []) for c in v.get("chapters", [])]

    if not chapters:
        failures.append("Manifest contains no chapters.")

    manifest_pages = {
        int(p["internal_page"]) for p in manifest.get("pages", [])
    }
    if manifest_pages != text_pages:
        failures.append(
            f"Manifest/source mismatch: manifest-only={sorted(manifest_pages-text_pages)}, "
            f"source-only={sorted(text_pages-manifest_pages)}"
        )

    if text_pages:
        start = int(manifest.get("content_start_internal_page", min(text_pages)))
        expected_source_pages = {
            p for p in range(start, max(text_pages) + 1)
            if p not in KNOWN_SOURCE_GAPS
        }
        missing_source_pages = sorted(expected_source_pages - text_pages)
        if missing_source_pages:
            failures.append(
                f"Missing source pages in retained range {start}–{max(text_pages)}: "
                f"{missing_source_pages}"
            )

    seen_pages = []
    for c in chapters:
        n = int(c["number"])
        start = int(c["start_internal_page"])
        end = int(c["end_internal_page"])
        if start > end:
            failures.append(f"Chapter {n}: start > end")
        for p in range(start, end + 1):
            if p in KNOWN_SOURCE_GAPS and p not in pages:
                continue
            seen_pages.append(p)
            if p not in pages:
                failures.append(f"Chapter {n}: missing source page {p}")

        for p in range(start, end + 1):
            json_path = args.source / "pages" / f"page-{p:04d}.json"
            html_path = args.source / "html" / f"page-{p:04d}.html"
            if not json_path.exists():
                failures.append(f"Chapter {n}: missing page JSON {json_path}")
                continue
            record = json.loads(json_path.read_text(encoding="utf-8"))
            source_text = pages.get(p, "")
            forbidden = {"text", "description", "meta_description"} & set(record)
            if forbidden:
                failures.append(
                    f"Source page {p}: redundant JSON fields present: {sorted(forbidden)}"
                )
            if "paragraphs" not in record:
                failures.append(f"Source page {p}: paragraphs metadata missing")
            else:
                paragraph_text = norm("\n".join(record["paragraphs"]))
                body_text = source_text.split("\nهامش\n", 1)[0]
                if paragraph_text != norm(body_text):
                    failures.append(
                        f"Source page {p}: JSON paragraphs differ from canonical prose"
                    )
            if "references" not in record or "reference_count" not in record:
                failures.append(f"Source page {p}: references metadata missing")
            elif record["reference_count"] != len(record["references"]):
                failures.append(f"Source page {p}: reference_count mismatch")
            else:
                # References are structural metadata. Their markers may
                # legitimately remain inline in the prose.
                for reference in record["references"]:
                    marker = str(reference.get("marker", "")).strip()
                    if not marker:
                        failures.append(
                            f"Source page {p}: reference has an empty marker"
                        )
            if not html_path.exists():
                failures.append(f"Chapter {n}: missing source HTML {html_path}")

        target = args.output / f"chapter-{n:02d}.html"
        if not target.exists():
            failures.append(f"Chapter {n}: missing generated file {target}")
            continue
        raw = target.read_text(encoding="utf-8")
        found = [int(x) for x in MARKER.findall(raw)]
        expected = [p for p in range(start, end + 1) if p in pages]
        if found != expected:
            failures.append(f"Chapter {n}: page markers {found} != expected {expected}")
        if "reader.js" not in raw:
            failures.append(f"Chapter {n}: reader.js missing")
        if 'data-source-book=' not in raw:
            failures.append(f"Chapter {n}: source-book provenance missing")

    # Verify generated HTML contains the actual canonical text for every
    # source page, not merely a page-number marker.
    for c in chapters:
        n = int(c["number"])
        target = args.output / f"chapter-{n:02d}.html"
        if not target.exists():
            continue
        soup = BeautifulSoup(target.read_text(encoding="utf-8"), "html.parser")
        markers = soup.select(".pdf-page-marker[data-source-internal-page]")
        for i, marker in enumerate(markers):
            page = int(marker["data-source-internal-page"])
            next_marker = markers[i + 1] if i + 1 < len(markers) else None
            pieces = []
            node = marker.next_sibling
            while node is not None and node is not next_marker:
                if getattr(node, "get_text", None):
                    pieces.append(node.get_text(" ", strip=True))
                node = node.next_sibling
            generated = norm(" ".join(pieces))
            expected = pages.get(page)
            if expected is not None and generated != expected:
                failures.append(
                    f"Chapter {n}, source page {page}: generated text differs from canonical text"
                )

    duplicates = sorted({p for p in seen_pages if seen_pages.count(p) > 1})
    if duplicates:
        failures.append(f"Source pages assigned to multiple chapters: {duplicates}")

    if seen_pages:
        ordered = sorted(set(seen_pages))
        expected = [
            p for p in range(ordered[0], ordered[-1] + 1)
            if p not in KNOWN_SOURCE_GAPS
        ]
        if ordered != expected:
            failures.append(
                f"Assigned source-page coverage has unexpected gaps: expected "
                f"{expected}, got {ordered}"
            )

    if failures:
        print("VALIDATION FAILED")
        for item in failures:
            print(f" - {item}")
        return 1

    print(f"VALIDATION PASSED: {len(chapters)} chapters, {len(seen_pages)} assigned pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
