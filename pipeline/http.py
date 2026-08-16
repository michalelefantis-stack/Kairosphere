"""Shared HTTP helper.

Every adapter must fail soft: one dead upstream degrades that layer of the map,
it never takes the pipeline down. This wraps that policy in one place.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests

log = logging.getLogger(__name__)

USER_AGENT = "kairosphere-phenomena-pipeline/1.0 (+https://kairosphere.app)"
DEFAULT_TIMEOUT = 30


def get_json(url: str, *, timeout: int = DEFAULT_TIMEOUT, params: Optional[dict] = None) -> Optional[Any]:
    """GET and parse JSON, or return None and log why not."""
    try:
        response = requests.get(
            url,
            params=params,
            timeout=timeout,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        log.warning("timeout: %s", url)
    except requests.exceptions.HTTPError as exc:
        log.warning("http %s: %s", exc.response.status_code if exc.response else "?", url)
    except requests.exceptions.RequestException as exc:
        log.warning("request failed (%s): %s", type(exc).__name__, url)
    except ValueError:
        log.warning("response was not JSON: %s", url)
    return None
