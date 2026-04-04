#!/usr/bin/env python3
"""
Build the static VWAD site into _site/.
"""
from __future__ import annotations

import json
import hashlib
import re
import shutil
import sys
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "_site"
INDEX_HTML = ROOT / "index.html"
COLLECTION_JSON = ROOT / "data" / "collection.json"
APP_LOGO_DIR = ROOT / "images" / "app_logos"
# Same-stem SVG beats raster when both exist in app_logos/.
RASTER_LOGO_PRIORITY = {".png": 40, ".jpg": 30, ".jpeg": 30, ".webp": 25, ".gif": 20}
SVG_LOGO_PRIORITY = 100
BUILD_APP_LOGO_PATHS_PLACEHOLDER = "<!-- BUILD_APP_LOGO_PATHS -->"
REPORT_PATH = ROOT / "generated_site_report.json"
COPY_PATHS = [
    "js",
    "images",
    "data",
    "app",
    "404.html",
    "CNAME",
    "favicon.ico",
    "manifest.json",
    "sw.js",
]
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HOME_TITLE = "OWASP Vulnerable Web Applications Directory"
HOME_DESCRIPTION = "A comprehensive registry of known vulnerable web and mobile applications for legal security testing and training."
SITE_NAME = "OWASP Vulnerable Web Applications Directory"
OG_IMAGE_PATH = "/images/logos/og-image.png"
CSS_BUNDLES = {
    "core": [
        "css/base.css",
        "css/shell.css",
        "css/buttons.css",
        "css/footer.css",
    ],
    "home": [
        "css/pills.css",
        "css/app-detail.css",
        "css/pages/home.css",
        "css/pages/search.css",
        "css/pages/table.css",
    ],
    "app": [
        "css/pills.css",
        "css/app-detail.css",
        "css/pages/app.css",
    ],
    "404": [
        "css/pages/404.css",
    ],
}
STYLESHEET_BLOCK_RE = re.compile(
    r"((?:\s*<link rel=\"stylesheet\" href=\"css/[^\"]+\">\n)+)"
)
COLLECTION_TOOLTIPS = {
    "online": "Hosted online; use over the internet",
    "offline": "Download and run locally",
    "mobile": "Mobile app (e.g. Android, iOS)",
    "container": "Containerized (Docker, VMs, ISOs)",
    "platform": "Platform or multi-app environment",
}
CATEGORY_LABELS = {
    "ctf": "CTF",
    "code-review": "Code review",
    "single-player": "Single-player",
    "multi-player": "Multi-player",
    "guided-lessons": "Guided lessons",
    "free-form": "Free-form",
    "scanner-test": "Scanner test",
}
CATEGORY_TOOLTIPS = {
    "ctf": "Capture the Flag challenge",
    "code-review": "Code review practice",
    "single-player": "Single-player",
    "multi-player": "Multi-player",
    "guided-lessons": "Guided lessons",
    "free-form": "Free-form practice",
    "scanner-test": "Scanner or tool testing",
}
COLLECTION_FALLBACKS = {
    "online": "and available online.",
    "offline": "and available offline.",
    "mobile": "and available as a mobile application.",
    "container": "and available in a containerized format.",
    "platform": "and available as a platform environment.",
}
REPOSITORY_HOSTS = {
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "sourceforge.net",
}
ICON_LINK = "Link"
INLINE_BUTTON_ICONS = {
    "link": (
        '<svg class="btn-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>'
        '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
        "</svg>"
    ),
    "download": (
        '<svg class="btn-icon" aria-hidden="true" viewBox="2 2 20 20" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'
        '<polyline points="7 10 12 15 17 10"/>'
        '<line x1="12" y1="15" x2="12" y2="3"/>'
        "</svg>"
    ),
    "guide": (
        '<svg class="btn-icon" aria-hidden="true" viewBox="3 1 18 21" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'
        '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'
        '<line x1="8" y1="6" x2="16" y2="6"/>'
        '<line x1="8" y1="10" x2="16" y2="10"/>'
        "</svg>"
    ),
    "docker": (
        '<svg class="btn-icon" aria-hidden="true" viewBox="0.5 0.5 23.5 23.5" fill="currentColor">'
        '<path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>'
        "</svg>"
    ),
    "announcement": (
        '<svg class="btn-icon" aria-hidden="true" viewBox="0 0 72 72" fill="none" '
        'stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M19.64 25.98s24.79 1.289 40-9.142"/>'
        '<path d="M19.64 44.88s24.79-1.289 40 9.142"/>'
        '<path d="M12.85 25.98h6.787v18.63h-6.787c-1.105 0-2-.895-2-2v-14.63c0-1.105.895-2 2-2z"/>'
        '<rect x="59.64" y="15.29" width="6" height="40.01" rx="2" ry="2"/>'
        '<path d="M19.636 44.92l.877 4.648h-1.5l1.564 8.299h.5l.38 2.016-5.475.076-2.835-15.04"/>'
        '<path d="M10.85 28.79h-2.485c-1.105 0-2 .895-2 2v8.922c0 1.105.895 2 2 2h2.485"/>'
        '<line x1="13.64" y1="41" x2="16.64" y2="41"/>'
        "</svg>"
    ),
    "live": (
        '<svg class="btn-icon" aria-hidden="true" viewBox="1 1 22 22" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<circle cx="12" cy="12" r="10"/>'
        '<line x1="2" y1="12" x2="22" y2="12"/>'
        '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'
        "</svg>"
    ),
    "demo": (
        '<svg class="btn-icon" aria-hidden="true" viewBox="7 4 13 16" fill="currentColor">'
        '<path d="M8 5v14l11-7z"/>'
        "</svg>"
    ),
    "preview": (
        '<svg class="btn-icon" aria-hidden="true" viewBox="0 3 24 18" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>'
        '<circle cx="12" cy="12" r="3"/>'
        "</svg>"
    ),
}


