# GitHub Watch

Visualization of the current 500 biggest Github Projects, similar to the iconic S&P 500 treemaps.

Check it out [here!](https://rohanadwankar.github.io/github_watch/)

## Architecutre 

- `site/` contains the static site.
- `site/data/heatmap.json` stores the tracked repo metadata and star history.
- `scripts/update-heatmap.mjs` fetches the top 500 code repos and appends a fresh star datapoint.
- `.github/workflows/update_json.yml` repeatedly updates the JSON, commits it back to the repo, and deploys GitHub Pages (like a cron job).

In this way we avoid needing a database or server.
