# Workflow Scripts

This directory contains scripts used by GitHub Actions workflows: validation for `data/collection.json`, and automation for stats, contributors, and repository discovery.

## Scripts

### check_schema.py

Validates that `collection.json` conforms to the JSON schema defined in `schema.json`. Uses Python's `jsonschema` library for comprehensive validation with user-friendly error messages.

**Usage:**
```bash
python3 check_schema.py <schema_file> <json_file>
```

**Exit codes:**
- `0`: All entries conform to the schema
- `1`: Schema validation failed or an error occurred

**Features:**
- Entry-by-entry error reporting
- Clear field path identification
- Human-readable error messages
- Shows expected values for constraints (enums, minimums, required fields, etc.)

### check_ordering.py

Validates that entries in `collection.json` are ordered alphabetically by the `name` field (case-insensitive).

**Usage:**
```bash
python3 check_ordering.py <json_file>
```

**Exit codes:**
- `0`: All entries are properly ordered
- `1`: Entries are not ordered alphabetically or an error occurred

### check_editorconfig.py

Validates that `collection.json` adheres to the `.editorconfig` rules for JSON files:
- `indent_style = tab`
- `indent_size = 1`
- `charset = utf-8`
- `end_of_line = lf`
- `insert_final_newline = true`
- `trim_trailing_whitespace = true`

Additionally validates that special characters (e.g., ç, ê) are stored as-is rather than as Unicode escape sequences (e.g., `\u00e7`, `\u00ea`), which requires using `ensure_ascii=False` in `json.dump()`.

**Usage:**
```bash
python3 check_editorconfig.py <json_file>
```

**Exit codes:**
- `0`: File adheres to all `.editorconfig` rules
- `1`: File violates one or more rules or an error occurred

### check_links.py

Validates that all app URLs and reference URLs in `collection.json` are accessible and not broken. Checks HTTP status codes and detects redirects.

**Usage:**
```bash
python3 check_links.py
```

**Exit codes:**
- `0`: All URLs are accessible
- `1`: One or more URLs failed validation or an error occurred

**Features:**
- **Duplicate detection**: Skips checking the same URL multiple times
- **Redirect tracking**: Identifies URLs that redirect and logs the final destination
- **Comprehensive error reporting**: Reports both connection errors and HTTP error status codes (4xx, 5xx)
- **Context information**: Shows which entry and field (App URL or Reference URL) each URL belongs to
- **JSON output**: Saves failed links and redirects to `failed_links.json` for artifact upload
- **Workflow summary**: Outputs formatted results to `GITHUB_STEP_SUMMARY` for easy viewing in GitHub Actions

**Environment Variables:**
- `DATA_FILE`: Path to collection JSON file (default: `data/collection.json`)

### update_contributors.py

Fetches contributor data from GitHub repositories and writes a JSON file for the static site. Aggregates contributions from multiple repositories and sorts by contribution count.

**Usage:**
```bash
python3 update_contributors.py [output_file]
```

If `output_file` is omitted, writes to `data/contributors.json`.

**Exit codes:**
- `0`: Update completed successfully
- `1`: Update failed or an error occurred

**Features:**
- **Multi-repository aggregation**: Fetches contributors from legacy (OWASP-VWAD), main directory, and this site repo
- **Exclusion list**: Filters out bots and project authors to show only community contributors
- **Smart sorting**: Sorts by contribution count (descending), then alphabetically by username
- **JSON output**: Writes `{ "updated": "<ISO8601>", "contributors": [ { "login", "contributions" }, ... ] }`; the workflow commits the file when it changes

**Environment Variables:**
- `GITHUB_TOKEN`: GitHub personal access token (optional, but recommended for higher rate limits)

**Excluded accounts:**
- Bots: `vwadbot`, `dependabot[bot]`, `owasp-nest[bot]`, `github-actions[bot]`, `Copilot`, `OWASPFoundation`
- Authors: `kingthorin`, `psiinon`, `raulsiles`

### scout.py

Discovers GitHub repositories that may be candidates for the vulnerable web applications directory (e.g. via search). Reads existing repos from `data/collection.json` to avoid duplicates. Outputs `scout-results.json` and `scout-issue-body.md` for the **Repository Scout** workflow, which creates an issue with label `new app` when new repositories are found.

**Usage:**
```bash
python3 .github/workflows/scripts/scout.py
```

Typically run by `repo-scout.yml` (weekly, Monday 09:00 UTC) or manually via workflow_dispatch.

**Environment Variables:**
- `GITHUB_TOKEN`: GitHub token (workflow provides this)

### update_stats.py

Updates GitHub statistics (stars and last contribution date) in `collection.json` for all entries with a `badge` field. Also detects archived repositories: updates `data/archived_repos.json` and writes an artifact so the workflow can create an issue for new archived repos.

**Usage:**
```bash
python3 update_stats.py
```

**Exit codes:**
- `0`: Update completed successfully
- `1`: Update failed or an error occurred

