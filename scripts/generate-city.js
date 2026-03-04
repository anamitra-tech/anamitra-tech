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
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const PALETTES = [
  { top:"#00d2ff", mid:"#0a4060", dark:"#041828", side:"#062030", win:"#00eeff", glow:"#00d2ff" },
  { top:"#aa55ff", mid:"#3a1060", dark:"#180830", side:"#220a40", win:"#cc88ff", glow:"#aa55ff" },
  { top:"#00ff88", mid:"#0a4030", dark:"#041820", side:"#062820", win:"#88ffcc", glow:"#00ff88" },
  { top:"#ff7700", mid:"#602010", dark:"#281008", side:"#401808", win:"#ffcc88", glow:"#ff7700" },
  { top:"#ff0088", mid:"#600030", dark:"#280018", side:"#400020", win:"#ff88cc", glow:"#ff0088" },
  { top:"#ffdd00", mid:"#604010", dark:"#281808", side:"#402808", win:"#ffee88", glow:"#ffdd00" },
  { top:"#00ffee", mid:"#0a4040", dark:"#041c1c", side:"#062828", win:"#88ffee", glow:"#00ffee" },
  { top:"#ff4455", mid:"#601020", dark:"#280810", side:"#400a18", win:"#ff9988", glow:"#ff4455" },
  { top:"#44aaff", mid:"#0a3060", dark:"#041828", side:"#062040", win:"#88ccff", glow:"#44aaff" },
  { top:"#ff44ee", mid:"#500050", dark:"#200028", side:"#380038", win:"#ff88ee", glow:"#ff44ee" },
];

const LANG_COLORS = {
  JavaScript:"#f7df1e", TypeScript:"#3178c6", Python:"#3572a5",
  Java:"#b07219", Go:"#00acd7", "C++":"#f34b7d", C:"#aaaaaa",
  Rust:"#dea584", Ruby:"#cc1122", PHP:"#4f5d95", Swift:"#fa7343",
  Kotlin:"#a97bff", HTML:"#e34c26", CSS:"#563d7c", Shell:"#89e051",
  Dart:"#00b4ab", R:"#198ce7", Vue:"#41b883", "C#":"#178600",
  "Jupyter Notebook":"#f37726", Svelte:"#ff3e00",
};

