"""Find a photograph that is actually of the event.

The catalogue's images were largely generic stock, and it showed: one Unsplash
photo served the Atacama Desert Bloom, Namaqualand Daisies, a Saudi camel
market and a Lebanese saint's feast; a picture of Darling Harbour stood in for
four different Aboriginal festivals. 82 of 351 events shared a photo with
another event.

Stock cannot be verified — an Unsplash ID either resolves or it does not, and
resolving tells you nothing about the subject. Wikimedia can: its filenames
and descriptions name what is in the frame, so a candidate can be checked
against the event before it is accepted.

    python -m pipeline.images                 # resolve everything
    python -m pipeline.images --limit 20      # try a sample first
    python -m pipeline.images --only th-songkran id-nyepi

Writes public/data/event_images.json — a mapping, not an edit to the
catalogue, so it can be re-run and reviewed without touching source data.

Attribution is captured with every image. Most Commons material is CC-BY or
CC-BY-SA, which obliges us to credit the photographer; an image without
recoverable licence information is discarded rather than used.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from pathlib import Path

import requests

log = logging.getLogger("images")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "event_images.json"
UA = "kairosphere-images/1.0 (+https://kairosphere.app)"

WIKI = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"

# Words too common to prove a photo is of the right subject.
STOPWORDS = {
    "the", "of", "and", "de", "la", "el", "at", "in", "on", "a", "an",
    "festival", "ceremony", "ritual", "celebration", "feast", "day", "days",
    "great", "grand", "annual", "traditional", "national", "holy", "sacred",
    "dance", "music", "show", "fair", "night", "new", "year",
}

# A candidate must clear this to be used. 2 means "the event name appears";
# 5 means "the event name and the place both appear".
MIN_SCORE = 2

_last_call = 0.0


def _get(url: str, params: dict) -> dict | None:
    """Polite, rate-limited GET against a Wikimedia endpoint."""
    global _last_call
    wait = 0.4 - (time.time() - _last_call)
    if wait > 0:
        time.sleep(wait)
    try:
        response = requests.get(url, params=params, timeout=25, headers={"User-Agent": UA})
        _last_call = time.time()
        if response.status_code != 200:
            return None
        return response.json()
    except Exception as exc:
        log.debug("request failed: %s", type(exc).__name__)
        return None


def keywords(title: str) -> list[str]:
    """Distinctive words from an event name, used to verify a photo."""
    cleaned = re.sub(r"\(.*?\)", " ", title.lower())
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    return [w for w in cleaned.split() if len(w) > 3 and w not in STOPWORDS]


def matches(candidate_text: str, words: list[str]) -> str | None:
    """The keyword that vouches for this image, if any."""
    haystack = candidate_text.lower()
    for word in words:
        if word in haystack:
            return word
    return None


def _license_of(info: dict) -> tuple[str, str, str]:
    meta = info.get("extmetadata") or {}

    def val(key: str) -> str:
        raw = (meta.get(key) or {}).get("value", "")
        return re.sub(r"<[^>]+>", "", str(raw)).strip()

    return val("LicenseShortName"), val("Artist"), val("LicenseUrl")


# Filenames that name infrastructure or paperwork rather than the event. A
# ticket counter at Batu Caves really is Thaipusam, and is not a photograph of
# Thaipusam.
WEAK_SUBJECTS = (
    "station", "ticket", "counter", "queue", "poster", "logo", "map",
    "banner", "sign ", "signage", "diagram", "coat of arms", "stamp",
    "leaflet", "brochure", "portrait of", "cover",
)


def _score(name: str, description: str, words: list[str], place_words: list[str]) -> tuple[int, str]:
    """Rank a candidate. Higher is a better lead image."""
    haystack = f"{name} {description}".lower()
    score, why = 0, []

    hit = matches(haystack, words)
    if hit:
        score += 2
        why.append(hit)

    place = matches(haystack, place_words)
    if place:
        # Strongly preferred: the app is about going there, so Songkran
        # photographed in Los Angeles is the wrong picture of the right thing.
        score += 3
        why.append(place)

    if any(weak in haystack for weak in WEAK_SUBJECTS):
        score -= 3

    return score, " + ".join(why)


def _usable(page: dict, words: list[str], place_words: list[str], trusted: bool) -> dict | None:
    """Turn a Commons page into an image, if it can be vouched for."""
    infos = page.get("imageinfo") or []
    if not infos:
        return None
    info = infos[0]
    mime = str(info.get("mime", ""))
    # Photographs only — diagrams, logos and maps are not pictures of an event.
    if not mime.startswith("image/") or mime == "image/svg+xml":
        return None

    name = page.get("title", "")
    description = (info.get("extmetadata", {}).get("ImageDescription", {}) or {}).get("value", "")
    haystack = f"{name} {description}"

    hit = matches(haystack, words)
    if not hit:
        return None

    # A keyword alone is not proof. "Pasola" matched a New Jersey fire marshal
    # named John Pasola. Outside a curated category, the place must appear too.
    if not trusted:
        place = matches(haystack, place_words)
        if not place:
            return None
        hit = f"{hit} + {place}"

    score, _ = _score(name, description, words, place_words)

    license_name, artist, license_url = _license_of(info)
    if not license_name:
        return None

    return {
        "url": info.get("thumburl") or info.get("url"),
        "credit": artist or "Wikimedia Commons contributor",
        "license": license_name,
        "licenseUrl": license_url,
        "sourcePage": f"https://commons.wikimedia.org/wiki/{name.replace(' ', '_')}",
        "verifiedBy": hit,
        "score": score,
        "via": "commons-category" if trusted else "commons-search",
    }


def from_category(title: str, words: list[str], place_words: list[str] | None = None) -> dict | None:
    """Files inside a Commons category named for the event.

    The strongest signal available: a human has already decided these images
    depict this subject, so no keyword guessing is needed.
    """
    clean = re.sub(r"\(.*?\)", "", title).strip()
    data = _get(COMMONS, {
        "action": "query", "generator": "search",
        "gsrsearch": f'incategory:"{clean}"', "gsrnamespace": 6, "gsrlimit": 6,
        "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": 1200, "format": "json", "origin": "*",
    })
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    ranked = [_usable(p, words, place_words or [], trusted=True) for p in pages.values()]
    ranked = [r for r in ranked if r]
    return max(ranked, key=lambda r: r["score"]) if ranked else None


def from_commons(title: str, words: list[str], extra: str = "", place_words: list[str] | None = None) -> dict | None:
    """Free-text Commons search, with the place required as corroboration."""
    query = f"{title} {extra}".strip()
    data = _get(COMMONS, {
        "action": "query", "generator": "search", "gsrsearch": query,
        "gsrnamespace": 6, "gsrlimit": 8,
        "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": 1200, "format": "json", "origin": "*",
    })
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    ranked = [_usable(p, words, place_words or [], trusted=False) for p in pages.values()]
    ranked = [r for r in ranked if r]
    return max(ranked, key=lambda r: r["score"]) if ranked else None


def from_wikipedia(title: str, words: list[str]) -> dict | None:
    """Use an article's lead image, but only when the article is the event."""
    data = _get(WIKI, {
        "action": "query", "generator": "search", "gsrsearch": title, "gsrlimit": 1,
        "prop": "pageimages", "piprop": "original", "format": "json", "origin": "*",
    })
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    if not pages:
        return None
    page = list(pages.values())[0]
    source = (page.get("original") or {}).get("source")
    if not source:
        return None

    # The article must be about this event, not merely mention it.
    if not matches(page.get("title", ""), words):
        return None

    filename = source.rsplit("/", 1)[-1]
    return {
        "url": source,
        "credit": "Wikimedia Commons contributor",
        "license": "See source page",
        "licenseUrl": "",
        "sourcePage": f"https://commons.wikimedia.org/wiki/File:{filename}",
        "verifiedBy": matches(page.get("title", ""), words),
        "via": "wikipedia-lead",
    }


