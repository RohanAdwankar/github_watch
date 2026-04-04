const board = document.getElementById("board");
const tooltip = document.getElementById("tooltip");
const windowBar = document.getElementById("window-bar");
const groupingBar = document.getElementById("grouping-bar");
const scaleLegend = document.getElementById("scale-legend");

const GROUPING_OPTIONS = [
  { key: "language", label: "Language" },
  { key: "topic", label: "Topics" },
];

const TOPIC_CLUSTERS = [
  { name: "AI", topics: ["ai", "agents", "agent", "llm", "gpt", "openai", "anthropic", "rag", "mcp", "machine-learning", "deep-learning", "generative-ai"] },
  { name: "Web", topics: ["web", "web-framework", "frontend", "backend", "fullstack", "spa", "ssr", "serverless"] },
  { name: "React", topics: ["react", "nextjs", "react-native", "jsx", "redux", "tailwindcss"] },
  { name: "Developer Tools", topics: ["developer-tools", "devtools", "build-tool", "testing", "testing-tools", "automation", "compiler", "bundler", "linter"] },
  { name: "CLI & Terminal", topics: ["cli", "terminal", "shell", "command-line", "terminal-emulators"] },
  { name: "Data & Databases", topics: ["database", "postgres", "postgresql", "mysql", "sqlite", "redis", "analytics", "data-science", "data-visualization"] },
  { name: "Infra & DevOps", topics: ["kubernetes", "docker", "cloud", "observability", "monitoring", "infrastructure", "deployment", "networking"] },
  { name: "Security", topics: ["security", "privacy", "reverse-engineering", "pentest", "encryption"] },
  { name: "Mobile", topics: ["android", "ios", "flutter", "mobile", "macos", "windows", "linux"] },
  { name: "Design & UI", topics: ["ui", "components", "design-systems", "visualization", "diagram", "drawing", "whiteboard"] },
  { name: "Media", topics: ["audio", "video", "image", "ocr", "speech", "diffusion", "photo", "streaming"] },
  { name: "Education", topics: ["education", "tutorial", "learning", "algorithms", "interview", "books"] },
  { name: "Finance", topics: ["finance", "trading", "crypto", "bitcoin"] },
  { name: "Games", topics: ["game", "game-engine", "graphics", "gamedev"] },
];

const TOPIC_STOPWORDS = new Set([
  "javascript",
  "typescript",
  "python",
  "java",
  "go",
  "rust",
  "library",
  "framework",
  "frontend",
  "backend",
  "declarative",
  "open-source",
  "api",
]);

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: value > 9999 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function mixChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function colorForScore(score) {
  const clamped = Math.max(-1, Math.min(1, score || 0));
  const white = [248, 248, 244];
  const green = [22, 125, 78];
  const red = [137, 24, 31];
  const base = clamped >= 0 ? green : red;
  const t = 0.08 + Math.abs(clamped) * 0.92;
  return `rgb(${mixChannel(white[0], base[0], t)} ${mixChannel(white[1], base[1], t)} ${mixChannel(white[2], base[2], t)})`;
}

function quantile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * p)));
  return sortedValues[index];
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  const absValue = Math.abs(value);
  const digits = absValue >= 1 ? 1 : absValue >= 0.1 ? 2 : 3;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function buildColorScale(repos) {
  const negatives = repos
    .filter((repo) => repo.growthMode === "delta" && repo.growthPercent < 0)
    .map((repo) => Math.abs(repo.growthPercent))
    .sort((a, b) => a - b);
  const positives = repos
    .filter((repo) => repo.growthMode === "delta" && repo.growthPercent > 0)
    .map((repo) => repo.growthPercent)
    .sort((a, b) => a - b);
  const negativeBound = negatives.length ? Math.max(quantile(negatives, 0.9), negatives[0]) : 0.05;
  const positiveBound = positives.length ? Math.max(quantile(positives, 0.9), positives[0]) : 0.25;
  return {
    negativeBound,
    positiveBound,
    legendStops: [
      { label: `<= ${formatPercent(-negativeBound)}`, value: -1 },
      { label: formatPercent(-(negativeBound / 2)), value: -0.45 },
      { label: "0%", value: 0 },
      { label: formatPercent(positiveBound / 2), value: 0.45 },
      { label: `>= ${formatPercent(positiveBound)}`, value: 1 },
    ],
  };
}