**Features:**
- **Dynamic rate limit handling**: Automatically detects and handles GitHub API rate limits with exponential backoff
- **Intelligent caching**: Uses local caching to minimize API calls
- **Retry mechanism**: Automatically retries failed requests with configurable retry limits
- **GraphQL batch queries**: Uses GraphQL API for efficient batch processing (faster for large datasets)
- **Debug logging**: Comprehensive logging with response headers for troubleshooting
- **Graceful degradation**: Falls back to cached data when API limits are exceeded

**Environment Variables:**
- `GITHUB_TOKEN`: GitHub personal access token (recommended for higher rate limits). Without this, the script uses unauthenticated requests with lower limits (60 requests/hour vs 5000 requests/hour).
- `CACHE_FILE`: Path to cache file (default: `.github_stats_cache.json`)
- `MAX_RETRIES`: Maximum number of retry attempts (default: `3`)
- `INITIAL_DELAY`: Initial delay between requests in seconds (default: `1`)
- `DEBUG_LOGGING`: Enable detailed debug logging (default: `false`). Set to `true` to see full response headers and diagnostic information.

**Examples:**

Basic usage (uses defaults):
```bash
python3 update_stats.py
```

With debug logging:
```bash
DEBUG_LOGGING=true python3 update_stats.py
```

With custom retry settings:
```bash
MAX_RETRIES=5 INITIAL_DELAY=2 python3 update_stats.py
```

**Rate Limit Handling:**

The script implements sophisticated rate limit handling:

1. **Detection**: Monitors `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers
2. **Primary rate limit (403)**: When `X-RateLimit-Remaining` reaches 0, waits until the reset time
3. **Secondary rate limit (429)**: Honors `Retry-After` header or uses exponential backoff
4. **Exponential backoff**: For transient errors, uses `wait_time = min(2^retry_count, 300)` seconds
5. **Graceful fallback**: Returns cached data when rate limits prevent fresh fetches

**Caching:**

The script uses local caching to minimize API calls:

1. **Cache storage**: Stores repository statistics in a local cache file
2. **Cache file**: JSON file mapping `owner/repo` to stats (excluded from git via `.gitignore`)
3. **Fallback**: Uses cached data when API calls fail or rate limits are exceeded

### update_sourceforge_stats.py

Updates `last_contributed` in `collection.json` for entries that reference SourceForge (and do not have a GitHub `badge`). Fetches the latest activity date from SourceForge's REST activity API and writes ISO 8601 timestamps. Runs as a separate job a few hours after the GitHub stats update.

**Usage:**
```bash
python3 update_sourceforge_stats.py
```

**Exit codes:**
- `0`: Update completed successfully (or no SourceForge-only entries)
- `1`: Script failed (e.g. file not found, invalid JSON)

**Features:**
- **SourceForge-only entries**: Processes only entries that have a SourceForge project URL (in `url` or `references`) and no `badge` (so GitHub job owns badge entries).
- **Activity API**: Uses `https://sourceforge.net/rest/p/{slug}/activity/`; takes the first timeline item's `published` (ms) as last activity.
- **Throttling**: Delay between requests (default 1.5s) to avoid overloading SourceForge.
- **Caching**: Local cache (e.g. `.sourceforge_stats_cache.json`) stores last_contributed per slug; used when API fails or returns no data.
- **No-op writes**: Writes `collection.json` only when at least one entry's `last_contributed` actually changed.

**Environment Variables:**
- `CACHE_FILE`: Path to cache file (default: `.sourceforge_stats_cache.json`)
- `REQUEST_DELAY`: Seconds between API requests (default: `1.5`)
- `DEBUG_LOGGING`: Set to `true` for verbose output

## Integration with Workflows

These scripts are automatically executed by GitHub Actions workflows:

- `validate.yml` (workflow name: **Validate JSON**): Runs validation scripts (`check_schema.py`, `check_ordering.py`, `check_editorconfig.py`) on PRs that modify `data/collection.json`. When it fails, `comment.yml` posts the failure artifact as a comment on the PR (triggered by `workflow_run`).
- `update-stats.yml`: Runs `update_stats.py` weekly; updates `data/collection.json` and `data/archived_repos.json`, commits when changed, and may create an issue for newly detected archived repos.
- `update-sourceforge-stats.yml`: Runs `update_sourceforge_stats.py` weekly (Sundays 04:00 UTC, a few hours after GitHub stats); updates `last_contributed` for SourceForge-only entries in `data/collection.json` and commits when changed.
- `link-checker.yml`: Runs `check_links.py` on manual trigger to validate all app and reference URLs.
- `update-contributors.yml`: Runs `update_contributors.py` weekly to update `data/contributors.json`; commits and pushes when the file changes.
- `repo-scout.yml`: Runs `scout.py` weekly (Mondays 09:00 UTC); creates an issue with new repository findings (label `new app`).

The validation results from `validate.yml` are:

1. Combined into a unified `artifact.txt` file (failures only)
2. Displayed in the GitHub Actions job summary with proper formatting (all results)
3. Posted as a comment on the pull request if any validation fails

Each validation step includes a clear PASS/FAIL indicator for easy identification of issues.
