# GitHub Watch

Static GitHub Pages site for a GitHub sector-style heatmap.

## Shape

- `site/` contains the static site.
- `site/data/heatmap.json` stores the tracked repo metadata and star history.
- `scripts/update-heatmap.mjs` fetches the top 500 code repos and appends a fresh star datapoint.
- `.github/workflows/update_json.yml` runs every 10 minutes, updates the JSON, commits it back to the repo, and deploys GitHub Pages.

## Local preview

Serve `site/` with any static file server. For example:

```bash
uv run python -m http.server 8000 --directory site
```

Then open `http://127.0.0.1:8000`.

## GitHub Pages deploy

1. Push the repo to GitHub.
2. In GitHub repo settings, set Pages source to `GitHub Actions`.
3. Let the workflow run once manually with `workflow_dispatch`, or wait for the first scheduled run.
4. The workflow updates `site/data/heatmap.json`, pushes it to the repo, and deploys `site/` to Pages.

## Data behavior

- Each sync makes 5 GitHub search requests.
- The top 500 repos are filtered to exclude obvious list-only repos.
- Every sync appends a new `{ ts, stars }` point to each tracked repo’s `starHistory`.
- The frontend computes performance over whichever time windows actually exist in the stored history.
- On first deploy, only the grid is available. After more syncs accumulate, windows like `10m`, `1h`, `6h`, `24h`, and `7d` become available automatically.