def get_site_url() -> str:
    if (ROOT / "CNAME").exists():
        host = (ROOT / "CNAME").read_text(encoding="utf-8").strip()
        if host:
            if host.startswith("http://") or host.startswith("https://"):
                return host.rstrip("/")
            return ("https://" + host).rstrip("/")
    return "https://vwad.owasp.org"


def load_collection() -> list[dict]:
    return json.loads(COLLECTION_JSON.read_text(encoding="utf-8"))


def local_app_logo_paths() -> dict[str, str]:
    """slug stem -> site-relative path under images/app_logos/. SVG beats same-stem raster."""
    best: dict[str, tuple[int, str]] = {}

    def consider(stem: str, priority: int, rel: str) -> None:
        prev = best.get(stem)
        if prev is None or priority > prev[0]:
            best[stem] = (priority, rel)

    if not APP_LOGO_DIR.is_dir():
        return {}
    for p in APP_LOGO_DIR.iterdir():
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        if ext == ".svg":
            consider(p.stem, SVG_LOGO_PRIORITY, f"images/app_logos/{p.name}")
            continue
        pri = RASTER_LOGO_PRIORITY.get(ext)
        if pri is not None:
            consider(p.stem, pri, f"images/app_logos/{p.name}")

    return {stem: pair[1] for stem, pair in best.items()}


def render_app_logo_paths_script(logo_paths: dict[str, str]) -> str:
    """Inline script before app.js: slug -> bundled logo path under images/app_logos/."""
    payload = json.dumps(logo_paths, ensure_ascii=False, sort_keys=True)
    return f"<script>window.VWAD_APP_LOGO_PATHS={payload};</script>"


def inject_app_logo_paths_script(html: str, logo_paths: dict[str, str]) -> str:
    if BUILD_APP_LOGO_PATHS_PLACEHOLDER not in html:
        raise ValueError("BUILD_APP_LOGO_PATHS placeholder missing from HTML")
    return html.replace(
        BUILD_APP_LOGO_PATHS_PLACEHOLDER, render_app_logo_paths_script(logo_paths), 1
    )