function isoBuilding(repo, commits, maxC, idx, cx, GROUND, pal) {
  const ratio = commits / maxC;
  const BW = Math.max(50, Math.min(86, 50 + repo.name.length * 1.5));
  const BH = 30 + ratio * 220;
  // Isometric depth offset
  const DX = 18, DY = 10;

  const left = cx - BW/2, right = cx + BW/2;
  const top = GROUND - BH;

  function pt(x,y){ return `${x.toFixed(1)},${y.toFixed(1)}`; }

  const uid = `b${idx}`;
  const delay = (idx * 0.07).toFixed(2);

  // Windows on front
  const wRows = Math.max(3, Math.floor(BH/23));
  const wCols = Math.max(2, Math.min(5, Math.floor(BW/15)));
  const wW = Math.floor((BW-12)/wCols)-3;
  const wH = 9;
  let wins = "";
  for(let r=0;r<wRows;r++) for(let c=0;c<wCols;c++){
    const lit=Math.random()>.3;
    const wx=left+6+c*(wW+3), wy=top+10+r*((BH-14)/wRows);
    const fd=(3+Math.random()*8).toFixed(1), fb=(Math.random()*7).toFixed(1);
    wins+=`<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${wW}" height="${wH}" rx="1.5"
      fill="${lit?pal.win:"rgba(255,255,255,0.04)"}" opacity="${lit?(0.5+Math.random()*.45).toFixed(2):"0.25"}">
      ${lit?`<animate attributeName="opacity" values="${(.35+Math.random()*.2).toFixed(2)};${(.8+Math.random()*.2).toFixed(2)};${(.35+Math.random()*.2).toFixed(2)}" dur="${fd}s" begin="${fb}s" repeatCount="indefinite"/>`:""}
    </rect>`;
  }

  // Windows on right side face (skewed)
  const sWCols=Math.max(1,Math.floor(DX/9));
  for(let r=0;r<Math.min(wRows,5);r++) for(let c=0;c<sWCols;c++){
    const lit=Math.random()>.4;
    const fx=(c+0.5)/sWCols, fy=(r+0.5)/wRows;
    const wx=right+DX*fx-3, wy=top+fy*(BH-14)+8-DY*(1-fy);
    wins+=`<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="7" height="8" rx="1"
      fill="${lit?pal.win:"rgba(255,255,255,0.03)"}" opacity="${lit?"0.4":"0.18"}"
      transform="skewY(-${(Math.atan2(DY,DX)*180/Math.PI).toFixed(1)})"/>`;
  }

  // Language tags
  const langs=[repo.language,...(repo.topics||[]).slice(0,3)].filter(Boolean).slice(0,4);
  const tH=14, tPad=8, tGap=5;
  const tWidths=langs.map(l=>l.length*6.5+tPad*2);
  const tTotal=tWidths.reduce((s,w)=>s+w+tGap,-tGap);
  let tX=cx-tTotal/2;
  let tags="";
  langs.forEach((lang,li)=>{
    const col=LANG_COLORS[lang]||pal.top;
    const tw=tWidths[li];
    const ty=GROUND+22;
    tags+=`<rect x="${tX.toFixed(1)}" y="${ty}" width="${tw.toFixed(1)}" height="${tH}" rx="7"
      fill="${col}20" stroke="${col}" stroke-width="0.8" stroke-opacity="0.65"/>
    <text x="${(tX+tw/2).toFixed(1)}" y="${ty+10}" text-anchor="middle"
      font-family="'Courier New',monospace" font-size="8.5" font-weight="600" fill="${col}">${esc(lang)}</text>`;
    tX+=tw+tGap;
  });

  // Antenna
  let ant="";
  if(ratio>.28){
    const aH=14+ratio*22, ax=cx+DX*0.5, ay=top-DY*0.5;
    const bd=(0.65+(idx%8)*0.13).toFixed(2);
    ant=`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${(ay-aH).toFixed(1)}"
      stroke="rgba(255,255,255,0.38)" stroke-width="1.5"/>
    <circle cx="${ax.toFixed(1)}" cy="${(ay-aH).toFixed(1)}" r="3.5" fill="${pal.top}">
      <animate attributeName="opacity" values="1;0.05;1" dur="${bd}s" repeatCount="indefinite"/>
      <animate attributeName="r" values="2.5;5.5;2.5" dur="${bd}s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${ax.toFixed(1)}" cy="${(ay-aH).toFixed(1)}" r="10" fill="${pal.top}" opacity="0.08">
      <animate attributeName="r" values="5;15;5" dur="${bd}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.12;0;0.12" dur="${bd}s" repeatCount="indefinite"/>
    </circle>`;
  }

  const glowR=BW*0.85;

  return `
<defs>
  <linearGradient id="gf${idx}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${pal.mid}"/>
    <stop offset="100%" stop-color="${pal.dark}"/>
  </linearGradient>
  <linearGradient id="gs${idx}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${pal.dark}"/>
    <stop offset="100%" stop-color="${pal.side}"/>
  </linearGradient>
  <linearGradient id="gt${idx}" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0%" stop-color="${pal.mid}"/>
    <stop offset="100%" stop-color="${pal.top}" stop-opacity="0.85"/>
  </linearGradient>
  <radialGradient id="fl${idx}" cx="50%" cy="30%" r="50%">
    <stop offset="0%" stop-color="${pal.glow}" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="${pal.glow}" stop-opacity="0"/>
  </radialGradient>
  <filter id="fg${idx}" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="3.5"/>
  </filter>
</defs>

<a href="${esc(repo.html_url)}" target="_blank">
<g style="animation:rise .8s cubic-bezier(.22,1,.36,1) ${delay}s both;transform-origin:${cx.toFixed(1)}px ${GROUND}px;transform-box:fill-box">

  ${ant}

  <!-- Floor glow -->
  <ellipse cx="${(cx+DX*.3).toFixed(1)}" cy="${GROUND}" rx="${glowR.toFixed(1)}" ry="${(glowR*.22).toFixed(1)}" fill="url(#fl${idx})">
    <animate attributeName="rx" values="${glowR.toFixed(1)};${(glowR*1.18).toFixed(1)};${glowR.toFixed(1)}" dur="${(1.8+idx*.12).toFixed(1)}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values=".65;1;.65" dur="${(1.8+idx*.12).toFixed(1)}s" repeatCount="indefinite"/>
  </ellipse>

  <!-- Base plate -->
  <polygon points="${pt(left-4,GROUND+4)},${pt(right+DX+4,GROUND+4-DY)},${pt(right+DX+4,GROUND-2-DY)},${pt(right+1,GROUND-2)},${pt(left-4,GROUND-2)}"
    fill="${pal.dark}" opacity="0.95"/>

  <!-- Right side face -->
  <polygon points="${pt(right,top)},${pt(right+DX,top-DY)},${pt(right+DX,GROUND-DY)},${pt(right,GROUND)}"
    fill="url(#gs${idx})"/>

  <!-- Front face -->
  <rect x="${left}" y="${top}" width="${BW}" height="${BH}" fill="url(#gf${idx})"/>

  <!-- Animated shimmer on front -->
  <rect x="${left}" y="${top}" width="${BW}" height="${BH}" fill="rgba(255,255,255,0)">
    <animate attributeName="fill" values="rgba(255,255,255,0.02);rgba(255,255,255,0.06);rgba(255,255,255,0.02)" dur="${(2.5+idx*.18).toFixed(1)}s" repeatCount="indefinite"/>
  </rect>

  <!-- Windows -->
  ${wins}

  <!-- Top face -->
  <polygon points="${pt(left,top)},${pt(right,top)},${pt(right+DX,top-DY)},${pt(left+DX,top-DY)}"
    fill="url(#gt${idx})"/>

  <!-- Roof glow -->
  <line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="${pal.top}" stroke-width="3" filter="url(#fg${idx})">
    <animate attributeName="opacity" values=".6;1;.6" dur="${(1.4+idx*.09).toFixed(1)}s" repeatCount="indefinite"/>
  </line>
  <line x1="${right}" y1="${top}" x2="${(right+DX).toFixed(1)}" y2="${(top-DY).toFixed(1)}"
    stroke="${pal.top}" stroke-width="1.5" opacity="0.55" filter="url(#fg${idx})"/>

  <!-- Name label -->
  <rect x="${(cx-BW/2-2).toFixed(1)}" y="${(GROUND+5).toFixed(1)}" width="${(BW+4).toFixed(1)}" height="15" rx="4"
    fill="rgba(0,4,20,.85)" stroke="${pal.top}" stroke-width=".7" stroke-opacity=".5"/>
  <text x="${cx.toFixed(1)}" y="${(GROUND+15.5).toFixed(1)}" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="9.5" font-weight="bold" fill="${pal.top}"
    >${esc(repo.name.length>14?repo.name.slice(0,13)+"…":repo.name)}</text>

  <!-- Language tags -->
  ${tags}

  <!-- Commit count -->
  <text x="${cx.toFixed(1)}" y="${(GROUND+(langs.length>0?42:27)).toFixed(1)}" text-anchor="middle"
    font-family="'Courier New',monospace" font-size="8" fill="rgba(200,220,255,.4)">${commits} commits</text>

</g>
</a>`;
}

