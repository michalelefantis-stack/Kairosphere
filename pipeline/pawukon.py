"""The Balinese pawukon calendar.

Much of what a visitor experiences as stumbling onto something in Bali is
scheduled on a calendar they cannot read. The pawukon is a 210-day cycle of
ten concurrent weeks, and every temple's odalan anniversary recurs on it. That
makes a large slice of "I had no idea this was happening" a computation rather
than a scrape — Tier 1, no upstream, no staleness, free forever.

It does not predict a royal cremation. It does cover the several thousand
temple festivals a year that nobody tells a tourist about.

Anchored on published Galungan dates, which recur exactly every 210 days:
2025-04-23, 2025-11-19, 2026-06-17, 2027-01-13.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

CYCLE = 210

# The thirty wuku, each seven days long.
WUKU = [
    "Sinta", "Landep", "Ukir", "Kulantir", "Tolu", "Gumbreg",
    "Wariga", "Warigadean", "Julungwangi", "Sungsang", "Dungulan", "Kuningan",
    "Langkir", "Medangsia", "Pujut", "Pahang", "Krulut", "Merakih",
    "Tambir", "Medangkungan", "Matal", "Uye", "Menail", "Prangbakat",
    "Bala", "Ugu", "Wayang", "Kelawu", "Dukut", "Watugunung",
]

# Saptawara — the seven-day week.
SAPTAWARA = ["Redite", "Soma", "Anggara", "Buda", "Wraspati", "Sukra", "Saniscara"]
# Pancawara — the five-day market week.
PANCAWARA = ["Umanis", "Paing", "Pon", "Wage", "Kliwon"]
# Triwara — the three-day week.
TRIWARA = ["Pasah", "Beteng", "Kajeng"]

# Galungan falls on Buda Kliwon Dungulan. Dungulan is the 11th wuku, so its
# days are 70-76, and Buda (Wednesday) is the fourth of them: index 73.
GALUNGAN_INDEX = 73
_ANCHOR = date(2026, 6, 17)  # a published Galungan


@dataclass(frozen=True)
class PawukonDay:
    date: date
    index: int          # 0-209 within the cycle
    wuku: str
    saptawara: str
    pancawara: str
    triwara: str

    @property
    def name(self) -> str:
        """e.g. 'Buda Kliwon Dungulan' — how a Balinese date is actually said."""
        return f"{self.saptawara} {self.pancawara} {self.wuku}"


def pawukon_index(day: date) -> int:
    """Position in the 210-day cycle, 0-209."""
    return (GALUNGAN_INDEX + (day - _ANCHOR).days) % CYCLE


def describe(day: date) -> PawukonDay:
    index = pawukon_index(day)
    return PawukonDay(
        date=day,
        index=index,
        wuku=WUKU[index // 7],
        saptawara=SAPTAWARA[index % 7],
        # Pancawara runs continuously through the cycle rather than resetting
        # each wuku. The +1 phase is fixed by the anchor: Galungan is Buda
        # KLIWON Dungulan at index 73, and 73 % 5 lands on Wage without it.
        # Cross-checks: Saraswati (209) = Umanis, Pagerwesi (3) = Kliwon.
        pancawara=PANCAWARA[(index + 1) % 5],
        # Triwara's phase is NOT verified against a published almanac — it is
        # structurally correct (Kajeng Kliwon recurs every 15 days) but the
        # offset could be out. Nothing published depends on it yet.
        triwara=TRIWARA[index % 3],
    )


def next_occurrence(index: int, after: date) -> date:
    """The next date on which the cycle reaches a given index."""
    delta = (index - pawukon_index(after)) % CYCLE
    return after + timedelta(days=delta)


def occurrences(index: int, start: date, end: date) -> list[date]:
    """Every date in a range on which the cycle reaches an index."""
    out: list[date] = []
    day = next_occurrence(index, start)
    while day <= end:
        out.append(day)
        day += timedelta(days=CYCLE)
    return out


# ── island-wide observances ───────────────────────────────────────────────

# Offsets from the start of the cycle for the festivals that move the whole
# island, rather than a single temple.
ISLAND_WIDE = {
    "Galungan": (GALUNGAN_INDEX, "Ancestral spirits return; penjor poles line every road."),
    "Kuningan": (GALUNGAN_INDEX + 10, "The spirits depart; offerings are made before noon."),
    "Pagerwesi": (3, "‘Iron fence’ — fortifying the mind against disorder."),
    "Saraswati": (209, "Knowledge and learning; books and manuscripts are blessed."),
    "Tumpek Landep": (13, "Blessing of metal — once blades, now vehicles and tools."),
    "Tumpek Wariga": (48, "Blessing of plants, 25 days before Galungan."),
}


def island_festivals(start: date, end: date) -> list[dict]:
    """Island-wide pawukon festivals falling in a range."""
    found: list[dict] = []
    for name, (index, blurb) in ISLAND_WIDE.items():
        for when in occurrences(index % CYCLE, start, end):
            found.append({
                "name": name,
                "date": when,
                "pawukon": describe(when).name,
                "description": blurb,
            })
    return sorted(found, key=lambda f: f["date"])


def temple_odalan(pawukon_name: str, start: date, end: date) -> list[date]:
    """Dates a temple celebrates, given its odalan day.

    A temple's anniversary is stated as a pawukon day — "Anggara Kasih
    Medangsia" — not a Gregorian date, which is why the same temple's festival
    moves through the western calendar every year.
    """
    parts = pawukon_name.split()
    if len(parts) != 3:
        raise ValueError(f"expected 'Saptawara Pancawara Wuku', got {pawukon_name!r}")
    sapta, panca, wuku = parts
    if wuku not in WUKU:
        raise ValueError(f"unknown wuku: {wuku}")

    base = WUKU.index(wuku) * 7
    for offset in range(7):
        index = base + offset
        day = describe(date(2026, 1, 1) + timedelta(days=(index - pawukon_index(date(2026, 1, 1))) % CYCLE))
        if day.saptawara == sapta and day.pancawara == panca:
            return occurrences(index, start, end)
    return []
