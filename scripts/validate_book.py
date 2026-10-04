#!/usr/bin/env python3
"""Validate deterministic Jihad bil-Nafs source/chapter generation."""

from __future__ import annotations

import argparse
import html as html_lib
import json
import re
from pathlib import Path

MARKER = re.compile(r'data-source-internal-page="(\d+)"')


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

    manifest = load_manifest(args.source)
    chapters = [c for v in manifest.get("volumes", []) for c in v.get("chapters", [])]

    if not chapters:
        failures.append("Manifest contains no chapters.")

    seen_pages = []
    for c in chapters:
        n = int(c["number"])
        start = int(c["start_internal_page"])
        end = int(c["end_internal_page"])
        if start > end:
            failures.append(f"Chapter {n}: start > end")
        for p in range(start, end + 1):
            seen_pages.append(p)
            if p not in pages:
                failures.append(f"Chapter {n}: missing source page {p}")

        target = args.output / f"chapter-{n:02d}.html"
        if not target.exists():
            failures.append(f"Chapter {n}: missing generated file {target}")
            continue
        raw = target.read_text(encoding="utf-8")
        found = [int(x) for x in MARKER.findall(raw)]
        expected = list(range(start, end + 1))
        if found != expected:
            failures.append(f"Chapter {n}: page markers {found} != expected {expected}")
        if "reader.js" not in raw:
            failures.append(f"Chapter {n}: reader.js missing")
        if 'data-source-book=' not in raw:
            failures.append(f"Chapter {n}: source-book provenance missing")

    duplicates = sorted({p for p in seen_pages if seen_pages.count(p) > 1})
    if duplicates:
        failures.append(f"Source pages assigned to multiple chapters: {duplicates}")

    if failures:
        print("VALIDATION FAILED")
        for item in failures:
            print(f" - {item}")
        return 1

    print(f"VALIDATION PASSED: {len(chapters)} chapters, {len(seen_pages)} assigned pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
