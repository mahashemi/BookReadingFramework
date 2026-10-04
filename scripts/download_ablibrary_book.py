#!/usr/bin/env python3
"""
Download scan pages from ablibrary.net for local OCR/source verification.

Example:
    python scripts/download_ablibrary_book.py \
      --url "https://ablibrary.net/books/17168?page=11&page-label=4" \
      --output "Library/Book 03 - Jihad al-Nafs/reference/ablibrary"

The supplied URL is treated as the page corresponding to the first requested
download. The script discovers the page image from the HTML, then walks the
book's ?page=N URLs, saving images and a manifest. It is resumable: existing
files are skipped unless --force is used.

Notes:
- ablibrary uses an internal page number and a separate printed page label.
- We preserve both in manifest.json rather than assuming they are identical.
- The script does not attempt OCR; the downloaded scans remain the source of truth.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


DEFAULT_TIMEOUT = 30
DEFAULT_DELAY = 0.8
DEFAULT_MAX_PAGES = 500
USER_AGENT = (
    "Mozilla/5.0 (compatible; BookReadingFramework source downloader/1.0; "
    "+https://github.com/mahashemi/BookReadingFramework)"
)


def make_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=5,
        connect=5,
        read=5,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET", "HEAD"}),
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "fa,en;q=0.8",
        }
    )
    return session


def page_url(base_url: str, page_number: int) -> str:
    parsed = urlparse(base_url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["page"] = [str(page_number)]
    # page-label is deliberately removed: the server should derive the label
    # from the requested internal page, rather than us guessing it.
    query.pop("page-label", None)
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


def first_int(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\d+", value)
    return int(match.group()) if match else None


def extract_page_label(soup: BeautifulSoup, url: str) -> str | None:
    parsed = parse_qs(urlparse(url).query)
    if parsed.get("page-label"):
        return parsed["page-label"][0]

    # Try common attributes/text without assuming a particular site markup.
    patterns = (
        re.compile(r"""page-label\s*[:=]\s*[\'"]?([^\'"&<> ]+)""", re.I),
        re.compile(r"(?:صفحه|صفحة|page)\s*[-:]?\s*([\d۰-۹]+)", re.I),
    )
    html = str(soup)
    for pattern in patterns:
        match = pattern.search(html)
        if match:
            return match.group(1)
    return None


def score_image(url: str, attrs: dict[str, str]) -> int:
    haystack = " ".join(
        [
            url,
            attrs.get("class", ""),
            attrs.get("id", ""),
            attrs.get("alt", ""),
            attrs.get("data-testid", ""),
        ]
    ).lower()
    score = 0
    for token, points in (
        ("page", 8),
        ("book", 4),
        ("reader", 4),
        ("scan", 5),
        ("image", 2),
        ("cover", -8),
        ("logo", -10),
        ("icon", -10),
        ("avatar", -10),
    ):
        if token in haystack:
            score += points
    return score


def extract_image_url(soup: BeautifulSoup, page_url_value: str) -> str | None:
    candidates: list[tuple[int, str]] = []

    for tag in soup.find_all(["img", "source"]):
        attrs = {str(k): " ".join(v) if isinstance(v, list) else str(v)
                 for k, v in tag.attrs.items()}

        urls: list[str] = []
        for key in ("src", "data-src", "data-lazy-src", "data-original", "href"):
            if attrs.get(key):
                urls.append(attrs[key])

        srcset = attrs.get("srcset", "")
        if srcset:
            urls.extend(item.strip().split(" ")[0] for item in srcset.split(","))

        for raw in urls:
            if not raw or raw.startswith("data:"):
                continue
            absolute = urljoin(page_url_value, raw)
            if absolute.startswith(("http://", "https://")):
                candidates.append((score_image(absolute, attrs), absolute))

    if not candidates:
        return None

    # Prefer likely scan/page images and avoid tiny UI assets.
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def infer_extension(content_type: str, image_url: str) -> str:
    content_type = content_type.lower().split(";")[0]
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/tiff": ".tif",
        "image/bmp": ".bmp",
    }
    if content_type in mapping:
        return mapping[content_type]
    suffix = Path(urlparse(image_url).path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"} else ".bin"


def download_page(
    session: requests.Session,
    url: str,
    output_dir: Path,
    page_number: int,
    timeout: int,
    force: bool,
) -> dict:
    response = session.get(url, timeout=timeout)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    image_url = extract_image_url(soup, response.url)
    label = extract_page_label(soup, response.url)

    if not image_url:
        raise RuntimeError(
            "Could not find a page image in the HTML. "
            "The site may require browser-rendered JavaScript; "
            "inspect this page before adding a browser-specific adapter: "
            + response.url
        )

    image_response = session.get(image_url, timeout=timeout, stream=True)
    image_response.raise_for_status()

    extension = infer_extension(
        image_response.headers.get("Content-Type", ""),
        image_url,
    )
    filename = f"page-{page_number:04d}{extension}"
    destination = output_dir / filename

    if force or not destination.exists() or destination.stat().st_size == 0:
        with destination.open("wb") as handle:
            for chunk in image_response.iter_content(chunk_size=1024 * 256):
                if chunk:
                    handle.write(chunk)

    return {
        "page": page_number,
        "page_label": label,
        "page_url": response.url,
        "image_url": image_url,
        "file": filename,
        "bytes": destination.stat().st_size,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="A valid ablibrary book page URL.")
    parser.add_argument("--output", required=True, type=Path, help="Local output directory.")
    parser.add_argument("--start-page", type=int, help="Internal page number to start from.")
    parser.add_argument("--max-pages", type=int, default=DEFAULT_MAX_PAGES)
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--force", action="store_true", help="Redownload existing files.")
    args = parser.parse_args()

    parsed = urlparse(args.url)
    book_match = re.search(r"/books/(\d+)", parsed.path)
    if not book_match:
        parser.error("--url must look like https://ablibrary.net/books/<book-id>?...")

    start_page = args.start_page
    if start_page is None:
        start_page = first_int(parse_qs(parsed.query).get("page", [None])[0])
    if start_page is None:
        parser.error("Could not determine the internal page number; pass --start-page.")

    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "manifest.json"
    session = make_session()

    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {
            "book_id": book_match.group(1),
            "source": "https://ablibrary.net",
            "seed_url": args.url,
            "pages": [],
        }

    existing = {entry["page"]: entry for entry in manifest["pages"]}

    print(f"Book {manifest['book_id']}: starting at internal page {start_page}")
    print(f"Output: {args.output}")

    consecutive_failures = 0

    for page_number in range(start_page, start_page + args.max_pages):
        url = page_url(args.url, page_number)
        try:
            entry = download_page(
                session=session,
                url=url,
                output_dir=args.output,
                page_number=page_number,
                timeout=args.timeout,
                force=args.force,
            )
            existing[page_number] = entry
            consecutive_failures = 0
            manifest["pages"] = [existing[n] for n in sorted(existing)]
            manifest_path.write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(
                f"✓ page={page_number} label={entry['page_label']} "
                f"file={entry['file']} bytes={entry['bytes']}"
            )
        except Exception as exc:
            consecutive_failures += 1
            print(f"✗ page={page_number}: {exc}", file=sys.stderr)
            # A short run of missing pages can be a transient failure. Three
            # consecutive failures is a safer stopping point than one.
            if consecutive_failures >= 3:
                print("Stopping after 3 consecutive failures.", file=sys.stderr)
                break

        time.sleep(max(0.0, args.delay))

    print(f"Manifest: {manifest_path}")
    print(f"Downloaded/recorded pages: {len(existing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
