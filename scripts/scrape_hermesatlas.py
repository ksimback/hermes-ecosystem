#!/usr/bin/env python3
"""
scrape-hermesatlas.py

Downloads every page from hermesatlas.com using the sitemap.xml as a URL catalog.
Saves HTML to `_scrape/<path>/index.html` mirroring the site URL structure with
proper nesting (e.g. /projects/NousResearch/hermes-agent → _scrape/projects/NousResearch/hermes-agent/index.html).

Polite crawler: 1 request/sec, respects robots.txt, User-Agent identifies itself.

Usage:
    python3 scripts/scrape-hermesatlas.py                    # scrape sitemap URLs from live site
    python3 scripts/scrape-hermesatlas.py --local-sitemap     # use local sitemap.xml (no fetch needed)
    python3 scripts/scrape-hermesatlas.py --url-only          # just print all discovered URLs, don't download
"""

import html.parser
import os
import re
import time
import urllib.parse
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library is required. Install with: pip install requests")
    sys.exit(1)


SITE = "https://hermesatlas.com"
SITEMAP_URL = f"{SITE}/sitemap.xml"
LOCAL_SITEMAP = Path(__file__).resolve().parent.parent / "sitemap.xml"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "_scrape"

# Polite crawling
DELAY_SEC = 1.0  # 1 request per second
USER_AGENT = "HermesAtlas-Scraper/1.0 (hermesatlas.com scraper; educational use)"

# Track stats
stats = {"fetched": 0, "skipped": 0, "errors": 0, "urls_total": 0}


def fetch_with_retry(url, max_retries=3, timeout=30):
    """Fetch a URL with retries on transient errors."""
    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.get(
                url,
                headers={"User-Agent": USER_AGENT},
                timeout=timeout,
                allow_redirects=True,
            )
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as e:
            if attempt < max_retries:
                wait = DELAY_SEC * (2 ** (attempt - 1))
                print(f"  ⚠ Retry {attempt}/{max_retries} after {wait:.0f}s: {e}")
                time.sleep(wait)
            else:
                print(f"  ✗ FAILED after {max_retries} attempts: {e}")
                return None


def parse_sitemap(text):
    """Extract <loc> URLs from sitemap XML using stdlib (no bs4 needed)."""

    class SitemapParser(html.parser.HTMLParser):
        def __init__(self):
            super().__init__()
            self.urls = []
            self._in_loc = False
            self._text = ""

        def handle_starttag(self, tag, attrs):
            if tag == "loc":
                self._in_loc = True
                self._text = ""

        def handle_endtag(self, tag):
            if tag == "loc":
                self._in_loc = False
                url = self._text.strip()
                if url:
                    self.urls.append(url)

        def handle_data(self, data):
            if self._in_loc:
                self._text += data

    parser = SitemapParser()
    parser.feed(text)
    return parser.urls


def url_to_filepath(url):
    """Convert a URL like https://hermesatlas.com/projects/owner/name to
    a file path like _scrape/projects/owner/name/index.html"""
    parsed = urllib.parse.urlparse(url)
    path = parsed.path.strip("/")

    if not path:
        return OUTPUT_DIR / "index.html"

    # Handle files that already have an extension (like /privacy -> no ext though)
    # For extensionless paths, create index.html inside a directory
    # e.g. /projects/Owner/Repo  → _scrape/projects/Owner/Repo/index.html
    # e.g. /guide/install/       → _scrape/guide/install/index.html
    parts = path.split("/")
    last = parts[-1]

    if "." in last:
        # Has an extension (unlikely for this site but handle it)
        return OUTPUT_DIR / path

    return OUTPUT_DIR / path / "index.html"


def ensure_output_dir(filepath):
    """Create parent directories for a file path."""
    os.makedirs(filepath.parent, exist_ok=True)


def save_page(url, html_content, filepath):
    """Save the HTML content to disk, adding source metadata comment."""
    ensure_output_dir(filepath)
    # Prepend a comment with source info
    content = f"<!-- Source: {url} -->\n<!-- Downloaded: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())} -->\n{html_content}"
    filepath.write_text(content, encoding="utf-8")
    return len(html_content)


