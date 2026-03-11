#!/usr/bin/env python3
"""
Update last_contributed from SourceForge for directory entries that are not on GitHub.

This script:
1. Loads data/collection.json and finds entries with a SourceForge project URL and no badge
2. For each unique project slug, fetches the activity API and takes the latest activity date
3. Updates last_contributed (ISO 8601) for those entries
4. Uses a local cache and throttling to avoid hammering SourceForge

Environment variables:
- CACHE_FILE: Path to cache file (default: .sourceforge_stats_cache.json)
- REQUEST_DELAY: Seconds between requests (default: 1.5)
- DEBUG_LOGGING: Set to 'true' for verbose output
"""

import json
import os
import re
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

try:
    import requests
except ImportError:
    print("Error: requests library is required. Install with: pip install requests")
    sys.exit(1)

COLLECTION_JSON_PATH = "data/collection.json"
SOURCEFORGE_ACTIVITY_API = "https://sourceforge.net/rest/p/{slug}/activity/"
CACHE_FILE = os.environ.get("CACHE_FILE", ".sourceforge_stats_cache.json")
REQUEST_DELAY = float(os.environ.get("REQUEST_DELAY", "1.5"))
REQUEST_TIMEOUT = 15
DEBUG_LOGGING = os.environ.get("DEBUG_LOGGING", "false").lower() == "true"

# URL pattern: sourceforge.net/projects/<slug>/ (slug is first path segment only)
SF_PROJECT_PATTERN = re.compile(
    r"https?://sourceforge\.net/projects/([^/#?]+)",
    re.IGNORECASE,
)


def debug_log(message: str) -> None:
    if DEBUG_LOGGING:
        print(f"[DEBUG] {message}")


def extract_slug(url: str) -> Optional[str]:
    """Extract SourceForge project slug from a project or files URL."""
    if not url or not isinstance(url, str):
        return None
    m = SF_PROJECT_PATTERN.search(url.strip())
    if not m:
        return None
    # Slug is the first path segment (e.g. 'bwapp' from 'bwapp/files')
    return m.group(1).split("/")[0].strip() or None


def has_sourceforge_url(entry: Dict[str, Any]) -> Optional[str]:
    """Return a SourceForge project URL from entry (main url or references), or None."""
    main = entry.get("url") or ""
    if "sourceforge.net" in main.lower():
        return main.strip()
    for ref in entry.get("references") or []:
        u = (ref.get("url") or "").strip()
        if "sourceforge.net" in u.lower():
            return u
    return None


def load_cache() -> Dict[str, Dict[str, Any]]:
    """Load cache from file. Keys are slugs."""
    if not os.path.exists(CACHE_FILE):
        debug_log(f"Cache file {CACHE_FILE} does not exist")
        return {}
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            debug_log(f"Loaded cache with {len(data)} entries")
            return data
    except (json.JSONDecodeError, OSError) as e:
        print(f"Warning: Failed to load cache: {e}")
        return {}


def save_cache(cache: Dict[str, Dict[str, Any]]) -> None:
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
        debug_log(f"Saved cache with {len(cache)} entries")
    except OSError as e:
        print(f"Warning: Failed to save cache: {e}")


def fetch_last_activity(slug: str) -> Optional[str]:
    """
    Fetch latest activity timestamp for a SourceForge project.
    Returns ISO 8601 date string or None.
    """
    url = SOURCEFORGE_ACTIVITY_API.format(slug=slug)
    headers = {
        "Accept": "application/json",
        "User-Agent": "OWASP-VWAD-SourceForge-Stats",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            debug_log(f"  {slug}: HTTP {resp.status_code}")
            return None
        data = resp.json()
        timeline = data.get("timeline") if isinstance(data, dict) else None
        if not timeline or not isinstance(timeline, list):
            debug_log(f"  {slug}: No timeline")
            return None
        first = timeline[0]
        if not isinstance(first, dict):
            return None
        published = first.get("published")
        if published is None:
            return None
        try:
            ts = int(published) / 1000.0
            dt = datetime.utcfromtimestamp(ts)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except (ValueError, OSError):
            return None
    except requests.RequestException as e:
        print(f"  Warning: Request failed for {slug}: {e}")
        return None


def update_collection_sourceforge_stats(collection_path: str) -> bool:
    """
    Update collection.json with last_contributed from SourceForge for SF-only entries.

    Returns True if the file was written (possibly with changes).
    """
    cache = load_cache()

    try:
        with open(collection_path, "r", encoding="utf-8") as f:
            collection = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {collection_path}")
        return False
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {collection_path}: {e}")
        return False

    if not isinstance(collection, list):
        print("Error: Expected array in collection")
        return False

    # Build set of entries that have a badge (GitHub) — we do not touch those
    entries_with_badge: Set[int] = set()
    for i, entry in enumerate(collection):
        if not isinstance(entry, dict):
            continue
        if entry.get("badge"):
            entries_with_badge.add(i)

    # Collect (index, entry, slug) for entries that have SF URL and no badge
    slug_to_indices: Dict[str, List[int]] = {}
    for i, entry in enumerate(collection):
        if i in entries_with_badge:
            continue
        if not isinstance(entry, dict):
            continue
        sf_url = has_sourceforge_url(entry)
        if not sf_url:
            continue
        slug = extract_slug(sf_url)
        if not slug:
            continue
        slug_to_indices.setdefault(slug, []).append(i)

    if not slug_to_indices:
        print("No SourceForge-only entries to update.")
        return True

    print(f"Found {len(slug_to_indices)} SourceForge project(s) across entries.")

    updated_count = 0
    for slug, indices in sorted(slug_to_indices.items()):
        time.sleep(REQUEST_DELAY)
        cached = cache.get(slug, {})
        last_contributed = fetch_last_activity(slug)
        if last_contributed is None:
            if cached.get("last_contributed"):
                last_contributed = cached["last_contributed"]
                debug_log(f"  Using cached last_contributed for {slug}")
            else:
                print(f"  Skipped {slug}: no activity data")
                continue
        else:
            cache[slug] = {
                "last_contributed": last_contributed,
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }

        for i in indices:
            entry = collection[i]
            old_val = entry.get("last_contributed")
            if old_val != last_contributed:
                entry["last_contributed"] = last_contributed
                updated_count += 1
                name = entry.get("name", "?")
                print(f"  Updated {name} ({slug}): last_contributed = {last_contributed}")
            else:
                debug_log(f"  No change for entry at index {i} ({slug})")

    save_cache(cache)

    if updated_count == 0:
        print("\nNo changes to write.")
        return True

    try:
        with open(collection_path, "w", encoding="utf-8") as f:
            json.dump(collection, f, indent="\t", ensure_ascii=False)
            f.write("\n")
        print(f"\nUpdated {updated_count} entry(ies). Wrote {collection_path}")
        return True
    except OSError as e:
        print(f"Error: Failed to write {collection_path}: {e}")
        return False


def main() -> None:
    print("=" * 60)
    print("SourceForge last_contributed update")
    print("=" * 60)
    success = update_collection_sourceforge_stats(COLLECTION_JSON_PATH)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
