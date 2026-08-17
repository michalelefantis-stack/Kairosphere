"""Is each description actually about the event it is attached to?

The Abu Simbel Sun Festival was described with a biography of Nefertari.
Fluent, accurate, well written, and about a queen rather than a solar
alignment. No boilerplate filter catches that: the text is long, specific
and even mentions Abu Simbel, because Ramesses built her a temple there.

So the check cannot be "does it mention the event". It has to be "does it
read like an account of an event at all". A biography opens by saying
somebody was a person; a gazetteer entry says somewhere is a place; an
account of a festival says it is held, celebrated, or observed.

    python -m pipeline.verify_descriptions            # report only
    python -m pipeline.verify_descriptions --fetch    # try Wikipedia for suspects

Reports rather than rewrites. Where a replacement can be sourced it is
written into the briefings file, which the app already prefers over the
catalogue text; nothing here invents prose, because a confident description
of the wrong festival is the problem, not the cure.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from pathlib import Path

from pipeline.briefings import (
    EVENT_MARKERS,
    briefing_for,
    load_catalogue,
    load_existing,
    save,
)

log = logging.getLogger("descriptions")

ROOT = Path(__file__).resolve().parent.parent

# Openings that describe a subject which is not an event. Anchored near the
# start, because these are definitional phrases: what matters is what the
# first sentence says the thing *is*.
#
# The noun has to arrive within a word or two of "is a". An unbounded gap
# looked harmless and flagged five correct descriptions out of six: "is a
# yearly gathering of the Tuareg and Wodaabe peoples in the northern Niger
# town" matched the pattern for "is a town", as did "is a summer festival in
# the town of Haro" and "is a ritual performed by the men of the southern
# part of Pentecost Island". Every one of them describes its event correctly
# and says so in the same breath.
NOT_AN_EVENT = (
    r"\bwas an? (?:\w+ ){0,2}(queen|king|pharaoh|emperor|empress|ruler|consort|"
    r"general|writer|poet|painter|composer|saint|monk|chief|explorer)\b",
    r"\bis an? (?:\w+ ){0,2}(city|town|village|province|region|district|state|"
    r"country|island|river|lake|mountain|desert|volcano|national park)\b",
    r"\bis the (capital|largest city|homeland)\b",
    r"\bwas born\b",
    r"\bis a genus\b",
    r"\bis a species\b",
)

# How much of the opening counts as the definition.
LEDE_CHARS = 260

BOILERPLATE = (
    r"^Automated ingestion",
    r"An incredible cultural event occurring around",
    r"^A spectacular natural phenomenon in .{1,60}\.\s*Timing:",
)


def keywords(title: str) -> list[str]:
    cleaned = re.sub(r"\(.*?\)", " ", title.lower())
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    stop = {"the", "of", "and", "festival", "ceremony", "ritual", "day", "days",
            "celebration", "feast", "great", "annual", "national", "fair"}
    return [w for w in cleaned.split() if len(w) > 3 and w not in stop]


def diagnose(event: dict) -> str | None:
    """Why this description is suspect, or None if it looks fine."""
    text = (event.get("description") or "").strip()
    if not text:
        return "empty"

    for pattern in BOILERPLATE:
        if re.search(pattern, text, re.I):
            return "boilerplate"

    # Thin, not wrong. "Marks the end of Ramadan; a major celebration for the
    # Muslim community" is true and useful; it is simply short. Kept separate
    # in the report so it never gets counted as an error.
    if len(text) < 60:
        return "thin: under 60 characters"

    lede = text[:LEDE_CHARS].lower()

    for pattern in NOT_AN_EVENT:
        m = re.search(pattern, lede)
        if m:
            return f'describes a subject that is not an event: "{m.group(0)}"'

    # Deliberately not checked: whether the description repeats the event's
    # own title. That test looked reasonable and flagged 57 events, nearly all
    # of them correct — Parrtjima is described as "Ahelhe Ithepe (Light
    # Storytelling)... celebrating Aboriginal culture through light", which is
    # a better description for not restating the name above it. A check that
    # is wrong 90% of the time trains you to ignore the 10%.
    #
    # Nor is "long but contains no event word" kept. It flagged the corrected
    # Abu Simbel text, which describes the sun entering the temple and never
    # needs the word "festival".
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true",
                        help="try to source a replacement for each suspect")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    events = load_catalogue()
    briefings = load_existing()

    suspects = []
    for event in events:
        reason = diagnose(event)
        if reason:
            suspects.append((event, reason))

    covered = sum(1 for e, _ in suspects if e["id"] in briefings)
    log.info("%d events, %d suspect descriptions", len(events), len(suspects))
    log.info("  %d of those already have a sourced briefing shown instead", covered)
    log.info("  %d are what the reader actually sees\n", len(suspects) - covered)

    by_reason: dict[str, int] = {}
    for _, reason in suspects:
        key = reason.split(":")[0]
        by_reason[key] = by_reason.get(key, 0) + 1
    for reason, count in sorted(by_reason.items(), key=lambda kv: -kv[1]):
        log.info(f"  {count:>3}  {reason}")

    exposed = [(e, r) for e, r in suspects if e["id"] not in briefings]
    log.info("\nshown to readers today:")
    for event, reason in exposed[:40]:
        log.info(f"  {event['title'][:36]:<38} {reason[:64]}")

    if not args.fetch:
        return 0

    log.info("\nlooking for replacements…")
    found = 0
    targets = exposed[: args.limit] if args.limit else exposed
    for i, (event, _) in enumerate(targets, 1):
        result = briefing_for(event["title"], event["region"])
        if result:
            briefings[event["id"]] = result
            found += 1
            log.info(f"  [{i}/{len(targets)}] {event['title'][:34]:<36} "
                     f"{result['sourceTitle'][:34]}")
        if i % 20 == 0:
            save(briefings)
    save(briefings)
    log.info(f"\nsourced {found} replacements; {len(targets) - found} still unverified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