def is_safe_url(url: str) -> bool:
    """Return True only if *url* is a valid absolute HTTP(S) URL."""
    normalized = str(url).strip()
    if not normalized:
        return False
    parsed = urlparse(normalized)
    return parsed.scheme in {"http", "https"} and bool(parsed.hostname)


def validate_collection(apps: list[dict]) -> None:
    seen: set[str] = set()
    for app in apps:
        slug = str(app.get("slug", "")).strip()
        if not slug:
            raise ValueError(f'Missing slug for "{app.get("name", "unknown")}"')
        if not SLUG_RE.fullmatch(slug):
            raise ValueError(f'Invalid slug "{slug}" for "{app.get("name", "unknown")}"')
        if slug in seen:
            raise ValueError(f'Duplicate slug "{slug}"')
        seen.add(slug)
        app_url = app.get("url", "")
        if not app_url:
            raise ValueError(f'Missing URL for "{slug}"')
        if not is_safe_url(app_url):
            raise ValueError(f'Unsafe URL scheme in "{slug}": {app_url!r}')
        for ref in app.get("references") or []:
            ref_url = ref.get("url")
            if ref_url is not None and not is_safe_url(ref_url):
                raise ValueError(
                    f'Unsafe URL scheme in reference "{ref.get("name", "")}" for "{slug}": {ref_url!r}'
                )


def reset_output_dir() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)


def copy_allowlist() -> None:
    for entry in COPY_PATHS:
        src = ROOT / entry
        dst = OUT_DIR / entry
        if src.is_dir():
            shutil.copytree(src, dst)
        elif src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)


def load_shared_shell() -> tuple[str, str]:
    home_html = INDEX_HTML.read_text(encoding="utf-8")
    body_match = re.search(
        r"<body id=\"top\"[^>]*>(.*?)<main id=\"main-content\" class=\"site-main\">",
        home_html,
        re.S,
    )
    footer_match = re.search(
        r"(<footer id=\"page-end\".*?<a href=\"#top\" id=\"back-to-top\".*?</a>)",
        home_html,
        re.S,
    )
    if not body_match or not footer_match:
        raise ValueError("Could not extract shared page shell from index.html")
    prefix = body_match.group(1)
    prefix = prefix.replace(
        '<p class="project-header-contributors">Thanks to our <a href="#contributors">contributors</a>.</p>\n',
        "",
    )
    return prefix, footer_match.group(1)


def absolute_url(site_url: str, path: str) -> str:
    return site_url.rstrip("/") + "/" + path.lstrip("/")


def strip_css_comments(css: str) -> str:
    result: list[str] = []
    in_string: str | None = None
    index = 0
    while index < len(css):
        char = css[index]
        if in_string:
            result.append(char)
            if char == "\\" and index + 1 < len(css):
                result.append(css[index + 1])
                index += 2
                continue
            if char == in_string:
                in_string = None
            index += 1
            continue
        if char in ("'", '"'):
            in_string = char
            result.append(char)
            index += 1
            continue
        if char == "/" and index + 1 < len(css) and css[index + 1] == "*":
            index += 2
            while index + 1 < len(css) and not (css[index] == "*" and css[index + 1] == "/"):
                index += 1
            index += 2
            continue
        result.append(char)
        index += 1
    return "".join(result)


def compact_css(css: str) -> str:
    # Keep bundling conservative: removing CSS comments is safe, but naive
    # whitespace minification breaks valid syntax inside calc(), shorthand
    # values, and adjacent functional notations.
    return strip_css_comments(css).strip() + "\n"


def write_css_bundles() -> dict[str, str]:
    output_dir = OUT_DIR / "css" / "build"
    output_dir.mkdir(parents=True, exist_ok=True)
    built: dict[str, str] = {}
    for bundle_name, paths in CSS_BUNDLES.items():
        source = "\n".join((ROOT / path).read_text(encoding="utf-8") for path in paths)
        content = compact_css(source)
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:10]
        relative_path = f"css/build/{bundle_name}.{digest}.css"
        (OUT_DIR / relative_path).write_text(content, encoding="utf-8")
        built[bundle_name] = relative_path
    return built


