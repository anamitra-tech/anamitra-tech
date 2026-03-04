const https = require("https");
const fs    = require("fs");

const USERNAME = process.env.GITHUB_USERNAME || process.argv[2];
const TOKEN    = process.env.GH_TOKEN || "";

function ghFetch(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "api.github.com", path,
      headers: { "User-Agent":"GitCity","Accept":"application/vnd.github.v3+json",
        ...(TOKEN?{Authorization:`token ${TOKEN}`}:{}) },
    };
    https.get(opts,(res)=>{
      let d="";res.on("data",c=>d+=c);
      res.on("end",()=>{try{resolve(JSON.parse(d));}catch{reject(new Error("parse"));}});
    }).on("error",reject);
  });
}
async function getAllRepos(){
  let all=[],page=1;
  while(true){
    const b=await ghFetch(`/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner&sort=pushed`);
    if(!Array.isArray(b))break;
    all=all.concat(b.filter(r=>!r.fork));
    if(b.length<100)break;page++;
  }
  return all;
}
async function getCommits(repo){
  try{
    const c=await ghFetch(`/repos/${USERNAME}/${repo.name}/contributors?per_page=100`);
    return!Array.isArray(c)?1:Math.max(1,c.reduce((s,x)=>s+(x.contributions||0),0));
  }catch{return 1;}
}

function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

const PALETTES=[
  {top:"#00d4ff",fa:"#0c3f5a",fb:"#051e2e",sa:"#07304a",sb:"#020f1d",win:"#00eeff",glow:"#00d4ff"},
  {top:"#b55fff",fa:"#300c62",fb:"#170631",sa:"#260a52",sb:"#0f0322",win:"#d490ff",glow:"#b55fff"},
  {top:"#00ff99",fa:"#0b4232",fb:"#051f18",sa:"#083528",sb:"#030f0b",win:"#88ffd4",glow:"#00ff99"},
  {top:"#ff8c00",fa:"#5e2b00",fb:"#2f1500",sa:"#4c2200",sb:"#1f0e00",win:"#ffcc88",glow:"#ff8c00"},
  {top:"#ff0099",fa:"#5e0031",fb:"#2f0018",sa:"#4c0028",sb:"#1f0011",win:"#ff88cc",glow:"#ff0099"},
  {top:"#ffe000",fa:"#5e4500",fb:"#2f2200",sa:"#4c3800",sb:"#1f1700",win:"#fff088",glow:"#ffe000"},
  {top:"#00ffdd",fa:"#0b3e3a",fb:"#051f1d",sa:"#083130",sb:"#030f0e",win:"#88fff0",glow:"#00ffdd"},
  {top:"#ff4466",fa:"#5e1020",fb:"#2f0810",sa:"#4c0818",sb:"#1f0408",win:"#ff9aaa",glow:"#ff4466"},
  {top:"#44aaff",fa:"#0a2e5a",fb:"#05162e",sa:"#06204a",sb:"#02081e",win:"#88ccff",glow:"#44aaff"},
  {top:"#ffaa00",fa:"#5e3800",fb:"#2f1c00",sa:"#4c2c00",sb:"#1f1200",win:"#ffdd88",glow:"#ffaa00"},
];
const LANG_COLORS={JavaScript:"#f7df1e",TypeScript:"#3178c6",Python:"#4584b6","Jupyter Notebook":"#f37726",SQL:"#e38d00",Java:"#b07219",Go:"#00acd7","C++":"#f34b7d",C:"#aaaaaa",Rust:"#dea584",Ruby:"#cc3333",PHP:"#6f4f9e",Swift:"#fa7343",Kotlin:"#a97bff",HTML:"#e34c26",CSS:"#563d7c",Shell:"#89e051","C#":"#178600",Dart:"#00b4ab",R:"#198ce7",Vue:"#41b883",Svelte:"#ff3e00"};

const SLOT_W=110,BW=54,DX=16,DY=9,GROUND=280,SVG_H=430;

