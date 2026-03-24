# GitHub Actions Workflows

Workflows in this directory:

- **Validate JSON** (`validate.yml`) – On PRs that change `data/collection.json`, runs schema, ordering, and .editorconfig checks. **Comment** (`comment.yml`) posts failure details on the PR when validation fails.
- **Validate OWASP Metadata** (`validate-owasp-metadata.yml`) – On pushes and PRs, validates `project.owasp.yaml` using OWASP's metadata validator.
- **Validate Generated Site** (`validate-generated-site.yml`) – On PRs and pushes touching site/build inputs, builds `_site/`, validates generated pages, JSON-LD, sitemap, canonical tags, and compatibility redirects, and uploads the build report artifact.
- **Deploy GitHub Pages** (`deploy-pages.yml`) – On `main`, rebuilds `_site/`, validates it, uploads the Pages artifact, and deploys GitHub Pages from Actions.
- **Update GitHub Statistics** (`update-stats.yml`) – Weekly; updates stars and last-contribution dates in `collection.json`, and `data/archived_repos.json` when it detects archived repos (may create an issue).
- **Update GitHub Contributors** (`update-contributors.yml`) – Weekly; writes `data/contributors.json` and commits when changed.
- **Link Checker** (`link-checker.yml`) – Manual; validates app and reference URLs in `collection.json`.
- **Repository Scout** (`repo-scout.yml`) – Weekly; runs `scout.py` to discover new vulnerable-app repos and opens an issue with findings.

See [scripts/README.md](scripts/README.md) for script details.
