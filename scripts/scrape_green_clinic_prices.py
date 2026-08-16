#!/usr/bin/env python3
"""Collect current Green Clinic laboratory prices from public catalogue pages.

The script only creates a local review JSON; it never writes to Supabase.
"""
import argparse
import html
import json
import re
import time
from collections import deque
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

BASE = "https://www.green-clinica.ru"
ROOT = f"{BASE}/analyzes/"
HEADERS = {"User-Agent": "GreenClinicCatalogReview/1.0"}


def fetch(url: str) -> str:
    request = Request(url, headers=HEADERS)
    with urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace")


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def parse_items(page: str, source_url: str) -> list[dict]:
    blocks = re.findall(r'<div class="analyse_item">(.*?)(?=<div class="analyse_item">|<div class="bx-pagination|$)', page, re.S)
    rows = []
    for block in blocks:
        match = re.search(r'analyse_artnum">\s*(.*?)\s*</span>\s*(.*?)</a>', block, re.S)
        price = re.search(r'analyse_price[^>]*>\s*([\d\s]+)\s*руб', block, re.S)
        if not match or not price:
            continue
        code, title = clean(match.group(1)), clean(match.group(2))
        rows.append({
            "green_clinic_code": code,
            "title": title,
            "price_rub": int(re.sub(r"\D", "", price.group(1))),
            "source_url": source_url,
        })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-pages", type=int, default=0)
    args = parser.parse_args()
    root = fetch(ROOT)
    categories = sorted({urljoin(BASE, path) for path in re.findall(r'href="(/analyzes/[^"?]+/)"\s+class="service_item', root)})
    queue = deque(categories)
    visited, rows, failures = set(), {}, []
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    while queue and (not args.max_pages or len(visited) < args.max_pages):
        url = queue.popleft()
        if url in visited:
            continue
        visited.add(url)
        try:
            page = fetch(url)
        except Exception as error:
            failures.append({"url": url, "error": str(error)})
            continue
        for item in parse_items(page, url):
            rows[item["green_clinic_code"]] = item
        for href in re.findall(r'href="([^"]*\?PAGEN_\d+=\d+)"', page):
            next_url = urljoin(BASE, href)
            if next_url not in visited:
                queue.append(next_url)
        time.sleep(0.12)
        output_path.write_text(json.dumps({"source": ROOT, "pages_checked": len(visited), "items": sorted(rows.values(), key=lambda row: row["green_clinic_code"]), "failures": failures}, ensure_ascii=False, indent=2), encoding="utf-8")
    output = {"source": ROOT, "pages_checked": len(visited), "items": sorted(rows.values(), key=lambda row: row["green_clinic_code"]), "failures": failures}
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"pages_checked": len(visited), "items": len(rows), "failures": len(failures)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
