# OWASP VWAD - GitHub Pages

Standalone GitHub Pages site for the OWASP Vulnerable Web Applications Directory (VWAD) project. Static HTML/CSS, no build step, easy to maintain and test locally.

### The live site is https://vwad.owasp.org/

## Test locally

From this directory, run any of:

```bash
# Option 1: npx (Node)
npx serve .

# Option 2: Python 3 (custom 404 page)
python3 serve.py 8000

# Option 3: Python 3 plain
python3 -m http.server 8000
```

Then open [http://localhost:3000](http://localhost:3000) (serve) or [http://localhost:8000](http://localhost:8000) (Python). Use `serve.py` if you want missing paths to show the custom 404 page instead of the server’s default.

You can also open `index.html` directly in a browser, but relative links and assets work best when served over HTTP.

## Serving path

The same files work at any base path. A small script in each page sets `window.VWAD_BASE` from `location.pathname`, so the site works at `https://example.github.io/`, `https://example.github.io/vwad-new/`, or any subpath. No config or build step is needed when you move the site.

## Structure

- `index.html` - Homepage with the featured app, browse table, Basic and Advanced browse search, About VWAD, and Contributors. The project header includes a “Thanks to our contributors” link that jumps to `#contributors`.
- `app/index.html` - App detail page; use `app/#<slug>` for a specific app (for example `app/#dot-net-goat`). Each app has a unique URL with full details such as collections, technology, author, notes, references, and stars.
- `data/collection.json` - Copy of the directory data from the main project; update from `_data/collection.json` when needed.
- `data/contributors.json` - List of GitHub contributors (login, contributions) from the VWAD-related repos. Updated weekly by the **Update GitHub Contributors** workflow; see `.github/workflows/update-contributors.yml` and `.github/workflows/scripts/update_contributors.py`.
- `data/archived_repos.json` - List of repositories detected as archived by the **Update GitHub Statistics** workflow; updated when `update_stats.py` finds archived repos (the workflow may also open an issue for newly archived repos).
- `js/app.js` - Loads collection data, assigns unique slugs, and exposes shared browse/app lookup and search helpers.
- `js/home.js` - Homepage bootstrap and browse-search orchestration for mode switching, reset behavior, and result rendering.
- `js/advanced-search.js` - Advanced browse-search controller, including custom multi-select filters, grouped pills, and Advanced-only UI behavior.
- `js/search-options.js` - Shared option definitions and label helpers used by the browse-search UI.
- `js/search-table.js` - Browse table rendering, sorting, sticky/scroll behavior, and table interaction helpers.
- `js/app-viewer.js` - Renders a single app on the app detail page.
- `js/theme.js` - Theme toggle, system-theme syncing, and back-to-top button behavior.
- `css/base.css` - Shared tokens, dark-theme variables, reset/base element styles, accessibility helpers, and utilities.
- `css/shell.css` - Shared layout, containers, site header, project header, and common section framing.
- `css/buttons.css` - Shared button primitives and button variants.
- `css/pills.css` - Shared pill styles used by the browse table and app detail views.
- `css/app-detail.css` - Shared app-detail component styles used by the homepage featured card and the app page.
- `css/footer.css` - Active site footer styles.
- `css/pages/home.css` - Homepage-only framing styles for featured content, browse section layout, and contributors.
- `css/pages/search.css` - Homepage browse/search controls and advanced search UI.
- `css/pages/table.css` - Homepage browse-results table, toolbar, and scroll behavior.
- `css/pages/app.css` - App detail page and no-slug state styles.
- `css/pages/404.css` - 404 page layout and artwork styles.
- No build tools; add more `.html` and assets as needed.

## Automation

See [.github/workflows/README.md](.github/workflows/README.md) for GitHub Actions workflows.

## Cache busting

CSS, JS, and font URLs use a version query parameter (`?v=...` or `&v=...`) so browsers don’t serve stale assets. Stylesheets are linked directly from each HTML page, so **after each deploy** bump the shared CSS version on every stylesheet `<link>` (for example `?v=10` to `?v=11`) and update any changed JS or font URLs too. Search for `v=` to find every occurrence.
