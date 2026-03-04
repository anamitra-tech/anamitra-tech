const https = require("https");
const fs = require("fs");

const USERNAME = process.env.GITHUB_USERNAME || process.argv[2];
const TOKEN = process.env.GH_TOKEN || "";

// ─── API ──────────────────────────────────────────────────────────────────────
function ghFetch(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "api.github.com",
      path,
      headers: {
        "User-Agent": "GitCity-Action",
        Accept: "application/vnd.github.v3+json",
        ...(TOKEN ? { Authorization: `token ${TOKEN}` } : {}),
      },
    };
    https.get(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error("Parse error")); }
      });
    }).on("error", reject);
  });
}

async function getAllRepos() {
  let all = [], page = 1;
  while (true) {
    const b = await ghFetch(`/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner&sort=pushed`);
    if (!Array.isArray(b)) break;
    all = all.concat(b.filter((r) => !r.fork));
    if (b.length < 100) break;
    page++;
  }
  return all;
}

async function getCommits(repo) {
  try {
    const c = await ghFetch(`/repos/${USERNAME}/${repo.name}/contributors?per_page=100`);
    if (!Array.isArray(c)) return 1;
    return Math.max(1, c.reduce((s, x) => s + (x.contributions || 0), 0));
  } catch { return 1; }
}

// ─── PALETTES ─────────────────────────────────────────────────────────────────
const PALETTES = [
  { wall:"#081828", wallLight:"#0d2840", wallDark:"#041018", accent:"#00d2ff", win:"#00eeff", winDim:"#003344" },
  { wall:"#110828", wallLight:"#1a0e3a", wallDark:"#080418", accent:"#aa55ff", win:"#cc88ff", winDim:"#220044" },
  { wall:"#041c10", wallLight:"#061f12", wallDark:"#020e08", accent:"#00ff88", win:"#88ffcc", winDim:"#003322" },
  { wall:"#1c0a00", wallLight:"#241200", wallDark:"#120600", accent:"#ff7700", win:"#ffcc88", winDim:"#441a00" },
  { wall:"#1c0010", wallLight:"#240018", wallDark:"#120008", accent:"#ff0088", win:"#ff88cc", winDim:"#440022" },
  { wall:"#181400", wallLight:"#201a00", wallDark:"#100d00", accent:"#ffdd00", win:"#ffee88", winDim:"#443300" },
  { wall:"#001c1c", wallLight:"#002424", wallDark:"#001010", accent:"#00ffee", win:"#88ffee", winDim:"#003333" },
  { wall:"#1c0400", wallLight:"#240800", wallDark:"#120200", accent:"#ff4455", win:"#ff9988", winDim:"#440011" },
  { wall:"#00142a", wallLight:"#001c38", wallDark:"#000c18", accent:"#44aaff", win:"#88ccff", winDim:"#001133" },
  { wall:"#140020", wallLight:"#1c0028", wallDark:"#0c0018", accent:"#ff44ee", win:"#ff88ee", winDim:"#330044" },
];

const LANG_COLORS = {
  JavaScript:"#f7df1e", TypeScript:"#3178c6", Python:"#3572a5",
  Java:"#b07219", Go:"#00acd7", "C++":"#f34b7d", C:"#888888",
  Rust:"#dea584", Ruby:"#cc1122", PHP:"#4f5d95", Swift:"#fa7343",
  Kotlin:"#a97bff", HTML:"#e34c26", CSS:"#563d7c", Shell:"#89e051",
  Dart:"#00b4ab", R:"#198ce7", Vue:"#41b883", Svelte:"#ff3e00",
  "C#":"#178600", Scala:"#c22d40", Haskell:"#5e5086",
};

function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#",""),16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