function scoreForPercent(percent, scale) {
  if (!Number.isFinite(percent) || percent === 0) return 0;
  if (percent < 0) {
    return -Math.sqrt(Math.min(1, Math.abs(percent) / Math.max(scale.negativeBound, 0.0001)));
  }
  return Math.sqrt(Math.min(1, percent / Math.max(scale.positiveBound, 0.0001)));
}

function renderScaleLegend(scale, windowLabel) {
  scaleLegend.innerHTML = `
    <div class="scale-legend-label">${windowLabel} change</div>
    <div class="scale-legend-bar">
      ${scale.legendStops.map((stop) => `
        <div class="scale-legend-step ${Math.abs(stop.value) > 0.35 ? "dark" : ""}" style="background:${colorForScore(stop.value)}">${stop.label}</div>
      `).join("")}
    </div>
  `;
}

function binaryTreemap(items, x, y, width, height) {
  if (!items.length) return [];
  if (items.length === 1) return [{ item: items[0], x, y, width, height }];

  const total = items.reduce((sum, item) => sum + item.value, 0);
  let running = 0;
  let splitIndex = 0;
  for (let index = 0; index < items.length; index += 1) {
    running += items[index].value;
    if (running >= total / 2) {
      splitIndex = index + 1;
      break;
    }
  }
  if (splitIndex <= 0 || splitIndex >= items.length) {
    splitIndex = Math.max(1, Math.floor(items.length / 2));
  }

  const first = items.slice(0, splitIndex);
  const second = items.slice(splitIndex);
  const firstValue = first.reduce((sum, item) => sum + item.value, 0);
  const ratio = firstValue / total;

  if (width >= height) {
    const firstWidth = Math.round(width * ratio);
    return [
      ...binaryTreemap(first, x, y, firstWidth, height),
      ...binaryTreemap(second, x + firstWidth, y, width - firstWidth, height),
    ];
  }

  const firstHeight = Math.round(height * ratio);
  return [
    ...binaryTreemap(first, x, y, width, firstHeight),
    ...binaryTreemap(second, x, y + firstHeight, width, height - firstHeight),
  ];
}

function getBaseline(history, minutes) {
  const latest = history[history.length - 1];
  if (!latest) return null;
  const cutoffMs = new Date(latest.ts).getTime() - minutes * 60 * 1000;
  let baseline = null;
  for (const point of history) {
    const pointMs = new Date(point.ts).getTime();
    if (Number.isFinite(pointMs) && pointMs <= cutoffMs) {
      baseline = point;
    }
  }
  return baseline;
}

function computeRepo(repo, windowMinutes) {
  const history = Array.isArray(repo.starHistory) ? repo.starHistory : [];
  const latest = history[history.length - 1];
  const baseline = getBaseline(history, windowMinutes);
  let delta = 0;
  let growthMode = "warming";
  if (latest && baseline) {
    delta = latest.stars - baseline.stars;
    growthMode = "delta";
  }
  const denom = Math.max((baseline?.stars ?? repo.stars) || 1, 1);
  const percent = (delta / denom) * 100;
  const score = Math.max(-1, Math.min(1, percent / 10));
  return {
    ...repo,
    growthScore: Number(score.toFixed(4)),
    growthPercent: Number(percent.toFixed(2)),
    growthLabel: growthMode === "delta" ? `${delta >= 0 ? "+" : ""}${delta} stars` : "warming up",
    growthMode,
  };
}

