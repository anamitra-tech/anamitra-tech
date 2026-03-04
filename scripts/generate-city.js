const https = require("https");
const fs = require("fs");

const USERNAME = process.env.GITHUB_USERNAME || process.argv[2];
const TOKEN = process.env.GH_TOKEN || "";

function ghFetch(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path,
      headers: {
        "User-Agent": "GitCity-Action",
        Accept: "application/vnd.github.v3+json",
        ...(TOKEN ? { Authorization: `token ${TOKEN}` } : {}),
      },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("JSON parse error")); }
      });
    }).on("error", reject);
  });
}

async function getAllRepos() {
  let repos = [], page = 1;
  while (true) {
    const batch = await ghFetch(
      `/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner&sort=pushed`
    );
    if (!Array.isArray(batch)) break;
    repos = repos.concat(batch.filter((r) => !r.fork));
    if (batch.length < 100) break;
    page++;
  }
  return repos;
}

async function getCommitCount(repo) {
  try {
    const contributors = await ghFetch(
      `/repos/${USERNAME}/${repo.name}/contributors?per_page=100`
    );
    if (!Array.isArray(contributors)) return 1;
    return contributors.reduce((s, c) => s + (c.contributions || 0), 0) || 1;
  } catch {
    return 1;
  }
}

// ─── SVG GENERATION ──────────────────────────────────────────────────────────

const PALETTES = [
  { top: "#00d4ff", mid: "#0088bb", dark: "#004466", win: "#00eeff", glow: "#00d4ff" },
  { top: "#a855f7", mid: "#7c3aed", dark: "#3b0d6e", win: "#d8b4fe", glow: "#a855f7" },
  { top: "#00ff88", mid: "#00bb66", dark: "#005533", win: "#aaffd4", glow: "#00ff88" },
  { top: "#ff6b00", mid: "#cc4400", dark: "#661a00", win: "#ffbb88", glow: "#ff6b00" },
  { top: "#ff0080", mid: "#cc0060", dark: "#660030", win: "#ffaacc", glow: "#ff0080" },
  { top: "#ffd700", mid: "#cc9900", dark: "#664400", win: "#fff0aa", glow: "#ffd700" },
  { top: "#00ffff", mid: "#00aaaa", dark: "#005555", win: "#aaffff", glow: "#00ffff" },
  { top: "#ff4444", mid: "#cc1111", dark: "#660000", win: "#ffaaaa", glow: "#ff4444" },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateBuilding(repo, commits, maxCommits, index, xPos, palette) {
  const SCENE_H = 280;
  const MIN_H = 40, MAX_H = 240;
  const height = MIN_H + Math.round((commits / maxCommits) * (MAX_H - MIN_H));
  const width = Math.max(38, Math.min(72, 38 + Math.floor(repo.name.length * 1.2)));
  const y = SCENE_H - height;
  const depth = 10; // 3D depth offset

  const cols = Math.max(2, Math.min(4, Math.floor(width / 14)));
  const rows = Math.max(2, Math.min(10, Math.floor(height / 22)));
  const winW = Math.floor((width - 10) / cols) - 3;
  const winH = 10;
  const animDelay = index * 0.07;

  const repoUrl = repo.html_url;
  const label = repo.name.length > 12 ? repo.name.slice(0, 11) + "…" : repo.name;

  // 3D face colors
  const frontColor = palette.mid;
  const sideColor = palette.dark;
  const topColor = palette.top;

  let windows = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() > 0.35;
      const wx = xPos + 5 + c * (winW + 3);
      const wy = y + 8 + r * (winH + 6);
      const wOpacity = lit ? (0.6 + Math.random() * 0.4) : 0.08;
      const flickerDur = 3 + Math.random() * 8;
      const flickerDelay = Math.random() * 6;
      windows += `<rect x="${wx}" y="${wy}" width="${winW}" height="${winH}" 
        rx="1" fill="${palette.win}" opacity="${wOpacity}"
        style="animation: flicker${lit ? 'On' : 'Off'} ${flickerDur.toFixed(1)}s ${flickerDelay.toFixed(1)}s infinite"/>`;
    }
  }

  // Antenna for tall buildings
  let antenna = "";
  if (commits > maxCommits * 0.45) {
    const ax = xPos + width / 2;
    antenna = `
      <line x1="${ax}" y1="${y}" x2="${ax}" y2="${y - 18}" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
      <circle cx="${ax}" cy="${y - 20}" r="3" fill="${palette.glow}" style="animation: blinkAnt ${(1.2 + index * 0.15).toFixed(1)}s ${animDelay.toFixed(1)}s infinite">
        <animate attributeName="opacity" values="1;0.1;1" dur="${(1.2 + index*0.15).toFixed(1)}s" begin="${animDelay.toFixed(1)}s" repeatCount="indefinite"/>
      </circle>`;
  }

  const glowId = `glow${index}`;
  const riseId = `rise${index}`;

  return `
  <!-- Building: ${escapeXml(repo.name)} | ${commits} commits -->
  <defs>
    <filter id="${glowId}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <linearGradient id="grad${index}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${frontColor}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${palette.dark}" stop-opacity="1"/>
    </linearGradient>
  </defs>

  <a href="${escapeXml(repoUrl)}" target="_blank">
    <g class="building" style="animation: riseUp 0.7s cubic-bezier(0.22,1,0.36,1) ${animDelay.toFixed(2)}s both; transform-origin: ${xPos + width/2}px ${SCENE_H}px; transform-box: fill-box;">

      ${antenna}

      <!-- Rooftop glow line -->
      <rect x="${xPos - 1}" y="${y - 1}" width="${width + 2}" height="4" rx="2"
        fill="${palette.top}"
        style="filter: drop-shadow(0 0 6px ${palette.glow}); animation: roofPulse 2s ${animDelay.toFixed(1)}s infinite alternate"/>

      <!-- 3D top face -->
      <polygon points="${xPos},${y} ${xPos + width},${y} ${xPos + width + depth},${y - depth} ${xPos + depth},${y - depth}"
        fill="${topColor}" opacity="0.85"/>

      <!-- 3D side face -->
      <polygon points="${xPos + width},${y} ${xPos + width},${y + height} ${xPos + width + depth},${y + height - depth} ${xPos + width + depth},${y - depth}"
        fill="${sideColor}" opacity="0.9"/>

      <!-- Front face -->
      <rect x="${xPos}" y="${y}" width="${width}" height="${height}" fill="url(#grad${index})"/>

      <!-- Windows -->
      ${windows}

      <!-- Hover overlay -->
      <rect x="${xPos}" y="${y}" width="${width}" height="${height}" fill="${palette.top}" opacity="0"
        class="hover-overlay" rx="1">
        <animate attributeName="opacity" values="0" dur="0.1s" fill="freeze"/>
      </rect>

      <!-- Label -->
      <text x="${xPos + width / 2}" y="${SCENE_H + 14}" 
        text-anchor="middle" font-family="'Courier New', monospace" font-size="8" 
        fill="rgba(180,210,240,0.7)" letter-spacing="0.3">${escapeXml(label)}</text>

      <!-- Commit count badge -->
      <text x="${xPos + width / 2}" y="${SCENE_H + 24}" 
        text-anchor="middle" font-family="'Courier New', monospace" font-size="7.5" 
        fill="${palette.top}" font-weight="bold">${commits}c</text>

    </g>
  </a>`;
}

