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

- `index.html` - Homepage with featured app, browse-all, search (by name, author, technology, notes, collection), About VWAD, and Contributors (links to GitHub). Project header includes a “Thanks to our contributors” link that jumps to `#contributors`.
- `app/index.html` / `app.html` - App detail page; use `app/#<slug>` or `app.html#<slug>` for a specific app (e.g. `app/#dot-net-goat`). Each app has a unique URL with full details (collections, technology, author, notes, references, stars).
- `data/collection.json` - Copy of the directory data from the main project; update from `_data/collection.json` when needed.
- `data/contributors.json` - List of GitHub contributors (login, contributions) from the VWAD-related repos. Updated weekly by the **Update GitHub Contributors** workflow; see `.github/workflows/update-contributors.yml` and `.github/workflows/scripts/update_contributors.py`.
- `data/archived_repos.json` - List of repositories detected as archived by the **Update GitHub Statistics** workflow; updated when `update_stats.py` finds archived repos (workflow may also open an issue for new ones).
- `js/app.js` - Loads collection, assigns unique slugs, search/filter API.
- `js/home.js` - Browse table and search UI.
- `js/app-viewer.js` - Renders a single app on the app page.
- `css/site.css` - Standalone styles (OWASP community–aligned theme).
- No build tools; add more `.html` and assets as needed.

## Automation

See [.github/workflows/README.md](.github/workflows/README.md) for GitHub Actions workflows.

## Cache busting

CSS, JS, and font URLs use a `?v=1` query parameter so browsers don’t serve stale assets. **After each deploy**, bump the version in all HTML files (e.g. change `?v=1` to `?v=2`) so visitors see the latest changes. Search for `?v=` to find every occurrence.
