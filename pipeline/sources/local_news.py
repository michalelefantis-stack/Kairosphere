"""Local-language news monitor — the spontaneous-event layer.

The case this exists for: a royal cremation is announced in Ubud and happens
within days. It is in the Indonesian press, in outlets a visitor has never
heard of, under a word ("pelebon") they cannot search for. The event is not
unpredictable — it is merely invisible.

So this is a discovery and translation problem, not a forecasting one, and it
is solved with three cheap parts:

  1. Google News RSS, queried in the local language. RSS is published for
     machine consumption, needs no key, and already aggregates the national
     outlets — so there is no per-site scraper to maintain and no terms of
     service to tiptoe around. Scraping Instagram or Facebook would do neither.
  2. A source-domain check, because `gl` does not hard-fence results. A Peru
     query returns articles from farodevigo.es and oem.com.mx; the publisher's
     ccTLD is the cheapest available signal of where a story is actually from.
  3. An extraction pass that turns a headline into a structured candidate and,
     critically, separates public ceremony from private grief.

Nothing here publishes as fact. Candidates enter at low confidence, decay
quickly, and say plainly that they are unconfirmed reports.
"""

from __future__ import annotations

import email.utils as eut
import hashlib
import json
import logging
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, urlparse

import requests

log = logging.getLogger(__name__)

REGISTRY = Path(__file__).resolve().parent.parent / "registry" / "locales.json"
RSS = "https://news.google.com/rss/search"
UA = "Mozilla/5.0 (compatible; kairosphere-monitor/1.0)"

# Refresh cadence per tier, in hours. Tier A is dense-tourism; tier C is a
# weekly sweep. This is the only knob that controls cost.
TIER_HOURS = {"a": 6, "b": 24, "c": 168}

# Only consider articles this fresh — a spontaneous event announced three weeks
# ago is not news to anyone standing there today.
MAX_AGE_DAYS = 10


@dataclass
class Candidate:
    id: str
    country: str
    title: str
    url: str
    source: str
    source_domain: str
    published: datetime
    query: str
    # Filled by the extraction pass; absent when no key is configured.
    kind: str = "unclassified"
    is_public: bool | None = None
    place: str = ""
    when_text: str = ""
    confidence: float = 0.2
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "country": self.country,
            "title": self.title,
            "url": self.url,
            "source": self.source,
            "sourceDomain": self.source_domain,
            "publishedAt": self.published.isoformat().replace("+00:00", "Z"),
            "query": self.query,
            "kind": self.kind,
            "isPublic": self.is_public,
            "place": self.place,
            "whenText": self.when_text,
            "confidence": round(self.confidence, 3),
            "reasons": self.reasons,
        }


def load_locales() -> list[dict]:
    return json.loads(REGISTRY.read_text(encoding="utf-8"))["locales"]


def _fetch(query: str, hl: str, gl: str) -> list:
    url = f"{RSS}?q={quote(query)}&hl={hl}&gl={gl}&ceid={gl}:{hl}"
    try:
        response = requests.get(url, timeout=25, headers={"User-Agent": UA})
        if response.status_code != 200:
            log.warning("rss %s %s: http %s", gl, query, response.status_code)
            return []
        return list(ET.fromstring(response.content).iter("item"))
    except Exception as exc:
        log.warning("rss %s %s failed: %s", gl, query, type(exc).__name__)
        return []


def _published(item) -> datetime | None:
    raw = item.findtext("pubDate")
    if not raw:
        return None
    try:
        when = eut.parsedate_to_datetime(raw)
        return when if when.tzinfo else when.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _domain(item) -> tuple[str, str]:
    source = item.find("source")
    name = (source.text or "").strip() if source is not None else ""
    url = source.get("url", "") if source is not None else ""
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return name, host


def _origin_score(domain: str, country: str) -> tuple[float, str]:
    """How likely is this publisher to be reporting from the target country?

    `gl` is a hint, not a filter — a Peru query happily returns Spanish and
    Mexican outlets. A matching ccTLD is strong evidence; a generic .com is
    merely not evidence either way.
    """
    cc = country.lower()
    if domain.endswith(f".{cc}") or f".{cc}." in domain:
        return 0.25, f"published by a {country} domain ({domain})"
    if domain.endswith((".com", ".org", ".net")):
        return 0.0, "generic domain, origin unverified"
    # A different ccTLD is a positive signal that this is the wrong country.
    if re.search(r"\.[a-z]{2}$", domain):
        return -0.20, f"published by a non-{country} domain ({domain})"
    return 0.0, ""


