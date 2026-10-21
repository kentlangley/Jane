#!/usr/bin/env node
// Generates docs/architecture.svg, the friendly "how Jane works" diagram in docs/ARCHITECTURE.md.
//   node docs/architecture.mjs                         SVG without the font; text uses Kalam if the viewer has it, else a cursive/sans fallback
//   KALAM_DIR=/path/to/Kalam node docs/architecture.mjs  embeds a subset of the Kalam font (SIL OFL 1.1, Google Fonts) so
//                                                        it looks the same everywhere (needs fontTools' pyftsubset)
// The hand-drawn look comes from slightly wobbly outlines (seeded, so the output is stable). All text is real SVG text.
import fs from 'fs';import path from 'path';import os from 'os';import {execFileSync} from 'child_process';import {fileURLToPath} from 'url';
const OUT=path.join(path.dirname(fileURLToPath(import.meta.url)),'architecture.svg');
const W=1200,H=1405,DY=30; // DY: room for the two-line subtitle; everything below the title shifts down by it
// ---------- seeded wobble ----------
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};const j=(a=1.6)=>(rnd()*2-1)*a;
const f=n=>Math.round(n*10)/10;
function roughRect(x,y,w,h,r=16,a=1.6){ // rounded rect with jittered corners and a bowed midpoint on each side
  const p=[[x+r,y],[x+w-r,y],[x+w,y+r],[x+w,y+h-r],[x+w-r,y+h],[x+r,y+h],[x,y+h-r],[x,y+r]].map(([px,py])=>[px+j(a),py+j(a)]);
  const c=[[x+w,y],[x+w,y+h],[x,y+h],[x,y]].map(([px,py])=>[px+j(a),py+j(a)]);
  const mid=(A,B)=>[(A[0]+B[0])/2+j(a*1.2),(A[1]+B[1])/2+j(a*1.2)];
  let d=`M${f(p[0][0])},${f(p[0][1])}`;
  for(let i=0;i<4;i++){const A=p[2*i],B=p[2*i+1],C=p[(2*i+2)%8],m=mid(A,B);
    d+=` Q${f(m[0])},${f(m[1])} ${f(B[0])},${f(B[1])} Q${f(c[i][0])},${f(c[i][1])} ${f(C[0])},${f(C[1])}`;}
  return d+'Z';}
const box=(x,y,w,h,{fill='#fff',stroke='#555',sw=2.5,r=16,dash=''}={})=>
  `<path d="${roughRect(x,y,w,h,r,0.6)}" fill="${fill}" stroke="none"/>`+
  `<path d="${roughRect(x,y,w,h,r)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"${dash?` stroke-dasharray="${dash}"`:''}/>`+
  `<path d="${roughRect(x+1,y+1,w-2,h-2,r)}" fill="none" stroke="${stroke}" stroke-width="${sw*0.45}" opacity=".5" stroke-linecap="round"/>`;
// arrow along points; the line is a gently bent curve through them, with a hand-drawn head
function arrow(pts,{color='#6b4f3a',sw=3,dash='',head=true,bend=6}={}){
  let d=`M${pts[0][0]},${pts[0][1]}`;
  for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i],dx=x1-x0,dy=y1-y0,L=Math.hypot(dx,dy)||1;
    const b=bend*(i%2?1:-1)*Math.min(1,L/120),mx=(x0+x1)/2-dy/L*b,my=(y0+y1)/2+dx/L*b;d+=` Q${f(mx)},${f(my)} ${x1},${y1}`;}
  let s=`<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${dash?` stroke-dasharray="${dash}"`:''}/>`;
  if(head){const [x1,y1]=pts.at(-1),[x0,y0]=pts.at(-2),t=Math.atan2(y1-y0,x1-x0),k=14;
    const a1=[x1-k*Math.cos(t-0.45),y1-k*Math.sin(t-0.45)],a2=[x1-k*Math.cos(t+0.45),y1-k*Math.sin(t+0.45)];
    s+=`<path d="M${f(a1[0])},${f(a1[1])} L${x1},${y1} L${f(a2[0])},${f(a2[1])}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;}
  return s;}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// text lines: [text, {size, weight, color}] ; "**x**" not supported, keep it simple
function text(x,y,lines,{size=18,lh=1.32,color='#3b2f2a',weight=400,anchor='start'}={}){
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">`+
    lines.map((l,i)=>{const o=typeof l==='string'?{t:l}:l;return `<tspan x="${x}" dy="${i?f(size*lh):0}"${o.w?` font-weight="${o.w}"`:''}${o.c?` fill="${o.c}"`:''}${o.s?` font-size="${o.s}"`:''}>${esc(o.t)}</tspan>`;}).join('')+`</text>`;}
