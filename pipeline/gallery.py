"""More than one photograph per event.

The single-image resolver already fetches six candidates from a Commons
category, verifies each one, ranks them and then discards five. Those five
cost nothing extra to keep, and one photograph of an event is a poor
substitute for the thing itself: a still of Naghol shows a tower, not a man
falling twenty-five metres on two vines.

    python -m pipeline.gallery              # events that have a lead photo
    python -m pipeline.gallery --limit 20

Adds a `gallery` array to each record in public/data/event_images.json. Every
frame goes through the same checks as the lead image — a Commons category is
human curation, and the licence has to be recoverable or the file is dropped.

Video is deliberately not here. It belongs, but not as a search: an unkeyed
query for "Gerewol Festival Niger" returns whatever ranks that week, which is
exactly how a Jim Crow segregation cartoon ended up on an Apsáalooke powwow.
When video arrives it should be resolved once and reviewed, like everything
else in this directory.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from pipeline.briefings import load_catalogue, load_existing
from pipeline.images import COMMONS, WIKI, _get, _usable, keywords

log = logging.getLogger("gallery")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "event_images.json"

# Enough to swipe through, few enough to stay on one screen and one request.
MAX_FRAMES = 5


def from_category(title: str, words: list[str], place_words: list[str]) -> list[dict]:
    """Every usable file in a category named for the event, best first."""
    clean = title.split("(")[0].strip()
    data = _get(COMMONS, {
        "action": "query", "generator": "search",
        "gsrsearch": f'incategory:"{clean}"', "gsrnamespace": 6, "gsrlimit": 12,
        "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": 1200, "format": "json", "origin": "*",
    })
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    found = [_usable(p, words, place_words, trusted=True) for p in pages.values()]
    found = [f for f in found if f]
    return sorted(found, key=lambda r: -r["score"])


def from_article(article_title: str, words: list[str], place_words: list[str]) -> list[dict]:
    """Photographs on the Wikipedia article, verified like any other search.

    Appearing on the right article is not evidence of being a picture of the
    subject. This path first took every image the page carried, which put the
    cupola of St Peter's on eight different carnivals, a Tiepolo painting on
    two, a museum object on a Dogon funeral and a 1980 portrait of the Dalai
    Lama on Losar -- all of them legitimately illustrating those articles,
    none of them a photograph of the event.

    So a file has to earn its place the way an untrusted Commons search result
    does: named subject, a real corroborating place, and a photograph rather
    than a painting, a diagram or a museum object.
    """
    data = _get(WIKI, {
        "action": "query", "titles": article_title,
        "prop": "images", "imlimit": 30,
        "format": "json", "origin": "*",
    })
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    names: list[str] = []
    for page in pages.values():
        for entry in page.get("images") or []:
            title = entry.get("title", "")
            if title.startswith("File:"):
                names.append(title)
    if not names:
        return []

    # One request for the batch; Commons takes up to 50 titles at a time.
    meta = _get(COMMONS, {
        "action": "query", "titles": "|".join(names[:50]),
        "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": 1200, "format": "json", "origin": "*",
    })
    found = [
        _usable(page, words, place_words, trusted=False)
        for page in (((meta or {}).get("query") or {}).get("pages") or {}).values()
    ]
    found = [f for f in found if f]
    for frame in found:
        frame["via"] = "wikipedia-article"
    return sorted(found, key=lambda r: -r["score"])[:MAX_FRAMES]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    doc = json.loads(OUT.read_text(encoding="utf-8"))
    images = doc["images"]
    briefings = load_existing()

    # Only events that already have a verified lead image: if we could not
    # prove one photograph, five is not an improvement.
    targets = [e for e in load_catalogue()
               if e["id"] in images and not images[e["id"]].get("gallery")]
    if args.limit:
        targets = targets[: args.limit]

    log.info("%d events with a lead photograph and no gallery\n", len(targets))

    # Every url already spoken for: each event's lead photograph, plus any
    # gallery frame assigned earlier in this run or a previous one.
    claimed = {v["url"] for v in images.values() if v.get("url")}
    for record in images.values():
        for frame in record.get("gallery") or []:
            claimed.add(frame["url"])

    added = 0
    for i, event in enumerate(targets, 1):
        words = keywords(event["title"])
        place_words = keywords(event.get("region", ""))
        lead_url = images[event["id"]].get("url")

        frames = from_category(event["title"], words, place_words)
        if len(frames) < 2 and event["id"] in briefings:
            frames += from_article(briefings[event["id"]]["sourceTitle"], words, place_words)

        # Never repeat the lead image inside its own gallery, and never let a
        # frame serve two events. A photograph used twice is proof it was not
        # chosen for either subject -- the same rule utils/eventImages applies
        # to the lead images it strips.
        seen = {lead_url}
        gallery = []
        for frame in frames:
            if frame["url"] in seen or frame["url"] in claimed:
                continue
            seen.add(frame["url"])
            claimed.add(frame["url"])
            gallery.append({
                "url": frame["url"],
                "credit": frame["credit"],
                "license": frame["license"],
                "sourcePage": frame["sourcePage"],
                # Kept so a later audit can tell a curated-category frame from
                # one found on an article. The first pass could not, which is
                # why the bad frames had to be rebuilt rather than filtered.
                "verifiedBy": frame["verifiedBy"],
                "via": frame["via"],
            })
            if len(gallery) >= MAX_FRAMES:
                break

        if gallery:
            images[event["id"]]["gallery"] = gallery
            added += 1
            log.info("  [%d/%d] %-34s %d more", i, len(targets), event["title"][:34], len(gallery))
        else:
            log.info("  [%d/%d] %-34s none", i, len(targets), event["title"][:34])

        if i % 20 == 0:
            doc["images"] = images
            OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    doc["images"] = images
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log.info("\n%d events gained a gallery", added)
    return 0


if __name__ == "__main__":
    sys.exit(main())