def collect(locale: dict, max_age_days: int = MAX_AGE_DAYS) -> list[Candidate]:
    """Fetch and dedupe raw candidates for one locale."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    seen: set[str] = set()
    out: list[Candidate] = []

    for query in locale["queries"]:
        for item in _fetch(query, locale["hl"], locale["gl"]):
            when = _published(item)
            if not when or when < cutoff:
                continue

            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            # Feeds append " - Publisher", and sometimes " - domain - Publisher".
            title = re.sub(r"\s+-\s+[\w.-]+\.[a-z]{2,}\s+-\s+.+$", "", title).strip()
            # Google appends " - Publisher"; strip it so dedupe works on the
            # headline and the same story from two outlets collapses.
            bare = re.sub(r"\s+-\s+[^-]+$", "", title).strip().lower()
            key = hashlib.sha1(bare.encode("utf-8")).hexdigest()[:16]
            if key in seen:
                continue
            seen.add(key)

            name, domain = _domain(item)
            bonus, reason = _origin_score(domain, locale["country"])

            out.append(
                Candidate(
                    id=f"news-{locale['country'].lower()}-{key}",
                    country=locale["country"],
                    title=title,
                    url=(item.findtext("link") or "").strip(),
                    source=name,
                    source_domain=domain,
                    published=when,
                    query=query,
                    confidence=max(0.05, 0.2 + bonus),
                    reasons=[r for r in [reason] if r],
                )
            )

    return out


# ── extraction ────────────────────────────────────────────────────────────

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)

EXTRACTION_PROMPT = """You are filtering a news feed for a travel app about cultural rituals and natural phenomena.

For each numbered headline decide:
- kind: "ceremony" (a ritual, festival, procession, religious observance), "phenomenon" (a natural event people travel to see), or "none" (politics, sport, business, food writing, retrospectives, anything not an attendable event)
- isPublic: true only if outsiders could respectfully attend. A civic festival, a temple ceremony, a public procession are public. A named individual's funeral or a private family rite is NOT public, even when reported in the press.
- place: the town or region named, or "" if none
- whenText: any date or timing mentioned, verbatim, or "" if none
- upcoming: true if it describes something still to come, false if it already happened

Return ONLY a JSON array, one object per headline, in order:
[{"n":1,"kind":"ceremony","isPublic":true,"place":"Ubud","whenText":"Saturday","upcoming":true}]

Headlines:
"""


def _gemini(payload: dict, api_key: str) -> dict | None:
    try:
        response = requests.post(
            f"{GEMINI_URL}?key={api_key}",
            json=payload,
            timeout=90,
            headers={"Content-Type": "application/json"},
        )
        if response.status_code != 200:
            log.warning("gemini http %s", response.status_code)
            return None
        return response.json()
    except Exception as exc:
        log.warning("gemini failed: %s", type(exc).__name__)
        return None


def extraction_available(api_key: str | None = None) -> bool:
    """Whether the classifier can run at all this pass."""
    return bool(api_key or os.environ.get("GEMINI_API_KEY"))


def classify(candidates: list[Candidate], api_key: str | None = None, batch: int = 40) -> list[Candidate]:
    """Turn headlines into structured candidates.

    Without a key this is a no-op and everything stays 'unclassified' at low
    confidence — the pipeline still produces a feed, it is just noisier.
    """
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        log.info("no GEMINI_API_KEY: skipping extraction, candidates stay unclassified")
        return candidates

    for start in range(0, len(candidates), batch):
        chunk = candidates[start:start + batch]
        listing = "\n".join(f"{i+1}. {c.title}" for i, c in enumerate(chunk))
        result = _gemini(
            {
                "contents": [{"parts": [{"text": EXTRACTION_PROMPT + listing}]}],
                "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
            },
            api_key,
        )
        if not result:
            continue

        try:
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            rows = json.loads(text)
        except (KeyError, IndexError, ValueError, TypeError):
            log.warning("could not parse extraction response")
            continue

        for row in rows:
            index = int(row.get("n", 0)) - 1
            if not 0 <= index < len(chunk):
                continue
            candidate = chunk[index]
            candidate.kind = str(row.get("kind", "none"))
            candidate.is_public = row.get("isPublic")
            candidate.place = str(row.get("place", ""))[:80]
            candidate.when_text = str(row.get("whenText", ""))[:60]

            if candidate.kind == "none":
                candidate.confidence = 0.0
                continue
            # An attendable event with a place and a forward-looking date is
            # the strongest thing a headline alone can tell us.
            if candidate.place:
                candidate.confidence += 0.12
                candidate.reasons.append(f"names a location ({candidate.place})")
            if row.get("upcoming"):
                candidate.confidence += 0.15
                candidate.reasons.append("describes something still to come")
            if candidate.is_public is False:
                candidate.reasons.append("private observance — withheld")

    return candidates


def publishable(candidates: list[Candidate]) -> list[Candidate]:
    """Apply the ethics gate and drop the noise.

    A named individual's funeral is reported in the local press every day. It
    is not an attraction, and routing strangers to it is exactly what the
    sensitivity rules elsewhere in this pipeline exist to prevent.
    """
    keep = []
    for c in candidates:
        if c.kind == "none":
            continue
        if c.is_public is False:
            continue
        keep.append(c)
    return sorted(keep, key=lambda c: (-c.confidence, -c.published.timestamp()))
