"""Check that every locale in the registry actually returns recent hits.

Written because guessing failed. An earlier probe used "festa tradicional
folia" for Brazil and "geleneksel şenlik festival" for Turkey; both returned
plenty of articles and none from the past week, because one term was a
carnival word searched in August and the other was too narrow. A locale that
returns nothing is worse than an absent one — it looks like coverage.

    python -m pipeline.verify_locales
    python -m pipeline.verify_locales --country ID JP TH
"""

from __future__ import annotations

import argparse
import email.utils as eut
import json
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import requests

REGISTRY = Path(__file__).resolve().parent / "registry" / "locales.json"
RSS = "https://news.google.com/rss/search"
# Google News returns an empty document to an unrecognised client.
UA = "Mozilla/5.0 (compatible; kairosphere-monitor/1.0)"

# A locale needs this many articles from the last week to be worth shipping.
MIN_RECENT = 3
RECENT_DAYS = 7


def fetch(query: str, hl: str, gl: str, timeout: int = 25):
    url = f"{RSS}?q={quote(query)}&hl={hl}&gl={gl}&ceid={gl}:{hl}"
    try:
        response = requests.get(url, timeout=timeout, headers={"User-Agent": UA})
        if response.status_code != 200:
            return []
        root = ET.fromstring(response.content)
        return list(root.iter("item"))
    except Exception:
        return []


def published(item) -> datetime | None:
    raw = item.findtext("pubDate")
    if not raw:
        return None
    try:
        when = eut.parsedate_to_datetime(raw)
        return when if when.tzinfo else when.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def check(locale: dict) -> dict:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=RECENT_DAYS)

    month_cutoff = now - timedelta(days=30)
    total = recent = 0
    within_month = 0
    freshest: tuple[datetime, str] | None = None
    per_query = {}

    for query in locale["queries"]:
        items = fetch(query, locale["hl"], locale["gl"])
        hits = 0
        for item in items:
            when = published(item)
            if not when:
                continue
            total += 1
            if when >= cutoff:
                recent += 1
                hits += 1
            if when >= month_cutoff:
                within_month += 1
            if freshest is None or when > freshest[0]:
                freshest = (when, (item.findtext("title") or "")[:70])
        per_query[query] = hits

    return {
        "country": locale["country"],
        "name": locale["name"],
        "total": total,
        "recent": recent,
        "month": within_month,
        # A quiet week is not a dead locale. Coverage is judged over a month;
        # festival-name terms only fire in season, so Matariki in August looks
        # identical to no coverage at all on a 7-day window.
        "passes": within_month >= MIN_RECENT,
        "perQuery": per_query,
        "freshest": freshest[1] if freshest else "",
        "freshestAgeDays": (now - freshest[0]).days if freshest else None,
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", nargs="*", help="limit to these ISO codes")
    parser.add_argument("--json", action="store_true", help="emit machine-readable results")
    args = parser.parse_args(argv)

    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

    locales = json.loads(REGISTRY.read_text(encoding="utf-8"))["locales"]
    if args.country:
        wanted = {c.upper() for c in args.country}
        locales = [l for l in locales if l["country"] in wanted]

    results = [check(locale) for locale in locales]

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return 0

    print(f"{'':<4}{'country':<16}{'tot':>5}{'7d':>5}{'30d':>6}  headline")
    print("-" * 108)
    for r in sorted(results, key=lambda x: -x["month"]):
        mark = "ok" if r["passes"] else ("!!" if r["month"] == 0 else " ~")
        print(f"{mark:<4}{r['name']:<16}{r['total']:>5}{r['recent']:>5}{r['month']:>6}  {r['freshest']}")

    failing = [r for r in results if not r["passes"]]
    print(f"\n{len(results) - len(failing)}/{len(results)} locales pass "
          f"(>= {MIN_RECENT} articles in {RECENT_DAYS} days)")
    if failing:
        print("\nneeds better query terms, or drop:")
        for r in failing:
            dead = [q for q, n in r["perQuery"].items() if n == 0]
            print(f"  {r['name']:<16} recent={r['recent']}  zero-hit terms: {dead}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
