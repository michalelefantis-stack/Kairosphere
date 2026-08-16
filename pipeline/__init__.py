"""Kairosphere phenomena pipeline.

Normalizes every event source into one schema, then lets a confidence engine
reconcile them. Four tiers, in descending order of automation:

  Tier 1  deterministic  — astronomy and calendar math, computed offline
  Tier 2  model feeds    — NOAA aurora, USA-NPN phenology, GDD bloom model
  Tier 3  citizen science— iNaturalist observation density -> phase estimate
  Tier 4  curated        — human-verified registry, review-gated, never auto-published

Run with:  python -m pipeline.run
"""

__version__ = "1.0.0"
SCHEMA_VERSION = 1


def load_dotenv() -> None:
    """Read KEY=value pairs from a root .env into the environment.

    Saves every local pipeline run needing an `export` first. Values already
    set in the environment always win, so CI secrets are never overridden by a
    stale file. .env is gitignored — the key must not enter the repository.
    """
    import os
    from pathlib import Path

    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_dotenv()
