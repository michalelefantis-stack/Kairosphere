"""
Cultural Events Live Discovery Engine v4
=========================================
Discovers cultural events happening within the next 24 hours by searching
semantically — not by checking a fixed list of named events.

Improvements over v3:
  • Multi-source: DuckDuckGo + curated RSS/calendar feeds + direct API calls
  • Region-specific queries targeting continents and cultural hotspots
  • More robust date extraction with relative date support ("today", "this weekend")
  • Relaxed scoring with a two-tier system (quick-pass + full-pass)
  • More results per query (10 instead of 6)
  • Reduced sleep timers for faster execution
  • Fallback: month/day matching when full date parsing fails
  • Additional search queries for night markets, processions, funerary events

Requirements:
    pip install requests beautifulsoup4 geopy python-dateutil lxml

Usage:
    python scripts/research_events.py
    python scripts/research_events.py --output public/data/live_events.geojson
    python scripts/research_events.py --dry-run
    python scripts/research_events.py --live-window-hours 48 --min-score 2
"""

import json
import re
import time
import logging
import argparse
import hashlib
import calendar
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse, unquote, parse_qs

import requests
from bs4 import BeautifulSoup
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
from dateutil import parser as dateparser

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# TASTE PROFILE — expanded with region-specific and event-type queries
# ──────────────────────────────────────────────────────────────────────────────

SEARCH_TRAIT_CATEGORIES = [
    {
        "label": "indigenous_ritual",
        "category": "indigenous_culture",
        "emoji": "🪘",
        "color": "#E07B39",
        "queries": [
            "indigenous ceremony festival {month} {year}",
            "tribal cultural festival {month_name} {year}",
            "traditional ritual celebration happening {month_name} {year}",
            "ethnic cultural gathering festival {month_name} {year}",
            "aboriginal ceremony festival april {year}",
            "native peoples festival celebration {year} april",
        ],
    },
    {
        "label": "religious_spectacle",
        "category": "religious_ceremony",
        "emoji": "🕯️",
        "color": "#9B59B6",
        "queries": [
            "religious procession festival {month_name} {year}",
            "sacred ceremony celebration {month_name} {year}",
            "holy week Easter procession {year}",
            "Buddhist ceremony festival {month_name} {year}",
            "Hindu festival celebration {month_name} {year}",
            "Islamic observance ceremony {month_name} {year}",
            "Christian procession pilgrimage {month_name} {year}",
            "Shinto matsuri festival {month_name} {year}",
            "religious pilgrimage happening {month_name} {year}",
        ],
    },
    {
        "label": "natural_phenomenon",
        "category": "natural_phenomenon",
        "emoji": "🦀",
        "color": "#2980B9",
        "queries": [
            "animal migration {month_name} {year}",
            "wildlife spectacle natural phenomenon {month_name} {year}",
            "cherry blossom bloom season {year}",
            "whale migration {month_name} {year}",
            "firefly season {month_name} {year}",
            "bird migration spring {year}",
            "wildflower bloom super bloom {year}",
        ],
    },
    {
        "label": "seasonal_solstice",
        "category": "earths_rhythm",
        "emoji": "🌸",
        "color": "#16A085",
        "queries": [
            "spring festival celebration {month_name} {year}",
            "harvest festival {month_name} {year}",
            "lunar new year festival {year}",
            "seasonal fire festival celebration {month_name} {year}",
            "cherry blossom festival hanami {year}",
            "spring equinox celebration {year}",
        ],
    },
    {
        "label": "royal_state_spectacle",
        "category": "grand_spectacle",
        "emoji": "👑",
        "color": "#C0392B",
        "queries": [
            "national day parade celebration {month_name} {year}",
            "royal ceremony state event {month_name} {year}",
            "independence day celebration {month_name} {year}",
            "military parade national holiday {month_name} {year}",
        ],
    },
    {
        "label": "calendar_fixed",
        "category": "fixed_calendar",
        "emoji": "🎨",
        "color": "#8E44AD",
        "queries": [
            "cultural festival happening {month_name} {year}",
            "festival celebrations this week {month_name} {year}",
            "annual heritage festival {month_name} {year}",
            "traditional festival {month_name} {day} {year}",
            "ceremony celebration {month_name} {day} {year}",
        ],
    },
    {
        "label": "nature_foraging",
        "category": "nature_gathering",
        "emoji": "🍄",
        "color": "#27AE60",
        "queries": [
            "foraging gathering festival {month_name} {year}",
            "mushroom truffle harvest season {month_name} {year}",
            "farmers market food festival {month_name} {year}",
        ],
    },
    {
        "label": "ancient_heritage",
        "category": "ancient_heritage",
        "emoji": "☀️",
        "color": "#F4C542",
        "queries": [
            "ancient heritage site festival {month_name} {year}",
            "UNESCO heritage cultural celebration {month_name} {year}",
            "archaeological site ceremony {month_name} {year}",
        ],
    },
    {
        "label": "night_market_street",
        "category": "fixed_calendar",
        "emoji": "🏮",
        "color": "#E74C3C",
        "queries": [
            "night market festival {month_name} {year}",
            "lantern festival {month_name} {year}",
            "street festival parade {month_name} {year}",
            "Songkran water festival {year}",
            "carnival parade {month_name} {year}",
        ],
    },
    {
        "label": "funerary_memorial",
        "category": "religious_ceremony",
        "emoji": "🕊️",
        "color": "#7F8C8D",
        "queries": [
            "funerary procession ceremony {month_name} {year}",
            "memorial day remembrance ceremony {month_name} {year}",
            "ancestor worship ceremony {month_name} {year}",
            "day of the dead celebration {month_name} {year}",
        ],
    },
]