def render_stylesheet_links(bundle_hrefs: list[str]) -> str:
    return "\n" + "\n".join(
        f'  <link rel="stylesheet" href="{href}">' for href in bundle_hrefs
    ) + "\n"


def replace_stylesheet_block(html: str, bundle_hrefs: list[str]) -> str:
    replacement = render_stylesheet_links(bundle_hrefs)
    rendered, count = STYLESHEET_BLOCK_RE.subn(replacement, html, count=1)
    if count != 1:
        raise ValueError("Could not replace stylesheet block in built HTML")
    return rendered


def json_script(data: dict) -> str:
    return '<script type="application/ld+json">\n' + json.dumps(data, indent=2, ensure_ascii=False) + "\n</script>"


def home_jsonld(site_url: str, apps: list[dict]) -> dict:
    item_list_id = absolute_url(site_url, "/#app-list")
    website_id = absolute_url(site_url, "/#website")
    webpage_id = absolute_url(site_url, "/#webpage")
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": website_id,
                "url": absolute_url(site_url, "/"),
                "name": SITE_NAME,
            },
            {
                "@type": "CollectionPage",
                "@id": webpage_id,
                "url": absolute_url(site_url, "/"),
                "name": HOME_TITLE,
                "description": HOME_DESCRIPTION,
                "isPartOf": {"@id": website_id},
                "mainEntity": {"@id": item_list_id},
            },
            {
                "@type": "ItemList",
                "@id": item_list_id,
                "name": "VWAD application directory",
                "numberOfItems": len(apps),
                "itemListOrder": "https://schema.org/ItemListOrderAscending",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": index,
                        "url": app_page_url(site_url, app),
                        "name": app["name"],
                    }
                    for index, app in enumerate(apps, 1)
                ],
            },
        ],
    }


def build_homepage(
    site_url: str, apps: list[dict], css_bundle_hrefs: list[str], logo_paths: dict[str, str]
) -> None:
    home_html = INDEX_HTML.read_text(encoding="utf-8")
    home_html = inject_app_logo_paths_script(home_html, logo_paths)
    placeholder = "<!-- BUILD_HOME_JSONLD -->"
    if placeholder not in home_html:
        raise ValueError("Homepage JSON-LD placeholder not found in index.html")
    script = "  " + json_script(home_jsonld(site_url, apps)).replace("\n", "\n  ")
    rendered = replace_stylesheet_block(home_html.replace(placeholder, script), css_bundle_hrefs)
    (OUT_DIR / "index.html").write_text(rendered, encoding="utf-8")


def app_page_url(site_url: str, app: dict) -> str:
    return absolute_url(site_url, f"/app/{app['slug']}/")


def is_repository_url(url: str) -> bool:
    try:
        hostname = urlparse(url).hostname or ""
    except ValueError:
        return False
    hostname = hostname.lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]
    return hostname in REPOSITORY_HOSTS


def button_icon(name: str) -> str:
    return INLINE_BUTTON_ICONS.get(name, INLINE_BUTTON_ICONS["link"])


def format_date(value: str) -> str:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value
    return dt.strftime("%b %d, %Y").replace(" 0", " ")


def updated_band(value: str) -> dict | None:
    try:
        then = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    days = (datetime.now(timezone.utc) - then.astimezone(timezone.utc)).total_seconds() / 86400
    if days < 30:
        return {"label": "< 1mo", "slug": "lt1mo"}
    if days < 30 * 6:
        return {"label": "< 6mo", "slug": "lt6mo"}
    if days < 365:
        return {"label": "< 1y", "slug": "lt1y"}
    if days < 365 * 2:
        return {"label": "< 2y", "slug": "lt2y"}
    return {"label": "2y +", "slug": "2y"}


