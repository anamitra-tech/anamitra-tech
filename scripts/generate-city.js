const https = require("https");
const fs = require("fs");

const USERNAME = process.env.GITHUB_USERNAME || process.argv[2];
const TOKEN = process.env.GH_TOKEN || "";

function ghFetch(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "api.github.com", path,
      headers: {
        "User-Agent": "GitCity-Action",
        Accept: "application/vnd.github.v3+json",
        ...(TOKEN ? { Authorization: `token ${TOKEN}` } : {}),
      },
    };
    https.get(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("parse")); } });
    }).on("error", reject);
  });
}

async function getAllRepos() {
  let all = [], page = 1;
  while (true) {
    const b = await ghFetch(`/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner&sort=pushed`);
    if (!Array.isArray(b)) break;
    all = all.concat(b.filter(r => !r.fork));
    if (b.length < 100) break;
    page++;
  }
  return all;
}

async function getCommits(repo) {
  try {
    const c = await ghFetch(`/repos/${USERNAME}/${repo.name}/contributors?per_page=100`);
    return !Array.isArray(c) ? 1 : Math.max(1, c.reduce((s, x) => s + (x.contributions || 0), 0));
  } catch { return 1; }
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── PALETTES ──────────────────────────────────────────────────────────────────
const PALETTES = [
  { top: "#00d2ff", front: "#0d3a55", side: "#071e2d", roof: "#00d2ff", win: "#00eeff", glow: "#00d2ff" },
  { top: "#aa55ff", front: "#2d1050", side: "#180828", roof: "#aa55ff", win: "#cc88ff", glow: "#aa55ff" },
  { top: "#00ff88", front: "#0d3828", side: "#071c14", roof: "#00ff88", win: "#88ffcc", glow: "#00ff88" },
  { top: "#ff7700", front: "#552010", side: "#2d1008", roof: "#ff7700", win: "#ffcc88", glow: "#ff7700" },
  { top: "#ff0088", front: "#550028", side: "#2d0014", roof: "#ff0088", win: "#ff88cc", glow: "#ff0088" },
  { top: "#ffdd00", front: "#554010", side: "#2d2008", roof: "#ffdd00", win: "#ffee88", glow: "#ffdd00" },
  { top: "#00ffee", front: "#0d3838", side: "#071c1c", roof: "#00ffee", win: "#88ffee", glow: "#00ffee" },
  { top: "#ff4455", front: "#551020", side: "#2d0810", roof: "#ff4455", win: "#ff9988", glow: "#ff4455" },
  { top: "#44aaff", front: "#0d2d55", side: "#07162d", roof: "#44aaff", win: "#88ccff", glow: "#44aaff" },
  { top: "#ff44ee", front: "#500050", side: "#280028", roof: "#ff44ee", win: "#ff88ee", glow: "#ff44ee" },
];

const LANG_COLORS = {
  JavaScript: "#f7df1e", TypeScript: "#3178c6", Python: "#3572a5",
  Java: "#b07219", Go: "#00acd7", "C++": "#f34b7d", C: "#aaaaaa",
  Rust: "#dea584", Ruby: "#cc1122", PHP: "#4f5d95", Swift: "#fa7343",
  Kotlin: "#a97bff", HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051",
  Dart: "#00b4ab", R: "#198ce7", Vue: "#41b883", "C#": "#178600",
  "Jupyter Notebook": "#f37726", Svelte: "#ff3e00", Scala: "#c22d40",
};

// ── SINGLE BUILDING SVG ───────────────────────────────────────────────────────
// Layout per building (all coords relative to building's left-x, ground-y):
//   Sky zone:   building body
//   GROUND:     base
//   GROUND+6:   repo name label
//   GROUND+24:  language tag pills
//   GROUND+42:  commit count text
// Total label height below ground: ~55px
// We add this to the total SVG height

function building(repo, commits, maxC, idx, cx, GROUND, pal) {
  const ratio = commits / maxC;

  // Building size
  const BW = Math.max(52, Math.min(90, 52 + repo.name.length * 1.6));
  const BH = 32 + ratio * 200; // max ~232px tall
  const DX = 16;  // isometric side offset X
  const DY = 9;   // isometric side offset Y

  const left  = cx - BW / 2;
  const right = cx + BW / 2;
  const top   = GROUND - BH;

  // Windows on front face
  const wRows = Math.max(3, Math.floor(BH / 24));
  const wCols = Math.max(2, Math.min(5, Math.floor(BW / 16)));
  const wW    = Math.floor((BW - 14) / wCols) - 3;
  const wH    = 10;

  let wins = "";
  for (let r = 0; r < wRows; r++) {
    for (let c = 0; c < wCols; c++) {
      const lit  = Math.random() > 0.3;
      const wx   = left + 7 + c * (wW + 3);
      const wy   = top + 10 + r * ((BH - 16) / wRows);
      const dur  = (3 + Math.random() * 8).toFixed(1);
      const beg  = (Math.random() * 8).toFixed(1);
      const opHi = (0.75 + Math.random() * 0.25).toFixed(2);
      const opLo = (0.25 + Math.random() * 0.2).toFixed(2);
      wins += `
        <rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${wW}" height="${wH}" rx="2"
          fill="${lit ? pal.win : "rgba(255,255,255,0.05)"}"
          opacity="${lit ? opHi : "0.2"}">
          ${lit ? `<animate attributeName="opacity" values="${opLo};${opHi};${opLo}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>` : ""}
        </rect>`;
    }
  }

  // Isometric side windows
  const sWCols = Math.max(1, Math.floor(DX / 9));
  for (let r = 0; r < Math.min(wRows, 5); r++) {
    const lit = Math.random() > 0.45;
    const wx  = right + 4;
    const wy  = top + 14 + r * ((BH - 20) / wRows);
    wins += `
      <rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="8" height="8" rx="1"
        fill="${lit ? pal.win : "rgba(255,255,255,0.04)"}"
        opacity="${lit ? "0.5" : "0.15"}" transform="skewY(-29)"/>`;
  }

  // Antenna on taller buildings
  let ant = "";
  if (ratio > 0.25) {
    const aH  = 12 + ratio * 20;
    const ax  = cx + DX * 0.4;
    const ay  = top - DY * 0.4;
    const dur = (0.7 + (idx % 8) * 0.14).toFixed(2);
    ant = `
      <line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${(ay - aH).toFixed(1)}"
        stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
      <circle cx="${ax.toFixed(1)}" cy="${(ay - aH).toFixed(1)}" r="3.5" fill="${pal.top}">
        <animate attributeName="opacity" values="1;0.05;1"   dur="${dur}s" repeatCount="indefinite"/>
        <animate attributeName="r"       values="2.5;5;2.5"  dur="${dur}s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${ax.toFixed(1)}" cy="${(ay - aH).toFixed(1)}" r="10" fill="${pal.top}" opacity="0.1">
        <animate attributeName="r"       values="5;16;5"       dur="${dur}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.12;0;0.12"  dur="${dur}s" repeatCount="indefinite"/>
      </circle>`;
  }

  // ── LABEL SECTION (always below the building) ────────────────────────────
  // 1) Repo name
  const nameY  = GROUND + 18;
  const nameStr = repo.name.length > 15 ? repo.name.slice(0, 14) + "…" : repo.name;

  // 2) Language tag pills
  const langs = [repo.language, ...(repo.topics || []).slice(0, 3)]
    .filter(Boolean).slice(0, 4);

  const TAG_H   = 14;
  const TAG_PAD = 7;
  const TAG_GAP = 4;
  const tagWidths = langs.map(l => Math.max(30, l.length * 6.5 + TAG_PAD * 2));
  const tagsTotal = tagWidths.reduce((s, w) => s + w + TAG_GAP, -TAG_GAP);
  let tX = cx - tagsTotal / 2;
  const tagsY = GROUND + 28;

  let tagsSVG = "";
  langs.forEach((lang, li) => {
    const col = LANG_COLORS[lang] || pal.top;
    const tw  = tagWidths[li];
    tagsSVG += `
      <rect x="${tX.toFixed(1)}" y="${tagsY}" width="${tw.toFixed(1)}" height="${TAG_H}" rx="7"
        fill="${col}22" stroke="${col}" stroke-width="0.9" stroke-opacity="0.7"/>
      <text x="${(tX + tw / 2).toFixed(1)}" y="${tagsY + 10}" text-anchor="middle"
        font-family="'Courier New',monospace" font-size="8.5" font-weight="bold"
        fill="${col}">${esc(lang)}</text>`;
    tX += tw + TAG_GAP;
  });

  // 3) Commit count
  const commitY = GROUND + (langs.length > 0 ? 50 : 32);

  // Floor glow
  const glowR = BW * 0.85;
  const delay = (idx * 0.07).toFixed(2);

  return `
<!-- ═══ BUILDING: ${esc(repo.name)} (${commits} commits) ═══ -->
<defs>
  <linearGradient id="gf${idx}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="${pal.front}" stop-opacity="1"/>
    <stop offset="100%" stop-color="${pal.side}"  stop-opacity="1"/>
  </linearGradient>
  <linearGradient id="gs${idx}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="${pal.side}"/>
    <stop offset="100%" stop-color="${pal.front}" stop-opacity="0.7"/>
  </linearGradient>
  <linearGradient id="gt${idx}" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0%"   stop-color="${pal.front}"/>
    <stop offset="100%" stop-color="${pal.top}" stop-opacity="0.9"/>
  </linearGradient>
  <radialGradient id="fl${idx}" cx="50%" cy="20%" r="55%">
    <stop offset="0%"   stop-color="${pal.glow}" stop-opacity="0.4"/>
    <stop offset="100%" stop-color="${pal.glow}" stop-opacity="0"/>
  </radialGradient>
  <filter id="fg${idx}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3"/>
  </filter>
</defs>

<a href="${esc(repo.html_url)}" target="_blank" style="cursor:pointer">

  <!-- Rise animation wrapper — only the BUILDING, NOT the labels -->
  <g style="animation:rise .9s cubic-bezier(.22,1,.36,1) ${delay}s both;transform-origin:${cx.toFixed(1)}px ${GROUND}px;transform-box:fill-box">

    ${ant}

    <!-- Floor glow pool -->
    <ellipse cx="${(cx + DX * 0.3).toFixed(1)}" cy="${GROUND.toFixed(1)}"
      rx="${glowR.toFixed(1)}" ry="${(glowR * 0.2).toFixed(1)}"
      fill="url(#fl${idx})">
      <animate attributeName="rx" values="${glowR.toFixed(1)};${(glowR*1.2).toFixed(1)};${glowR.toFixed(1)}" dur="${(2+idx*0.12).toFixed(1)}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;1;0.6" dur="${(2+idx*0.12).toFixed(1)}s" repeatCount="indefinite"/>
    </ellipse>

    <!-- Base plate shadow -->
    <polygon
      points="${(left-3).toFixed(1)},${(GROUND+3).toFixed(1)}
              ${(right+DX+3).toFixed(1)},${(GROUND+3-DY).toFixed(1)}
              ${(right+DX+3).toFixed(1)},${(GROUND-2-DY).toFixed(1)}
              ${(right+1).toFixed(1)},${(GROUND-2).toFixed(1)}
              ${(left-3).toFixed(1)},${(GROUND-2).toFixed(1)}"
      fill="${pal.side}" opacity="0.85"/>

    <!-- ISO right face -->
    <polygon
      points="${right.toFixed(1)},${top.toFixed(1)}
              ${(right+DX).toFixed(1)},${(top-DY).toFixed(1)}
              ${(right+DX).toFixed(1)},${(GROUND-DY).toFixed(1)}
              ${right.toFixed(1)},${GROUND.toFixed(1)}"
      fill="url(#gs${idx})"/>

    <!-- Front face -->
    <rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${BW}" height="${BH}"
      fill="url(#gf${idx})"/>

    <!-- Shimmer -->
    <rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${BW}" height="${BH}" fill="transparent">
      <animate attributeName="fill"
        values="rgba(255,255,255,0.02);rgba(255,255,255,0.07);rgba(255,255,255,0.02)"
        dur="${(3+idx*0.2).toFixed(1)}s" repeatCount="indefinite"/>
    </rect>

    <!-- Windows -->
    ${wins}

    <!-- ISO top face -->
    <polygon
      points="${left.toFixed(1)},${top.toFixed(1)}
              ${right.toFixed(1)},${top.toFixed(1)}
              ${(right+DX).toFixed(1)},${(top-DY).toFixed(1)}
              ${(left+DX).toFixed(1)},${(top-DY).toFixed(1)}"
      fill="url(#gt${idx})"/>

    <!-- Roof glow line (front edge) -->
    <line x1="${left.toFixed(1)}" y1="${top.toFixed(1)}"
          x2="${right.toFixed(1)}" y2="${top.toFixed(1)}"
      stroke="${pal.roof}" stroke-width="3" filter="url(#fg${idx})">
      <animate attributeName="opacity" values="0.6;1;0.6" dur="${(1.5+idx*0.1).toFixed(1)}s" repeatCount="indefinite"/>
    </line>

    <!-- Roof glow line (right edge) -->
    <line x1="${right.toFixed(1)}" y1="${top.toFixed(1)}"
          x2="${(right+DX).toFixed(1)}" y2="${(top-DY).toFixed(1)}"
      stroke="${pal.roof}" stroke-width="1.5" opacity="0.55" filter="url(#fg${idx})"/>

  </g><!-- end rise animation -->

  <!-- ── LABELS (no animation, always visible) ── -->

  <!-- Repo name pill -->
  <rect x="${(cx - BW/2 - 2).toFixed(1)}" y="${(nameY - 13).toFixed(1)}"
    width="${(BW + 4).toFixed(1)}" height="16" rx="5"
    fill="rgba(0,4,22,0.88)" stroke="${pal.top}" stroke-width="0.8" stroke-opacity="0.6"/>
  <text x="${cx.toFixed(1)}" y="${nameY.toFixed(1)}" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="10" font-weight="bold"
    fill="${pal.top}">${esc(nameStr)}</text>

  <!-- Language tags -->
  ${tagsSVG}

  <!-- Commit count -->
  <text x="${cx.toFixed(1)}" y="${commitY.toFixed(1)}" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="8.5"
    fill="rgba(180,210,255,0.55)">${commits.toLocaleString()} commits</text>

</a>`;
}

// ── FULL SVG ──────────────────────────────────────────────────────────────────
function generateSVG(repos) {
  // Give plenty of height for labels below ground
  const LABEL_SPACE = 70;  // px below GROUND for name + tags + commits
  const GROUND      = 320;
  const H           = GROUND + LABEL_SPACE + 20; // 410 total
  const W           = Math.max(980, repos.length * 100 + 120);

  const maxC = Math.max(...repos.map(r => r.totalCommits), 1);

  // Mountain layout: tallest repos in the center
  const sorted = [...repos].sort((a, b) => b.totalCommits - a.totalCommits);
  const arr    = new Array(sorted.length);
  let l = Math.floor(sorted.length / 2) - 1;
  let r = Math.floor(sorted.length / 2);
  for (let i = 0; i < sorted.length; i++) {
    if (i % 2 === 0) { arr[r] = sorted[i]; r++; }
    else              { arr[l] = sorted[i]; l--; }
  }

  // Building x positions
  const bWidths = arr.map(repo =>
    repo ? Math.max(52, Math.min(90, 52 + repo.name.length * 1.6)) : 0
  );
  const totalBW = bWidths.reduce((s, w) => s + w + 14, 0);
  let xCursor = (W - totalBW) / 2;

  let bldsSVG = "";
  arr.forEach((repo, idx) => {
    if (!repo) return;
    const bw = bWidths[idx];
    const cx = xCursor + bw / 2;
    bldsSVG += building(repo, repo.totalCommits, maxC, idx, cx, GROUND, PALETTES[idx % PALETTES.length]);
    xCursor += bw + 14;
  });

  // Stars
  const STAR_COLS = ["white","#00d2ff","#aa55ff","#ff6090","#ffdd00","#00ffee","#ff44ee","#88ff44"];
  let starsSVG = "";
  for (let i = 0; i < 180; i++) {
    const sx  = (Math.random() * W).toFixed(1);
    const sy  = (Math.random() * (GROUND - 80)).toFixed(1);
    const sr  = (0.3 + Math.random() * 2).toFixed(1);
    const col = STAR_COLS[Math.floor(Math.random() * STAR_COLS.length)];
    const dur = (2 + Math.random() * 5).toFixed(1);
    const beg = (Math.random() * 6).toFixed(1);
    starsSVG += `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="${col}">
      <animate attributeName="opacity"
        values="${(0.08+Math.random()*0.15).toFixed(2)};${(0.6+Math.random()*0.4).toFixed(2)};${(0.08+Math.random()*0.15).toFixed(2)}"
        dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
    </circle>`;
  }

  // Shooting stars
  let shootSVG = "";
  for (let i = 0; i < 4; i++) {
    const sy  = (10 + Math.random() * 70).toFixed(1);
    const dur = (3 + Math.random() * 4).toFixed(1);
    const beg = (i * 8 + Math.random() * 5).toFixed(1);
    shootSVG += `
    <line x1="0" y1="${sy}" x2="65" y2="${(parseFloat(sy)+5).toFixed(1)}"
      stroke="white" stroke-width="1.5" opacity="0">
      <animateTransform attributeName="transform" type="translate"
        values="-100,0;${W+100},0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0.85;0.85;0"
        dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
    </line>`;
  }

  const mX = W - 95, mY = 62;

  return `<svg xmlns="http://www.w3.org/2000/svg"
  width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

<defs>
<style>
  @keyframes rise {
    from { transform: scaleY(0); opacity: 0; }
    to   { transform: scaleY(1); opacity: 1; }
  }
</style>

<!-- Sky -->
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%"   stop-color="#000510"/>
  <stop offset="60%"  stop-color="#000d24"/>
  <stop offset="100%" stop-color="#040318"/>
</linearGradient>

<!-- Ground -->
<linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%"   stop-color="#050d1e"/>
  <stop offset="100%" stop-color="#020810"/>
</linearGradient>

<!-- Shiny ground reflection -->
<linearGradient id="gref" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%"   stop-color="transparent"/>
  <stop offset="28%"  stop-color="rgba(0,130,255,0.09)"/>
  <stop offset="50%"  stop-color="rgba(0,210,255,0.15)"/>
  <stop offset="72%"  stop-color="rgba(100,0,255,0.09)"/>
  <stop offset="100%" stop-color="transparent"/>
</linearGradient>

<!-- Horizon glow -->
<linearGradient id="horiz" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%"   stop-color="transparent"/>
  <stop offset="100%" stop-color="rgba(0,80,200,0.22)"/>
</linearGradient>

<!-- Ground neon line -->
<linearGradient id="gline" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%"   stop-color="transparent"/>
  <stop offset="20%"  stop-color="#00d2ff"/>
  <stop offset="50%"  stop-color="#aa55ff"/>
  <stop offset="80%"  stop-color="#00d2ff"/>
  <stop offset="100%" stop-color="transparent"/>
</linearGradient>

<!-- Moon glow -->
<filter id="moonF" x="-80%" y="-80%" width="260%" height="260%">
  <feGaussianBlur stdDeviation="12"/>
</filter>
</defs>

<!-- Sky background -->
<rect width="${W}" height="${H}" fill="url(#sky)"/>

<!-- Stars -->
${starsSVG}

<!-- Shooting stars -->
${shootSVG}

<!-- Moon halo -->
<circle cx="${mX}" cy="${mY}" r="55" fill="#f8e88a" filter="url(#moonF)" opacity="0.15">
  <animate attributeName="r" values="50;62;50" dur="5s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.1;0.2;0.1" dur="5s" repeatCount="indefinite"/>
</circle>
<!-- Moon body -->
<circle cx="${mX}" cy="${mY}" r="28" fill="#f8e880"/>
<circle cx="${(mX-9)}" cy="${(mY-6)}" r="5.5" fill="#e8c840" opacity="0.3"/>
<circle cx="${(mX+10)}" cy="${(mY+9)}" r="3.5" fill="#e8c840" opacity="0.22"/>

<!-- Horizon glow -->
<rect x="0" y="${GROUND - 100}" width="${W}" height="100" fill="url(#horiz)"/>

<!-- ══ BUILDINGS ══ -->
${bldsSVG}

<!-- Ground -->
<rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="url(#gnd)"/>
<rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="url(#gref)"/>

<!-- Ground grid -->
${Array.from({length: 14}, (_, i) => {
  const gx = ((i + 1) * W / 15).toFixed();
  return `<line x1="${gx}" y1="${GROUND}" x2="${gx}" y2="${H}" stroke="rgba(0,100,200,0.07)" stroke-width="1"/>`;
}).join("")}
${Array.from({length: 4}, (_, i) => {
  const gy = (GROUND + (i + 1) * (H - GROUND) / 5).toFixed();
  return `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="rgba(0,100,200,0.05)" stroke-width="1"/>`;
}).join("")}

<!-- Ground neon line -->
<line x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}"
  stroke="url(#gline)" stroke-width="2.5">
  <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite"/>
</line>

<!-- Road dashes -->
<line x1="0" y1="${GROUND + 26}" x2="${W}" y2="${GROUND + 26}"
  stroke="rgba(255,255,255,0.07)" stroke-width="1.5" stroke-dasharray="28,28"/>

<!-- Footer -->
<text x="${(W/2).toFixed()}" y="${H - 8}" text-anchor="middle"
  font-family="'Courier New',monospace" font-size="10"
  fill="rgba(0,210,255,0.28)" letter-spacing="3">GITCITY · github.com/${esc(USERNAME)}</text>

</svg>`;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
  if (!USERNAME) { console.error("Usage: node generate-city.js <username>"); process.exit(1); }
  console.log(`\n🏙️  GitCity for @${USERNAME}\n`);

  const repos = await getAllRepos();
  console.log(`✓ ${repos.length} own repos found`);
  const limited = repos.slice(0, 36);

  const withC = await Promise.all(
    limited.map(async (repo, i) => {
      const c = await getCommits(repo);
      console.log(`  [${i + 1}/${limited.length}] ${repo.name}: ${c} commits`);
      return { ...repo, totalCommits: c };
    })
  );

  const svg = generateSVG(withC);
  const out = process.env.OUTPUT_PATH || "github-city.svg";
  fs.writeFileSync(out, svg, "utf8");
  console.log(`\n✅ Written to ${out}`);
  console.log(`   ${withC.length} buildings | ${withC.reduce((s,r)=>s+r.totalCommits,0)} total commits`);
})();