function buildParts(repo,commits,maxC,idx,cx,pal){
  const ratio=Math.pow(commits/maxC,0.55);
  const BH=35+ratio*205;
  const left=cx-BW/2,right=cx+BW/2,top=GROUND-BH;
  const delay=(idx*0.09).toFixed(2);

  // Windows
  const wRows=Math.max(3,Math.floor(BH/26));
  const wCols=3,wW=11,wH=9,wPX=8,wPY=10;
  const wSX=(BW-wPX*2-wCols*wW)/(wCols-1);
  const wSY=Math.max(3,(BH-wPY*2-wRows*wH)/(wRows-1));
  let wins="";
  for(let r=0;r<wRows;r++)for(let c=0;c<wCols;c++){
    const lit=Math.random()>.3;
    const wx=left+wPX+c*(wW+wSX),wy=top+wPY+r*(wH+wSY);
    const dur=(3+Math.random()*7).toFixed(1),beg=(Math.random()*9).toFixed(1);
    const hi=(0.8+Math.random()*.2).toFixed(2),lo=(0.15+Math.random()*.15).toFixed(2);
    wins+=`<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${wW}" height="${wH}" rx="2" fill="${lit?pal.win:"rgba(20,40,90,.5)"}" opacity="${lit?hi:".35"}">${lit?`<animate attributeName="opacity" values="${lo};${hi};${lo}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>`:""}
    </rect>`;
  }
  for(let r=0;r<Math.min(wRows,5);r++){
    const lit=Math.random()>.45,wy=top+wPY+r*(wH+wSY);
    wins+=`<rect x="${(right+3).toFixed(1)}" y="${wy.toFixed(1)}" width="7" height="${wH}" rx="1.5" fill="${lit?pal.win:"rgba(10,20,50,.4)"}" opacity="${lit?".5":".15"}" transform="skewY(-${(Math.atan2(DY,DX)*180/Math.PI).toFixed(1)})"/>`;
  }

  let ant="";
  if(ratio>.28){
    const aH=11+ratio*17,ax=cx+DX*.44,ay=top-DY*.44,bd=(0.6+(idx%9)*.15).toFixed(2);
    ant=`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${(ay-aH).toFixed(1)}" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>
    <circle cx="${ax.toFixed(1)}" cy="${(ay-aH).toFixed(1)}" r="3.5" fill="${pal.top}"><animate attributeName="opacity" values="1;.04;1" dur="${bd}s" repeatCount="indefinite"/><animate attributeName="r" values="2.5;5.5;2.5" dur="${bd}s" repeatCount="indefinite"/></circle>
    <circle cx="${ax.toFixed(1)}" cy="${(ay-aH).toFixed(1)}" r="10" fill="${pal.top}" opacity=".1"><animate attributeName="r" values="6;16;6" dur="${bd}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".12;0;.12" dur="${bd}s" repeatCount="indefinite"/></circle>`;
  }

  const gR=BW*.88;
  const body=`
<defs>
  <linearGradient id="gf${idx}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${pal.fa}"/><stop offset="100%" stop-color="${pal.fb}"/></linearGradient>
  <linearGradient id="gs${idx}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${pal.sb}"/><stop offset="100%" stop-color="${pal.sa}"/></linearGradient>
  <linearGradient id="gt${idx}" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="${pal.fa}"/><stop offset="100%" stop-color="${pal.top}"/></linearGradient>
  <radialGradient id="fl${idx}" cx="50%" cy="30%" r="50%"><stop offset="0%" stop-color="${pal.glow}" stop-opacity=".5"/><stop offset="100%" stop-color="${pal.glow}" stop-opacity="0"/></radialGradient>
  <filter id="fg${idx}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4.5"/></filter>
</defs>
<g style="animation:rise .8s cubic-bezier(.22,1,.36,1) ${delay}s both;transform-origin:${cx.toFixed(1)}px ${GROUND}px;transform-box:fill-box">
  ${ant}
  <ellipse cx="${(cx+DX*.28).toFixed(1)}" cy="${GROUND}" rx="${gR.toFixed(1)}" ry="${(gR*.17).toFixed(1)}" fill="url(#fl${idx})"><animate attributeName="rx" values="${gR.toFixed(1)};${(gR*1.25).toFixed(1)};${gR.toFixed(1)}" dur="${(2.2+idx*.14).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;1;.5" dur="${(2.2+idx*.14).toFixed(1)}s" repeatCount="indefinite"/></ellipse>
  <polygon points="${(left-4).toFixed(1)},${(GROUND+5).toFixed(1)} ${(right+DX+4).toFixed(1)},${(GROUND+5-DY).toFixed(1)} ${(right+DX+2).toFixed(1)},${(GROUND-2-DY).toFixed(1)} ${right.toFixed(1)},${(GROUND-2).toFixed(1)} ${(left-4).toFixed(1)},${(GROUND-2).toFixed(1)}" fill="${pal.sb}" opacity=".88"/>
  <polygon points="${right.toFixed(1)},${top.toFixed(1)} ${(right+DX).toFixed(1)},${(top-DY).toFixed(1)} ${(right+DX).toFixed(1)},${(GROUND-DY).toFixed(1)} ${right.toFixed(1)},${GROUND.toFixed(1)}" fill="url(#gs${idx})"/>
  <rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${BW}" height="${BH}" fill="url(#gf${idx})" rx="1"/>
  <rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${BW}" height="${BH}" fill="transparent" rx="1"><animate attributeName="fill" values="rgba(255,255,255,0);rgba(255,255,255,.06);rgba(255,255,255,0)" dur="${(4+idx*.3).toFixed(1)}s" repeatCount="indefinite"/></rect>
  ${wins}
  <polygon points="${left.toFixed(1)},${top.toFixed(1)} ${right.toFixed(1)},${top.toFixed(1)} ${(right+DX).toFixed(1)},${(top-DY).toFixed(1)} ${(left+DX).toFixed(1)},${(top-DY).toFixed(1)}" fill="url(#gt${idx})"/>
  <line x1="${left.toFixed(1)}" y1="${top.toFixed(1)}" x2="${right.toFixed(1)}" y2="${top.toFixed(1)}" stroke="${pal.top}" stroke-width="3.5" filter="url(#fg${idx})"><animate attributeName="opacity" values=".6;1;.6" dur="${(1.6+idx*.1).toFixed(1)}s" repeatCount="indefinite"/></line>
  <line x1="${right.toFixed(1)}" y1="${top.toFixed(1)}" x2="${(right+DX).toFixed(1)}" y2="${(top-DY).toFixed(1)}" stroke="${pal.top}" stroke-width="1.8" opacity=".55" filter="url(#fg${idx})"/>
  <polygon points="${left.toFixed(1)},${top.toFixed(1)} ${right.toFixed(1)},${top.toFixed(1)} ${(right+DX).toFixed(1)},${(top-DY).toFixed(1)} ${(left+DX).toFixed(1)},${(top-DY).toFixed(1)}" fill="none" stroke="${pal.top}" stroke-width=".8" stroke-opacity=".4"/>
</g>`;

  const langs=[repo.language,...(repo.topics||[]).slice(0,1)].filter(Boolean).slice(0,2);
  const nm=repo.name.length>13?repo.name.slice(0,12)+"…":repo.name;
  const NY=GROUND+21,TY=GROUND+35,CY=GROUND+60;
  const maxTW=Math.floor((SLOT_W-20-(langs.length-1)*5)/langs.length);
  const tWs=langs.map(l=>Math.min(maxTW,l.length*7+16));
  const tTotal=tWs.reduce((s,w)=>s+w+5,-5);
  let tx=cx-tTotal/2,tagSVG="";
  langs.forEach((l,li)=>{
    const col=LANG_COLORS[l]||pal.top,tw=tWs[li];
    const ls=l.length*7+4>tw?l.slice(0,Math.floor((tw-8)/7))+"…":l;
    tagSVG+=`<rect x="${tx.toFixed(1)}" y="${TY}" width="${tw}" height="14" rx="7" fill="${col}28" stroke="${col}" stroke-width="1.1"/><text x="${(tx+tw/2).toFixed(1)}" y="${TY+10.5}" text-anchor="middle" font-family="monospace" font-size="9" font-weight="bold" fill="${col}">${esc(ls)}</text>`;
    tx+=tw+5;
  });
  const label=`<a href="${esc(repo.html_url)}" target="_blank">
  <rect x="${(cx-BW/2-3).toFixed(1)}" y="${(NY-14).toFixed(1)}" width="${BW+6}" height="17" rx="5" fill="rgba(2,6,28,.94)" stroke="${pal.top}" stroke-width="1.2" stroke-opacity=".8"/>
  <text x="${cx.toFixed(1)}" y="${NY.toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="10.5" font-weight="bold" fill="${pal.top}">${esc(nm)}</text>
  ${tagSVG}
  <text x="${cx.toFixed(1)}" y="${CY.toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="9" fill="rgba(155,200,255,.8)">${commits} commits</text>
</a>`;
  return{body,label};
}

