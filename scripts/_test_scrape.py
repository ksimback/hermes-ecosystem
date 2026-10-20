#!/usr/bin/env python3
"""Quick smoke test: download first 3 sitemap URLs to verify the scraper works."""
import sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent))

# Monkey-patch to limit URLs
import scrape_hermesatlas as sh

original = sh.get_sitemap_urls
def limited_get_sitemap(use_local=False):
    urls = original(use_local)
    return urls[:3]  # just the first 3

sh.get_sitemap_urls = limited_get_sitemap
sh.main()