def title_case(value: str) -> str:
    return " ".join(part[:1].upper() + part[1:] for part in str(value or "").split())


def dedupe_preserve(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def get_description(app: dict, warnings: list[dict]) -> str:
    description = str(app.get("description", "") or "").strip()
    if description:
        return description

    warnings.append(
        {
            "code": "missing-description",
            "slug": app["slug"],
            "message": f'Missing source description for "{app["name"]}"',
        }
    )
    parts = [
        f'{app["name"]} is a vulnerable application listed in the OWASP Vulnerable Web Applications Directory.'
    ]
    collections = app.get("collection") or []
    if len(collections) == 1 and collections[0] in COLLECTION_FALLBACKS:
        parts[0] = parts[0][:-1] + " " + COLLECTION_FALLBACKS[collections[0]]
    tech = [str(value).strip() for value in (app.get("technology") or []) if str(value).strip()]
    if tech:
        parts.append("Technologies include " + ", ".join(tech[:3]) + ".")
    fallback = " ".join(parts)
    warnings.append(
        {
            "code": "fallback-description-used",
            "slug": app["slug"],
            "message": f'Using fallback description for "{app["name"]}"',
        }
    )
    return fallback


def meta_description(description: str) -> str:
    if len(description) <= 180:
        return description
    trimmed = description[:177].rsplit(" ", 1)[0].rstrip(" ,.;:")
    return trimmed + "..."


def app_keywords(app: dict) -> str:
    values = dedupe_preserve(
        [str(value) for value in (app.get("collection") or [])]
        + [str(value) for value in (app.get("technology") or [])]
        + [str(value) for value in (app.get("categories") or [])]
    )
    return ", ".join(values)


def application_type(app: dict) -> str:
    collections = set(app.get("collection") or [])
    if "mobile" in collections:
        return "MobileApplication"
    if "online" in collections:
        return "WebApplication"
    return "SoftwareApplication"


def additional_property_values(app: dict) -> list[dict]:
    values: list[dict] = []
    for item in app.get("collection") or []:
        values.append({"@type": "PropertyValue", "name": "Collection", "value": item})
    for item in app.get("technology") or []:
        values.append({"@type": "PropertyValue", "name": "Technology", "value": item})
    for item in app.get("categories") or []:
        values.append({"@type": "PropertyValue", "name": "Category", "value": item})
    return values


def application_jsonld(site_url: str, app: dict, description: str) -> dict:
    page_url = app_page_url(site_url, app)
    page_id = page_url + "#webpage"
    website_id = absolute_url(site_url, "/#website")
    app_id = page_url + "#application"
    breadcrumb_id = page_url + "#breadcrumb"
    entity = {
        "@type": application_type(app),
        "@id": app_id,
        "name": app["name"],
        "description": description,
        "applicationCategory": "EducationalApplication",
        "keywords": app_keywords(app),
        "mainEntityOfPage": {"@id": page_id},
        "offers": {
            "@type": "Offer",
            "price": 0,
        },
    }
    author = str(app.get("author", "") or "").strip()
    if author:
        entity["author"] = author
    if app.get("last_contributed"):
        entity["dateModified"] = app["last_contributed"]
    if app.get("references"):
        download_ref = next((ref for ref in app["references"] if ref.get("name") == "download"), None)
        guide_ref = next((ref for ref in app["references"] if ref.get("name") == "guide"), None)
        if download_ref and download_ref.get("url"):
            entity["downloadUrl"] = download_ref["url"]
        if guide_ref and guide_ref.get("url"):
            entity["softwareHelp"] = guide_ref["url"]
    if is_repository_url(app["url"]):
        entity["codeRepository"] = app["url"]
    else:
        entity["url"] = app["url"]
    properties = additional_property_values(app)
    if properties:
        entity["additionalProperty"] = properties

    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": website_id,
                "url": absolute_url(site_url, "/"),
                "name": SITE_NAME,
            },
            {
                "@type": "WebPage",
                "@id": page_id,
                "url": page_url,
                "name": f'{app["name"]} - OWASP VWAD',
                "description": description,
                "isPartOf": {"@id": website_id},
                "breadcrumb": {"@id": breadcrumb_id},
                "mainEntity": {"@id": app_id},
            },
            {
                "@type": "BreadcrumbList",
                "@id": breadcrumb_id,
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": absolute_url(site_url, "/"),
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": app["name"],
                        "item": page_url,
                    },
                ],
            },
            entity,
        ],
    }