// ─── BUILDING SVG ─────────────────────────────────────────────────────────────
function buildingSVG(repo, commits, maxCommits, idx, cx, groundY, pal) {
  const ratio = commits / maxCommits;
  const H = 30 + ratio * 200;   // building height in px
  const W = Math.max(42, Math.min(78, 42 + repo.name.length * 1.4));
  const D = 14; // 3D depth
  const x = cx - W / 2;
  const y = groundY - H;
  const delay = idx * 0.06;
  const bid = `b${idx}`;
  const gradId = `wg${idx}`;
  const glowId = `gl${idx}`;
  const shineId = `sh${idx}`;
  const reflId = `rf${idx}`;

  // Windows
  const winRows = Math.max(3, Math.floor(H / 22));
  const winCols = Math.max(2, Math.min(5, Math.floor(W / 14)));
  const winW = Math.floor((W - 12) / winCols) - 3;
  const winH = 9;
  let windows = "";
  for (let r = 0; r < winRows; r++) {
    for (let c = 0; c < winCols; c++) {
      const lit = Math.random() > 0.32;
      const wx = x + 6 + c * (winW + 3);
      const wy = y + 10 + r * ((H - 14) / winRows);
      const flickDur = (3 + Math.random() * 9).toFixed(1);
      const flickDel = (Math.random() * 7).toFixed(1);
      windows += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${winW}" height="${winH}" rx="1"
        fill="${lit ? pal.win : pal.winDim}"
        opacity="${lit ? (0.55 + Math.random() * 0.45).toFixed(2) : "0.15"}">
        ${lit ? `<animate attributeName="opacity" values="${(0.4+Math.random()*0.3).toFixed(2)};${(0.85+Math.random()*0.15).toFixed(2)};${(0.4+Math.random()*0.3).toFixed(2)}" dur="${flickDur}s" begin="${flickDel}s" repeatCount="indefinite"/>` : ""}
      </rect>`;
    }
  }

  // Language dots below building
  const langs = [repo.language, ...(repo.topics || [])].filter(Boolean).slice(0, 5);
  const dotSpacing = 11;
  const dotsW = langs.length * dotSpacing;
  const dotsX = cx - dotsW / 2 + 4;
  let langDots = "";
  langs.forEach((lang, li) => {
    const col = LANG_COLORS[lang] || pal.accent;
    langDots += `
      <circle cx="${(dotsX + li * dotSpacing).toFixed(1)}" cy="${(groundY + 20).toFixed(1)}" r="4" fill="${col}" opacity="0.9">
        <animate attributeName="r" values="3.5;4.5;3.5" dur="${(2+li*0.3).toFixed(1)}s" repeatCount="indefinite"/>
      </circle>
      <title>${esc(lang)}</title>`;
  });

  // Antenna
  let antenna = "";
  if (ratio > 0.35) {
    const antH = 12 + ratio * 18;
    const ax = cx;
    antenna = `
      <line x1="${ax}" y1="${y}" x2="${ax}" y2="${y - antH}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
      <line x1="${ax - 4}" y1="${y - antH * 0.4}" x2="${ax + 4}" y2="${y - antH * 0.4}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <circle cx="${ax}" cy="${(y - antH).toFixed(1)}" r="3.5" fill="${pal.accent}">
        <animate attributeName="opacity" values="1;0.05;1" dur="${(0.8 + idx * 0.11 % 1.2).toFixed(2)}s" repeatCount="indefinite"/>
        <animate attributeName="r" values="3;4.5;3" dur="${(0.8 + idx * 0.11 % 1.2).toFixed(2)}s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${ax}" cy="${(y - antH).toFixed(1)}" r="8" fill="${pal.accent}" opacity="0.15">
        <animate attributeName="r" values="6;12;6" dur="${(0.8 + idx * 0.11 % 1.2).toFixed(2)}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.2;0;0.2" dur="${(0.8 + idx * 0.11 % 1.2).toFixed(2)}s" repeatCount="indefinite"/>
      </circle>`;
  }

  // Reflection on ground
  const reflHeight = Math.min(40, H * 0.15);

  return `
<defs>
  <!-- Building wall gradient - front face shading -->
  <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${pal.wallDark}"/>
    <stop offset="40%" stop-color="${pal.wallLight}"/>
    <stop offset="100%" stop-color="${pal.wall}"/>
  </linearGradient>
  <!-- Shine overlay -->
  <linearGradient id="${shineId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(255,255,255,0.08)"/>
    <stop offset="30%" stop-color="rgba(255,255,255,0.02)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>
  </linearGradient>
  <!-- Glow filter -->
  <filter id="${glowId}" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feComposite in="SourceGraphic" in2="blur" operator="over"/>
  </filter>
  <!-- Reflection gradient -->
  <linearGradient id="${reflId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${pal.accent}" stop-opacity="0.15"/>
    <stop offset="100%" stop-color="${pal.accent}" stop-opacity="0"/>
  </linearGradient>
</defs>

<a href="${esc(repo.html_url)}" target="_blank">
<g id="${bid}" style="animation: riseUp 0.75s cubic-bezier(0.22,1,0.36,1) ${delay.toFixed(2)}s both; transform-origin: ${cx}px ${groundY}px; transform-box: fill-box;">

  ${antenna}

  <!-- 3D Top face -->
  <polygon points="${x},${y} ${(x+W).toFixed(1)},${y} ${(x+W+D).toFixed(1)},${(y-D).toFixed(1)} ${(x+D).toFixed(1)},${(y-D).toFixed(1)}"
    fill="${pal.accent}" opacity="0.9"/>

  <!-- 3D Side face (right) -->
  <polygon points="${(x+W).toFixed(1)},${y} ${(x+W).toFixed(1)},${groundY} ${(x+W+D).toFixed(1)},${(groundY-D)} ${(x+W+D).toFixed(1)},${(y-D).toFixed(1)}"
    fill="${pal.wallDark}" opacity="0.95"/>

  <!-- Front face -->
  <rect x="${x}" y="${y}" width="${W}" height="${H}" fill="url(#${gradId})"/>

  <!-- Shine layer -->
  <rect x="${x}" y="${y}" width="${W}" height="${H}" fill="url(#${shineId})"/>

  <!-- Windows -->
  ${windows}

  <!-- Hover highlight (CSS) -->
  <rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${pal.accent}" opacity="0" rx="1" class="bhl">
    <set attributeName="opacity" to="0.07" begin="${bid}.mouseover" end="${bid}.mouseout"/>
  </rect>

  <!-- Roof accent bar -->
  <rect x="${(x-1).toFixed(1)}" y="${(y-1).toFixed(1)}" width="${(W+2).toFixed(1)}" height="5" rx="2"
    fill="${pal.accent}" filter="url(#${glowId})">
    <animate attributeName="opacity" values="0.75;1;0.75" dur="${(1.8+idx*0.07).toFixed(1)}s" repeatCount="indefinite"/>
  </rect>

  <!-- Ground reflection -->
  <rect x="${x}" y="${groundY}" width="${W}" height="${reflHeight}" fill="url(#${reflId})" opacity="0.7"/>

  <!-- Building name label -->
  <rect x="${(cx - W/2 - 2).toFixed(1)}" y="${(groundY + 5).toFixed(1)}"
    width="${(W + 4).toFixed(1)}" height="13" rx="3"
    fill="rgba(0,4,18,0.75)" stroke="${pal.accent}" stroke-width="0.5" stroke-opacity="0.4"/>
  <text x="${cx}" y="${(groundY + 15).toFixed(1)}"
    text-anchor="middle" font-family="'Courier New',monospace"
    font-size="8" font-weight="bold" fill="${pal.accent}"
    style="text-shadow: 0 0 6px ${pal.accent}">
    ${esc(repo.name.length > 13 ? repo.name.slice(0,12)+"…" : repo.name)}
  </text>

  <!-- Language dots -->
  ${langDots}

</g>
</a>`;
}

// ─── FULL SVG ─────────────────────────────────────────────────────────────────
function generateSVG(repos) {
  const W = Math.max(900, repos.length * 62 + 100);
  const H = 480;
  const GROUND_Y = 300;

  const maxC = Math.max(...repos.map((r) => r.totalCommits), 1);

  // Mountain layout: tallest in center
  const sorted = [...repos].sort((a,b) => b.totalCommits - a.totalCommits);
  const arranged = new Array(sorted.length);
  let l = Math.floor(sorted.length/2)-1, r = Math.floor(sorted.length/2);
  for (let i = 0; i < sorted.length; i++) {
    if (i%2===0) { arranged[r]=sorted[i]; r++; }
    else { arranged[l]=sorted[i]; l--; }
  }

  // Calculate x positions
  const bWidths = arranged.map(repo => repo ? Math.max(42, Math.min(78, 42 + repo.name.length * 1.4)) : 0);
  const totalW = bWidths.reduce((s,w) => s+w+10, 0);
  let xCursor = (W - totalW) / 2;

  let buildings = "";
  arranged.forEach((repo, idx) => {
    if (!repo) return;
    const pal = PALETTES[idx % PALETTES.length];
    const bw = bWidths[idx];
    const cx = xCursor + bw/2;
    buildings += buildingSVG(repo, repo.totalCommits, maxC, idx, cx, GROUND_Y, pal);
    xCursor += bw + 10;
  });

  // Stars
  let starsSVG = "";
  for (let i = 0; i < 120; i++) {
    const sx = (Math.random() * W).toFixed(1);
    const sy = (Math.random() * (GROUND_Y - 60)).toFixed(1);
    const sr = (0.4 + Math.random() * 1.8).toFixed(1);
    const dur = (2 + Math.random() * 5).toFixed(1);
    const beg = (Math.random() * 5).toFixed(1);
    const colors = ["white","#00d2ff","#aa55ff","#ff6090","#ffdd00"];
    const col = colors[Math.floor(Math.random()*colors.length)];
    starsSVG += `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="${col}" opacity="${(0.3+Math.random()*0.7).toFixed(2)}">
      <animate attributeName="opacity" values="${(0.1+Math.random()*0.2).toFixed(2)};${(0.7+Math.random()*0.3).toFixed(2)};${(0.1+Math.random()*0.2).toFixed(2)}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
      <animate attributeName="r" values="${sr};${(parseFloat(sr)+0.8).toFixed(1)};${sr}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
    </circle>`;
  }

  // Shooting stars
  let shooters = "";
  for (let i = 0; i < 3; i++) {
    const sy = 20 + Math.random() * 80;
    const dur = (3 + Math.random() * 4).toFixed(1);
    const beg = (i * 7 + Math.random() * 5).toFixed(1);
    shooters += `<line x1="-20" y1="${sy}" x2="60" y2="${sy+5}" stroke="white" stroke-width="1.5" opacity="0">
      <animateTransform attributeName="transform" type="translate" values="-100,0;${W+100},0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0.8;0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
    </line>`;
  }

  // Moon
  const moonX = W - 80, moonY = 55;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  style="font-family:'Courier New',monospace">

<defs>
  <style>
    @keyframes riseUp {
      from { transform: scaleY(0); opacity: 0; }
      to   { transform: scaleY(1); opacity: 1; }
    }
    a:hover .bhl { opacity: 0.07 !important; }
  </style>

  <!-- Sky gradient -->
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#000610"/>
    <stop offset="65%"  stop-color="#000e24"/>
    <stop offset="100%" stop-color="#050520"/>
  </linearGradient>

  <!-- Ground gradient -->
  <linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#060e1c"/>
    <stop offset="100%" stop-color="#020810"/>
  </linearGradient>

  <!-- Shiny ground reflection gradient -->
  <linearGradient id="gndShine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="transparent"/>
    <stop offset="20%"  stop-color="rgba(0,100,255,0.06)"/>
    <stop offset="50%"  stop-color="rgba(0,180,255,0.1)"/>
    <stop offset="80%"  stop-color="rgba(100,0,255,0.06)"/>
    <stop offset="100%" stop-color="transparent"/>
  </linearGradient>

  <!-- Horizon glow -->
  <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="transparent"/>
    <stop offset="100%" stop-color="rgba(0,100,200,0.2)"/>
  </linearGradient>

  <!-- Moon glow filter -->
  <filter id="moonGlow">
    <feGaussianBlur stdDeviation="8" result="blur"/>
    <feComposite in="SourceGraphic" in2="blur" operator="over"/>
  </filter>

  <!-- Ground glow line gradient -->
  <linearGradient id="glowLine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="transparent"/>
    <stop offset="25%"  stop-color="#00d2ff"/>
    <stop offset="50%"  stop-color="#aa55ff"/>
    <stop offset="75%"  stop-color="#00d2ff"/>
    <stop offset="100%" stop-color="transparent"/>
  </linearGradient>
</defs>

<!-- Sky -->
<rect width="${W}" height="${H}" fill="url(#sky)"/>

<!-- Stars -->
${starsSVG}

<!-- Shooting stars -->
${shooters}

<!-- Moon -->
<circle cx="${moonX}" cy="${moonY}" r="26" fill="#f8e88a" filter="url(#moonGlow)">
  <animate attributeName="r" values="25;27;25" dur="5s" repeatCount="indefinite"/>
</circle>
<circle cx="${moonX}" cy="${moonY}" r="26" fill="#f0d060"/>
<circle cx="${moonX-7}" cy="${moonY-5}" r="5" fill="#e0c040" opacity="0.4"/>
<circle cx="${moonX+8}" cy="${moonY+8}" r="3" fill="#e0c040" opacity="0.3"/>
<!-- Moon halo -->
<circle cx="${moonX}" cy="${moonY}" r="40" fill="none" stroke="#f8e88a" stroke-width="1" opacity="0.12">
  <animate attributeName="r" values="38;44;38" dur="5s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.08;0.18;0.08" dur="5s" repeatCount="indefinite"/>
</circle>

<!-- Horizon glow -->
<rect x="0" y="${GROUND_Y-80}" width="${W}" height="80" fill="url(#horizon)"/>

<!-- Buildings -->
${buildings}

<!-- Ground base -->
<rect x="0" y="${GROUND_Y}" width="${W}" height="${H - GROUND_Y}" fill="url(#gnd)"/>

<!-- Shiny ground layer -->
<rect x="0" y="${GROUND_Y}" width="${W}" height="${H - GROUND_Y}" fill="url(#gndShine)"/>

<!-- Ground neon line -->
<line x1="0" y1="${GROUND_Y}" x2="${W}" y2="${GROUND_Y}"
  stroke="url(#glowLine)" stroke-width="2.5">
  <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite"/>
</line>

<!-- Road dashes -->
<line x1="0" y1="${GROUND_Y+22}" x2="${W}" y2="${GROUND_Y+22}"
  stroke="rgba(255,255,255,0.08)" stroke-width="1.5" stroke-dasharray="28,28"/>

<!-- Grid lines on ground -->
${Array.from({length:8},(_,i)=>{
  const gx = (i+1) * W/9;
  return `<line x1="${gx.toFixed()}" y1="${GROUND_Y}" x2="${gx.toFixed()}" y2="${H}"
    stroke="rgba(0,80,180,0.08)" stroke-width="1"/>`;
}).join('')}

<!-- Footer label -->
<text x="${W/2}" y="${H-10}" text-anchor="middle"
  font-family="'Courier New',monospace" font-size="10" fill="rgba(0,210,255,0.3)"
  letter-spacing="3">GITCITY · github.com/${esc(USERNAME)}</text>

</svg>`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  if (!USERNAME) { console.error("Usage: node generate-city.js <username>"); process.exit(1); }
  console.log(`\n🏙️  GitCity Generator for @${USERNAME}\n`);

  const repos = await getAllRepos();
  console.log(`✓ Found ${repos.length} own repos`);
  const limited = repos.slice(0, 36);

  const withCommits = await Promise.all(
    limited.map(async (repo, i) => {
      const c = await getCommits(repo);
      console.log(`  [${i+1}/${limited.length}] ${repo.name}: ${c} commits`);
      return { ...repo, totalCommits: c };
    })
  );

  const svg = generateSVG(withCommits);
  const out = process.env.OUTPUT_PATH || "github-city.svg";
  fs.writeFileSync(out, svg, "utf8");
  console.log(`\n✅ SVG saved → ${out}`);
  console.log(`   Repos: ${withCommits.length} | Total commits: ${withCommits.reduce((s,r)=>s+r.totalCommits,0)}`);
})();