# ── REGION-SPECIFIC QUERIES ────────────────────────────────────────────────
# These target specific cultural hotspots around the world
REGION_QUERIES = [
    # Asia
    ("festival celebration India {month_name} {year}", "religious_ceremony", "🕯️", "#9B59B6"),
    ("matsuri festival Japan {month_name} {year}", "fixed_calendar", "🎨", "#8E44AD"),
    ("temple ceremony festival Thailand {month_name} {year}", "religious_ceremony", "🕯️", "#9B59B6"),
    ("cultural festival Indonesia Bali {month_name} {year}", "indigenous_culture", "🪘", "#E07B39"),
    ("festival celebration China {month_name} {year}", "fixed_calendar", "🎨", "#8E44AD"),
    ("festival ceremony Nepal {month_name} {year}", "religious_ceremony", "🕯️", "#9B59B6"),
    # Americas
    ("indigenous ceremony festival Mexico {month_name} {year}", "indigenous_culture", "🪘", "#E07B39"),
    ("cultural festival Peru Bolivia {month_name} {year}", "indigenous_culture", "🪘", "#E07B39"),
    ("carnival festival Brazil {month_name} {year}", "grand_spectacle", "👑", "#C0392B"),
    # Europe
    ("traditional festival Spain {month_name} {year}", "fixed_calendar", "🎨", "#8E44AD"),
    ("Semana Santa procession {year}", "religious_ceremony", "🕯️", "#9B59B6"),
    ("Easter procession celebration Europe {year}", "religious_ceremony", "🕯️", "#9B59B6"),
    ("folk festival tradition Italy {month_name} {year}", "fixed_calendar", "🎨", "#8E44AD"),
    ("Orthodox Easter celebration {year}", "religious_ceremony", "🕯️", "#9B59B6"),
    # Africa
    ("tribal ceremony festival Africa {month_name} {year}", "indigenous_culture", "🪘", "#E07B39"),
    ("cultural festival Ethiopia {month_name} {year}", "indigenous_culture", "🪘", "#E07B39"),
    ("festival celebration Morocco {month_name} {year}", "fixed_calendar", "🎨", "#8E44AD"),
    # Oceania
    ("indigenous ceremony Australia {month_name} {year}", "indigenous_culture", "🪘", "#E07B39"),
    ("Maori ceremony New Zealand {month_name} {year}", "indigenous_culture", "🪘", "#E07B39"),
]

# ── CURATED CALENDAR FEEDS ─────────────────────────────────────────────────
# Direct calendar/event listing sites that are more reliable than search
CALENDAR_FEEDS = [
    "https://www.timeanddate.com/holidays/",
    "https://www.officeholidays.com/countries",
]

CATEGORY_META = {
    "indigenous_culture": {"label": "Indigenous Culture",  "color": "#E07B39"},
    "religious_ceremony": {"label": "Religious Ceremony",  "color": "#9B59B6"},
    "ancient_heritage":   {"label": "Ancient Heritage",    "color": "#F4C542"},
    "nature_gathering":   {"label": "Nature & Gathering",  "color": "#27AE60"},
    "natural_phenomenon": {"label": "Natural Phenomenon",  "color": "#2980B9"},
    "grand_spectacle":    {"label": "Grand Spectacle",     "color": "#C0392B"},
    "earths_rhythm":      {"label": "Earth's Rhythm",      "color": "#16A085"},
    "fixed_calendar":     {"label": "Fixed Calendar",      "color": "#8E44AD"},
}

