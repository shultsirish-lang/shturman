#!/usr/bin/env python3
"""Extract a reviewable Helix laboratory catalogue from directory PDFs.

The output is JSON only; it never writes to Supabase. Review the generated
batch before importing it through the protected API.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

from pypdf import PdfReader

ITEM = re.compile(r"^\s*\[(?P<code>\d{2}-\d{3})\](?:\s+(?P<title>.+?))?\s*$")
NOISE = re.compile(r"^(?:\d+\s*/\s*\d+|HELIX|КЛИНИЧЕСКИЕ ИНФЕКЦИИ|ЛАБОРАТОРНЫЕ ИССЛЕДОВАНИЯ)$", re.I)


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" -–—\t")


def source_version(filename: str) -> str:
    match = re.search(r"(?:_|\s)(\d{2}_\d{2})(?:\D|$)", filename)
    return match.group(1).replace("_", "/") if match else ""


def aliases(*values: str) -> list[str]:
    text = " ".join(values).casefold()
    result: set[str] = set()
    if "herpes" in text or "герпес" in text:
        result.update({"герпес", "впг", "hsv"})
    if "varicella" in text:
        result.update({"ветряная оспа", "ветрянка", "герпес зостер"})
    if "cytomegalovirus" in text:
        result.update({"цитомегаловирус", "цмв"})
    if "papillomavirus" in text or "впч" in text:
        result.update({"впч", "вирус папилломы человека", "hpv"})
    if "целиак" in text or "глютен" in text:
        result.update({"целиакия", "глютен", "непереносимость глютена"})
    if "аллерген" in text or "allergen" in text or "immunocap" in text:
        result.update({"аллергия", "аллерголог", "аллергены"})
    return sorted(result)


def page_columns(page) -> list[list[tuple[float, str]]]:
    """Return visual text lines for each PDF column, top to bottom."""
    spans: list[tuple[float, float, str]] = []
    page.extract_text(visitor_text=lambda text, _cm, tm, _font, _size: spans.append((tm[4], tm[5], text.strip())))
    columns: list[list[tuple[float, float, str]]] = [[], []]
    for x, y, text in spans:
        if not text or x < 40 or y < 80:
            continue
        columns[0 if x < 600 else 1].append((x, y, text))
    result: list[list[str]] = []
    for column in columns:
        rows: list[list[tuple[float, float, str]]] = []
        for span in sorted(column, key=lambda item: (-item[1], item[0])):
            if rows and abs(rows[-1][0][1] - span[1]) <= 2:
                rows[-1].append(span)
            else:
                rows.append([span])
        result.append([(min(x for x, _y, _text in row), compact(" ".join(text for _x, _y, text in sorted(row)))) for row in rows])
    return result


def extract_pdf(path: Path) -> list[dict]:
    reader = PdfReader(path)
    specialty = compact(path.stem.split("_")[0].replace("Справочник ", ""))
    found: list[dict] = []
    for page_number, page in enumerate(reader.pages, start=1):
        for column in page_columns(page):
            topic = specialty
            pending: dict | None = None
            for raw_x, raw_line in column + [(0, "")]:
                line = compact(raw_line)
                if not line or NOISE.match(line):
                    if pending:
                        pending.pop("_indent", None)
                        found.append(pending)
                        pending = None
                    continue
                match = ITEM.match(line)
                if match:
                    if pending:
                        pending.pop("_indent", None)
                        found.append(pending)
                    pending = {
                        "code": match.group("code"),
                        "title": compact(match.group("title") or ""),
                        "specialty": specialty,
                        "topic": topic,
                        "source_name": path.name,
                        "source_version": source_version(path.name),
                        "source_page": page_number,
                        "_indent": raw_x,
                    }
                elif pending and raw_x >= pending["_indent"] + 20 and len(line) <= 180 and not line.startswith(("http", "www.")):
                    pending["title"] = compact(f"{pending['title']} {line}")
                else:
                    if pending:
                        pending.pop("_indent", None)
                        found.append(pending)
                        pending = None
                    if len(line) <= 110 and not line.startswith(("[", "http", "www.")):
                        topic = line
    return found


def merge(rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if row["title"]:
            grouped[row["code"]].append(row)
    result = []
    for code, entries in sorted(grouped.items()):
        titles = defaultdict(int)
        for entry in entries:
            titles[entry["title"]] += 1
        title = max(titles, key=lambda value: (titles[value], -len(value)))
        first = next(entry for entry in entries if entry["title"] == title)
        topics = sorted({entry["topic"] for entry in entries if entry["topic"] and not re.search(r"(?:\[|\]|^\d|^/|^Настоящие материалы)", entry["topic"])})
        specialties = sorted({entry["specialty"] for entry in entries if entry["specialty"]})
        sources = sorted({entry["source_name"] for entry in entries})
        pages = sorted({entry["source_page"] for entry in entries})
        identifier = hashlib.sha256(f"helix:{code}".encode()).hexdigest()[:20]
        result.append({
            "id": f"helix-{identifier}",
            "provider": "Helix",
            "code": code,
            "title": title,
            "specialty": "; ".join(specialties),
            "topics": topics,
            "keywords": aliases(title, *topics),
            "source_name": "; ".join(sources),
            "source_version": first["source_version"],
            "source_pages": pages,
        })
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    files = sorted(args.source_dir.glob("*.pdf"))
    if not files:
        raise SystemExit("No PDF files found")
    rows = [row for file in files for row in extract_pdf(file)]
    catalog = merge(rows)
    args.output.write_text(json.dumps({"provider": "Helix", "items": catalog}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"files": len(files), "raw_entries": len(rows), "unique_items": len(catalog)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
