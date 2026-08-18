"""Render public/og-image.png from scripts/og_image.html.

    python scripts/make_og_image.py

index.html points every Open Graph and Twitter card at /og-image.png. Without
the file every share of the app renders a blank card, which is a bad first
impression of a project whose whole argument is that it checked its facts.

The counts are read from the catalogue rather than typed, and the same run
rewrites them in index.html's meta tags. index.html claimed "340+ events"
against a catalogue of 327 for exactly the reason a number should not be
hand-written in two places: one of them goes stale and nobody notices.

Rasterised with headless Chrome because it is already on the machine and it
renders the same default sans stack the app itself uses — no webfont to embed
and nothing new to install.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts" / "og_image.html"
OUT = ROOT / "public" / "og-image.png"

WIDTH, HEIGHT = 1200, 630

CHROME_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
]


def find_browser() -> str:
    for name in ("chrome", "google-chrome", "chromium", "msedge"):
        found = shutil.which(name)
        if found:
            return found
    for path in CHROME_CANDIDATES:
        if path.exists():
            return str(path)
    raise SystemExit("No Chrome or Edge found to rasterise with.")


def counts() -> dict[str, int]:
    """Real numbers, so the card cannot claim more than the app holds."""
    catalogue = json.loads((ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8"))
    events = catalogue["events"] if isinstance(catalogue, dict) else catalogue

    images = json.loads((ROOT / "public" / "data" / "event_images.json").read_text(encoding="utf-8"))
    photographed = {k for k, v in images["images"].items() if v.get("url")}

    # The last comma-separated part of a region is the country often enough to
    # count, and the figure is only ever used as "N countries" on a card.
    places = {(e.get("region") or "").split(",")[-1].strip() for e in events}
    places.discard("")

    return {
        "events": len(events),
        "countries": len(places),
        "photos": sum(1 for e in events if e["id"] in photographed),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--open", action="store_true", help="show the numbers and exit")
    args = parser.parse_args(argv)

    numbers = counts()
    print("  ".join(f"{k}={v}" for k, v in numbers.items()))
    if args.open:
        return 0

    html = SOURCE.read_text(encoding="utf-8")
    for slot, value in numbers.items():
        html, hits = re.subn(
            rf'(<span data-slot="{slot}">)[^<]*(</span>)',
            rf"\g<1>{value}\g<2>",
            html,
        )
        if hits != 1:
            raise SystemExit(f"template slot {slot!r} matched {hits} times, expected 1")

    browser = find_browser()
    with tempfile.TemporaryDirectory() as work:
        page = Path(work) / "og.html"
        page.write_text(html, encoding="utf-8")
        shot = Path(work) / "og.png"

        subprocess.run(
            [
                browser,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--force-device-scale-factor=1",
                f"--window-size={WIDTH},{HEIGHT}",
                f"--screenshot={shot}",
                page.as_uri(),
            ],
            check=True,
            capture_output=True,
        )

        if not shot.exists():
            raise SystemExit("the browser produced no screenshot")
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_bytes(shot.read_bytes())

    print(f"wrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size // 1024} KB)")

    sync_meta(numbers)
    return 0


def sync_meta(numbers: dict[str, int]) -> None:
    """Keep index.html's advertised counts equal to the catalogue's real ones."""
    page = ROOT / "index.html"
    html = page.read_text(encoding="utf-8")

    before = html
    html = re.sub(r"\b\d+ rituals, ceremonies", f"{numbers['events']} rituals, ceremonies", html)
    html = re.sub(r"\b\d+ countries", f"{numbers['countries']} countries", html)

    if html != before:
        page.write_text(html, encoding="utf-8")
        print(f"updated index.html meta counts")
    else:
        print("index.html meta counts already correct")


if __name__ == "__main__":
    sys.exit(main())