def render_badge(stars: int) -> str:
    badge_url = f"https://img.shields.io/badge/stars-{stars}-007ec6?style=flat"
    return (
        '<img class="app-detail-stars-badge" src="'
        + escape(badge_url)
        + '" alt="'
        + escape(f"{stars} stars")
        + '" loading="lazy">'
    )


def render_collection_pills(values: list[str]) -> str:
    pills = []
    for value in values:
        title = COLLECTION_TOOLTIPS.get(value)
        title_attr = f' title="{escape(title)}"' if title else ""
        pills.append(f'<span class="pill pill-collection"{title_attr}>{escape(value)}</span>')
    return " ".join(pills)


def render_technology_pills(values: list[str]) -> str:
    return " ".join(f'<span class="pill">{escape(value)}</span>' for value in values)


def render_category_pills(values: list[str]) -> str:
    pills = []
    for value in values:
        label = CATEGORY_LABELS.get(value, value)
        title = CATEGORY_TOOLTIPS.get(value)
        title_attr = f' title="{escape(title)}"' if title else ""
        pills.append(f'<span class="pill pill-category"{title_attr}>{escape(label)}</span>')
    return " ".join(pills)


def render_action_links(app: dict) -> str:
    links = [
        '<a href="'
        + escape(app["url"])
        + '" class="btn btn-primary" target="_blank" rel="noopener">'
        + button_icon("link")
        + " "
        + ICON_LINK
        + "</a>"
    ]
    for ref in app.get("references") or []:
        label = title_case(ref.get("name", ""))
        url = ref.get("url")
        if not url:
            continue
        links.append(
            '<a href="'
            + escape(url)
            + '" class="btn btn-secondary" target="_blank" rel="noopener">'
            + button_icon(str(ref.get("name", "")).lower())
            + " "
            + escape(label)
            + "</a>"
        )
    return " ".join(links)


def render_app_logo_header_open(app: dict, logo_paths: dict[str, str]) -> str:
    """Opening markup: .app-detail-header + logo slot + .app-detail-title-wrap (caller closes after h1)."""
    slug = str(app.get("slug") or "").strip()
    rel = logo_paths.get(slug) if slug and SLUG_RE.fullmatch(slug) else None
    if rel:
        src = escape(rel)
        img = (
            f'<img class="app-logo-img" src="{src}" alt="" width="72" height="72" '
            'loading="lazy" decoding="async" '
            'onerror="this.parentElement.remove();" />'
        )
        slot = f'<div class="app-logo-slot app-logo-slot--detail" aria-hidden="true">{img}</div>'
    else:
        slot = ""
    return '<div class="app-detail-header">' + slot + '<div class="app-detail-title-wrap">'


