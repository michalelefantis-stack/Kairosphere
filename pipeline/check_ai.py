"""Diagnose the Gemini connection without ever printing the key.

    python -m pipeline.check_ai

Exists because a failed classification is silent by design — the monitor is
built to degrade rather than crash, so a bad key looks exactly like a clean
news day. This says which of the four things actually went wrong.
"""

from __future__ import annotations

import json
import os
import sys

import requests

from .sources.local_news import GEMINI_URL

MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def mask(key: str) -> str:
    """Enough to identify the key, never enough to use it."""
    if len(key) <= 8:
        return f"{'*' * len(key)} ({len(key)} chars)"
    return f"{key[:4]}…{key[-2:]} ({len(key)} chars)"


def scrub(text: str, key: str) -> str:
    return text.replace(key, "<KEY>") if key else text


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

    key = os.environ.get("GEMINI_API_KEY", "").strip()

    print("1. Is a key visible to the pipeline?")
    if not key:
        print("   NO — nothing in GEMINI_API_KEY.")
        print("   Put it in .env at the repo root, or export it in this shell.")
        return 1
    print(f"   yes: {mask(key)}")

    print("\n2. Does it look like an AI Studio key?")
    if key.startswith("AIza"):
        print("   yes — AIza… is the expected format.")
    else:
        print(f"   NO — starts with {key[:3]!r}, expected 'AIza'.")
        print("   Keys from aistudio.google.com/apikey begin AIza and are ~39 chars.")
        print("   An 'AQ.' prefix is an OAuth/ephemeral token, which this endpoint")
        print("   will reject: it authenticates with ?key=<api-key>, not a bearer token.")

    print("\n3. Can it list models?")
    try:
        response = requests.get(MODELS_URL, params={"key": key}, timeout=30)
        print(f"   HTTP {response.status_code}")
        if response.status_code == 200:
            names = [
                m.get("name", "").removeprefix("models/")
                for m in response.json().get("models", [])
            ]
            flash = [n for n in names if "flash" in n]
            print(f"   {len(names)} models available; flash variants: {flash[:6]}")
            target = GEMINI_URL.split("/models/")[1].split(":")[0]
            print(f"   monitor wants: {target} -> {'PRESENT' if target in names else 'NOT AVAILABLE'}")
            if target not in names and flash:
                print(f"   fix: set GEMINI_MODEL={flash[0]}")
        else:
            print("   " + scrub(response.text[:400], key))
            return 1
    except Exception as exc:
        print(f"   request failed: {type(exc).__name__}: {scrub(str(exc), key)}")
        return 1

    print("\n4. Does a real classification call work?")
    try:
        response = requests.post(
            f"{GEMINI_URL}?key={key}",
            json={
                "contents": [{"parts": [{"text": 'Reply with only: {"ok":true}'}]}],
                "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
            },
            timeout=60,
        )
        print(f"   HTTP {response.status_code}")
        if response.status_code != 200:
            print("   " + scrub(response.text[:400], key))
            return 1
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        print(f"   model replied: {text.strip()[:80]}")
        print("\nAll four checks passed — the monitor should classify normally.")
        return 0
    except Exception as exc:
        print(f"   failed: {type(exc).__name__}: {scrub(str(exc), key)}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