function generateSVG(repos) {
  const W = Math.max(980, repos.length * 98 + 120);
  const H = 530;
  const GROUND = 315;
  const maxC = Math.max(...repos.map(r=>r.totalCommits),1);

  // Mountain layout
  const sorted=[...repos].sort((a,b)=>b.totalCommits-a.totalCommits);
  const arr=new Array(sorted.length);
  let l=Math.floor(sorted.length/2)-1,r=Math.floor(sorted.length/2);
  for(let i=0;i<sorted.length;i++){
    if(i%2===0){arr[r]=sorted[i];r++;}else{arr[l]=sorted[i];l--;}
  }

  const bWidths=arr.map(repo=>repo?Math.max(50,Math.min(86,50+repo.name.length*1.5)):0);
  const totalW=bWidths.reduce((s,w)=>s+w+16,0);
  let xC=(W-totalW)/2;
  let blds="";
  arr.forEach((repo,idx)=>{
    if(!repo)return;
    const bw=bWidths[idx];
    blds+=isoBuilding(repo,repo.totalCommits,maxC,idx,xC+bw/2,GROUND,PALETTES[idx%PALETTES.length]);
    xC+=bw+16;
  });

  // Stars
  let sts="";
  const scols=["white","#00d2ff","#aa55ff","#ff6090","#ffdd00","#00ffee","#ff44ee"];
  for(let i=0;i<160;i++){
    const sx=(Math.random()*W).toFixed(1),sy=(Math.random()*(GROUND-80)).toFixed(1);
    const sr=(0.3+Math.random()*1.9).toFixed(1);
    const col=scols[Math.floor(Math.random()*scols.length)];
    const dur=(2+Math.random()*5).toFixed(1),beg=(Math.random()*6).toFixed(1);
    sts+=`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="${col}">
      <animate attributeName="opacity" values="${(0.1+Math.random()*.15).toFixed(2)};${(0.6+Math.random()*.4).toFixed(2)};${(0.1+Math.random()*.15).toFixed(2)}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
    </circle>`;
  }

  // Shooting stars
  let shoot="";
  for(let i=0;i<4;i++){
    const sy=(10+Math.random()*65).toFixed(1);
    const dur=(3+Math.random()*4).toFixed(1);
    const beg=(i*7+Math.random()*4).toFixed(1);
    shoot+=`<g>
      <line x1="0" y1="${sy}" x2="60" y2="${(parseFloat(sy)+4).toFixed(1)}" stroke="white" stroke-width="1.5" opacity="0">
        <animateTransform attributeName="transform" type="translate" values="-80,0;${W+80},0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.8;0.8;0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>
      </line>
    </g>`;
  }

  const mX=W-95,mY=62;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<style>
@keyframes rise{from{transform:scaleY(0);opacity:0}to{transform:scaleY(1);opacity:1}}
</style>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#000510"/><stop offset="60%" stop-color="#000c22"/><stop offset="100%" stop-color="#040418"/>
</linearGradient>
<linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#040d1c"/><stop offset="100%" stop-color="#020810"/>
</linearGradient>
<linearGradient id="gref" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="transparent"/>
  <stop offset="30%" stop-color="rgba(0,120,255,0.08)"/>
  <stop offset="50%" stop-color="rgba(0,200,255,0.13)"/>
  <stop offset="70%" stop-color="rgba(100,0,255,0.08)"/>
  <stop offset="100%" stop-color="transparent"/>
</linearGradient>
<linearGradient id="horiz" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="transparent"/><stop offset="100%" stop-color="rgba(0,80,200,0.2)"/>
</linearGradient>
<linearGradient id="gline" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="transparent"/>
  <stop offset="22%" stop-color="#00d2ff"/>
  <stop offset="50%" stop-color="#aa55ff"/>
  <stop offset="78%" stop-color="#00d2ff"/>
  <stop offset="100%" stop-color="transparent"/>
</linearGradient>
<filter id="moonF" x="-60%" y="-60%" width="220%" height="220%">
  <feGaussianBlur stdDeviation="10"/>
</filter>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
${sts}
${shoot}

<!-- Moon -->
<circle cx="${mX}" cy="${mY}" r="52" fill="${PALETTES[0].glow}" filter="url(#moonF)" opacity="0.12">
  <animate attributeName="r" values="48;58;48" dur="5s" repeatCount="indefinite"/>
</circle>
<circle cx="${mX}" cy="${mY}" r="28" fill="#f8e880"/>
<circle cx="${mX-9}" cy="${mY-6}" r="5.5" fill="#e8c840" opacity="0.3"/>
<circle cx="${mX+10}" cy="${mY+9}" r="3.5" fill="#e8c840" opacity="0.22"/>

<rect x="0" y="${GROUND-95}" width="${W}" height="95" fill="url(#horiz)"/>

${blds}

<rect x="0" y="${GROUND}" width="${W}" height="${H-GROUND}" fill="url(#gnd)"/>
<rect x="0" y="${GROUND}" width="${W}" height="${H-GROUND}" fill="url(#gref)"/>

${Array.from({length:14},(_,i)=>{
  const gx=((i+1)*W/15).toFixed();
  return `<line x1="${gx}" y1="${GROUND}" x2="${gx}" y2="${H}" stroke="rgba(0,100,200,0.065)" stroke-width="1"/>`;
}).join("")}
${Array.from({length:5},(_,i)=>{
  const gy=(GROUND+(i+1)*(H-GROUND)/6).toFixed();
  return `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="rgba(0,100,200,0.045)" stroke-width="1"/>`;
}).join("")}

<line x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}" stroke="url(#gline)" stroke-width="2.5">
  <animate attributeName="opacity" values=".5;1;.5" dur="3s" repeatCount="indefinite"/>
</line>
<line x1="0" y1="${GROUND+28}" x2="${W}" y2="${GROUND+28}"
  stroke="rgba(255,255,255,0.065)" stroke-width="1.5" stroke-dasharray="28,28"/>

<text x="${W/2}" y="${H-10}" text-anchor="middle"
  font-family="'Courier New',monospace" font-size="10" fill="rgba(0,210,255,0.25)" letter-spacing="3">
  GITCITY · github.com/${esc(USERNAME)}
</text>
</svg>`;
}

(async()=>{
  if(!USERNAME){console.error("Usage: node generate-city.js <username>");process.exit(1);}
  console.log(`\n🏙️  GitCity for @${USERNAME}\n`);
  const repos=await getAllRepos();
  console.log(`✓ ${repos.length} repos`);
  const limited=repos.slice(0,36);
  const withC=await Promise.all(limited.map(async(r,i)=>{
    const c=await getCommits(r);
    console.log(`  [${i+1}/${limited.length}] ${r.name}: ${c}`);
    return{...r,totalCommits:c};
  }));
  const svg=generateSVG(withC);
  const out=process.env.OUTPUT_PATH||"github-city.svg";
  fs.writeFileSync(out,svg,"utf8");
  console.log(`\n✅ Done → ${out}`);
})();