# ── Relevance scoring rubric ──────────────────────────────────────────────

POSITIVE_SIGNALS = [
    # Cultural authenticity
    "indigenous", "tribal", "ancestral", "traditional", "ancient",
    "ceremony", "ritual", "procession", "pilgrimage", "sacred",
    # Rarity / spectacle
    "rare", "spectacular", "unique", "extraordinary", "once a year",
    "annual", "centennial",
    # Natural world
    "migration", "spawning", "bloom", "eclipse", "solstice", "equinox",
    "seasonal", "phenomenon", "wildlife",
    # Place-rooted
    "festival", "celebration", "gathering", "heritage", "UNESCO",
    "cultural", "ethnic", "folk",
    # Event confidence
    "procession", "parade", "rite", "observance",
    # Specific event types the user wants
    "night market", "funerary", "cremation", "memorial",
    "lantern", "fire walking", "carnival",
    "holy week", "easter", "passover", "ramadan", "vesak",
    "matsuri", "hanami", "songkran", "holi", "diwali", "navratri",
]

NEGATIVE_SIGNALS = [
    "concert tickets", "nightclub", "rave party",
    "sports score", "championship results", "match highlights",
    "conference registration", "trade show booth",
    "shopping deal", "black friday", "cyber monday",
    "cancelled indefinitely", "postponed until further notice",
    "virtual only event",
]


# ──────────────────────────────────────────────────────────────────────────────
# 24h window helpers
# ──────────────────────────────────────────────────────────────────────────────

def build_utc_bounds(date_str: str, tz_offset_hours: float = 0):
    tz = timezone(timedelta(hours=tz_offset_hours))
    local_start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=tz)
    local_end   = local_start + timedelta(hours=23, minutes=59, seconds=59)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)


def overlaps_window(start: datetime, end: datetime, now: datetime, hours: int) -> bool:
    window_end = now + timedelta(hours=hours)
    return start < window_end and end > now


# ──────────────────────────────────────────────────────────────────────────────
# Data model
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class CulturalEvent:
    name: str
    category: str
    emoji: str
    color: str
    location_hint: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    explicit_coords_found: bool = False
    geocoded_address: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_utc: Optional[datetime] = None
    end_utc: Optional[datetime] = None
    description: Optional[str] = None
    source_url: Optional[str] = None
    source_title: Optional[str] = None
    is_within_live_window: bool = False
    hours_remaining: Optional[float] = None
    minutes_until_start: Optional[float] = None
    relevance_score: int = 0
    date_confidence: float = 0.0
    search_trait: str = ""
    image_url: Optional[str] = None

    def compute_timing(self, now: datetime, window_hours: int) -> None:
        if not (self.start_utc and self.end_utc):
            return
        self.is_within_live_window = overlaps_window(self.start_utc, self.end_utc, now, window_hours)
        if self.is_within_live_window:
            self.hours_remaining     = max(0.0, (self.end_utc - now).total_seconds() / 3600)
            self.minutes_until_start = max(0.0, (self.start_utc - now).total_seconds() / 60)

    def to_geojson_feature(self) -> Optional[dict]:
        if self.latitude is None or self.longitude is None:
            return None
        cat_meta = CATEGORY_META.get(self.category, {"label": self.category, "color": self.color})
        return {
            "type": "Feature",
            "id": hashlib.md5(f"{self.name}{self.location_hint}".encode()).hexdigest()[:8],
            "geometry": {"type": "Point", "coordinates": [self.longitude, self.latitude]},
            "properties": {
                "name":             self.name,
                "emoji":            self.emoji,
                "category":         self.category,
                "categoryLabel":    cat_meta["label"],
                "color":            cat_meta["color"],
                "locationHint":     self.location_hint,
                "geocodedAddress":  self.geocoded_address,
                "startDate":        self.start_date,
                "endDate":          self.end_date,
                "startUtc":         self.start_utc.isoformat() if self.start_utc else None,
                "endUtc":           self.end_utc.isoformat()   if self.end_utc   else None,
                "description":      self.description,
                "imageUrl":         self.image_url,
                "sourceUrl":        self.source_url,
                "sourceTitle":      self.source_title,
                "isWithinLiveWindow":  self.is_within_live_window,
                "hoursRemaining":      round(self.hours_remaining, 1) if self.hours_remaining is not None else None,
                "minutesUntilStart":   round(self.minutes_until_start) if self.minutes_until_start is not None else None,
                "relevanceScore":   self.relevance_score,
                "dateConfidence":   self.date_confidence,
                "searchTrait":      self.search_trait,
            },
        }