def render_app_content(app: dict, description: str, logo_paths: dict[str, str]) -> str:
    rows: list[str] = []
    if app.get("collection"):
        rows.append(
            '<div class="app-detail-row"><span class="label">Collections</span> '
            + render_collection_pills(app["collection"])
            + "</div>"
        )
    if app.get("technology"):
        rows.append(
            '<div class="app-detail-row"><span class="label">Technology</span> '
            + render_technology_pills(app["technology"])
            + "</div>"
        )
    if app.get("categories"):
        rows.append(
            '<div class="app-detail-row"><span class="label">Categories</span> '
            + render_category_pills(app["categories"])
            + "</div>"
        )
    if app.get("author"):
        rows.append(
            '<div class="app-detail-row"><span class="label">Author</span> '
            + escape(app["author"])
            + "</div>"
        )
    if app.get("stars") is not None:
        rows.append(
            '<div class="app-detail-row"><span class="label">Stars</span> '
            + render_badge(int(app["stars"]))
            + "</div>"
        )
    if app.get("last_contributed"):
        band = updated_band(app["last_contributed"])
        pill = (
            ' <span class="pill pill-updated pill-updated-'
            + escape(band["slug"])
            + '">'
            + escape(band["label"])
            + "</span>"
        ) if band else ""
        rows.append(
            '<div class="app-detail-row"><span class="label">Last contribution</span> '
            + escape(format_date(app["last_contributed"]))
            + pill
            + "</div>"
        )

    notes_html = ""
    notes = str(app.get("notes", "") or "").strip()
    if notes:
        notes_html = (
            '<div class="app-detail-notes"><h2>Notes</h2><p>'
            + escape(notes)
            + "</p></div>"
        )

    header_open = render_app_logo_header_open(app, logo_paths)
    return """<div class="container app-view">
      <nav class="app-breadcrumbs" aria-label="Breadcrumb">
        <ol class="app-breadcrumbs-list">
          <li><a href="./">Home</a></li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>
      <article class="app-detail">
        {header_open}
        <h1 class="app-detail-title">{name}</h1>
        </div></div>
        <div class="app-detail-description"><p>{description}</p></div>
        <div class="app-detail-meta">{rows}</div>
        <div class="app-detail-links">{links}</div>
        {notes}
        <p class="app-detail-back"><a href="./">← Back to directory</a></p>
      </article>
    </div>""".format(
        header_open=header_open,
        name=escape(app["name"]),
        description=escape(description),
        rows="".join(rows),
        links=render_action_links(app),
        notes=notes_html,
    )


def render_app_page(
    site_url: str,
    body_prefix: str,
    footer_markup: str,
    app: dict,
    description: str,
    css_bundle_hrefs: list[str],
    logo_paths: dict[str, str],
) -> str:
    page_title = f'{app["name"]} - OWASP VWAD'
    page_url = app_page_url(site_url, app)
    og_image_url = absolute_url(site_url, OG_IMAGE_PATH)
    structured_data = json_script(application_jsonld(site_url, app, description))
    main_content = render_app_content(app, description, logo_paths)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(page_title)}</title>
  <meta name="description" content="{escape(meta_description(description))}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{escape(page_title)}">
  <meta property="og:description" content="{escape(meta_description(description))}">
  <meta property="og:image" content="{escape(og_image_url)}">
  <meta property="og:url" content="{escape(page_url)}">
  <meta property="og:site_name" content="{escape(SITE_NAME)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escape(page_title)}">
  <meta name="twitter:description" content="{escape(meta_description(description))}">
  <meta name="twitter:image" content="{escape(og_image_url)}">
  <link rel="canonical" href="{escape(page_url)}">
  <meta name="robots" content="index,follow">
  <link rel="icon" href="/images/logos/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/images/logos/apple-touch-icon.png">
  <base href="../../">
  <script>(function(){{var t;try{{t=localStorage.getItem('vwad-theme');}}catch(e){{}}var effective;if(!t||t==='system'){{effective=window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}}else{{effective=t;}}document.documentElement.setAttribute('data-theme',effective);}})();</script>
{render_stylesheet_links(css_bundle_hrefs).rstrip()}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap&v=10" rel="stylesheet">
  {structured_data}
</head>
<body id="top" class="page-app">
{body_prefix}
  <main id="main-content" class="site-main">
{main_content}
  </main>

{footer_markup}

  <script src="js/theme.js?v=1"></script>
