# OWASP VWAD - GitHub Pages

Static GitHub Pages site for the OWASP Vulnerable Web Applications Directory (VWAD) project. The site builds into `_site/` as deployable static HTML, CSS, JS, and data, with dedicated app pages at `/app/<slug>/` and a lightweight stdlib-only build pipeline that is easy to run and test locally.

### Live site

https://vwad.owasp.org/

## Build and preview locally

From this directory:

```bash
python3 scripts/build_site.py
python3 serve.py 8000 _site
```

Then open [http://localhost:8000](http://localhost:8000).

## Serving paths and URLs

- The same build works when served from `/`, `/vwad-new/`, or another subpath
- A small script derives `window.VWAD_BASE` from `location.pathname`, so data and app URLs resolve correctly without changing the built files
- Canonical app pages live at `/app/<slug>/`
- `data/collection.json` contains explicit stable `slug` values
- Legacy `app/#<slug>`, `app/?slug=<slug>`, and `app/?name=<name>` URLs resolve through the compatibility page at `/app/`

## Structure

- `index.html` - Homepage source template. The build injects homepage
  JSON-LD before writing `_site/index.html`.
- `app/index.html` - Compatibility redirect page for legacy app URLs.
- `data/collection.json` - Source-of-truth app directory data, including required stable `slug`.
- `data/contributors.json` - Contributor data used by the homepage contributors section.
- `data/archived_repos.json` - Archive-status data maintained by the stats workflow.
- `schema.json` - Source validation schema for `data/collection.json`.
- `scripts/build_site.py` - Builds `_site/`, pre-renders app pages,
  injects JSON-LD, writes sitemap, and emits
  `generated_site_report.json`.
- `scripts/validate_generated_site.py` - Validates generated app pages,
  sitemap, canonical tags, JSON-LD, and compatibility redirects.
- `_site/` - Generated deploy output. Not committed.
- `js/app.js` - Loads collection data, validates explicit slugs, and
  exposes shared browse/app lookup and search helpers.
- `js/home.js` - Homepage bootstrap and browse-search orchestration for
  mode switching, reset behavior, and result rendering.
- `js/advanced-search.js` - Advanced browse-search controller,
  including custom multi-select filters, grouped pills, and
  Advanced-only UI behavior.
- `js/search-options.js` - Shared option definitions and label helpers
  used by the browse-search UI.
- `js/search-table.js` - Browse table rendering, sorting,
  sticky/scroll behavior, and table interaction helpers.
- `js/theme.js` - Theme toggle, system-theme syncing, and back-to-top
  button behavior.
- `css/base.css` - Shared tokens, dark-theme variables, reset/base
  element styles, accessibility helpers, and utilities.
- `css/shell.css` - Shared layout, containers, site header, project
  header, and common section framing.
- `css/buttons.css` - Shared button primitives and button variants.
- `css/pills.css` - Shared pill styles used by the browse table and app
  detail views.
- `css/app-detail.css` - Shared app-detail component styles used by the
  homepage featured card and the app page.
- `css/footer.css` - Active site footer styles.
- `css/pages/home.css` - Homepage-only framing styles for featured
  content, browse section layout, and contributors.
- `css/pages/search.css` - Homepage browse/search controls and advanced
  search UI.
- `css/pages/table.css` - Homepage browse-results table, toolbar, and
  scroll behavior.
- `css/pages/app.css` - App detail page, breadcrumb, and
  compatibility-page styles.
- `css/pages/404.css` - 404 page layout and artwork styles.

## Automation

See [.github/workflows/README.md](.github/workflows/README.md) for
workflow details.

The workflows most relevant to the site build and deploy path are:

- `validate.yml` - Validates source `data/collection.json` against
  `schema.json`
- `validate-generated-site.yml` - Builds and validates the generated
  `_site/`
- `deploy-pages.yml` - Rebuilds `_site/` and deploys GitHub Pages from
  Actions on `main`

## GitHub Pages setting

This repo should be configured to deploy GitHub Pages from
**GitHub Actions**, not from the branch root.

## Cache busting

CSS, JS, and font URLs use a version query parameter (`?v=...` or
`&v=...`) so browsers don’t serve stale assets. Stylesheets are linked
directly from each HTML page, so **after each deploy** bump the shared
CSS version on every stylesheet `<link>` (for example `?v=10` to
`?v=11`) and update any changed JS or font URLs too. Search for `v=`
to find every occurrence.
