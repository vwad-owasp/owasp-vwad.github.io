#!/usr/bin/env python3

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests

URLS = [
    "https://api.github.com/repos/OWASP/OWASP-VWAD/contributors",
    "https://api.github.com/repos/OWASP/www-project-vulnerable-web-applications-directory/contributors",
    "https://api.github.com/repos/owasp-vwad/owasp-vwad.github.io/contributors",
]

EXCLUDE = {
    # Bots
    "vwadbot",
    "dependabot[bot]",
    "owasp-nest[bot]",
    "github-actions[bot]",
    "Copilot",
    "OWASPFoundation",
    "owasp-vwad",
    "vwad-owasp",
}


def fetch_contributors(token: str = None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    totals = {}

    for url in URLS:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()

        for user in resp.json():
            login = user["login"]
            if login in EXCLUDE:
                continue
            totals[login] = totals.get(login, 0) + user["contributions"]

    # Sort by contributions descending, then login ascending
    return sorted(
        totals.items(),
        key=lambda x: (-x[1], x[0].lower()),
    )


def write_json(out_path: Path, contributors: list) -> None:
    data = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "contributors": [
            {"login": login, "contributions": count}
            for login, count in contributors
        ],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(data, indent="\t", ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"{out_path}: updated with {len(contributors)} contributors")


def main():
    parser = argparse.ArgumentParser(
        description="Fetch GitHub contributors and write data/contributors.json"
    )
    parser.add_argument(
        "output_file",
        type=Path,
        default=Path("data/contributors.json"),
        nargs="?",
        help="Path to the JSON file to write (default: data/contributors.json)",
    )
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("Warning: GITHUB_TOKEN not set. Using unauthenticated requests.", flush=True)

    contributors = fetch_contributors(token=token)
    write_json(args.output_file, contributors)


if __name__ == "__main__":
    main()