</body>
</html>
"""


def write_compatibility_pages(
    app_bundle_hrefs: list[str], not_found_bundle_hrefs: list[str], logo_paths: dict[str, str]
) -> None:
    compat_page = OUT_DIR / "app" / "index.html"
    if not compat_page.exists():
        raise ValueError("Missing copied compatibility page")
    compat_html = compat_page.read_text(encoding="utf-8")
    compat_html = inject_app_logo_paths_script(compat_html, logo_paths)
    compat_page.write_text(replace_stylesheet_block(compat_html, app_bundle_hrefs), encoding="utf-8")

    not_found_page = OUT_DIR / "404.html"
    if not not_found_page.exists():
        raise ValueError("Missing copied 404 page")
    not_found_html = not_found_page.read_text(encoding="utf-8")
    not_found_page.write_text(
        replace_stylesheet_block(not_found_html, not_found_bundle_hrefs),
        encoding="utf-8",
    )


def write_app_pages(
    site_url: str, apps: list[dict], css_bundle_hrefs: list[str], logo_paths: dict[str, str]
) -> list[dict]:
    body_prefix, footer_markup = load_shared_shell()
    warnings: list[dict] = []
    for app in apps:
        if not app.get("author"):
            warnings.append(
                {
                    "code": "missing-author",
                    "slug": app["slug"],
                    "message": f'Missing author for "{app["name"]}"',
                }
            )
        if not app.get("last_contributed"):
            warnings.append(
                {
                    "code": "missing-last-contributed",
                    "slug": app["slug"],
                    "message": f'Missing last_contributed for "{app["name"]}"',
                }
            )
        if not app.get("references"):
            warnings.append(
                {
                    "code": "missing-references",
                    "slug": app["slug"],
                    "message": f'Missing references for "{app["name"]}"',
                }
            )
        if app.get("stars") is None:
            warnings.append(
                {
                    "code": "missing-stars",
                    "slug": app["slug"],
                    "message": f'Missing stars for "{app["name"]}"',
                }
            )
        description = get_description(app, warnings)
        page_html = render_app_page(
            site_url,
            body_prefix,
            footer_markup,
            app,
            description,
            css_bundle_hrefs,
            logo_paths,
        )
        target = OUT_DIR / "app" / app["slug"] / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page_html, encoding="utf-8")
    return warnings


def write_sitemap(site_url: str, apps: list[dict], built_at: str) -> None:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        f"    <loc>{escape(absolute_url(site_url, '/'))}</loc>",
        f"    <lastmod>{escape(built_at)}</lastmod>",
        "  </url>",
    ]
    for app in apps:
        lines.extend(
            [
                "  <url>",
                f"    <loc>{escape(app_page_url(site_url, app))}</loc>",
            ]
        )
        if app.get("last_contributed"):
            lines.append(f"    <lastmod>{escape(app['last_contributed'])}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    (OUT_DIR / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_report(site_url: str, apps: list[dict], built_at: str, warnings: list[dict]) -> None:
    report = {
        "site_url": site_url,
        "built_at": built_at,
        "app_count": len(apps),
        "warnings": warnings,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build() -> int:
    site_url = get_site_url()
    built_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    apps = load_collection()
    validate_collection(apps)
    logo_paths = local_app_logo_paths()
    reset_output_dir()
    copy_allowlist()
    css_bundles = write_css_bundles()
    home_bundle_hrefs = [css_bundles["core"], css_bundles["home"]]
    app_bundle_hrefs = [css_bundles["core"], css_bundles["app"]]
    not_found_bundle_hrefs = [css_bundles["core"], css_bundles["404"]]
    build_homepage(site_url, apps, home_bundle_hrefs, logo_paths)
    write_compatibility_pages(app_bundle_hrefs, not_found_bundle_hrefs, logo_paths)
    warnings = write_app_pages(site_url, apps, app_bundle_hrefs, logo_paths)
    write_sitemap(site_url, apps, built_at)
    write_report(site_url, apps, built_at, warnings)
    print(f"Built {len(apps)} app pages into {OUT_DIR}")
    print(f"Wrote report to {REPORT_PATH}")
    if warnings:
        print(f"Collected {len(warnings)} non-blocking warnings")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(build())
    except Exception as exc:  # pragma: no cover - command-line error path
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