function generateSVG(repos) {
  const WIDTH = Math.max(860, repos.length * 58 + 80);
  const HEIGHT = 380;
  const SCENE_H = 280;
  const maxCommits = Math.max(...repos.map((r) => r.totalCommits));

  // Sort: mountain shape (tallest in center)
  const sorted = [...repos].sort((a, b) => b.totalCommits - a.totalCommits);
  const arranged = new Array(sorted.length);
  let l = Math.floor(sorted.length / 2) - 1;
  let r = Math.floor(sorted.length / 2);
  for (let i = 0; i < sorted.length; i++) {
    if (i % 2 === 0) { arranged[r] = sorted[i]; r++; }
    else { arranged[l] = sorted[i]; l--; }
  }

  // Calculate x positions
  const totalWidth = arranged.reduce((s, repo, i) => {
    const w = Math.max(38, Math.min(72, 38 + Math.floor(repo.name.length * 1.2)));
    return s + w + 8;
  }, 0);
  const startX = (WIDTH - totalWidth) / 2;

  let buildings = "";
  let xCursor = startX;
  arranged.forEach((repo, idx) => {
    if (!repo) return;
    const palette = PALETTES[idx % PALETTES.length];
    const w = Math.max(38, Math.min(72, 38 + Math.floor(repo.name.length * 1.2)));
    buildings += generateBuilding(repo, repo.totalCommits, maxCommits, idx, xCursor, palette);
    xCursor += w + 8;
  });

  // Stars
  let stars = "";
  for (let i = 0; i < 80; i++) {
    const sx = Math.random() * WIDTH;
    const sy = Math.random() * (SCENE_H - 60);
    const sr = 0.5 + Math.random() * 1.5;
    const dur = 2 + Math.random() * 4;
    const del = Math.random() * 5;
    stars += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="white" opacity="${(0.3 + Math.random() * 0.7).toFixed(2)}">
      <animate attributeName="opacity" values="${(0.2 + Math.random()*0.3).toFixed(2)};${(0.7 + Math.random()*0.3).toFixed(2)};${(0.2 + Math.random()*0.3).toFixed(2)}" dur="${dur.toFixed(1)}s" begin="${del.toFixed(1)}s" repeatCount="indefinite"/>
    </circle>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">

  <defs>
    <style>
      @keyframes riseUp {
        from { transform: scaleY(0); opacity: 0; }
        to   { transform: scaleY(1); opacity: 1; }
      }
      @keyframes roofPulse {
        from { opacity: 0.7; }
        to   { opacity: 1; filter: drop-shadow(0 0 8px currentColor); }
      }
      @keyframes blinkAnt {
        0%,49%,100% { opacity: 1; }
        50%,99%     { opacity: 0.1; }
      }
      @keyframes flickerOn {
        0%,89%,100% { opacity: var(--op, 0.8); }
        90%         { opacity: 0.15; }
      }
      @keyframes flickerOff {
        0%,94%,100% { opacity: 0.08; }
        95%         { opacity: 0.5; }
      }
      @keyframes groundPulse {
        0%,100% { opacity: 0.6; }
        50%     { opacity: 1; }
      }
      @keyframes moonGlow {
        0%,100% { filter: drop-shadow(0 0 12px rgba(245,213,106,0.6)); }
        50%     { filter: drop-shadow(0 0 25px rgba(245,213,106,0.9)); }
      }
      .building { cursor: pointer; }
      .building:hover rect { filter: brightness(1.3); }
    </style>

    <!-- Sky gradient -->
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#06091a"/>
      <stop offset="70%"  stop-color="#0d1f3c"/>
      <stop offset="100%" stop-color="#1a0d3c"/>
    </linearGradient>

    <!-- Ground gradient -->
    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#0a1020"/>
      <stop offset="100%" stop-color="#050810"/>
    </linearGradient>

    <!-- Horizon glow -->
    <linearGradient id="horizonGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(124,58,237,0.3)"/>
    </linearGradient>
  </defs>

  <!-- Sky -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#skyGrad)"/>

  <!-- Stars -->
  ${stars}

  <!-- Moon -->
  <circle cx="${WIDTH - 90}" cy="50" r="28" fill="#f5d56a" style="animation: moonGlow 4s infinite alternate">
    <animate attributeName="r" values="27;29;27" dur="4s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${WIDTH - 83}" cy="44" r="5" fill="#e8c050" opacity="0.5"/>
  <circle cx="${WIDTH - 98}" cy="58" r="3" fill="#e8c050" opacity="0.35"/>

  <!-- Horizon glow -->
  <rect x="0" y="${SCENE_H - 60}" width="${WIDTH}" height="60" fill="url(#horizonGrad)"/>

  <!-- Buildings -->
  ${buildings}

  <!-- Ground -->
  <rect x="0" y="${SCENE_H}" width="${WIDTH}" height="${HEIGHT - SCENE_H}" fill="url(#groundGrad)"/>

  <!-- Ground neon line -->
  <line x1="0" y1="${SCENE_H}" x2="${WIDTH}" y2="${SCENE_H}" stroke-width="2"
    stroke="url(#neonLine)" style="animation: groundPulse 3s infinite"/>
  <defs>
    <linearGradient id="neonLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="transparent"/>
      <stop offset="30%"  stop-color="#00d4ff"/>
      <stop offset="50%"  stop-color="#7c3aed"/>
      <stop offset="70%"  stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>
  </defs>

  <!-- Road dashes -->
  <line x1="0" y1="${SCENE_H + 20}" x2="${WIDTH}" y2="${SCENE_H + 20}"
    stroke="rgba(255,255,255,0.12)" stroke-width="1.5"
    stroke-dasharray="30,30"/>

</svg>`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  if (!USERNAME) {
    console.error("Usage: node generate-city.js <github-username>");
    process.exit(1);
  }

  console.log(`Fetching repos for @${USERNAME}...`);
  const repos = await getAllRepos();
  console.log(`Found ${repos.length} own repos.`);

  const limited = repos.slice(0, 35);
  console.log(`Fetching commit counts for ${limited.length} repos...`);

  const withCommits = await Promise.all(
    limited.map(async (repo) => {
      const c = await getCommitCount(repo);
      console.log(`  ${repo.name}: ${c} commits`);
      return { ...repo, totalCommits: c };
    })
  );

  const svg = generateSVG(withCommits);
  const outPath = process.env.OUTPUT_PATH || "github-city.svg";
  fs.writeFileSync(outPath, svg, "utf8");
  console.log(`✅ SVG written to ${outPath}`);
})();