function normalizeTopic(topic) {
  return String(topic || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function titleCaseTopic(topic) {
  return topic
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildTopicFrequency(repos) {
  const counts = new Map();
  for (const repo of repos) {
    for (const rawTopic of repo.topics || []) {
      const topic = normalizeTopic(rawTopic);
      if (!topic || TOPIC_STOPWORDS.has(topic)) continue;
      counts.set(topic, (counts.get(topic) || 0) + 1);
    }
  }
  return counts;
}

function topicGroupForRepo(repo, topicFrequency) {
  const topics = (repo.topics || []).map(normalizeTopic).filter(Boolean);
  let bestCluster = null;
  let bestScore = 0;

  for (const cluster of TOPIC_CLUSTERS) {
    let score = 0;
    for (const topic of topics) {
      if (cluster.topics.includes(topic)) score += 3;
      else if (cluster.topics.some((needle) => topic.includes(needle) || needle.includes(topic))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCluster = cluster.name;
    }
  }

  if (bestCluster) return bestCluster;

  const rankedTopics = topics
    .filter((topic) => !TOPIC_STOPWORDS.has(topic))
    .map((topic) => ({ topic, frequency: topicFrequency.get(topic) || 0 }))
    .sort((a, b) => b.frequency - a.frequency);

  if (rankedTopics[0]?.frequency >= 6) {
    return titleCaseTopic(rankedTopics[0].topic);
  }

  return "Other Topics";
}

function getAvailableWindows(repos, windows) {
  const timestamps = repos
    .flatMap((repo) => (repo.starHistory || []).map((point) => new Date(point.ts).getTime()))
    .filter(Number.isFinite);
  if (!timestamps.length) return [];
  const ageMinutes = (Math.max(...timestamps) - Math.min(...timestamps)) / 60000;
  return windows.filter((window) => ageMinutes >= window.minutes);
}

function buildSnapshot(data, selectedWindow, groupingMode) {
  const computedRepos = data.repos.map((repo) => computeRepo(repo, selectedWindow.minutes));
  const colorScale = buildColorScale(computedRepos);
  const repos = computedRepos
    .map((repo) => ({
      ...repo,
      growthScore: Number(scoreForPercent(repo.growthPercent, colorScale).toFixed(4)),
    }))
    .sort((a, b) => b.stars - a.stars);
  const sectorsByName = new Map();
  const topicFrequency = buildTopicFrequency(repos);

  for (const repo of repos) {
    const groupName = groupingMode === "topic" ? topicGroupForRepo(repo, topicFrequency) : repo.language;
    if (!sectorsByName.has(groupName)) sectorsByName.set(groupName, []);
    sectorsByName.get(groupName).push(repo);
  }
  const sectors = [...sectorsByName.entries()]
    .map(([name, members]) => ({
      name,
      stars: members.reduce((sum, repo) => sum + repo.stars, 0),
      repos: members.sort((a, b) => b.stars - a.stars),
    }))
    .sort((a, b) => b.stars - a.stars);

  return {
    generatedAt: data.generatedAt,
    selectedWindow,
    groupingMode,
    availableWindows: getAvailableWindows(data.repos, data.windows),
    stats: {
      totalRepos: repos.length,
      totalStars: repos.reduce((sum, repo) => sum + repo.stars, 0),
    },
    colorScale,
    sectors,
  };
}

function draw(snapshot) {
  document.getElementById("generated-at").textContent = snapshot.generatedAt
    ? `Cached snapshot from ${new Date(snapshot.generatedAt).toLocaleString()}.`
    : "No snapshot yet.";
  document.getElementById("legend").textContent = `Size = current stars. Color = change over ${snapshot.selectedWindow.label}. Grouped by ${snapshot.groupingMode}.`;
  document.getElementById("stat-repos").textContent = formatNumber(snapshot.stats.totalRepos);
  document.getElementById("stat-stars").textContent = formatNumber(snapshot.stats.totalStars);
  renderScaleLegend(snapshot.colorScale, snapshot.selectedWindow.label);

  board.innerHTML = "";
  const rect = board.getBoundingClientRect();
  const sectorBoxes = binaryTreemap(
    snapshot.sectors.map((sector) => ({ ...sector, value: sector.stars })),
    0,
    0,
    Math.floor(rect.width),
    Math.floor(rect.height),
  );

  for (const box of sectorBoxes) {
    const sector = document.createElement("section");
    sector.className = "sector";
    sector.style.left = `${box.x}px`;
    sector.style.top = `${box.y}px`;
    sector.style.width = `${box.width}px`;
    sector.style.height = `${box.height}px`;

    const label = document.createElement("div");
    label.className = "sector-label";
    label.textContent = `${box.item.name} ${formatNumber(box.item.stars)}`;
    sector.appendChild(label);

    const repoBoxes = binaryTreemap(
      box.item.repos.map((repo) => ({ ...repo, value: repo.stars })),
      0,
      20,
      Math.max(box.width, 0),
      Math.max(box.height - 20, 0),
    );

    for (const repoBox of repoBoxes) {
      if (repoBox.width < 14 || repoBox.height < 14) continue;
      const compact = repoBox.width < 52 || repoBox.height < 36;
      const showName = repoBox.width > 22 && repoBox.height > 18;
      const showFull = repoBox.width > 110 && repoBox.height > 64;
      const showDesc = repoBox.width > 165 && repoBox.height > 92;
      const showMeta = repoBox.width > 125 && repoBox.height > 68;
      const darkText = (repoBox.item.growthScore || 0) < 0.55 && (repoBox.item.growthScore || 0) > -0.55;

      const repo = document.createElement("a");
      repo.className = "repo";
      if (compact) repo.classList.add("compact");
      repo.href = repoBox.item.htmlUrl;
      repo.target = "_blank";
      repo.rel = "noreferrer";
      repo.style.left = `${repoBox.x}px`;
      repo.style.top = `${repoBox.y}px`;
      repo.style.width = `${repoBox.width}px`;
      repo.style.height = `${repoBox.height}px`;
      repo.style.background = colorForScore(repoBox.item.growthScore);
      repo.style.color = darkText ? "#11110f" : "#ffffff";

      repo.innerHTML = `
        <div>
          ${showName ? `<div class="repo-name">${repoBox.item.name}</div>` : ""}
          ${showFull ? `<div class="repo-full">${repoBox.item.fullName}</div>` : ""}
          ${showDesc ? `<div class="repo-desc">${repoBox.item.description}</div>` : ""}
        </div>
        ${showMeta ? `<div class="repo-meta"><span>${formatNumber(repoBox.item.stars)} stars</span><span>${repoBox.item.growthLabel}</span></div>` : ""}
      `;

      const showTooltip = (event) => {
        tooltip.innerHTML = `
          <strong>${repoBox.item.fullName}</strong><br />
          ${repoBox.item.description || "No description"}<br /><br />
          Stars: ${formatNumber(repoBox.item.stars)}<br />
          Growth: ${repoBox.item.growthLabel}<br />
          Window: ${snapshot.selectedWindow.label}<br />
          History points: ${repoBox.item.starHistory?.length || 0}
        `;
        tooltip.style.left = `${event.clientX + 14}px`;
        tooltip.style.top = `${event.clientY + 14}px`;
        tooltip.classList.add("visible");
      };

      repo.addEventListener("mouseenter", showTooltip);
      repo.addEventListener("mousemove", showTooltip);
      repo.addEventListener("mouseleave", () => tooltip.classList.remove("visible"));
      sector.appendChild(repo);
    }

    board.appendChild(sector);
  }
}

async function init() {
  const response = await fetch("./data/heatmap.json", { cache: "no-store" });
  if (!response.ok) {
    board.innerHTML = `<div class="status">No heatmap data has been generated yet.</div>`;
    return;
  }

  const data = await response.json();
  const availableWindows = getAvailableWindows(data.repos, data.windows);
  let currentWindow = availableWindows[availableWindows.length - 1] || data.windows[0];
  let currentGrouping = GROUPING_OPTIONS[0];

  function render(window, grouping = currentGrouping) {
    currentWindow = window;
    currentGrouping = grouping;
    groupingBar.innerHTML = "";
    for (const option of GROUPING_OPTIONS) {
      const button = document.createElement("button");
      button.textContent = option.label;
      if (option.key === grouping.key) button.classList.add("active");
      button.addEventListener("click", () => render(currentWindow, option));
      groupingBar.appendChild(button);
    }
    windowBar.innerHTML = "";
    for (const item of availableWindows) {
      const button = document.createElement("button");
      button.textContent = item.label;
      if (item.key === window.key) button.classList.add("active");
      button.addEventListener("click", () => render(item, currentGrouping));
      windowBar.appendChild(button);
    }
    draw(buildSnapshot(data, window, grouping.key));
  }

  render(currentWindow, currentGrouping);
  window.addEventListener("resize", () => render(currentWindow, currentGrouping));
}

init().catch(() => {
  board.innerHTML = `<div class="status">Unable to load heatmap data.</div>`;
});