const pill=(x,y,w,label,{fill='#fff',stroke='#999',color='#3b2f2a',size=17}={})=>box(x,y,w,34,{fill,stroke,sw:2,r:17})+text(x+w/2,y+23,[label],{size,color,anchor:'middle'});
const badge=(cx,cy,n,color)=>`<circle cx="${cx}" cy="${cy}" r="15" fill="${color}"/>`+text(cx,cy+6,[String(n)],{size:18,weight:700,color:'#fff',anchor:'middle'});
// ---------- icons (simple strokes, no emoji fonts needed) ----------
const I={
  sun:(x,y)=>`<g transform="translate(${x},${y})" stroke="#E8912D" stroke-width="3" stroke-linecap="round"><circle r="11" fill="#FFC94A"/>${[...Array(8)].map((_,i)=>{const t=i*Math.PI/4;return `<line x1="${f(16*Math.cos(t))}" y1="${f(16*Math.sin(t))}" x2="${f(22*Math.cos(t))}" y2="${f(22*Math.sin(t))}"/>`;}).join('')}</g>`,
  moon:(x,y)=>`<g transform="translate(${x},${y})"><path d="M6,-17 A18,18 0 1,0 17,8 A14,14 0 1,1 6,-17Z" fill="#FFE08A" stroke="#C9A43A" stroke-width="2.5"/><circle cx="20" cy="-14" r="2.2" fill="#FFE08A"/><circle cx="26" cy="-2" r="1.6" fill="#FFE08A"/></g>`,
  kid:(x,y)=>`<g transform="translate(${x},${y})" stroke="#6b4f3a" stroke-width="2.5" stroke-linecap="round"><circle r="20" fill="#FFD9B3"/><path d="M-19,-6 Q-14,-26 2,-21 Q16,-24 19,-6 Q10,-14 -2,-12 Q-12,-14 -19,-6Z" fill="#8a5a3b"/><circle cx="-7" cy="1" r="2" fill="#6b4f3a" stroke="none"/><circle cx="7" cy="1" r="2" fill="#6b4f3a" stroke="none"/><path d="M-7,9 Q0,15 7,9" fill="none"/></g>`,
  screen:(x,y)=>`<g transform="translate(${x},${y})" stroke="#6b4f3a" stroke-width="2.5" stroke-linejoin="round"><rect x="-24" y="-17" width="48" height="31" rx="5" fill="#CFE8FF"/><path d="M-30,18 L30,18" stroke-linecap="round"/><circle cx="-8" cy="-2" r="5" fill="#7BC67E" stroke="none"/><circle cx="8" cy="-2" r="5" fill="#F4A259" stroke="none"/><path d="M-3,-2 L3,-2" /></g>`,
  db:(x,y)=>`<g transform="translate(${x},${y})" stroke="#6b4f3a" stroke-width="2.5"><path d="M-20,-14 L-20,14 A20,7 0 0,0 20,14 L20,-14" fill="#FFE7C2"/><ellipse cx="0" cy="-14" rx="20" ry="7" fill="#FFF3DD"/><path d="M-20,0 A20,7 0 0,0 20,0" fill="none"/></g>`,
  bot:(x,y)=>`<g transform="translate(${x},${y})" stroke="#4a3f8f" stroke-width="2.5" stroke-linecap="round"><line x1="0" y1="-26" x2="0" y2="-17"/><circle cx="0" cy="-29" r="4" fill="#F4A259"/><rect x="-24" y="-17" width="48" height="36" rx="10" fill="#D9D4FF"/><circle cx="-9" cy="0" r="5" fill="#fff"/><circle cx="9" cy="0" r="5" fill="#fff"/><circle cx="-9" cy="0" r="2" fill="#4a3f8f" stroke="none"/><circle cx="9" cy="0" r="2" fill="#4a3f8f" stroke="none"/><path d="M-7,11 L7,11"/></g>`,
  parent:(x,y)=>`<g transform="translate(${x},${y})" stroke="#6b4f3a" stroke-width="2.5"><circle cx="-9" cy="-8" r="9" fill="#FFD9B3"/><path d="M-24,18 Q-9,-2 6,18Z" fill="#9CC5A1"/><circle cx="12" cy="-3" r="7" fill="#FFD9B3"/><path d="M1,18 Q12,4 23,18Z" fill="#F4A259"/></g>`,
  cloud:(x,y)=>`<g transform="translate(${x},${y})"><path d="M-22,10 Q-30,10 -30,1 Q-30,-8 -20,-8 Q-18,-20 -5,-19 Q5,-27 15,-17 Q28,-17 27,-4 Q34,0 30,8 Q27,12 20,10Z" fill="#FFD1A6" stroke="#D9772B" stroke-width="2.5" stroke-linejoin="round"/></g>`,
  server:(x,y)=>`<g transform="translate(${x},${y})" stroke="#4d7a52" stroke-width="2.5"><rect x="-20" y="-20" width="40" height="17" rx="4" fill="#CDEBCF"/><rect x="-20" y="2" width="40" height="17" rx="4" fill="#CDEBCF"/><circle cx="-11" cy="-11" r="2.5" fill="#4d7a52"/><circle cx="-11" cy="11" r="2.5" fill="#4d7a52"/></g>`,
  boxes:(x,y)=>`<g transform="translate(${x},${y})" stroke="#2f6f9a" stroke-width="2.5" fill="#CFE8FF"><rect x="-26" y="0" width="16" height="14" rx="2"/><rect x="-8" y="0" width="16" height="14" rx="2"/><rect x="10" y="0" width="16" height="14" rx="2"/><rect x="-17" y="-16" width="16" height="14" rx="2"/><rect x="1" y="-16" width="16" height="14" rx="2"/></g>`,
  shield:(x,y)=>`<g transform="translate(${x},${y})"><path d="M0,-20 L17,-13 Q17,10 0,20 Q-17,10 -17,-13Z" fill="#B8E0BA" stroke="#4d7a52" stroke-width="2.5" stroke-linejoin="round"/><path d="M-7,0 L-2,6 L8,-6" fill="none" stroke="#4d7a52" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  doc:(x,y)=>`<g transform="translate(${x},${y})" stroke="#6b4f3a" stroke-width="2.5" stroke-linejoin="round"><path d="M-14,-18 L6,-18 L14,-10 L14,18 L-14,18Z" fill="#fff"/><path d="M-8,-6 L8,-6 M-8,2 L8,2 M-8,10 L3,10" stroke-linecap="round"/></g>`,
};
// ---------- palette ----------
const C={ink:'#3b2f2a',dayBg:'#FFF6DE',dayLine:'#E8A33D',nightBg:'#ECE9FB',nightLine:'#7B6FD6',night:'#4a3f8f',brown:'#6b4f3a',
  green:'#4d7a52',greenBg:'#E7F4E8',blueBg:'#E6F2FF',orange:'#D9772B'};
const S=[];const add=s=>S.push(s);
// ---------- title ----------
add(text(W/2,52,['How Jane works'],{size:40,weight:700,anchor:'middle'}));
add(text(W/2,88,['Agent-Orchestrated Software (AOS): your own agent runs Jane from outside the app.'],{size:22,weight:700,anchor:'middle',color:C.night}));
add(text(W/2,118,['The app teaches by day. Your agent plans by night. No AI runs while your kid plays.'],{size:20,anchor:'middle',color:C.brown}));
const TITLE=S.length;
// ---------- daytime panel ----------
add(box(20,112,1160,330,{fill:C.dayBg,stroke:C.dayLine,sw:3,r:26}));
add(I.sun(56,148));add(text(88,157,['Daytime: learning'],{size:28,weight:700,color:'#B5651D'}));
add(pill(345,132,380,'No AI here: fast, predictable, private',{fill:'#fff',stroke:C.dayLine,color:'#B5651D'}));
// child
add(box(45,190,215,225,{fill:'#fff',stroke:C.dayLine}));add(I.kid(152,232));
add(text(152,290,[{t:'Your kid plays',w:700},'in a browser','(phone, tablet','or laptop)'],{size:19,anchor:'middle'}));
// app
add(box(335,190,440,225,{fill:'#fff',stroke:C.dayLine}));add(I.screen(378,226));
add(text(415,222,[{t:'The Jane app',w:700,s:22}],{size:22}));add(text(415,246,['static UI + engine'],{size:17,color:C.brown}));
add(text(355,282,['• Marble skill graph: 1,590 topics','• placement and inference','• spaced review (1→3→7→21→60 days)','  and review gates in quests','• grading, "I\'m stuck" help, earned medals'],{size:18,lh:1.3}));
// store
add(box(860,190,295,225,{fill:'#fff',stroke:C.dayLine}));add(I.db(900,228));
add(text(932,228,[{t:'Progress store',w:700,s:22}],{size:22}));
add(text(880,268,['progress  (the one record)','log:DATE  (answers)','lessons:DATE  (quest packs)'],{size:18,lh:1.35}));
add(text(880,360,['KV or JSON files, inside','YOUR deployment only'],{size:16,color:C.green,lh:1.3}));
// day arrows
add(arrow([[262,265],[331,265]],{color:C.brown}));add(text(296,256,['answers'],{size:15,anchor:'middle',color:C.brown}));
add(arrow([[331,330],[262,330]],{color:C.brown}));add(text(296,352,['next item'],{size:15,anchor:'middle',color:C.brown}));
add(arrow([[777,280],[856,280]],{color:C.brown}));add(text(816,270,['saves'],{size:15,anchor:'middle',color:C.brown}));
add(arrow([[856,345],[777,345]],{color:C.brown}));add(text(816,368,['today\'s quest'],{size:15,anchor:'middle',color:C.brown}));
// ---------- nighttime panel ----------
add(box(20,478,1160,400,{fill:C.nightBg,stroke:C.nightLine,sw:3,r:26}));
add(I.moon(56,512));add(text(88,522,['Nighttime: teaching  (about 1 AM)'],{size:28,weight:700,color:C.night}));
add(pill(530,497,250,'AI works offline, ahead of time',{fill:'#fff',stroke:C.nightLine,color:C.night,size:16}));
// bot
add(box(45,560,250,270,{fill:'#fff',stroke:C.nightLine}));add(I.bot(170,606));
add(text(170,660,[{t:'Your Grok Bot',w:700,s:21},'(or any agent that can','run Node scripts on a','schedule)'],{size:17,anchor:'middle'}));
add(text(60,754,['• own computer, nightly routine','• remembers your kid + rules','• may host Jane, or not'],{size:16,lh:1.3,color:C.night}));
// steps: row 1 L→R (1,2,3), row 2 R→L (4,5,6)
const SX=[335,598,861],SW=240;
const step=(n,x,y,h,title,lines)=>{add(box(x,y,SW,h,{fill:'#fff',stroke:C.nightLine,sw:2.2,r:14}));add(badge(x+22,y+24,n,C.nightLine));
  add(text(x+44,y+31,[{t:title,w:700}],{size:19}));add(text(x+14,y+58,lines,{size:16,lh:1.28,color:C.ink}));};
step(1,SX[0],560,118,'Back up',['backup-progress.mjs','saves a copy + sha256','of the progress record']);
step(2,SX[1],560,118,'Export (read-only)',['export-progress.mjs: answers,','weak spots, frontier,','reviews due, coverage']);
step(3,SX[2],560,118,'Think + write',['the next quest per LESSONS.md','(or refresh the stages your','kid hasn\'t reached yet)']);
step(4,SX[2],708,134,'Validate',['publish-lessons.mjs: teach first,','≤ 16 graded, boss tests only','what was taught, 1 active quest,','finished quests stay locked']);
step(5,SX[1],708,134,'Publish',['the content pack goes','to lessons:DATE','(a bad pack: nothing','is written)']);
step(6,SX[0],708,134,'Verify',['back up again: the','progress sha256 must','be unchanged']);
add(arrow([[577,619],[594,619]],{color:C.night,sw:2.5,bend:0}));add(arrow([[840,619],[857,619]],{color:C.night,sw:2.5,bend:0}));
add(arrow([[981,680],[981,704]],{color:C.night,sw:2.5,bend:0}));
add(arrow([[857,770],[840,770]],{color:C.night,sw:2.5,bend:0}));add(arrow([[594,770],[577,770]],{color:C.night,sw:2.5,bend:0}));
add(arrow([[297,690],[331,690]],{color:C.night,sw:2.5,bend:0}));
// store ↔ night: export down, publish back up (outside lane on the right)
add(arrow([[905,418],[760,556]],{color:C.night,sw:3,dash:'2 8',bend:10}));add(text(810,470,['read'],{size:16,color:C.night}));
add(arrow([[718,844],[718,860],[1130,860],[1130,418]],{color:C.night,sw:3,bend:0}));
add(text(1122,470,['new quest'],{size:16,color:C.night,anchor:'end'}));
// ---------- deploy strip ----------
add(text(40,926,[{t:'Deploy it your way: on the bot\'s computer or anywhere you choose',w:700}],{size:24}));
add(text(1170,926,['same app everywhere'],{size:17,color:C.brown,anchor:'end'}));
const dcard=(x,icon,title,lines,stroke,fill)=>{add(box(x,945,265,150,{fill,stroke,sw:2.4}));add(icon(x+38,985));
  add(text(x+72,980,[{t:title,w:700}],{size:19}));add(text(x+16,1028,lines,{size:16,lh:1.3}));};
dcard(30,I.cloud,'Cloudflare Worker',['+ Workers KV  (./deploy.sh)','free tier, reachable','from anywhere'],C.orange,'#FFF1E3');
dcard(315,I.server,'Node server',['npm start, JSON files','in DATA_DIR on your','own computer'],C.green,C.greenBg);
dcard(600,I.boxes,'Docker / compose',['docker compose up -d','data in a volume,','restarts on boot'],'#2f6f9a',C.blueBg);
add(box(885,945,285,150,{fill:'#FFF6DE',stroke:C.dayLine,sw:2.4}));add(I.parent(925,985));
add(text(960,980,[{t:'You, the parent',w:700}],{size:19}));
add(text(901,1028,['open /parent: a calm, read-only','report. The bot sends a short note','only when something matters.'],{size:16,lh:1.3}));
// ---------- sharing strip ----------
add(text(40,1142,[{t:'Share it',w:700}],{size:24}));
add(text(150,1142,['Another family gets their own copy:'],{size:18,color:C.brown}));
const scard=(x,w,icon,lines)=>{add(box(x,1160,w,80,{fill:'#fff',stroke:'#B89A7A',sw:2.2,r:14}));add(icon(x+34,1200));add(text(x+68,1192,lines,{size:17,lh:1.3}));};
scard(30,280,I.parent,[{t:'A parent imports the',w:400},'Jane bot template']);
scard(355,280,I.bot,['Their bot reads','BOT-SETUP.md']);
scard(680,280,I.screen,['It installs and runs','their own Jane']);
add(arrow([[312,1200],[351,1200]],{color:C.brown,bend:0}));add(arrow([[637,1200],[676,1200]],{color:C.brown,bend:0}));
add(I.shield(1002,1200));add(text(1030,1180,['Kid data stays','in each home,','never in the repo'],{size:16,color:C.green,lh:1.25}));
// ---------- why ----------
add(text(40,1286,[{t:'Why this way?',w:700}],{size:24}));
const why=[['Cheap: no per-question AI',282],['Private',100],['Works offline*',160],['Predictable for kids',205],['Smarter bot, same app',225]];
let wx=40;for(const [t,w] of why){add(pill(wx,1308,w,t,{fill:'#fff',stroke:C.dayLine,color:C.ink,size:16}));wx+=w+12;}
add(text(40,1362,['* Play never calls an AI or outside service. Node and Docker run on your home network with no API key or cloud account, and Jane keeps working if the bot skips a night.'],{size:14,color:C.brown}));
// ---------- font ----------
let fontCss='';const KD=process.env.KALAM_DIR;
if(KD){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kalam-'));const chars=[...new Set(S.join('').replace(/<[^>]*>/g,'')+' &;')].join('');
  fs.writeFileSync(path.join(tmp,'chars.txt'),chars);
  for(const [file,weight] of [['Kalam-Regular.ttf',400],['Kalam-Bold.ttf',700]]){const out=path.join(tmp,`${weight}.woff`);
    execFileSync('pyftsubset',[path.join(KD,file),`--text-file=${path.join(tmp,'chars.txt')}`,'--flavor=woff','--with-zopfli',`--output-file=${out}`].filter(a=>a!=='--with-zopfli'||process.env.ZOPFLI));
    fontCss+=`@font-face{font-family:"Kalam";font-weight:${weight};src:url(data:font/woff;base64,${fs.readFileSync(out).toString('base64')}) format("woff");}`;}
  fs.rmSync(tmp,{recursive:true});}
else console.warn('KALAM_DIR not set: the SVG uses the Kalam font only if the viewer has it installed.');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">How Jane works</title>
<desc id="d">Agent-Orchestrated Software (AOS): the parent's own agent runs Jane from outside the app. Daytime: the child plays in a browser; the Jane app (static UI plus an engine on the Marble skill graph) grades answers and saves progress to the progress store. No AI runs here. Nighttime, about 1 AM: the parent's bot (which may host Jane, or not) backs up, exports progress, writes the next quest per LESSONS.md, validates it with publish-lessons.mjs, publishes the content pack and verifies progress is unchanged. The same app deploys on the bot's computer or anywhere the parent chooses: Cloudflare Workers + KV, a Node server with JSON files, or Docker. Another family imports the bot template, their bot reads BOT-SETUP.md and installs their own copy; child data stays in each home.</desc>
<style>${fontCss}text{font-family:"Kalam","Comic Neue","Comic Sans MS","Chalkboard SE",cursive,sans-serif}</style>
<rect width="${W}" height="${H}" fill="#FFFCF5"/>
${S.slice(0,TITLE).join('\n')}
<g transform="translate(0,${DY})">
${S.slice(TITLE).join('\n')}
</g>
</svg>
`;
fs.writeFileSync(OUT,svg);console.log(`wrote ${path.relative(process.cwd(),OUT)} (${Math.round(svg.length/1024)} KB)`);