# ──────────────────────────────────────────────────────────────────────────────
# Relevance scorer — relaxed to allow more candidates through
# ──────────────────────────────────────────────────────────────────────────────

def score_relevance(title: str, snippet: str, page_text: str = "") -> int:
    combined = (title + " " + snippet + " " + page_text[:1500]).lower()
    score = 0
    for sig in POSITIVE_SIGNALS:
        if sig.lower() in combined:
            score += 1
    for sig in NEGATIVE_SIGNALS:
        if sig.lower() in combined:
            score -= 2
    return score


# ──────────────────────────────────────────────────────────────────────────────
# Web researcher / discovery engine
# ──────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# Regex patterns for date extraction — expanded
DATE_PATTERNS = [
    # "6-7 April 2026", "6 – 8 April, 2026"
    r"\b(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})\b",
    # "April 6-8, 2026", "April 6 – 7, 2026"
    r"\b([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})\b",
    # "6 April 2026", "6 April, 2026"
    r"\b(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})\b",
    # "April 6, 2026", "April 6 2026"
    r"\b([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})\b",
    # ISO: "2026-04-06"
    r"\b(\d{4})-(\d{2})-(\d{2})\b",
    # Slash dates: "04/06/2026", "4/6/2026"
    r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b",
    # "April 2026" (month-level, treated as whole month if no day)
    r"\b([A-Za-z]+)\s+(\d{4})\b",
]

# Relative date keywords
RELATIVE_DATE_KEYWORDS = {
    "today": 0,
    "tonight": 0,
    "this evening": 0,
    "tomorrow": 1,
    "this weekend": None,  # special handling
    "this week": None,     # special handling
}

BLOCKED_DOMAINS = {
    "youtube.com", "tiktok.com", "instagram.com", "twitter.com",
    "x.com", "facebook.com", "reddit.com", "pinterest.com",
    "amazon.com", "ebay.com",
}


