#!/usr/bin/env python3
"""
Validate the generated _site output.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from html import unescape
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "_site"
COLLECTION_JSON = ROOT / "data" / "collection.json"
REPORT_PATH = ROOT / "generated_site_report.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def is_absolute_url(value: str) -> bool:
    return isinstance(value, str) and (value.startswith("https://") or value.startswith("http://"))


def fail(message: str) -> None:
    raise AssertionError(message)


def extract_jsonld_objects(html: str) -> list[dict]:
    objects = []
    for match in re.finditer(r"<script type=\"application/ld\+json\">\s*(.*?)\s*</script>", html, re.S):
        objects.append(json.loads(match.group(1)))
    return objects


def extract_canonical(html: str) -> str | None:
    match = re.search(r"<link rel=\"canonical\" href=\"([^\"]+)\"", html)
    return match.group(1) if match else None


def extract_title(html: str) -> str | None:
    match = re.search(r"<title>(.*?)</title>", html, re.S)
    return unescape(match.group(1).strip()) if match else None


def extract_meta_description(html: str) -> str | None:
    match = re.search(r"<meta name=\"description\" content=\"([^\"]*)\">", html)
    return unescape(match.group(1)) if match else None


def graph_nodes(obj: dict) -> list[dict]:
    graph = obj.get("@graph")
    if isinstance(graph, list):
        return [node for node in graph if isinstance(node, dict)]
    return [obj] if isinstance(obj, dict) else []


def app_type(app: dict) -> str:
    collections = set(app.get("collection") or [])
    if "mobile" in collections:
        return "MobileApplication"
    if "online" in collections:
        return "WebApplication"
    return "SoftwareApplication"


def expected_warning_counts(apps: list[dict]) -> Counter:
    counts = Counter()
    for app in apps:
        if not str(app.get("description", "") or "").strip():
            counts["missing-description"] += 1
            counts["fallback-description-used"] += 1
        if not app.get("author"):
            counts["missing-author"] += 1
        if not app.get("last_contributed"):
            counts["missing-last-contributed"] += 1
        if not app.get("references"):
            counts["missing-references"] += 1
        if app.get("stars") is None:
            counts["missing-stars"] += 1
    return counts


def validate_report(apps: list[dict]) -> tuple[Counter, dict]:
    if not REPORT_PATH.exists():
        fail(f"Missing build report: {REPORT_PATH}")
    report = load_json(REPORT_PATH)
    warnings = report.get("warnings")
    if not isinstance(warnings, list):
        fail("Build report missing warnings list")
    actual = Counter(warning.get("code") for warning in warnings)
    expected = expected_warning_counts(apps)
    for code, count in expected.items():
        if actual.get(code, 0) != count:
            fail(f"Warning count mismatch for {code}: expected {count}, got {actual.get(code, 0)}")
    return actual, report


def validate_homepage(apps: list[dict]) -> None:
    page = SITE_DIR / "index.html"
    if not page.exists():
        fail("Missing generated homepage")
    html = page.read_text(encoding="utf-8")
    jsonld = extract_jsonld_objects(html)
    if not jsonld:
        fail("Homepage missing JSON-LD")
    nodes = graph_nodes(jsonld[0])
    by_type = {}
    for node in nodes:
        node_type = node.get("@type")
        by_type.setdefault(node_type, []).append(node)
    for required in ("WebSite", "CollectionPage", "ItemList"):
        if required not in by_type:
            fail(f"Homepage JSON-LD missing {required}")
    item_list = by_type["ItemList"][0]
    items = item_list.get("itemListElement") or []
    if len(items) != len(apps):
        fail(f"Homepage ItemList count mismatch: expected {len(apps)}, got {len(items)}")
    for entry in items:
        if entry.get("@type") != "ListItem":
            fail("Homepage ItemList contains non-ListItem entry")
        if not is_absolute_url(entry.get("url", "")):
            fail("Homepage ItemList contains non-absolute url")
        if not entry.get("name"):
            fail("Homepage ItemList entry missing name")


def validate_pwa_assets() -> None:
    manifest = SITE_DIR / "manifest.json"
    sw = SITE_DIR / "sw.js"
    if not manifest.exists():
        fail("Missing manifest.json in generated site")
    if not sw.exists():
        fail("Missing sw.js in generated site")


def validate_app_pages(apps: list[dict], site_url: str) -> None:
    generated_pages = list((SITE_DIR / "app").glob("*/index.html"))
    generated_pages = [path for path in generated_pages if path.parent.name != "app"]
    if len(generated_pages) != len(apps):
        fail(f"Generated app page count mismatch: expected {len(apps)}, got {len(generated_pages)}")

    canonical_urls = set()
    titles = set()
    for app in apps:
        page_path = SITE_DIR / "app" / app["slug"] / "index.html"
        if not page_path.exists():
            fail(f"Missing generated app page for slug {app['slug']}")
        html = page_path.read_text(encoding="utf-8")
        canonical = extract_canonical(html)
        if not canonical:
            fail(f"Missing canonical tag for {app['slug']}")
        expected_canonical = site_url.rstrip("/") + f"/app/{app['slug']}/"
        if canonical != expected_canonical:
            fail(f"Canonical mismatch for {app['slug']}: expected {expected_canonical}, got {canonical}")
        if canonical in canonical_urls:
            fail(f"Duplicate canonical URL {canonical}")
        canonical_urls.add(canonical)

        title = extract_title(html)
        if not title or app["name"] not in title:
            fail(f"Title missing app name for {app['slug']}")
        if title in titles:
            fail(f"Duplicate title {title}")
        titles.add(title)

        description = extract_meta_description(html)
        if not description:
            fail(f"Missing meta description for {app['slug']}")

        links_match = re.search(r'<div class="app-detail-links">(.*?)</div>', html, re.S)
        if not links_match:
            fail(f"Missing action links block for {app['slug']}")
        links_html = links_match.group(1)
        button_count = len(re.findall(r"<a\b", links_html))
        icon_count = len(re.findall(r'class="btn-icon"', links_html))
        if button_count == 0:
            fail(f"No action buttons rendered for {app['slug']}")
        if icon_count != button_count:
            fail(f"Action buttons missing SVG icons for {app['slug']}")

        jsonld = extract_jsonld_objects(html)
        if not jsonld:
            fail(f"Missing JSON-LD for {app['slug']}")
        nodes = graph_nodes(jsonld[0])
        types = {node.get("@type") for node in nodes}
        if "WebPage" not in types:
            fail(f"App page JSON-LD missing WebPage for {app['slug']}")
        if "BreadcrumbList" not in types:
            fail(f"App page JSON-LD missing BreadcrumbList for {app['slug']}")
        expected_type = app_type(app)
        if expected_type not in types:
            fail(f"App page JSON-LD missing {expected_type} for {app['slug']}")

        webpage = next(node for node in nodes if node.get("@type") == "WebPage")
        if not is_absolute_url(webpage.get("url", "")):
            fail(f"WebPage url is not absolute for {app['slug']}")
        breadcrumb = next(node for node in nodes if node.get("@type") == "BreadcrumbList")
        items = breadcrumb.get("itemListElement") or []
        if len(items) != 2:
            fail(f"Breadcrumb should have 2 items for {app['slug']}")
        for item in items:
            if not is_absolute_url(item.get("item", "")):
                fail(f"Breadcrumb item is not absolute for {app['slug']}")

        app_node = next(node for node in nodes if node.get("@type") == expected_type)
        if app_node.get("applicationCategory") != "EducationalApplication":
            fail(f"applicationCategory mismatch for {app['slug']}")
        offers = app_node.get("offers")
        if not isinstance(offers, dict):
            fail(f"Missing Offer for {app['slug']}")
        if offers.get("@type") != "Offer":
            fail(f"Offer type mismatch for {app['slug']}")
        if offers.get("price") != 0:
            fail(f"Offer price mismatch for {app['slug']}")
        for key in ("url", "codeRepository", "downloadUrl", "softwareHelp"):
            if key in app_node and not is_absolute_url(app_node[key]):
                fail(f"{key} is not absolute for {app['slug']}")


def validate_sitemap(apps: list[dict], site_url: str) -> None:
    sitemap = SITE_DIR / "sitemap.xml"
    if not sitemap.exists():
        fail("Missing sitemap.xml")
    homepage_url = site_url.rstrip("/") + "/"
    try:
        tree = ET.parse(sitemap)
    except ET.ParseError as exc:
        fail(f"Invalid sitemap.xml: {exc}")

    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    entries = {}
    for node in tree.getroot().findall("sm:url", namespace):
        loc_node = node.find("sm:loc", namespace)
        if loc_node is None or not (loc_node.text or "").strip():
            fail("Sitemap contains url entry without loc")
        entries[loc_node.text.strip()] = node

    if homepage_url not in entries:
        fail("Sitemap missing homepage URL")
    home_lastmod = entries[homepage_url].find("sm:lastmod", namespace)
    if home_lastmod is None or not (home_lastmod.text or "").strip():
        fail("Sitemap homepage missing lastmod")

    for app in apps:
        expected = site_url.rstrip("/") + f"/app/{app['slug']}/"
        if expected not in entries:
            fail(f"Sitemap missing {expected}")
        lastmod = entries[expected].find("sm:lastmod", namespace)
        expected_lastmod = str(app.get("last_contributed") or "").strip()
        if expected_lastmod:
            if lastmod is None or (lastmod.text or "").strip() != expected_lastmod:
                fail(f"Sitemap lastmod mismatch for {app['slug']}")
        elif lastmod is not None:
            fail(f"Sitemap should omit lastmod for {app['slug']}")


def validate_hash_links() -> None:
    pattern = re.compile(r"href=[\"'][^\"']*app/#")
    for path in SITE_DIR.rglob("*.html"):
        if path == SITE_DIR / "app" / "index.html":
            continue
        html = path.read_text(encoding="utf-8")
        if pattern.search(html):
            fail(f"Found legacy hash link in {path.relative_to(ROOT)}")


def validate_compat_page() -> None:
    page = SITE_DIR / "app" / "index.html"
    if not page.exists():
        fail("Missing compatibility page at _site/app/index.html")
    html = page.read_text(encoding="utf-8")
    required_fragments = [
        "window.location.hash",
        "params.get('slug')",
        "params.get('name')",
        "window.VWAD.getAppByName",
        "redirectToHome();",
    ]
    for fragment in required_fragments:
        if fragment not in html:
            fail(f"Compatibility page missing redirect logic fragment: {fragment}")


def main() -> int:
    apps = load_json(COLLECTION_JSON)
    _, report = validate_report(apps)
    site_url = str(report.get("site_url") or "https://vwad.owasp.org").rstrip("/")
    validate_homepage(apps)
    validate_pwa_assets()
    validate_app_pages(apps, site_url)
    validate_sitemap(apps, site_url)
    validate_hash_links()
    validate_compat_page()
    print(f"Validated generated site for {len(apps)} apps")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
