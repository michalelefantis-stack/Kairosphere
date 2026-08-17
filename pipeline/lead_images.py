"""Take the lead photograph from the article we already verified.

pipeline/briefings resolved a Wikipedia article for each event and only
accepted it after checking that it names the event, names its place, and
reads like an account of something happening. That is a far stronger claim
than any keyword search against Commons — and it is already made.

So the lead image of that article needs no separate verification. If the
article is about Up Helly Aa, the photograph at the top of it is a
photograph of Up Helly Aa, chosen by someone who read the article.

    python -m pipeline.lead_images            # events with a briefing, no photo
    python -m pipeline.lead_images --limit 10

Licence and credit are fetched from Commons for each file, and anything
without recoverable licence information is dropped rather than used —
Commons material is mostly CC-BY or CC-BY-SA and the attribution has to
travel with the picture.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from urllib.parse import unquote

from pipeline.briefings import load_catalogue, load_existing
from pipeline.images import COMMONS, WIKI, _get, _is_photograph_name, _license_of

log = logging.getLogger("lead-images")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "event_images.json"


def lead_image(article_title: str) -> str | None:
    """The file name of an article's lead image, if it has one."""
    data = _get(WIKI, {
        "action": "query", "titles": article_title,
        "prop": "pageimages", "piprop": "original",
        "format": "json", "origin": "*",
    })
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    for page in pages.values():
        source = (page.get("original") or {}).get("source")
        if source:
            # The returned url carries tracking parameters, and keeping them
            # turned every lookup into a request for a file literally named
            # "Landdiving1.jpg?utm_source=en.wikipedia.org".
            name = source.rsplit("/", 1)[-1].split("?", 1)[0].split("#", 1)[0]
            return unquote(name)
    return None


def commons_record(filename: str) -> dict | None:
    """Licence, credit and a display-sized url for a Commons file."""
    data = _get(COMMONS, {
        "action": "query", "titles": f"File:{filename}",
        "prop": "imageinfo", "iiprop": "url|extmetadata|mime",
        "iiurlwidth": 1200, "format": "json", "origin": "*",
    })
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    for page in pages.values():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]

        mime = str(info.get("mime", ""))
        # Photographs only. A coat of arms is not a picture of a festival.
        if not mime.startswith("image/") or mime == "image/svg+xml":
            return None
        if not _is_photograph_name(filename):
            return None

        license_name, artist, license_url = _license_of(info)
        if not license_name:
            return None

        return {
            "url": info.get("thumburl") or info.get("url"),
            "credit": artist or "Wikimedia Commons contributor",
            "license": license_name,
            "licenseUrl": license_url,
            "sourcePage": f"https://commons.wikimedia.org/wiki/File:{filename.replace(' ', '_')}",
        }
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    doc = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"images": {}}
    images = doc.get("images", {})
    briefings = load_existing()

    targets = [e for e in load_catalogue()
               if e["id"] not in images and e["id"] in briefings]
    if args.limit:
        targets = targets[: args.limit]

    log.info("%d events have a verified article and no photograph\n", len(targets))

    found = 0
    for i, event in enumerate(targets, 1):
        article = briefings[event["id"]]["sourceTitle"]
        filename = lead_image(article)
        if not filename:
            log.info("  [%d/%d] %-32s article has no lead image", i, len(targets), event["title"][:32])
            continue

        record = commons_record(filename)
        if not record:
            log.info("  [%d/%d] %-32s lead image unusable (%s)",
                     i, len(targets), event["title"][:32], filename[:40])
            continue

        record.update({
            "verifiedBy": f"lead image of “{article}”",
            "via": "wikipedia-lead",
            "score": 5,
        })
        images[event["id"]] = record
        found += 1
        log.info("  [%d/%d] %-32s %s", i, len(targets), event["title"][:32], filename[:46])

        if i % 20 == 0:
            doc["images"] = images
            OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    doc["images"] = images
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log.info("\nadded %d photographs; %d events now have one", found, len(images))
    return 0


if __name__ == "__main__":
    sys.exit(main())
