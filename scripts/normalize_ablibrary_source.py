#!/usr/bin/env python3
"""Normalize an already-downloaded Ahlulbayt source tree.

This is intentionally local/offline: it reads the retained Ahlulbayt HTML and
updates page JSON metadata without re-downloading the book.

It:
  * extracts cited references from the site's data-abl-content="footnote"
    section;
  * keeps references out of paragraphs[] while retaining them in full text;
  * adds references/reference_count to every page JSON and manifest entry;
  * optionally removes front matter before the chosen internal page;
  * audits JSON/HTML/text/manifest page coverage and reports missing pages.

Example:
  python3 scripts/normalize_ablibrary_source.py \
    --source reference/ablibrary \
    --keep-from 8 \
    --trim
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


PAGE_RE = re.compile(r"page-(\d+)\.(?:json|html|txt)$")


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def page_number(path: Path) -> int:
    match = PAGE_RE.search(path.name)
    if not match:
        raise ValueError(f"Not a page file: {path}")
    return int(match.group(1))



def extract_text_and_paragraphs(html: str) -> tuple[str, list[str]]:
    """Extract only the rendered book prose from articleBody.

    Ahlulbayt puts the book prose, footnotes, and page-navigation UI inside
    the same articleBody container. The footnote section is the hard boundary:
    prose before it is retained; the footnote definitions and everything after
    it are excluded from canonical text/paragraphs.

    We intentionally extract from the rendered DOM rather than JSON-LD
    articleBody because the rendered DOM preserves the source's line breaks.
    """
    soup = BeautifulSoup(html, "html.parser")
    body = soup.select_one('[itemprop="articleBody"]')
    if body is None:
        return "", []

    work = BeautifulSoup(str(body), "html.parser").select_one(
        '[itemprop="articleBody"]'
    )
    if work is None:
        return "", []

    footnote = work.select_one('[data-abl-content="footnote"]')
    if footnote is not None:
        # Remove everything after the footnote at each ancestor level, then
        # remove the footnote itself. This prevents navigation/chrome from
        # leaking into the book text.
        node = footnote
        while node is not work:
            for sibling in list(node.next_siblings):
                sibling.extract()
            node = node.parent
        footnote.extract()

    for tag in work.find_all(
        ["script", "style", "noscript", "svg", "nav", "header", "footer"]
    ):
        tag.decompose()

    raw = work.get_text("\n", strip=True)
    lines = []
    for line in raw.splitlines():
        line = normalize_text(line)
        if line:
            lines.append(line)

    return normalize_text("\n".join(lines)), lines

def extract_references(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    section = soup.select_one('[data-abl-content="footnote"]')
    if not section:
        return []

    references = []
    for raw in section.get_text("\n", strip=True).splitlines():
        line = normalize_text(raw)
        if not line or line == "هامش":
            continue
        match = re.match(
            r"^\(\s*([0-9۰-۹]+)\s*\)\s*[.\-–—]?\s*(.*)$",
            line,
        )
        if not match:
            continue
        references.append({
            "marker": match.group(1),
            "text": match.group(2).strip(),
        })
    return references


def audit_tree(source: Path, manifest: dict) -> list[str]:
    problems = []
    dirs = {name: source / name for name in ("html", "text", "pages")}
    sets = {}
    for name, directory in dirs.items():
        suffix = {"html": ".html", "text": ".txt", "pages": ".json"}[name]
        sets[name] = {
            page_number(p)
            for p in directory.glob(f"page-*{suffix}")
            if PAGE_RE.search(p.name)
        }

    manifest_pages = {int(x["internal_page"]) for x in manifest.get("pages", [])}
    if sets["html"] != sets["text"]:
        problems.append(
            f"HTML/text mismatch: html-only={sorted(sets['html'] - sets['text'])}, "
            f"text-only={sorted(sets['text'] - sets['html'])}"
        )
    if sets["html"] != sets["pages"]:
        problems.append(
            f"HTML/JSON mismatch: html-only={sorted(sets['html'] - sets['pages'])}, "
            f"json-only={sorted(sets['pages'] - sets['html'])}"
        )
    if manifest_pages != sets["pages"]:
        problems.append(
            f"Manifest/file mismatch: manifest-only={sorted(manifest_pages - sets['pages'])}, "
            f"file-only={sorted(sets['pages'] - manifest_pages)}"
        )

    if sets["html"]:
        ordered = sorted(sets["html"])
        gaps = [
            (a, b) for a, b in zip(ordered, ordered[1:]) if b != a + 1
        ]
        if gaps:
            problems.append(f"Source page gaps: {gaps}")

    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument(
        "--keep-from",
        type=int,
        default=8,
        help="First internal page to retain (default: 8; page 8 is printed page 1).",
    )
    ap.add_argument(
        "--trim",
        action="store_true",
        help="Delete html/text/json files before --keep-from and remove them from manifest.",
    )
    args = ap.parse_args()

    source = args.source
    manifest_path = source / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"Missing manifest: {manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = {
        int(item["internal_page"]): item
        for item in manifest.get("pages", [])
    }

    json_files = sorted((source / "pages").glob("page-*.json"), key=page_number)
    updated = 0
    reference_pages = 0
    total_references = 0

    for json_file in json_files:
        page = page_number(json_file)
        html_file = source / "html" / f"page-{page:04d}.html"
        text_file = source / "text" / f"page-{page:04d}.txt"

        if not html_file.exists():
            continue

        html = html_file.read_text(encoding="utf-8")
        references = extract_references(html)
        extracted_text, paragraphs = extract_text_and_paragraphs(html)
        soup = BeautifulSoup(html, "html.parser")
        meta_tag = soup.find("meta", attrs={"name": "description"})
        meta_description = meta_tag.get("content") if meta_tag else None

        record = json.loads(json_file.read_text(encoding="utf-8"))
        if extracted_text:
            text_file.write_text(extracted_text, encoding="utf-8")
            record["characters"] = len(extracted_text)
            record["description"] = extracted_text
            record["text"] = extracted_text
            record["paragraphs"] = paragraphs
            record["extraction_method"] = "articleBody"
        record["meta_description"] = meta_description
        record["references"] = references
        record["reference_count"] = len(references)
        json_file.write_text(
            json.dumps(record, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        entry = entries.get(page)
        if entry is not None:
            entry["references"] = references
            entry["reference_count"] = len(references)
            if text_file.exists():
                entry["characters"] = len(
                    text_file.read_text(encoding="utf-8")
                )
        updated += 1
        if references:
            reference_pages += 1
            total_references += len(references)

    if args.trim:
        for directory, suffix in (
            (source / "html", ".html"),
            (source / "text", ".txt"),
            (source / "pages", ".json"),
        ):
            for path in directory.glob(f"page-*{suffix}"):
                if page_number(path) < args.keep_from:
                    path.unlink()

        entries = {
            page: entry
            for page, entry in entries.items()
            if page >= args.keep_from
        }

    ordered_entries = [entries[n] for n in sorted(entries)]
    manifest["pages"] = ordered_entries
    manifest["content_start_internal_page"] = args.keep_from
    manifest["content_start_printed_page"] = next(
        (
            e.get("printed_page")
            for e in ordered_entries
            if e.get("internal_page") == args.keep_from
        ),
        None,
    )
    manifest["metadata_audit"] = {
        "references_extracted": True,
        "pages_with_references": reference_pages,
        "total_references": total_references,
        "page_jsons_updated": updated,
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    problems = audit_tree(source, manifest)
    print(f"Updated page JSON metadata: {updated}")
    print(f"Pages containing cited references: {reference_pages}")
    print(f"Total cited references extracted: {total_references}")
    print(f"Retained content starts at internal page {args.keep_from}.")

    if problems:
        print("\nAUDIT FINDINGS")
        for problem in problems:
            print(f" - {problem}")
        return 1

    print("\nAUDIT PASSED: manifest, JSON, HTML and text page sets agree.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
