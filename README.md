# GitHub Watch

<img width="1505" height="849" alt="Screenshot 2026-04-03 at 8 22 37 PM" src="https://github.com/user-attachments/assets/ad694641-a93c-4535-a9f8-f112bb6b5605" />

Visualization of the current 500 biggest Github Projects, similar to the iconic S&P 500 treemaps.

Check it out [here!](https://rohanadwankar.github.io/github_watch/)

## Architecture 

- `site/` contains the static site.
- `site/data/heatmap.json` stores the tracked repo metadata and star history.
- `scripts/update-heatmap.mjs` fetches the top 500 code repos and appends a fresh star datapoint.
- `.github/workflows/update_json.yml` repeatedly updates the JSON, commits it back to the repo, and deploys GitHub Pages (like a cron job).

In this way we avoid needing a database or server.
