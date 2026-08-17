"""Fetch a real description for each event into static data.

The catalogue's own descriptions are one line long — 83 characters at the
median, 245 of 373 under 150 — and many are templated: fifty begin "A
spectacular natural phenomenon in <place>. Timing: <something>." That is
enough to label a map pin and not enough to decide whether to travel.

The app already fetched Wikipedia at render time to fill the gap, which is
the wrong place for it three times over: it fails with no signal, it re-runs
the same search on every open, and nothing checks that the article it found
is about the right subject before showing it.

So the fetch moves here, once, into a file that can be reviewed:

    python -m pipeline.briefings                  # everything missing
    python -m pipeline.briefings --limit 20       # try a sample first
    python -m pipeline.briefings --only id-nyepi vanuatu-naghol
    python -m pipeline.briefings --refresh        # re-fetch existing entries

Writes public/data/event_briefings.json. Resumable: without --refresh it only
tries events that have no briefing yet.

Matching is deliberately strict, for the reason recorded in pipeline/images.py
— a keyword search once put a Jim Crow segregation cartoon on an Apsáalooke
powwow. A briefing that confidently describes the wrong festival is worse
than a thin one, because the reader has no way to tell.
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

log = logging.getLogger("briefings")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "event_briefings.json"
CATALOGUE_JSON = ROOT / "public" / "data" / "catalogue.json"

WIKI = "https://en.wikipedia.org/w/api.php"
UA = "kairosphere-briefings/1.0 (+https://kairosphere.app)"

# Enough to be worth reading, short enough to stay a briefing rather than an
# article. Cut on a sentence boundary, never mid-word.
TARGET_CHARS = 700
# Below this the extract is a stub and no better than what we already have.
MIN_CHARS = 180

# Words too common to prove an article is about the right subject.
STOPWORDS = {
    "the", "of", "and", "de", "la", "el", "at", "in", "on", "a", "an",
    "festival", "ceremony", "ritual", "celebration", "feast", "day", "days",
    "great", "grand", "annual", "traditional", "national", "holy", "sacred",
    "dance", "music", "show", "fair", "night", "new", "year", "week",
}

# Articles that are not about an event even when the words line up.
#
# The place and people entries are the ones that actually bit: "Crow Fair"
# retrieved "Crow Indian Reservation", which contains "crow" in the title and
# "montana" in the body and is an article about land.
WRONG_KIND = (
    "may refer to:", "is a surname", "is a given name", "is a village",
    "is a census-designated", "disambiguation", "is a genus", "is a species",
    "is a municipality", "is a commune", "is a football", "is an album",
    "is a song", "is a film", "is a novel",
    "is the homeland", "is a reservation", "is an indian reservation",
    "are a tribe", "is a tribe", "are an indigenous", "is an indigenous",
    "is a city", "is a town", "is a province", "is a district",
    "is a region", "is a country", "is a state in", "is a national park",
    "is a river", "is a mountain", "is a lake", "is an island",
)

# ...and the positive test. An article about an event says so within its first
# couple of sentences; an article about a place, a people or a building does
# not. Requiring this is what separates Takanakuy ("an annual established
# practice ... held on 25 December") from the Crow Indian Reservation.
EVENT_MARKERS = (
    "festival", "celebrat", "ceremon", "ritual", "observ", "commemorat",
    "held annually", "held on", "held in", "held each", "takes place",
    "annual", "procession", "pilgrimage", "feast", "carnival", "holiday",
    "is a practice", "gathering", "rite", "occurs", "phenomenon", "migration",
    "bloom", "eclipse", "solstice", "equinox", "spawning", "nesting",
)

# How far in to look for both. Beyond this we are reading trivia, not the
# definition of the subject.
LEDE_CHARS = 420

# Wikipedia's own categories, which are the better signal when the prose does
# not cooperate. Requiring an EVENT_MARKER in the lede correctly rejected
# "Crow Indian Reservation", but also rejected Calcio Storico, whose lede
# calls it "an early form of football" and never says "annual" — while its
# categories place it squarely among Italian festivals.
EVENT_CATEGORIES = re.compile(
    r"festival|holiday|observance|tradition|carnival|ritual|ceremon|"
    r"pilgrimage|feast|parade|powwow|folk|annual events|recurring events|"
    r"culture of|natural phenomen|astronomical",
    re.I,
)

_last_call = 0.0


def _get(params: dict) -> dict | None:
    """Polite, rate-limited GET against the Wikipedia API."""
    global _last_call
    wait = 0.3 - (time.time() - _last_call)
    if wait > 0:
        time.sleep(wait)
    try:
        response = requests.get(WIKI, params=params, timeout=25,
                                headers={"User-Agent": UA})
        _last_call = time.time()
        if response.status_code != 200:
            return None
        return response.json()
    except Exception as exc:
        log.debug("request failed: %s", type(exc).__name__)
        return None


def keywords(text: str) -> list[str]:
    """Distinctive words, used to check an article is about this event."""
    cleaned = re.sub(r"\(.*?\)", " ", text.lower())
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    return [w for w in cleaned.split() if len(w) > 3 and w not in STOPWORDS]


def trim(text: str, limit: int = TARGET_CHARS) -> str:
    """Cut to the last full sentence inside the limit."""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return (cut[: end + 1] if end > limit * 0.5 else cut.rstrip() + "…").strip()


def _acceptable(title: str, extract: str, words: list[str],
                place_words: list[str], categories: list[str] | None = None,
                require_place: bool = True) -> str | None:
    """The evidence this article is about this event, or None."""
    body = extract.lower()
    lede = body[:LEDE_CHARS]
    head = f"{title} {extract[:220]}".lower()

    if len(extract) < MIN_CHARS:
        return None
    # Bounded gap, so an adjective cannot smuggle a place past the check:
    # "Namaqualand is an arid region" did not match the literal "is a region",
    # and a gazetteer entry was accepted as a description of a flower bloom.
    if any(re.search(m.replace("is a ", r"is an? (?:\w+ ){0,2}")
                     .replace("is an ", r"is an? (?:\w+ ){0,2}"), lede)
           for m in WRONG_KIND):
        return None
    # The article has to be about an event. Without this, anything whose title
    # shares a word with the festival qualifies, including the geography.
    # Either the prose says so, or Wikipedia has already filed it that way.
    #
    # Skipped for natural phenomena. The gate exists to reject articles about
    # places and people, and WRONG_KIND already does that directly; what it
    # actually tests for is festival vocabulary, which an aurora has none of.
    # The article opens "a natural light display in Earth's sky" — no
    # ceremony, no procession, nothing held annually — and was rejected for
    # it, along with 31 of the other 35 phenomena.
    if require_place:
        filed_as_event = any(EVENT_CATEGORIES.search(c) for c in (categories or []))
        if not filed_as_event and not any(marker in lede for marker in EVENT_MARKERS):
            return None

    # The subject has to appear near the top — an event mentioned once in
    # passing halfway down an article about something else is not a briefing.
    hit = next((w for w in words if w in head), None)
    if not hit:
        return None

    # ...and the place has to appear somewhere, which is what separates the
    # right festival from one with the same name on another continent.
    place = next((w for w in place_words if w in body), None)
    if place:
        return f"{hit} + {place}"

    if require_place:
        return None

    # A natural phenomenon is not local in the way a festival is. The article
    # on auroras does not mention Tromsø, and should not have to: the subject
    # is the aurora, and Tromsø is merely somewhere you can stand and watch
    # one. Demanding the place rejected all 36 phenomena in the catalogue.
    #
    # What replaces it is the name itself — but in the article's *title*, not
    # merely somewhere in its opening. Accepting a lede match sent "Aurora
    # Borealis" to a Frederic Church painting of one, "Vaux's Swift Roosting"
    # to the chimney swift (a different bird, which the article mentions only
    # to compare), and "Matsu Blue Tears" to the Matsu Islands.
    lowered_title = title.lower()

    # A disambiguating parenthetical is Wikipedia stating outright that this
    # is the other thing with that name.
    if re.search(r"\((painting|film|movie|album|song|book|novel|band|"
                 r"video game|TV series|magazine|opera)\)", title, re.I):
        return None

    # *Every* distinctive word, not two of them. Two was enough to accept
    # "Atacama Desert" for the Atacama Desert Bloom, "Christmas Island" for
    # the crab migration and "Bongo (antelope)" for saiga calving — an
    # antelope from the wrong continent. The dropped word is the one that
    # names the event: bloom, crabs, calving.
    distinct = list(dict.fromkeys(words))
    matched = [w for w in distinct if w in lowered_title]
    if matched and len(matched) == len(distinct):
        return " + ".join(matched[:3])
    return None


def briefing_for(title: str, region: str, require_place: bool = True) -> dict | None:
    """Search Wikipedia and return a verified summary, or None."""
    # Keep what is inside the brackets. keywords() drops parentheticals, which
    # for "Naghol (Land Diving)" threw away the only two words Wikipedia files
    # the article under and left nothing to verify the match with.
    words = keywords(title.replace("(", " ").replace(")", " "))
    place_words = keywords(region)
    if not words:
        return None

    clean = re.sub(r"\(.*?\)", "", title).strip()
    # A parenthetical is usually the English name, and is often the one
    # Wikipedia files the article under: "Naghol (Land Diving)" lives at
    # "Land diving". Searching only the stripped title missed it entirely.
    aside = re.findall(r"\((.*?)\)", title)

    queries = [f"{clean} {region}", clean]
    queries += [f"{a} {region}" for a in aside] + aside
    queries.append(f"{clean} festival")

    seen: set[str] = set()
    for query in queries:
        data = _get({
            "action": "query", "generator": "search",
            "gsrsearch": query, "gsrlimit": 3,
            "prop": "extracts|categories", "exintro": 1, "explaintext": 1,
            "cllimit": 40, "clshow": "!hidden",
            "format": "json", "origin": "*",
        })
        pages = ((data or {}).get("query") or {}).get("pages") or {}
        # generator=search returns pages unordered; index carries the ranking.
        ordered = sorted(pages.values(), key=lambda p: p.get("index", 99))

        for page in ordered:
            page_title = page.get("title", "")
            if page_title in seen:
                continue
            seen.add(page_title)

            extract = (page.get("extract") or "").strip()
            categories = [c.get("title", "") for c in (page.get("categories") or [])]
            evidence = _acceptable(page_title, extract, words, place_words,
                                   categories, require_place)
            if not evidence:
                continue

            return {
                "summary": trim(extract),
                "sourceTitle": page_title,
                "sourceUrl": "https://en.wikipedia.org/wiki/"
                             + page_title.replace(" ", "_"),
                "verifiedBy": evidence,
                "chars": len(trim(extract)),
            }
    return None


def load_catalogue() -> list[dict]:
    """Read the catalogue.

    Straight JSON now. This used to run a regex over two TypeScript files and
    every pass eventually met something it did not expect — an escaped
    apostrophe in "Cooper\\'s Hill", a non-breaking space inside "341
    kilometres (212 mi)" that made an edit silently fail to match. Each of
    those was a wrong answer rather than an error, which is the worst kind.
    """
    if not CATALOGUE_JSON.exists():
        raise FileNotFoundError(
            f"{CATALOGUE_JSON} is missing. It is the catalogue; regenerate or "
            "restore it before running any pipeline step."
        )
    payload = json.loads(CATALOGUE_JSON.read_text(encoding="utf-8"))
    return payload.get("events", [])


def load_existing() -> dict:
    if not OUT.exists():
        return {}
    try:
        return json.loads(OUT.read_text(encoding="utf-8")).get("briefings", {})
    except Exception:
        return {}


def save(briefings: dict) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "note": (
            "Wikipedia intro extracts, verified to mention both the event and "
            "its place before being accepted. Text is CC BY-SA 4.0; the source "
            "link must be shown with it."
        ),
        "license": "CC BY-SA 4.0",
        "briefings": briefings,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, help="stop after this many fetches")
    parser.add_argument("--only", nargs="*", help="specific event ids")
    parser.add_argument("--refresh", action="store_true",
                        help="re-fetch events that already have a briefing")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    events = load_catalogue()
    briefings = load_existing()
    log.info("catalogue: %d events, %d already have a briefing",
             len(events), len(briefings))

    if args.only:
        wanted = set(args.only)
        events = [e for e in events if e["id"] in wanted]
    elif not args.refresh:
        events = [e for e in events if e["id"] not in briefings]

    if args.limit:
        events = events[: args.limit]

    found = missed = 0
    for i, event in enumerate(events, 1):
        result = briefing_for(event["title"], event["region"])
        if result:
            briefings[event["id"]] = result
            found += 1
            log.info("  [%d/%d] %-34s %4d chars  (%s)",
                     i, len(events), event["title"][:34],
                     result["chars"], result["verifiedBy"])
        else:
            missed += 1
            log.info("  [%d/%d] %-34s no verifiable article",
                     i, len(events), event["title"][:34])

        # Save as we go: the run is long and interrupting it should not
        # discard everything fetched so far.
        if i % 20 == 0:
            save(briefings)

    save(briefings)
    log.info("\nfound %d, missed %d — %d briefings total in %s",
             found, missed, len(briefings), OUT.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
