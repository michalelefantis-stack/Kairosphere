"""Find real books for an event, with real ISBNs.

The catalogue's previous reading list had 21 entries whose Amazon links all
pointed at `amzn.to/example` and whose Bookshop links all used the partner id
`12345`. Recalling ISBNs from memory would reproduce exactly that: plausible
titles, plausible numbers, dead links.

So they come from Open Library, which is free, needs no key, and returns the
ISBN and cover id alongside the title. Every link this produces resolves to a
real book because the identifier came from a catalogue rather than from a
guess.

    python -m pipeline.books --only middle-east-2026-5 india-maha-shivratri
    python -m pipeline.books --query "Nowruz" --limit 3

Prints TypeScript ready to paste into a `recommendedBooks` array. It does not
edit the catalogue: which three books belong on an event is an editorial
decision, and the search is only good enough to propose candidates.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import requests

log = logging.getLogger("books")

ROOT = Path(__file__).resolve().parent.parent
SEARCH = "https://openlibrary.org/search.json"
UA = "kairosphere-books/1.0 (+https://kairosphere.app)"

# Subject words that mean the result is fiction or a travel guide rather than
# something worth recommending as background.
UNWANTED = ("fiction", "juvenile", "coloring", "colouring", "cookbook",
            "travel guide", "phrasebook", "textbook of")

_last = 0.0


def _get(params: dict) -> dict | None:
    global _last
    wait = 0.5 - (time.time() - _last)
    if wait > 0:
        time.sleep(wait)
    try:
        r = requests.get(SEARCH, params=params, timeout=30, headers={"User-Agent": UA})
        _last = time.time()
        return r.json() if r.status_code == 200 else None
    except Exception as exc:
        log.debug("search failed: %s", type(exc).__name__)
        return None


def find_books(query: str, limit: int = 3) -> list[dict]:
    """Real books on this subject, with an ISBN we can link to."""
    data = _get({
        "q": query,
        "fields": "title,author_name,first_publish_year,isbn,cover_i,subject,ratings_average,ratings_count",
        "limit": 25,
    })
    docs = (data or {}).get("docs") or []

    out = []
    for doc in docs:
        isbns = doc.get("isbn") or []
        # A 13-digit ISBN is what bookshop.org resolves; prefer it.
        isbn = next((i for i in isbns if len(i) == 13 and i.startswith("978")), None)
        if not isbn or not doc.get("cover_i"):
            continue

        subjects = " ".join(doc.get("subject") or []).lower()
        title = (doc.get("title") or "").strip()
        if any(bad in subjects or bad in title.lower() for bad in UNWANTED):
            continue
        if not doc.get("author_name"):
            continue

        out.append({
            "title": title,
            "author": doc["author_name"][0],
            "year": doc.get("first_publish_year"),
            "isbn": isbn,
            "coverUrl": f"https://covers.openlibrary.org/b/id/{doc['cover_i']}-L.jpg",
            "bookshopLink": f"https://bookshop.org/book/{isbn}",
            "rating": doc.get("ratings_average"),
            "ratingCount": doc.get("ratings_count"),
        })
        if len(out) >= limit:
            break
    return out


def as_typescript(books: list[dict]) -> str:
    lines = []
    for b in books:
        rating = f"\n        goodreadsRating: {round(b['rating'], 2)}," if b.get("rating") else ""
        count = f"\n        ratingCount: \"{b['ratingCount']}\"," if b.get("ratingCount") else ""
        lines.append(
            "      {\n"
            f"        title: {json.dumps(b['title'])},\n"
            f"        author: {json.dumps(b['author'])},\n"
            f"        coverUrl: \"{b['coverUrl']}\",\n"
            f"        bookshopLink: \"{b['bookshopLink']}\","
            f"{rating}{count}\n"
            "      }"
        )
    return "    recommendedBooks: [\n" + ",\n".join(lines) + "\n    ]"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", help="search Open Library directly")
    parser.add_argument("--only", nargs="*", help="event ids from the catalogue")
    parser.add_argument("--limit", type=int, default=3)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    queries: list[tuple[str, str]] = []
    if args.query:
        queries.append((args.query, args.query))
    if args.only:
        from pipeline.briefings import load_catalogue
        events = {e["id"]: e for e in load_catalogue()}
        for event_id in args.only:
            event = events.get(event_id)
            if not event:
                log.info("  ! not in catalogue: %s", event_id)
                continue
            queries.append((event_id, event["title"]))

    for label, query in queries:
        books = find_books(query, args.limit)
        log.info("\n// %s — %s (%d found)", label, query, len(books))
        if books:
            log.info(as_typescript(books))
    return 0


if __name__ == "__main__":
    sys.exit(main())