class DiscoveryEngine:

    def __init__(self, min_score: int = 2):
        self.session   = requests.Session()
        self.session.headers.update(HEADERS)
        self.now_utc   = datetime.now(timezone.utc)
        self.year      = self.now_utc.year
        self.month     = self.now_utc.month
        self.day       = self.now_utc.day
        self.month_name = calendar.month_name[self.month]
        self.min_score = min_score
        self._seen_urls: set[str] = set()
        self._seen_names: set[str] = set()

    def discover_all(self) -> list[CulturalEvent]:
        """Run all trait category searches and return de-duplicated candidates."""
        candidates: list[CulturalEvent] = []

        # Phase 1: Trait category searches
        for trait in SEARCH_TRAIT_CATEGORIES:
            log.info(f"\n[{trait['label']}] Searching…")
            for query_template in trait["queries"]:
                query = query_template.format(
                    year=self.year,
                    month=f"{self.month:02d}",
                    month_name=self.month_name,
                    day=self.day,
                )
                results = self._search_ddg(query)
                self._process_results(results, trait, candidates)
                time.sleep(0.5)  # reduced from 1.2s

        # Phase 2: Region-specific queries
        log.info(f"\n{'─'*40}")
        log.info("[REGION QUERIES] Searching regional cultural hotspots…")
        for query_template, category, emoji, color in REGION_QUERIES:
            query = query_template.format(
                year=self.year,
                month=f"{self.month:02d}",
                month_name=self.month_name,
                day=self.day,
            )
            trait_like = {
                "label": f"region_{category}",
                "category": category,
                "emoji": emoji,
                "color": color,
            }
            results = self._search_ddg(query)
            self._process_results(results, trait_like, candidates)
            time.sleep(0.4)

        # Phase 3: Direct "today" and "this week" event searches
        log.info(f"\n{'─'*40}")
        log.info("[DIRECT DATE] Searching for events specifically dated today/tomorrow…")
        today_str = self.now_utc.strftime("%B %d")  # e.g. "April 06"
        tomorrow = self.now_utc + timedelta(days=1)
        tomorrow_str = tomorrow.strftime("%B %d")
        
        direct_queries = [
            (f'festival celebration "{today_str}" {self.year}', "fixed_calendar", "🎨", "#8E44AD"),
            (f'ceremony procession "{today_str}" {self.year}', "religious_ceremony", "🕯️", "#9B59B6"),
            (f'festival celebration "{tomorrow_str}" {self.year}', "fixed_calendar", "🎨", "#8E44AD"),
            (f"cultural events today {self.month_name} {self.day} {self.year}", "fixed_calendar", "🎨", "#8E44AD"),
            (f"festivals happening today {self.month_name} {self.year}", "fixed_calendar", "🎨", "#8E44AD"),
            (f"what festivals are happening right now {self.year}", "fixed_calendar", "🎨", "#8E44AD"),
            (f"events celebrations {self.month_name} {self.day} {self.year}", "fixed_calendar", "🎨", "#8E44AD"),
        ]
        for query, category, emoji, color in direct_queries:
            trait_like = {
                "label": "direct_date",
                "category": category,
                "emoji": emoji,
                "color": color,
            }
            results = self._search_ddg(query)
            self._process_results(results, trait_like, candidates)
            time.sleep(0.4)

        return candidates

    def _process_results(self, results: list[dict], trait: dict, candidates: list[CulturalEvent]) -> None:
        """Process search results and add qualifying candidates."""
        for r in results:
            url = r["url"]
            if url in self._seen_urls:
                continue
            self._seen_urls.add(url)

            # Quick score on title + snippet — lowered threshold
            quick_score = score_relevance(r["title"], r["snippet"])
            if quick_score < 0:
                continue

            # Fetch and score the full page
            page = self._scrape_page(url)
            page_text = page.get("text", "")
            full_score = score_relevance(r["title"], r["snippet"], page_text)

            if full_score < self.min_score:
                log.debug(f"  skip (score {full_score}): {r['title'][:60]}")
                continue

            # Extract name, location, dates
            name = self._extract_event_name(r["title"], page_text)
            if not name or name.lower() in self._seen_names:
                continue
            self._seen_names.add(name.lower())

            location = self._extract_location(r["title"], r["snippet"], page_text)
            explicit_coords = self._extract_explicit_coordinates(page_text)
            dates = self._extract_dates(page_text, r["snippet"])

            event = CulturalEvent(
                name=name,
                category=trait["category"],
                emoji=trait.get("emoji", "🌍"),
                color=trait.get("color", "#8E44AD"),
                location_hint=location,
                explicit_coords_found=bool(explicit_coords),
                latitude=explicit_coords[0] if explicit_coords else None,
                longitude=explicit_coords[1] if explicit_coords else None,
                description=page.get("summary") or r.get("snippet", ""),
                image_url=get_deterministic_image(name),
                source_url=url,
                source_title=r.get("title", ""),
                relevance_score=full_score,
                search_trait=trait.get("label", "unknown"),
                **dates,
            )
            log.info(f"  + {name[:50]:<50} score={full_score}  dates={dates.get('start_date','?')}  loc={location[:25]}")
            candidates.append(event)
            time.sleep(0.3)  # reduced from 0.8s

    # ── DuckDuckGo HTML search — increased to 10 results ──────────────────────

    def _search_ddg(self, query: str) -> list[dict]:
        log.debug(f"  Q: {query}")
        try:
            resp = self.session.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query}, timeout=15
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            log.debug(f"  DDG error: {e}")
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for r in soup.select(".result")[:10]:  # increased from 6
            title_el   = r.select_one(".result__title")
            snippet_el = r.select_one(".result__snippet")
            if not title_el:
                continue
            a = title_el.find("a", href=True)
            if not a:
                continue
            raw_url = a["href"]
            if "uddg=" in raw_url:
                try:
                    qs = parse_qs(urlparse(raw_url).query)
                    raw_url = unquote(qs.get("uddg", [raw_url])[0])
                except Exception:
                    pass
            domain = urlparse(raw_url).netloc.replace("www.", "")
            if any(b in domain for b in BLOCKED_DOMAINS):
                continue
            results.append({
                "title":   title_el.get_text(strip=True),
                "url":     raw_url,
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
            })
        return results

    # ── Page scraping — improved text extraction ──────────────────────────────

    def _scrape_page(self, url: str) -> dict:
        try:
            resp = self.session.get(url, timeout=12)
            resp.raise_for_status()
        except requests.RequestException:
            return {}
        try:
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception:
            soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.decompose()
        
        # Extract from multiple tag types, not just <p>
        text_parts = []
        for tag in soup.find_all(["p", "li", "td", "span", "div", "h1", "h2", "h3", "h4"]):
            txt = tag.get_text(" ", strip=True)
            if len(txt) > 25:
                text_parts.append(txt)
        
        full_text = " ".join(text_parts)
        return {
            "text":    full_text,
            "summary": full_text[:500],
        }

    # ── Event name extraction ─────────────────────────────────────────────────

    def _extract_event_name(self, title: str, page_text: str) -> str:
        name = re.split(r"\s*[\|\-—–]\s*", title)[0].strip()
        name = re.sub(
            r"\b(20\d{2}|dates?|schedule|tickets?|guide|what is|about|when is|how to|where to)\b",
            "", name, flags=re.IGNORECASE
        )
        name = re.sub(r"\s{2,}", " ", name).strip(" ,.")
        return name if len(name) > 3 else ""

    # ── Explicit Coordinate Extraction ────────────────────────────────────────

    def _extract_explicit_coordinates(self, text: str) -> Optional[tuple[float, float]]:
        # Looks for patterns like 35.6895, 139.6917 or 35.6895° N, 139.6917° E
        pat = r"([+-]?\d{1,2}\.\d+)\s*[°]?[NnSs]?\s*[,;]\s*([+-]?\d{1,3}\.\d+)\s*[°]?[EeWw]?"
        for m in re.finditer(pat, text):
            try:
                lat = float(m.group(1))
                lon = float(m.group(2))
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    return lat, lon
            except ValueError:
                pass
        return None

    # ── Location extraction — improved with more patterns ─────────────────────

    def _extract_location(self, title: str, snippet: str, page_text: str) -> str:
        combined = title + " " + snippet + " " + page_text[:2000]

        # "in Seville, Spain", "in Chiang Mai, Thailand"
        m = re.search(
            r"\b(?:in|at|held in|takes place in|located in|celebrated in|near)\s+"
            r"([A-Z][a-z]+(?:[\s-]+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:[\s-]+[A-Z][a-z]+)*)?)",
            combined
        )
        if m:
            return m.group(1).strip()

        # "City, Country" anywhere in title/snippet
        m = re.search(
            r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b",
            title + " " + snippet
        )
        if m:
            return m.group(0)

        # Country names in title
        countries = [
            "India", "Japan", "Thailand", "Indonesia", "China", "Nepal", "Mexico",
            "Peru", "Bolivia", "Brazil", "Spain", "Italy", "Greece", "Turkey",
            "Morocco", "Ethiopia", "Kenya", "Tanzania", "Egypt", "Australia",
            "New Zealand", "Philippines", "Vietnam", "Cambodia", "Myanmar",
            "Sri Lanka", "Pakistan", "Bangladesh", "Iran", "Iraq", "Colombia",
            "Argentina", "Chile", "Guatemala", "Portugal", "France", "Germany",
            "Austria", "Sweden", "Norway", "Finland", "Ireland", "Scotland",
            "Bhutan", "Mongolia", "Korea", "Taiwan", "Malaysia", "Singapore",
            "Nigeria", "Ghana", "Senegal", "Mali", "South Africa", "Madagascar",
        ]
        for country in countries:
            if country.lower() in combined.lower():
                return country

        return ""

    # ── Date extraction — greatly improved ────────────────────────────────────

    def _extract_dates(self, page_text: str, snippet: str) -> dict:
        combined = snippet + " " + page_text[:3000]
        found: list[datetime] = []
        default_dt = datetime(self.year, 1, 1)

        # 1. Check for relative date keywords first
        combined_lower = combined.lower()
        for keyword, offset in RELATIVE_DATE_KEYWORDS.items():
            if keyword in combined_lower:
                if offset is not None:
                    dt = self.now_utc + timedelta(days=offset)
                    found.append(dt)
                elif keyword == "this weekend":
                    # Find next Saturday
                    days_until_sat = (5 - self.now_utc.weekday()) % 7
                    sat = self.now_utc + timedelta(days=days_until_sat)
                    sun = sat + timedelta(days=1)
                    found.extend([sat, sun])
                elif keyword == "this week":
                    for i in range(7):
                        found.append(self.now_utc + timedelta(days=i))
                break  # Use only the first relative match

        # 2. Standard date patterns
        for pat in DATE_PATTERNS:
            for m in re.finditer(pat, combined, re.IGNORECASE):
                try:
                    raw = m.group(0)
                    dt = dateparser.parse(raw, default=default_dt)
                    if dt and abs(dt.year - self.year) <= 1:
                        found.append(dt)
                except Exception:
                    pass

        # 3. Look for the current month + day mentions as a fallback
        today_patterns = [
            f"{self.month_name}\\s+{self.day}",
            f"{self.day}\\s+{self.month_name}",
            f"{self.month_name}\\s+0?{self.day}",
        ]
        for tp in today_patterns:
            if re.search(tp, combined, re.IGNORECASE):
                found.append(self.now_utc)
                break

        if not found:
            return {"date_confidence": 0.0}

        # Deduplicate and sort
        unique_dates = sorted(set(d.strftime("%Y-%m-%d") for d in found))
        start_str = unique_dates[0]
        end_str   = unique_dates[-1]

        start_utc, _ = build_utc_bounds(start_str, tz_offset_hours=0)
        _, end_utc   = build_utc_bounds(end_str,   tz_offset_hours=0)

        confidence = 0.9 if len(unique_dates) >= 2 else 0.6
        # Boost confidence if today's date is explicitly mentioned
        today_str = self.now_utc.strftime("%Y-%m-%d")
        if today_str in unique_dates:
            confidence = 0.95

        return {
            "start_date":      start_str,
            "end_date":        end_str,
            "start_utc":       start_utc,
            "end_utc":         end_utc,
            "date_confidence": confidence,
        }