function generateSVG(repos){
  const maxC=Math.max(...repos.map(r=>r.totalCommits),1);
  const sorted=[...repos].sort((a,b)=>b.totalCommits-a.totalCommits);
  const arr=new Array(sorted.length);
  let li=Math.floor(sorted.length/2)-1,ri=Math.floor(sorted.length/2);
  for(let i=0;i<sorted.length;i++){if(i%2===0){arr[ri]=sorted[i];ri++;}else{arr[li]=sorted[i];li--;}}
  const W=arr.length*SLOT_W+80;
  let bodies="",labels="";
  arr.forEach((repo,idx)=>{
    if(!repo)return;
    const cx=40+SLOT_W/2+idx*SLOT_W;
    const{body,label}=buildParts(repo,repo.totalCommits,maxC,idx,cx,PALETTES[idx%PALETTES.length]);
    bodies+=body;labels+=label;
  });
  const SC=["white","#00d4ff","#b055ff","#ff6090","#ffe000","#00ffdd","#ff88aa"];
  let stars="";
  for(let i=0;i<180;i++){
    const sx=(Math.random()*W).toFixed(1),sy=(Math.random()*(GROUND-50)).toFixed(1);
    const sr=(0.3+Math.random()*1.8).toFixed(1),col=SC[Math.floor(Math.random()*SC.length)];
    const dur=(2+Math.random()*5).toFixed(1),beg=(Math.random()*7).toFixed(1);
    stars+=`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="${col}"><animate attributeName="opacity" values="${(0.07+Math.random()*.1).toFixed(2)};${(0.65+Math.random()*.35).toFixed(2)};${(0.07+Math.random()*.1).toFixed(2)}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/></circle>`;
  }
  let shoots="";
  for(let i=0;i<3;i++){
    const sy=(8+Math.random()*65).toFixed(1),dur=(3+Math.random()*4).toFixed(1),beg=(i*10+Math.random()*6).toFixed(1);
    shoots+=`<line x1="0" y1="${sy}" x2="70" y2="${(parseFloat(sy)+5).toFixed(1)}" stroke="white" stroke-width="1.5" opacity="0"><animateTransform attributeName="transform" type="translate" values="-100,0;${W+100},0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.9;.9;0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/></line>`;
  }
  const mX=W-90,mY=58;
  return`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SVG_H}" viewBox="0 0 ${W} ${SVG_H}">
<defs>
<style>@keyframes rise{from{transform:scaleY(0);opacity:0}to{transform:scaleY(1);opacity:1}}</style>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000510"/><stop offset="62%" stop-color="#000c22"/><stop offset="100%" stop-color="#03031a"/></linearGradient>
<linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#060e20"/><stop offset="100%" stop-color="#020810"/></linearGradient>
<linearGradient id="gref" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="transparent"/><stop offset="30%" stop-color="rgba(0,140,255,.1)"/><stop offset="50%" stop-color="rgba(0,220,255,.18)"/><stop offset="70%" stop-color="rgba(120,0,255,.1)"/><stop offset="100%" stop-color="transparent"/></linearGradient>
<linearGradient id="horiz" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="transparent"/><stop offset="100%" stop-color="rgba(0,90,220,.25)"/></linearGradient>
<linearGradient id="gline" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="transparent"/><stop offset="20%" stop-color="#00d4ff"/><stop offset="50%" stop-color="#b055ff"/><stop offset="80%" stop-color="#00d4ff"/><stop offset="100%" stop-color="transparent"/></linearGradient>
<filter id="moonF" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="${W}" height="${SVG_H}" fill="url(#sky)"/>
${stars}${shoots}
<circle cx="${mX}" cy="${mY}" r="58" fill="#f8e88a" filter="url(#moonF)" opacity=".14"><animate attributeName="r" values="53;66;53" dur="5s" repeatCount="indefinite"/></circle>
<circle cx="${mX}" cy="${mY}" r="29" fill="#f8e880"/><circle cx="${mX-10}" cy="${mY-7}" r="5" fill="#e8c840" opacity=".3"/><circle cx="${mX+10}" cy="${mY+9}" r="3" fill="#e8c840" opacity=".22"/>
<rect x="0" y="${GROUND-100}" width="${W}" height="100" fill="url(#horiz)"/>
${bodies}
<rect x="0" y="${GROUND}" width="${W}" height="${SVG_H-GROUND}" fill="url(#gnd)"/>
<rect x="0" y="${GROUND}" width="${W}" height="${SVG_H-GROUND}" fill="url(#gref)"/>
${Array.from({length:12},(_,i)=>`<line x1="${((i+1)*W/13).toFixed()}" y1="${GROUND}" x2="${((i+1)*W/13).toFixed()}" y2="${SVG_H}" stroke="rgba(0,100,200,.07)" stroke-width="1"/>`).join("")}
${Array.from({length:4},(_,i)=>`<line x1="0" y1="${(GROUND+(i+1)*(SVG_H-GROUND)/5).toFixed()}" x2="${W}" y2="${(GROUND+(i+1)*(SVG_H-GROUND)/5).toFixed()}" stroke="rgba(0,100,200,.05)" stroke-width="1"/>`).join("")}
<line x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}" stroke="url(#gline)" stroke-width="3"><animate attributeName="opacity" values=".5;1;.5" dur="3s" repeatCount="indefinite"/></line>
<line x1="0" y1="${GROUND+25}" x2="${W}" y2="${GROUND+25}" stroke="rgba(255,255,255,.07)" stroke-width="1.5" stroke-dasharray="28,28"/>
${labels}
<text x="${(W/2).toFixed()}" y="${SVG_H-8}" text-anchor="middle" font-family="monospace" font-size="10" fill="rgba(0,210,255,.28)" letter-spacing="3">GITCITY · github.com/${esc(USERNAME)}</text>
</svg>`;
}

(async()=>{
  if(!USERNAME){console.error("Usage: node generate-city.js <username>");process.exit(1);}
  console.log(`\n🏙️  GitCity for @${USERNAME}\n`);
  const repos=await getAllRepos();
  console.log(`✓ ${repos.length} repos`);
  const limited=repos.slice(0,36);
  const withC=await Promise.all(limited.map(async(repo,i)=>{
    const c=await getCommits(repo);
    console.log(`  [${i+1}/${limited.length}] ${repo.name}: ${c}`);
    return{...repo,totalCommits:c};
  }));
  const svg=generateSVG(withC);
  const out=process.env.OUTPUT_PATH||"github-city.svg";
  fs.writeFileSync(out,svg,"utf8");
  console.log(`\n✅ ${out} — ${withC.length} buildings`);
})();