def resolve(event_id: str, title: str, region: str) -> dict | None:
    words = keywords(title)
    if not words:
        return None
    country = region.split(",")[-1].strip()
    # Place names that can corroborate a free-text match.
    place_words = [w for w in re.split(r"[^a-zA-Z]+", region.lower()) if len(w) > 3]

    # Gather from every strategy and take the best, rather than accepting
    # whatever the first one returns. Short-circuiting handed Songkran a photo
    # taken in Los Angeles because the category happened to answer first.
    candidates = [
        from_category(title, words, place_words),
        from_commons(title, words, country, place_words),
        from_wikipedia(title, words),
    ]
    candidates = [c for c in candidates if c]
    if not candidates:
        return None

    best = max(candidates, key=lambda c: c.get("score", 0))
    # Below this the only thing linking photo to event is a single word, which
    # is how a New Jersey fire marshal nearly became a Sumbanese spear ritual.
    if best.get("score", 0) < MIN_SCORE:
        return None
    best["eventId"] = event_id
    return best


# ── catalogue reading ─────────────────────────────────────────────────────

def read_catalogue() -> list[dict]:
    """Pull id/title/region out of the data files without importing TypeScript."""
    events: list[dict] = []
    for path in (ROOT / "mockData.ts", ROOT / "data" / "southeastAsia.ts"):
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for block in re.findall(r"\{\s*id:\s*'([^']+)'(.*?)\n  \}", text, re.S):
            event_id, body = block
            title = re.search(r"title:\s*'((?:\\.|[^'\\])*)'", body)
            region = re.search(r"region:\s*'((?:\\.|[^'\\])*)'", body)
            if title:
                events.append({
                    "id": event_id,
                    "title": title.group(1),
                    "region": region.group(1) if region else "",
                })
    return events


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, help="only process this many events")
    parser.add_argument("--only", nargs="*", help="specific event ids")
    parser.add_argument("--refresh", action="store_true", help="re-resolve ids already mapped")
    args = parser.parse_args(argv)

    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    existing = {}
    if OUT.exists() and not args.refresh:
        try:
            existing = json.loads(OUT.read_text(encoding="utf-8")).get("images", {})
        except (OSError, json.JSONDecodeError):
            existing = {}

    events = read_catalogue()
    if args.only:
        wanted = set(args.only)
        events = [e for e in events if e["id"] in wanted]
    else:
        events = [e for e in events if e["id"] not in existing]
    if args.limit:
        events = events[: args.limit]

    log.info("resolving %d event(s); %d already mapped", len(events), len(existing))

    found = 0
    for index, event in enumerate(events, 1):
        result = resolve(event["id"], event["title"], event["region"])
        if result:
            existing[event["id"]] = result
            found += 1
            log.info("  %3d/%d  OK   %-42s <- %s", index, len(events),
                     event["title"][:42], result["verifiedBy"])
        else:
            log.info("  %3d/%d  --   %-42s (no verifiable photo)", index, len(events),
                     event["title"][:42])

        if index % 25 == 0:
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps({"images": existing}, ensure_ascii=False, indent=2),
                           encoding="utf-8")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "note": "Photos verified against Wikimedia descriptions. "
                        "Credit and licence must be displayed with the image.",
                "images": existing,
            },
            ensure_ascii=False, indent=2,
        ),
        encoding="utf-8",
    )
    log.info("%d resolved this run, %d mapped in total -> %s",
             found, len(existing), OUT.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