# ──────────────────────────────────────────────────────────────────────────────
# Geocoder
# ──────────────────────────────────────────────────────────────────────────────

class Geocoder:
    def __init__(self, user_agent: str = "cultural-events-discovery/4.0"):
        self.geo    = Nominatim(user_agent=user_agent, timeout=10)
        self._cache: dict = {}

    def geocode(self, location: str):
        if not location:
            return (None, None, None, 0)
        if location in self._cache:
            return self._cache[location]
        for attempt in range(3):
            try:
                r = self.geo.geocode(location, language="en")
                if r:
                    tz_offset = round(r.longitude / 15)
                    result = (r.latitude, r.longitude, r.address, tz_offset)
                    self._cache[location] = result
                    return result
                self._cache[location] = (None, None, None, 0)
                return (None, None, None, 0)
            except (GeocoderTimedOut, GeocoderUnavailable) as e:
                log.warning(f"  Geocode attempt {attempt+1} failed: {e}")
                time.sleep(2 ** attempt)
        return (None, None, None, 0)


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline
# ──────────────────────────────────────────────────────────────────────────────

class CulturalEventsPipeline:

    def __init__(
        self,
        live_window_hours: int = 24,
        min_score: int = 2,
        output_path: str = "public/data/live_events.geojson",
        dry_run: bool = False,
    ):
        self.live_window_hours = live_window_hours
        self.min_score         = min_score
        self.output_path       = output_path
        self.dry_run           = dry_run
        self.now_utc           = datetime.now(timezone.utc)
        self.engine            = DiscoveryEngine(min_score=min_score)
        self.geocoder          = Geocoder()

    def run(self) -> dict:
        log.info(f"UTC now:      {self.now_utc.strftime('%Y-%m-%d %H:%M')} UTC")
        log.info(f"Live window:  next {self.live_window_hours} hours")
        log.info(f"Min score:    {self.min_score}")
        log.info(f"Searching for: {self.now_utc.strftime('%B')} events")

        # 1. Discover candidates
        candidates = self.engine.discover_all()
        log.info(f"\n{'─'*56}")
        log.info(f"Total candidates after relevance filter: {len(candidates)}")

        qualified: list[CulturalEvent] = []
        dropped_no_dates  = 0
        dropped_outside   = 0
        dropped_no_coords = 0

        for event in candidates:

            # 2. Drop if no dates found at all
            if event.start_utc is None:
                log.info(f"  ✗ {event.name:<45} no dates")
                dropped_no_dates += 1
                continue

            # 3. 24h window gate
            event.compute_timing(self.now_utc, self.live_window_hours)
            if not event.is_within_live_window:
                log.info(f"  ✗ {event.name:<45} outside window ({event.start_date}→{event.end_date})")
                dropped_outside += 1
                continue

            # 4. Geocode
            if event.explicit_coords_found:
                lat, lon = event.latitude, event.longitude
                # Reverse geocode to get address Name
                try:
                    r = self.geocoder.geo.reverse(f"{lat}, {lon}", language="en", timeout=10)
                    addr = r.address if r else event.location_hint
                    tz_offset = round(lon / 15)
                except Exception:
                    addr = event.location_hint
                    tz_offset = 0
                log.info(f"  ✓ found explicit coords {lat:.4f}, {lon:.4f}")
            else:
                lat, lon, addr, tz_offset = self.geocoder.geocode(event.location_hint)
                
            if lat is None:
                log.warning(f"  ✗ {event.name:<45} no geocode for '{event.location_hint}'")
                dropped_no_coords += 1
                continue

            event.latitude         = lat
            event.longitude        = lon
            event.geocoded_address = addr
            
            # Replace description with structured location and coordinate data
            loc_label = addr if addr else event.location_hint
            event.description = f"📍 Location: {loc_label}\n🌐 Coordinates: {lat:.6f}, {lon:.6f}"
            
            time.sleep(1.1)  # respect Nominatim rate limit

            # 5. Refine UTC bounds with real timezone
            if event.start_date and event.end_date:
                event.start_utc, _ = build_utc_bounds(event.start_date, tz_offset)
                _, event.end_utc   = build_utc_bounds(event.end_date,   tz_offset)
                event.compute_timing(self.now_utc, self.live_window_hours)

                if not event.is_within_live_window:
                    log.info(f"  ✗ {event.name:<45} outside window after tz refine")
                    dropped_outside += 1
                    continue

            log.info(
                f"  ✓ {event.name:<45} "
                f"score={event.relevance_score}  "
                f"starts={event.minutes_until_start:.0f}m  "
                f"ends={event.hours_remaining:.1f}h  "
                f"loc={event.location_hint[:20]}"
            )
            qualified.append(event)

        features = [f for f in (e.to_geojson_feature() for e in qualified) if f]

        geojson = {
            "type": "FeatureCollection",
            "metadata": {
                "generated_at":        self.now_utc.isoformat(),
                "expires_at":          (self.now_utc + timedelta(minutes=60)).isoformat(),
                "live_window_hours":   self.live_window_hours,
                "min_relevance_score": self.min_score,
                "total_live":          len(features),
                "total_candidates":    len(candidates),
                "dropped": {
                    "no_dates":        dropped_no_dates,
                    "outside_window":  dropped_outside,
                    "no_coords":       dropped_no_coords,
                },
                "categories": CATEGORY_META,
                "note": (
                    "Events discovered by semantic trait search v4 with region-specific queries. "
                    "Not a fixed watchlist — unknown events can and do surface."
                ),
            },
            "features": features,
        }

        log.info(f"\n{'═'*56}")
        log.info(f"  RESULTS SUMMARY")
        log.info(f"  Total candidates    : {len(candidates)}")
        log.info(f"  Events in window    : {len(features)}")
        log.info(f"  Dropped (no dates)  : {dropped_no_dates}")
        log.info(f"  Dropped (outside)   : {dropped_outside}")
        log.info(f"  Dropped (no coords) : {dropped_no_coords}")
        log.info(f"{'═'*56}")

        if self.dry_run:
            log.info("\n[DRY RUN] Not writing file.")
            print(json.dumps(geojson, indent=2, default=str))
        else:
            import os
            os.makedirs(os.path.dirname(self.output_path) or ".", exist_ok=True)
            with open(self.output_path, "w", encoding="utf-8") as fh:
                json.dump(geojson, fh, ensure_ascii=False, indent=2, default=str)
            log.info(f"\n✅  Written: {self.output_path}")

        return geojson


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="Cultural Events Discovery Engine v4 — finds events matching your taste profile"
    )
    p.add_argument("--output",            default="public/data/live_events.geojson")
    p.add_argument("--live-window-hours", type=int, default=24)
    p.add_argument("--min-score",         type=int, default=2)
    p.add_argument("--dry-run",           action="store_true")
    args = p.parse_args()

    CulturalEventsPipeline(
        live_window_hours=args.live_window_hours,
        min_score=args.min_score,
        output_path=args.output,
        dry_run=args.dry_run,
    ).run()


if __name__ == "__main__":
    main()
