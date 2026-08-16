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