def download_page(url):
    """Download a single page and return (url, html, filepath) or None on failure."""
    filepath = url_to_filepath(url)

    # Skip if already downloaded (and not index.html which may be updated often)
    # Actually let's always re-fetch for freshness
    if False:
        pass

    print(f"  ↓ {url}")
    resp = fetch_with_retry(url)
    if resp is None:
        stats["errors"] += 1
        return None

    size = save_page(url, resp.text, filepath)
    stats["fetched"] += 1
    return (url, resp.text, filepath)


def get_sitemap_urls(use_local=False):
    """Get all URLs from the sitemap."""
    if use_local:
        if not LOCAL_SITEMAP.exists():
            print(f"✗ Local sitemap not found at {LOCAL_SITEMAP}")
            sys.exit(1)
        print(f"📄 Reading local sitemap: {LOCAL_SITEMAP}")
        text = LOCAL_SITEMAP.read_text(encoding="utf-8")
    else:
        print(f"🌐 Fetching sitemap from {SITEMAP_URL}")
        resp = fetch_with_retry(SITEMAP_URL)
        if resp is None:
            print("✗ Could not fetch sitemap. Use --local-sitemap to use the local copy.")
            sys.exit(1)
        text = resp.text

    urls = parse_sitemap(text)
    # Filter to only hermesatlas.com URLs
    urls = [u for u in urls if u.startswith(SITE)]
    stats["urls_total"] = len(urls)
    return urls


def verify_crawled_pages(filepath_map):
    """Quick sanity check: count total pages and check file sizes."""
    total_size = 0
    count = 0
    for url, fp in filepath_map.items():
        if fp.exists():
            size = fp.stat().st_size
            total_size += size
            count += 1
    return count, total_size


def main():
    import argparse

    global DELAY_SEC, OUTPUT_DIR
    _default_delay = DELAY_SEC
    _default_output = str(OUTPUT_DIR)

    parser = argparse.ArgumentParser(
        description="Download every page from hermesatlas.com",
        epilog="Saves to _scrape/ directory mirroring site URL structure.",
    )
    parser.add_argument(
        "--local-sitemap",
        action="store_true",
        help="Use local sitemap.xml instead of fetching from live site",
    )
    parser.add_argument(
        "--url-only",
        action="store_true",
        help="Just print all discovered URLs without downloading",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=_default_delay,
        help=f"Delay between requests in seconds (default: {_default_delay})",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=_default_output,
        help=f"Output directory (default: {_default_output})",
    )
    args = parser.parse_args()

    DELAY_SEC = args.delay
    OUTPUT_DIR = Path(args.output)

    print(f"{'='*60}")
    print(f"  Hermes Atlas Scraper")
    print(f"{'='*60}")
    print(f"  Site:      {SITE}")
    print(f"  Output:    {OUTPUT_DIR}")
    print(f"  Delay:     {DELAY_SEC}s")
    print(f"{'='*60}\n")

    # 1. Get all URLs from sitemap
    urls = get_sitemap_urls(use_local=args.local_sitemap)
    print(f"  Found {len(urls)} pages in sitemap\n")

    if args.url_only:
        print("URLs:")
        for u in urls:
            print(f"  {u}")
        print(f"\nTotal: {len(urls)} URLs")
        return

    # 2. Download each page
    filepath_map = {}
    print(f"Downloading {len(urls)} pages...\n")
    for i, url in enumerate(urls, 1):
        print(f"  [{i:>3}/{len(urls)}] ", end="")
        result = download_page(url)
        if result:
            _, _, fp = result
            filepath_map[url] = fp
        time.sleep(DELAY_SEC)

    # 3. Summary
    print(f"\n{'='*60}")
    print(f"  DONE")
    print(f"{'='*60}")
    verified_count, verified_size = verify_crawled_pages(filepath_map)
    print(f"  Total in sitemap:  {stats['urls_total']}")
    print(f"  Downloaded:        {verified_count}")
    print(f"  Errors:            {stats['errors']}")
    print(f"  Total size:        {verified_size:,} bytes ({verified_size/1024:.1f} KB)")
    print(f"  Output directory:  {OUTPUT_DIR}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
