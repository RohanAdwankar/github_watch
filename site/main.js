const board = document.getElementById("board");
const tooltip = document.getElementById("tooltip");
const windowBar = document.getElementById("window-bar");

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
  const green = [47, 143, 91];
  const red = [182, 66, 55];
  const base = clamped >= 0 ? green : red;
  const t = 0.2 + Math.abs(clamped) * 0.75;
  return `rgb(${mixChannel(white[0], base[0], t)} ${mixChannel(white[1], base[1], t)} ${mixChannel(white[2], base[2], t)})`;
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

function getAvailableWindows(repos, windows) {
  const timestamps = repos
    .flatMap((repo) => (repo.starHistory || []).map((point) => new Date(point.ts).getTime()))
    .filter(Number.isFinite);
  if (!timestamps.length) return [];
  const ageMinutes = (Math.max(...timestamps) - Math.min(...timestamps)) / 60000;
  return windows.filter((window) => ageMinutes >= window.minutes);
}

function buildSnapshot(data, selectedWindow) {
  const repos = data.repos.map((repo) => computeRepo(repo, selectedWindow.minutes)).sort((a, b) => b.stars - a.stars);
  const sectorsByName = new Map();
  for (const repo of repos) {
    if (!sectorsByName.has(repo.language)) sectorsByName.set(repo.language, []);
    sectorsByName.get(repo.language).push(repo);
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
    availableWindows: getAvailableWindows(data.repos, data.windows),
    stats: {
      totalRepos: repos.length,
      totalStars: repos.reduce((sum, repo) => sum + repo.stars, 0),
      greenCount: repos.filter((repo) => repo.growthScore > 0.12).length,
      redCount: repos.filter((repo) => repo.growthScore < -0.12).length,
      actualGrowthCount: repos.filter((repo) => repo.growthMode === "delta").length,
    },
    sectors,
  };
}

function draw(snapshot) {
  document.getElementById("generated-at").textContent = snapshot.generatedAt
    ? `Cached snapshot from ${new Date(snapshot.generatedAt).toLocaleString()}.`
    : "No snapshot yet.";
  document.getElementById("legend").textContent = `Size = current stars. Color = change over ${snapshot.selectedWindow.label}.`;
  document.getElementById("stat-repos").textContent = formatNumber(snapshot.stats.totalRepos);
  document.getElementById("stat-stars").textContent = formatNumber(snapshot.stats.totalStars);
  document.getElementById("stat-green").textContent = formatNumber(snapshot.stats.greenCount);
  document.getElementById("stat-red").textContent = formatNumber(snapshot.stats.redCount);
  document.getElementById("stat-measured").textContent = formatNumber(snapshot.stats.actualGrowthCount);
  document.getElementById("note").textContent = snapshot.availableWindows.length
    ? "The UI only shows timeframes that actually exist in the stored history."
    : "Only the grid is available until the next sync creates the first comparison window.";

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
      24,
      Math.max(box.width, 0),
      Math.max(box.height - 24, 0),
    );

    for (const repoBox of repoBoxes) {
      if (repoBox.width < 22 || repoBox.height < 22) continue;
      const showFull = repoBox.width > 120 && repoBox.height > 70;
      const showDesc = repoBox.width > 170 && repoBox.height > 100;
      const darkText = (repoBox.item.growthScore || 0) < 0.55 && (repoBox.item.growthScore || 0) > -0.55;

      const repo = document.createElement("a");
      repo.className = "repo";
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
          <div class="repo-name">${repoBox.item.name}</div>
          ${showFull ? `<div class="repo-full">${repoBox.item.fullName}</div>` : ""}
          ${showDesc ? `<div class="repo-desc">${repoBox.item.description}</div>` : ""}
        </div>
        ${showFull ? `<div class="repo-meta"><span>${formatNumber(repoBox.item.stars)} stars</span><span>${repoBox.item.growthLabel}</span></div>` : ""}
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

  function render(window) {
    currentWindow = window;
    windowBar.innerHTML = "";
    for (const item of availableWindows) {
      const button = document.createElement("button");
      button.textContent = item.label;
      if (item.key === window.key) button.classList.add("active");
      button.addEventListener("click", () => render(item));
      windowBar.appendChild(button);
    }
    draw(buildSnapshot(data, window));
  }

  render(currentWindow);
  window.addEventListener("resize", () => render(currentWindow));
}

init().catch(() => {
  board.innerHTML = `<div class="status">Unable to load heatmap data.</div>`;
});
