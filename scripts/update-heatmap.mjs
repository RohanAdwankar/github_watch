import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SITE_DIR = path.join(ROOT, "site");
const DATA_DIR = path.join(SITE_DIR, "data");
const DATA_PATH = path.join(DATA_DIR, "heatmap.json");
const SEARCH_PER_PAGE = 100;
const SEARCH_PAGE_COUNT = 10;
const LIMIT = 500;
const HISTORY_LIMIT = 300;
const WINDOWS = [
  { key: "10m", label: "10m", minutes: 10 },
  { key: "1h", label: "1h", minutes: 60 },
  { key: "6h", label: "6h", minutes: 360 },
  { key: "24h", label: "24h", minutes: 1440 },
  { key: "7d", label: "7d", minutes: 10080 },
];

function nowIso() {
  return new Date().toISOString();
}

function isListLike(repo) {
  const text = [
    repo.name,
    repo.description || "",
    repo.homepage || "",
    repo.language || "",
    ...(repo.topics || []),
  ]
    .join(" ")
    .toLowerCase();
  const markers = [
    "awesome",
    " curated ",
    " links",
    " resources",
    " list",
    " roadmap",
    " interview",
    " papers",
    " books",
    " tutorial",
  ];
  if (markers.some((marker) => ` ${text} `.includes(marker))) {
    return true;
  }
  if (!repo.language || repo.language === "Markdown") {
    return true;
  }
  return (repo.size || 0) < 80;
}

async function readExisting() {
  try {
    return JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
  } catch {
    return { generatedAt: null, repos: [], windows: WINDOWS };
  }
}

async function githubFetch(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "github-watch",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status}`);
  }
  return response;
}

async function fetchTopRepos() {
  const repos = [];
  const seen = new Set();
  for (let page = 1; page <= SEARCH_PAGE_COUNT; page += 1) {
    const response = await githubFetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(
        "stars:>1 fork:false archived:false",
      )}&sort=stars&order=desc&per_page=${SEARCH_PER_PAGE}&page=${page}`,
    );
    const payload = await response.json();
    for (const item of payload.items || []) {
      const repo = {
        fullName: item.full_name,
        owner: item.owner.login,
        name: item.name,
        htmlUrl: item.html_url,
        description: item.description || "",
        language: item.language || "Other",
        forks: item.forks_count,
        openIssues: item.open_issues_count,
        size: item.size,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        pushedAt: item.pushed_at,
        homepage: item.homepage || "",
        topics: item.topics || [],
        stars: item.stargazers_count,
      };
      if (seen.has(repo.fullName) || isListLike(repo)) {
        continue;
      }
      seen.add(repo.fullName);
      repos.push(repo);
      if (repos.length >= LIMIT) {
        return repos;
      }
    }
  }
  return repos;
}

function appendHistory(history, ts, stars) {
  const next = Array.isArray(history) ? [...history] : [];
  const last = next[next.length - 1];
  if (!last || last.ts !== ts) {
    next.push({ ts, stars });
  }
  if (next.length > HISTORY_LIMIT) {
    return next.slice(-HISTORY_LIMIT);
  }
  return next;
}

function mergeRepos(previousRepos, freshRepos, syncTs) {
  const previousMap = new Map(previousRepos.map((repo) => [repo.fullName, repo]));
  return freshRepos.map((repo) => {
    const previous = previousMap.get(repo.fullName);
    return {
      ...repo,
      starHistory: appendHistory(previous?.starHistory || [], syncTs, repo.stars),
    };
  });
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const existing = await readExisting();
  const syncTs = nowIso();
  const repos = mergeRepos(existing.repos || [], await fetchTopRepos(), syncTs);
  const payload = {
    generatedAt: syncTs,
    windows: WINDOWS,
    repos,
  };
  await fs.writeFile(DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote ${repos.length} repos to ${DATA_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
