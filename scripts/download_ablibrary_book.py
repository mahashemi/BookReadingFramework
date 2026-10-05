#!/usr/bin/env python3
"""
Download and canonically extract textual pages from Ahlulbayt Library for Book 3.

Example:
    python scripts/download_ablibrary_book.py \
      --book-id 17168 \
      --start-page 1 \
      --max-pages 200 \
      --output "reference/ablibrary/jehad-bil-nafs-vol-1-and-2-ayatollah-mazaheri"

For each internal page the script saves:
    html/page-0001.html   # exact downloaded HTML
    text/page-0001.txt    # extracted book text
    manifest.json         # page/source metadata

The HTML is retained as the retrieval layer so extraction can be re-run if
the site's DOM changes. Extracted text is a candidate canonical source only
when every page uses the same successful DOM extraction path. The script does
not OCR or silently correct spelling.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BASE_URL = "https://ablibrary.net/book_content/b/{book_id}/{page}"
DEFAULT_TIMEOUT = 30
DEFAULT_DELAY = 0.8
DEFAULT_MAX_PAGES = 500
DEFAULT_WORKERS = 5

# One requests.Session per worker thread for connection reuse.
thread_local = threading.local()

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/140 Safari/537.36"
)


def make_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=5,
        connect=5,
        read=5,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;"
                "q=0.9,*/*;q=0.8"
            ),
            "Accept-Language": "fa,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }
    )
    return session


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def page_url(book_id: str, page: int) -> str:
    return BASE_URL.format(book_id=book_id, page=page)


def extract_metadata(soup: BeautifulSoup, page: int) -> dict:
    title = None
    description = None
    printed_page = None

    tag = soup.find("title")
    if tag:
        title = tag.get_text(" ", strip=True)

    tag = soup.find("meta", attrs={"name": "description"})
    if tag:
        description = tag.get("content")

    if title:
        match = re.search(r"(?:صفحة|صفحه)\s*([0-9۰-۹]+)", title)
        if match:
            printed_page = match.group(1)

    return {
        "internal_page": page,
        "printed_page": printed_page,
        "title": title,
        "description": description,
    }


def extract_references(soup: BeautifulSoup) -> list[dict]:
    """Extract the source's cited references from Ahlulbayt footnotes.

    Ahlulbayt marks the reference section with:
        data-abl-content="footnote"
    We preserve the displayed footnote text rather than interpreting or
    normalizing the cited work, chapter, verse, volume, or page.
    """
    section = soup.select_one('[data-abl-content="footnote"]')
    if not section:
        return []

    references = []
    for raw in section.get_text("\n", strip=True).splitlines():
        line = normalize_text(raw)
        if not line or line == "هامش":
            continue
        match = re.match(r"^\(\s*([0-9۰-۹]+)\s*\)\s*[.\-–—]?\s*(.*)$", line)
        if not match:
            continue
        references.append({
            "marker": match.group(1),
            "text": match.group(2).strip(),
        })
    return references


def clean_container(element) -> str:
    # Remove site chrome and executable content before extracting text.
    for tag in element.find_all(
        ["script", "style", "noscript", "svg", "nav", "header", "footer"]
    ):
        tag.decompose()

    return normalize_text(element.get_text("\n", strip=True))


def extract_book_body(soup: BeautifulSoup):
    """Return the visible book body, full text, and body paragraphs.

    The visible prose is under itemProp="articleBody". Footnotes are retained
    at the end of the page text, while represented separately in references[];
    they are deliberately excluded from paragraphs[].
    """
    body = soup.select_one('[itemprop="articleBody"]')
    if not body:
        return None, None, []

    paragraphs = []
    for child in body.find_all(recursive=False):
        if child.name == "section" and child.get("data-abl-content") == "footnote":
            continue

        nodes = child.find_all(["h1", "h2", "h3", "p", "span"], recursive=True)
        if not nodes:
            nodes = [child]

        for node in nodes:
            if node.name == "span" and node.find_parent(["h1", "h2", "h3", "p"]):
                continue
            raw = node.get_text("\\n", strip=True)
            for line in raw.split("\\n"):
                line = normalize_text(line)
                if line:
                    paragraphs.append(line)

    footnote_lines = []
    footnote = body.select_one('[data-abl-content="footnote"]')
    if footnote:
        raw = footnote.get_text("\\n", strip=True)
        for line in raw.split("\\n"):
            line = normalize_text(line)
            if line and line != "هامش":
                footnote_lines.append(line)

    full_lines = paragraphs + (["هامش"] + footnote_lines if footnote_lines else [])
    text = normalize_text("\\n".join(full_lines))
    return body, text, paragraphs

def find_book_content(soup: BeautifulSoup) -> tuple[str | None, str, list[str]]:
    """Find the actual rendered book text and preserve logical paragraphs."""

    body, text, paragraphs = extract_book_body(soup)
    if text:
        return text, "articleBody", paragraphs

    candidates = []

    selectors = [
        "article",
        "main",
        '[class*="book-content"]',
        '[class*="bookContent"]',
        '[class*="reader-content"]',
        '[class*="readerContent"]',
        '[class*="page-content"]',
        '[class*="pageContent"]',
        '[id*="book-content"]',
        '[id*="bookContent"]',
        '[id*="reader-content"]',
        '[id*="readerContent"]',
    ]

    for selector in selectors:
        for element in soup.select(selector):
            text = clean_container(element)
            if len(text) < 100:
                continue

            score = len(text)
            arabic_chars = len(re.findall(r"[\u0600-\u06ff]", text))
            score += arabic_chars * 3

            lowered = text.lower()
            for token in (
                "login",
                "sign in",
                "facebook",
                "instagram",
                "telegram",
                "search",
            ):
                if token in lowered:
                    score -= 500

            candidates.append((score, text, selector, element))

    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        _, text, selector, element = candidates[0]
        paragraphs = [
            line for line in text.split("\n") if line.strip()
        ]
        return text, selector, paragraphs

    if soup.body:
        text = clean_container(soup.body)
        if len(text) >= 100:
            return text, "body-fallback", [
                line for line in text.split("\n") if line.strip()
            ]

    return None, "none", []

def get_worker_session() -> requests.Session:
    """Give each worker its own requests.Session for safe connection reuse."""
    if not hasattr(thread_local, "session"):
        thread_local.session = make_session()
    return thread_local.session


def download_page(
    session: requests.Session | None,
    book_id: str,
    page: int,
    html_dir: Path,
    text_dir: Path,
    pages_dir: Path,
    timeout: int,
    force: bool,
    delay: float = 0.0,
) -> dict:
    url = page_url(book_id, page)

    if session is None:
        session = get_worker_session()

    if delay > 0:
        time.sleep(delay)

    response = session.get(url, timeout=timeout)

    if response.status_code == 404:
        raise FileNotFoundError(f"HTTP 404: {url}")

    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "")
    if "html" not in content_type.lower():
        raise RuntimeError(
            f"Unexpected Content-Type {content_type!r} for {url}"
        )

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    metadata = extract_metadata(soup, page)
    references = extract_references(soup)
    text, extraction_method, paragraphs = find_book_content(soup)

    if not text:
        # Description is useful for diagnostics, but it is often truncated
        # and therefore is never presented as a successful full extraction.
        description = metadata.get("description")
        if description:
            text = normalize_text(description)
            paragraphs = [text]
            extraction_method = "meta-description-fallback"
        else:
            raise RuntimeError(
                "Could not locate book text in the downloaded HTML."
            )

    html_file = html_dir / f"page-{page:04d}.html"
    text_file = text_dir / f"page-{page:04d}.txt"
    page_file = pages_dir / f"page-{page:04d}.json"

    if force or not html_file.exists():
        html_file.write_text(html, encoding="utf-8")

    if force or not text_file.exists():
        text_file.write_text(text, encoding="utf-8")

    page_record = {
        **metadata,
        "meta_description": metadata.get("description"),
        "description": text,
        "url": response.url,
        "extraction_method": extraction_method,
        "characters": len(text),
        "text": text,
        "paragraphs": paragraphs,
        "references": references,
        "reference_count": len(references),
        "text_file": str(text_file),
    }
    if force or not page_file.exists():
        page_file.write_text(json.dumps(page_record, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "internal_page": page,
        "printed_page": metadata["printed_page"],
        "title": metadata["title"],
        "url": response.url,
        "html_file": str(html_file),
        "text_file": str(text_file),
        "page_file": str(page_file),
        "extraction_method": extraction_method,
        "characters": len(text),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument(
        "--book-id",
        default="17168",
        help="Ahlulbayt Library book ID (default: 17168).",
    )
    parser.add_argument(
        "--start-page",
        type=int,
        default=1,
        help="First internal page to download (default: 1).",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES,
        help=f"Maximum pages to attempt (default: {DEFAULT_MAX_PAGES}).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("reference/ablibrary/jehad-bil-nafs-vol-1-and-2-ayatollah-mazaheri"),
        help="Output directory.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"Delay between requests in seconds (default: {DEFAULT_DELAY}).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"HTTP timeout in seconds (default: {DEFAULT_TIMEOUT}).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        help=f"Number of parallel download workers (default: {DEFAULT_WORKERS}).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download and re-extract existing pages.",
    )

    args = parser.parse_args()

    if args.start_page < 1:
        parser.error("--start-page must be >= 1")
    if args.workers < 1:
        parser.error("--workers must be >= 1")

    args.output.mkdir(parents=True, exist_ok=True)
    html_dir = args.output / "html"
    text_dir = args.output / "text"
    pages_dir = args.output / "pages"
    html_dir.mkdir(exist_ok=True)
    text_dir.mkdir(exist_ok=True)
    pages_dir.mkdir(exist_ok=True)

    manifest_path = args.output / "manifest.json"

    if manifest_path.exists() and not args.force:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {
            "book_id": str(args.book_id),
            "source": "https://ablibrary.net",
            "endpoint": BASE_URL,
            "pages": [],
        }

    pages = {
        item["internal_page"]: item
        for item in manifest.get("pages", [])
    }

    print(f"Book ID: {args.book_id}")
    print(f"Pages: {args.start_page}.."
          f"{args.start_page + args.max_pages - 1}")
    print(f"Workers: {args.workers}")
    print(f"Output: {args.output}")

    # Work in batches so we can still detect the end of the book without
    # scheduling hundreds of speculative requests after the final page.
    consecutive_404s = 0
    attempted = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        batch_start = args.start_page

        while attempted < args.max_pages:
            batch_size = min(args.workers, args.max_pages - attempted)
            batch_pages = list(range(batch_start, batch_start + batch_size))

            futures = {
                executor.submit(
                    download_page,
                    None,
                    str(args.book_id),
                    page,
                    html_dir,
                    text_dir,
                    pages_dir,
                    args.timeout,
                    args.force,
                    args.delay,
                ): page
                for page in batch_pages
            }

            results = {}
            for future in as_completed(futures):
                page = futures[future]
                try:
                    results[page] = ("ok", future.result())
                except FileNotFoundError as exc:
                    results[page] = ("404", str(exc))
                except Exception as exc:
                    results[page] = ("error", str(exc))

            for page in batch_pages:
                status, value = results[page]

                if status == "ok":
                    pages[page] = value
                    print(
                        f"✓ internal={page} "
                        f"printed={value['printed_page']} "
                        f"chars={value['characters']} "
                        f"via={value['extraction_method']}"
                    )
                    consecutive_404s = 0
                elif status == "404":
                    print(f"✗ {value}", file=sys.stderr)
                    consecutive_404s += 1
                else:
                    print(f"✗ internal={page}: {value}", file=sys.stderr)
                    consecutive_404s = 0

                attempted += 1
                manifest["pages"] = [pages[n] for n in sorted(pages)]
                manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
                manifest_path.write_text(
                    json.dumps(manifest, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )

                if consecutive_404s >= 3:
                    break

            if consecutive_404s >= 3:
                print("Stopping after 3 consecutive 404 pages.", file=sys.stderr)
                break

            batch_start += batch_size

    extraction_counts = {}
    for entry in pages.values():
        method = entry.get("extraction_method", "unknown")
        extraction_counts[method] = extraction_counts.get(method, 0) + 1

    manifest["extraction_audit"] = {
        "page_count": len(pages),
        "methods": extraction_counts,
        "all_pages_have_text": all(
            Path(entry["text_file"]).exists() for entry in pages.values()
        ),
        "all_pages_have_html": all(
            Path(entry["html_file"]).exists() for entry in pages.values()
        ),
        "canonical_candidate": (
            len(extraction_counts) == 1
            and "meta-description-fallback" not in extraction_counts
            and "body-fallback" not in extraction_counts
            and "none" not in extraction_counts
        ),
    }

    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print()
    print(f"Manifest: {manifest_path}")
    print(f"Pages recorded: {len(pages)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
