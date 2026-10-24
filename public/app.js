const $=id=>document.getElementById(id);let st,TAX,timerInt;
const api=(p,b)=>fetch(p,{method:b?'POST':'GET',headers:{'content-type':'application/json'},body:b&&JSON.stringify(b)}).then(r=>r.json());
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// ---------- visuals ----------
function pizza(n,eaten){const cx=100,cy=100,r=90;let s=`<svg viewBox="0 0 200 200" role="img" aria-label="pizza with ${n} slices, ${eaten} eaten">`;
 for(let i=0;i<n;i++){const a1=2*Math.PI*i/n-Math.PI/2,a2=2*Math.PI*(i+1)/n-Math.PI/2,x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2),gone=i<eaten;
  s+=`<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} Z" fill="${gone?'#f5f5f5':'#ffca28'}" stroke="${gone?'#ccc':'#e65100'}" stroke-width="4" ${gone?'stroke-dasharray="6 5"':''}/>`;
  if(!gone){const m=(a1+a2)/2;for(const k of[.45,.75])s+=`<circle cx="${cx+r*k*Math.cos(m+(k>.6?.12:-.08))}" cy="${cy+r*k*Math.sin(m+(k>.6?.12:-.08))}" r="${Math.min(9,40/n+4)}" fill="#d32f2f"/>`;}}
 return s+`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#bf6c00" stroke-width="8"/></svg>`;}
function bar(n,sh){const w=190/n;let s='<svg viewBox="0 0 200 60">';for(let i=0;i<n;i++)s+=`<rect x="${5+i*w}" y="10" width="${w}" height="40" fill="${i<sh?'#8d6e63':'#ffccbc'}" stroke="#4e342e" stroke-width="2" rx="3"/>`;return s+'</svg>';}
const FRAMES={gate:'🗝️ Review Gate',card:'💡 Cool Card',explore:'🔍 Explorer Check',review:'🧠 Memory Check-in',boss:'👾 BOSS BATTLE',timed:'⏱️ Speed Round',mystery:'🕵️ Mystery',story:'📖 Story Quest',minigame:'🎲 Mini-game',quest:'🗡️ Quest',bonus:'⭐ Bonus',guided:'🧭 Practice',prove:'🎟️ Prove It! One harder question'};
const BOSSES=['🐉','👾','🦖','🐙','🤖','🧌'];
function say(t){const b=$('jane');b.innerHTML=gl(t);b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');}
function confetti(n=40){for(let i=0;i<n;i++){const e=document.createElement('div');e.className='confetti';e.textContent=['🎉','⭐','🍕','✨','🎈','💜'][i%6];e.style.left=Math.random()*100+'vw';e.style.animationDuration=1.5+Math.random()*2+'s';document.body.appendChild(e);setTimeout(()=>e.remove(),4000);}}
function banner(t){const b=document.createElement('div');b.className='banner';b.innerHTML=`<div>${t}</div>`;document.body.appendChild(b);setTimeout(()=>b.remove(),2000);}
function chips(s){const W=s.wallet;$('pts').textContent='⭐ '+(W?W.balance:s.points)+' pts';$('pts').title=W?`${W.balance} to spend in the Market (earned ${W.earned}, spent ${W.spent})`:'';{const f=W?.looks?.avatar?.face,me=$('me');if(me){me.hidden=!f;me.textContent=f||'';}}$('stars').textContent='🌟 '+s.stars;$('streak').textContent='🔥 '+s.streak+(W?.shield?' 🛡️':'');$('streak').title=W?.shield?`${W.shield} streak shield${W.shield>1?'s':''} ready`:'';{const D=s.days,el=$('days');if(el){el.hidden=!D?.n;el.textContent=`📅 ${D?.n||0}${D?.atRisk?' 🧊':''}`;el.title=D?.n?`${D.n} day${D.n>1?'s':''} in a row (best ${D.best})${D.freeze?` · ${D.freeze} freeze${D.freeze>1?'s':''} saved`:''}${D.atRisk?' · a freeze will save it when you play today':''}`:'';}}$('pct').textContent=`🗺️ ${s.progress.pct}%`;
 // worn theme paints the whole app (not only the Map sea); stickers show in a header chip with a one-time tip
 const tid=W?.equipped?.theme||'';document.body.classList.remove('theme-night','theme-sunset','theme-lava');if(tid)document.body.classList.add(tid);
 const sts=[...(W?.stickers||[])];if(W?.owned?.['test-sticker']&&!sts.some(x=>x.id==='test-sticker'))sts.push({id:'test-sticker',emoji:'🌟',title:'Gold star sticker'});
 const sk=$('stickers');if(sk){sk.hidden=!sts.length;sk.textContent=sts.map(x=>x.emoji||'🌟').join('')+(sts.length>1?'':'');sk.title=sts.length?('Your stickers: '+sts.map(x=>x.title||'sticker').join(', ')):'';
  if(sts.length&&!localStorage.getItem('jane-sticker-tip')){localStorage.setItem('jane-sticker-tip','1');say('🌟 Your gold star sticker lives up here next to your stars — tap the chip anytime to see your collection!');}}
 campaignHUD(s);}
let LN='Explorer';function setLearner(L){if(!L?.name||L.name===LN&&document.title.includes(LN))return;LN=L.name;document.querySelectorAll('.lname').forEach(e=>e.textContent=LN);document.title=`${LN}'s Learning Adventure with Jane`;}
// boss hearts: ❤️ = hits the boss still needs in THIS fight (server bossHP: today's first-try boss run on this topic), 🖤 = hits landed
function bossHTML(b,topicId){if(!b)return'';const BL=st?.wallet?.looks?.boss,BS=BL?.set?.length?BL.set:BOSSES;const max=Math.max(1,b.max|0),hp=Math.max(0,Math.min(max,b.hp|0));
 const msg=hp?`Hit it ${hp} more time${hp>1?'s':''} in a row!`:'Boss defeated! 💥';
 return`<div class="hp${BL?.frame?' bskin-'+esc(BL.frame):''}" aria-label="Boss: ${hp} of ${max} hearts left"><span class="boss">${BS[String(topicId||'').charCodeAt(4)%BS.length||0]}</span>${'❤️'.repeat(hp)}${'🖤'.repeat(max-hp)}<span class="small">${msg}</span></div>`;}
function bossBar(p){$('bossbar').innerHTML=p?.boss?bossHTML(p.boss,p.topicId):'';}
function render(s){st=s;if(s?.learner)setLearner(s.learner);chips(s);const p=s.item;clearInterval(timerInt);$('timer').innerHTML='';if(!p)return;
 const f=p.format||'quest';$('frame').className='framebar f-'+f;$('frame').textContent=p.gate?(p.gate.warm?`🔥 Warm-up! A quick one you learned before (${p.gate.n}/${p.gate.of})`:p.gate.spot?`🗝️ Gate! Quick check: show me you know this one (${p.gate.n}/${p.gate.of})`:`🗝️ Gate! Unlock it with something you learned before (${p.gate.n}/${p.gate.of})`):FRAMES[f]||'🗡️ Quest';$('pcard').className='card '+f;
 $('topic').textContent=`${ISL[p.topic.subject]?.e||'📚'} ${p.topic.name}${p.level?` · Lv ${p.level}`:''}`;
 PACKT=s.terms||{};glReset();if(p.blank)$('q').innerHTML=gl(p.q).replace(/_{2,}/,'<span class="blank" id="blankslot">❓</span>');else $('q').innerHTML=p.type==='card'?'':gl(p.q);$('ev').innerHTML='';
 $('vis').innerHTML=(p.vis?(p.vis.type==='pizza'?pizza(p.vis.slices,p.vis.eaten):bar(p.vis.parts,p.vis.shaded)):'')+(p.scene?sceneHTML(p.scene):'')+(p.tpl?tplHTML(p.tpl):'');
 questStrip(s,p);
 bossBar(p);
 if(p.intro){$('intro').hidden=false;$('intro').innerHTML=`<h3>${esc(p.intro.emoji||'✨')} ${gl(p.intro.title||'',new Set())}</h3><div>${gl(p.intro.story||'',new Set())}</div>`;}else $('intro').hidden=true;
 medalRow(s);
 $('steps').innerHTML=p.steps?.length?`<div class="steps"><b>🧭 Start like this:</b><ol>${p.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`:'';
 const canStuck=p.type!=='card'&&p.type!=='self';$('stuckf').hidden=!canStuck;
 const nWh=s.wallet?.hintTokens|0,hasWh=!!p.whisper;const whBtn=canStuck&&p.stage!=='bonus'&&(nWh||hasWh)?`<button type="button" class="whisperb" onclick="whisperTap()" ${hasWh?'disabled':''}>💡 ${hasWh?'Whisper used':`Jane whisper (${nWh})`}</button>`:'';
 $('srow').innerHTML=(canStuck&&p.type!=='input'?'<button type="button" class="stuckb" onclick="stuckTap()">I\'m stuck 🤔</button>':'')+(p.gate&&!p.gate.spot?'<button type="button" class="ghost provelink" onclick="openProve()">🎟️ Prove-It tickets</button>':'')+whBtn;showHelp(p.help);if(p.whisper)showWhisper(p.whisper);
 $('extra').innerHTML=p.stage==='bonus'?'<button class="ghost" onclick="skip()">Skip bonus ➡</button>':'';$('mc').innerHTML='';
 if(INTER[p.type]){$('f').style.display='none';INTER[p.type](p);}
 else if(p.type==='mc'||p.type==='self'){$('f').style.display='none';const ch=p.type==='self'?[['yes',p.choices[0]],['kinda',p.choices[1]],['no',p.choices[2]]]:p.choices.map(c=>[c,c]);
  $('mc').innerHTML=ch.map(([v,l])=>`<button data-v="${esc(v)}">${esc(l)}</button>`).join('');$('mc').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(p.blank&&$('blankslot')){$('blankslot').textContent=b.dataset.v;$('blankslot').classList.add('filled');setTimeout(()=>send(b.dataset.v),450);}else send(b.dataset.v);});}
 else{$('f').style.display='flex';$('a').value='';$('a').placeholder=p.creative?(p.placeholder||'Your idea!'):p.vis?.type==='pizza'||/fraction/i.test(p.topic.domain)?'Your answer (like 3/8)':'Your answer';setTimeout(()=>$('a').focus(),50);}
 if(p.timed){const end=Date.now()+p.timed*1000;$('timer').innerHTML='<div class="tbar"><i id="tb"></i></div><div class="small" id="tl"></div>';
  timerInt=setInterval(()=>{const left=Math.max(0,end-Date.now());$('tb').style.transform=`scaleX(${left/(p.timed*1000)})`;$('tl').textContent=left?`⚡ ${Math.ceil(left/1000)}s for a speed bonus!`:'Time\'s up for the bonus — but keep going, you can still get it!';if(!left)clearInterval(timerInt);},200);}}
async function send(v){if(!v||$('pcard').classList.contains('busy'))return;$('pcard').classList.add('busy');let r;try{r=await api('/api/answer',{answer:v});}catch(e){$('pcard').classList.remove('busy');say('Oops, the internet hiccuped. Try again! 🔌');return;}$('pcard').classList.remove('busy');say(r.jane);
 if(r.stuck){if(r.state)st=r.state;showHelp(r.stuck);return;}
 if(r.questDone)setTimeout(()=>questMedal(r.questDone),r.medal?2600:300);
 if(r.shielded)setTimeout(()=>banner(`🛡️ Shield up!<br><small>Your 🔥 ${r.shielded} streak is safe</small>`),300);
 if(r.proveIt?.passed)setTimeout(()=>banner(`🎟️ Proved it!<br><small>${esc(r.proveIt.topic||'')} +${r.proveIt.bonus} bonus</small>`),r.medal?2600:500);
 if(r.miniDone&&!r.reveal){chips(r.state);return miniEnd(r);}
 if(r.correct){const big=!!(r.mastered||r.levelUp||r.medal);if(!(window.FX&&FX.good($('pcard'),big)))confetti(big?80:30);if(r.medal)reveal(r.medal,r.inferred);else if(r.mastered)banner(`🏆 Mastered!<br><small>${esc(r.mastered)}</small>${r.inferred?`<br><small>+${r.inferred} skills lit up on your map!</small>`:''}`);else if(r.levelUp)banner('⬆ Level '+r.levelUp+'!');}
 else if(r.formNudge){/* right value, wrong form: a gentle nudge, no shake */}
 else if(window.FX&&!FX.reduced()){FX.bad($('pcard'));}else{$('pcard').classList.remove('shake');void $('pcard').offsetWidth;$('pcard').classList.add('shake');}
 if(r.boss){if(st?.item)st.item.boss=r.boss;$('bossbar').innerHTML=bossHTML(r.boss,st?.item?.topicId);$('bossbar').querySelector('.boss')?.classList.add('shake');}
 if(r.askChoice){chips(r.state);return ask(r.jane);}
 if(r.reveal){$('f').style.display='none';$('mc').innerHTML='';$('extra').innerHTML=`<p style="font-size:1.3rem">✅ Answer: <b>${esc(String(r.reveal).replace(/\|/g,' → '))}</b></p><button onclick="next()">Next ➡</button>`;window._next=r.state;window._mini=r.miniDone?r:null;chips(r.state);return;}
 if(r.retry){if(st.item.type==='input')$('a').select();else if(INTER[st.item.type])setTimeout(()=>render(st),900);return;}
 render(r.state);}
function ask(prev){$('f').style.display='none';$('mc').innerHTML='';$('extra').innerHTML='<div class="choices">'+[['harder','🚀 Harder!'],['same','👍 Keep going'],['easier','🐢 Easier'],['different','🎨 New subject'],['fractions','🍕 Fractions']].map(([c,l])=>`<button onclick="choose('${c}')">${l}</button>`).join('')+'</div>';
 say(prev+` Hey ${LN}, what would you like to do next?`);}
async function choose(c){const r=await api('/api/choice',{choice:c});say(r.jane);render(r.state);}
async function skip(){render(await api('/api/skipbonus',{}));say('No problem! Here\'s a new one. 😊');}
// ---------- "I'm stuck 🤔": hint → worked example → skip for now (never costs a heart, a point or the boss) ----------
async function stuckTap(){if($('pcard').classList.contains('busy'))return;$('pcard').classList.add('busy');let r;try{r=await api('/api/stuck',{});}finally{$('pcard').classList.remove('busy');}
 if(!r||r.error)return;say(r.jane);if(r.state)st=r.state;showHelp(r.stuck);}
async function skipNow(){if($('pcard').classList.contains('busy'))return;$('pcard').classList.add('busy');let r;try{r=await api('/api/skip',{});}finally{$('pcard').classList.remove('busy');}
 if(!r||r.error)return;say(r.jane);if(r.questDone)setTimeout(()=>questMedal(r.questDone),300);if(r.miniDone){chips(r.state);return miniEnd(r);}render(r.state);}
function tryAgain(){if(st?.item?.type==='input'){$('a').focus();$('a').select();}else $('mc').scrollIntoView({behavior:'smooth',block:'center'});}
function showHelp(h){const el=$('help');if(!h){el.hidden=true;el.innerHTML='';return;}el.hidden=false;const li=a=>(a||[]).map(x=>`<li>${esc(x)}</li>`).join('');
 el.innerHTML=h.step<2?`<div class="help"><div class="hl">💡 Hint</div><p>${gl(h.hint,new Set())}</p><div class="hb"><button type="button" class="ghost" onclick="tryAgain()">✏️ I'll try</button><button type="button" class="stuckb" onclick="stuckTap()">Still stuck 🤔</button></div></div>`
  :`<div class="help"><div class="hl">💡 Hint</div><p>${gl(h.hint,new Set())}</p>${h.example?`<div class="hl">👀 Watch me do one</div><div class="ex"><b>${esc(h.example.title)}</b><ol>${li(h.example.steps)}</ol></div>`:''}${h.start?.length?`<div class="hl">🚀 Your turn! Start like this:</div><ol class="start">${li(h.start)}</ol>`:''}
  <div class="hb"><button type="button" onclick="tryAgain()">✏️ I'll try!</button><button type="button" class="skipb" onclick="skipNow()">⏭️ Skip for now</button></div><div class="small">Skipping is OK! No hearts lost. We'll come back to it later.</div></div>`;
 if(window.FX)FX.enter(el);}
$('stuckf').onclick=()=>stuckTap();
async function next(){if(window._mini){const m=window._mini;window._mini=null;return miniEnd(m);}render(window._next||await api('/api/next',{}));window._next=null;}
$('f').onsubmit=e=>{e.preventDefault();send($('a').value.trim());};
// ---------- world map ----------
const ISL={Science:{x:290,y:540,r:250,e:'🔬',c:'#66bb6a'},Mathematics:{x:950,y:340,r:240,e:'🔢',c:'#42a5f5'},English:{x:1280,y:740,r:180,e:'📚',c:'#ab47bc'},History:{x:680,y:860,r:105,e:'🏛️',c:'#8d6e63'},
 'Personal & Social Development':{x:690,y:625,r:100,e:'💛',c:'#ec407a',s:'Heart Isle'},'Life Skills':{x:1370,y:300,r:70,e:'💰',c:'#ffa726'},Computing:{x:1000,y:690,r:70,e:'🤖',c:'#26c6da'},'Learning to Learn':{x:1000,y:900,r:70,e:'🧠',c:'#7e57c2'},
 Geography:{x:560,y:140,r:70,e:'🧭',c:'#26a69a'}};
// a subject the taxonomy adds later must never blank the whole Map: give it a spare islet instead of crashing doLayout
const SPARE=[[1480,470],[160,140],[160,960],[1500,1000],[1380,90]];
function ensureIslands(){let k=0;for(const t of TAX.topics){if(ISL[t.subject])continue;const [x,y]=SPARE[k%SPARE.length];k++;ISL[t.subject]={x,y,r:60,e:'🏝️',c:'#78909c'};}}
const COL={m:'#ffc400',v:'#ff6d00',r:'#00e676',l:'#2979ff',x:'#b0bec5'},SN={m:'Mastered ⭐',v:'Review due 🧠',r:'Ready to explore 🟢',l:'Learning 🔵',x:'Still to go 🔒'};
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296;};
let layout=null,mapData=null,zoomed=null;
async function loadMap(){if(!TAX)TAX=await (await fetch('/tax.json')).json();if(!layout){ensureIslands();layout=doLayout();TAX.idx=Object.fromEntries(TAX.topics.map((t,i)=>[t.id,i]));}
 mapData=await api('/api/map');try{drawMap();}catch(e){console.error(e);$('world').innerHTML='<p class="small">Oops, the map got lost in the fog. Try again in a moment! 🧭</p>';}drawBars();}
function blob(cx,cy,r,seed,n=48,amp=1){let d='';const P=[];for(let i=0;i<n;i++){const a=i/n*2*Math.PI,k=1+amp*(.07*Math.sin(a*3+seed*9)+.05*Math.sin(a*5+seed*4)+.025*Math.sin(a*11+seed*17));P.push([cx+r*k*Math.cos(a),cy+r*k*Math.sin(a)]);}
 // smooth closed curve through points (Catmull-Rom → cubic Bézier)
 for(let i=0;i<n;i++){const p0=P[(i-1+n)%n],p1=P[i],p2=P[(i+1)%n],p3=P[(i+2)%n];if(!i)d+=`M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
  d+=`C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)},${(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)},${(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;}return d+'Z';}
// nodes sit along winding trails: one trail per domain, from the island's heart outward (younger skills near the centre)
function doLayout(){const pos={},doms={},trails={};const bySub={};TAX.topics.forEach((t,i)=>(bySub[t.subject]??=[]).push(i));
 for(const [sub,idx] of Object.entries(bySub)){const I=ISL[sub];const dm=[...new Set(idx.map(i=>TAX.topics[i].domain))].sort();doms[sub]=[];trails[sub]=[];
  dm.forEach((d,k)=>{const a0=k/dm.length*2*Math.PI,a1=(k+1)/dm.length*2*Math.PI,am=(a0+a1)/2,w=(a1-a0);doms[sub].push({d,a:am});
   const ti=idx.filter(i=>TAX.topics[i].domain===d).sort((x,y)=>TAX.topics[x].ageRangeStart-TAX.topics[y].ageRangeStart||hash(TAX.topics[x].id)-hash(TAX.topics[y].id));
   const n=ti.length,lanes=n>40?3:n>12?2:1,ph=hash(d)*6;
   const at=(f,lane)=>{const rr=I.r*(.34+.6*f),a=am+Math.sin(f*7+ph)*w*.16+(lanes>1?(lane-(lanes-1)/2)*w*.26*(.4+f):0);return[I.x+rr*Math.cos(a),I.y+rr*Math.sin(a)];};
   for(let l=0;l<lanes;l++){let p='';for(let s=0;s<=24;s++){const [x,y]=at(s/24,l);p+=(s?'L':'M')+x.toFixed(1)+','+y.toFixed(1);}trails[sub].push(p);}
   ti.forEach((i,j)=>{const f=n>1?j/(n-1):.5;pos[i]=at(f,j%lanes);});});}
 return{pos,doms,trails};}
// ---------- landmarks (drawn at island heart, size s) ----------
function landmark(sub,x,y,s){const g=(b)=>`<g transform="translate(${x},${y}) scale(${(s/100).toFixed(3)})" class="lm">${b}</g>`;
 const sh='<ellipse cx="0" cy="44" rx="46" ry="10" fill="#0003"/>';
 switch(sub){
 case 'Mathematics':return g(sh+`<rect x="-40" y="0" width="80" height="44" fill="#90a4ae" stroke="#455a64" stroke-width="3"/><rect x="-22" y="-46" width="44" height="90" fill="#b0bec5" stroke="#455a64" stroke-width="3"/>
  ${[-40,-26,-12,2,16,26].map(a=>`<rect x="${a}" y="-6" width="10" height="8" fill="#b0bec5" stroke="#455a64" stroke-width="2"/>`).join('')}${[-22,-8,6].map(a=>`<rect x="${a+2}" y="-56" width="10" height="10" fill="#b0bec5" stroke="#455a64" stroke-width="2"/>`).join('')}
  <path d="M-10 44 v-20 a10 10 0 0 1 20 0 v20Z" fill="#5d4037"/><text x="0" y="-14" font-size="20" font-weight="800" text-anchor="middle" fill="#1565c0">123</text>
  <line x1="0" y1="-56" x2="0" y2="-92" stroke="#455a64" stroke-width="3"/><path class="flag" d="M0 -92 L28 -84 L0 -76Z" fill="#ffca28"/><text x="11" y="-80" font-size="10" font-weight="800" fill="#1565c0">π</text>`);
 case 'Science':return g(sh+`<path d="M-55 44 L-14 -30 Q0 -40 14 -30 L55 44Z" fill="#8d6e63" stroke="#4e342e" stroke-width="3"/><path d="M-14 -30 Q0 -40 14 -30 L8 -16 Q2 -8 -2 -18 Q-8 -8 -12 -20Z" fill="#ff7043"/>
  <path d="M-6 -22 Q-20 10 -30 30 M6 -22 Q14 6 26 32" stroke="#ff5722" stroke-width="5" fill="none" stroke-linecap="round"/>
  <g class="smoke"><circle cx="0" cy="-50" r="11" fill="#eceff1cc"/><circle cx="12" cy="-66" r="14" fill="#eceff1aa"/><circle cx="-4" cy="-86" r="17" fill="#eceff188"/></g>
  <g transform="translate(46,26)"><rect x="-14" y="0" width="28" height="18" fill="#eceff1" stroke="#455a64" stroke-width="2"/><path d="M-14 0 a14 14 0 0 1 28 0Z" fill="#cfd8dc" stroke="#455a64" stroke-width="2"/><line x1="0" y1="-6" x2="16" y2="-20" stroke="#455a64" stroke-width="5"/></g>`);
 case 'English':return g(sh+[['#ef5350',-44,90],['#42a5f5',-38,78],['#66bb6a',-32,68],['#ffca28',-26,56],['#ab47bc',-20,44]].map(([c,x0,w],k)=>`<rect x="${-w/2}" y="${30-k*16}" width="${w}" height="15" rx="3" fill="${c}" stroke="#4a148c" stroke-width="2.5"/><line x1="${-w/2+6}" y1="${37-k*16}" x2="${w/2-6}" y2="${37-k*16}" stroke="#fff8" stroke-width="2"/>`).join('')+
  `<path d="M-30 -50 Q-15 -62 0 -50 Q15 -62 30 -50 L30 -36 Q15 -48 0 -36 Q-15 -48 -30 -36Z" fill="#fff" stroke="#4a148c" stroke-width="2.5"/><line x1="0" y1="-50" x2="0" y2="-36" stroke="#4a148c" stroke-width="2"/>`);
 case 'History':return g(sh+`<path d="M-58 44 L-10 -40 L38 44Z" fill="#ffcc80" stroke="#bf6c00" stroke-width="3"/><path d="M-10 -40 L38 44 L10 44Z" fill="#ffb74d"/>${[0,1,2].map(k=>`<line x1="${-44+k*8}" y1="${20-k*22}" x2="${24-k*8}" y2="${20-k*22}" stroke="#bf6c00" stroke-width="2"/>`).join('')}
  <g transform="translate(44,8)"><rect x="-18" y="-6" width="36" height="6" fill="#eeeeee" stroke="#757575" stroke-width="2"/>${[-14,-4,6].map(a=>`<rect x="${a}" y="0" width="6" height="32" fill="#fafafa" stroke="#757575" stroke-width="1.5"/>`).join('')}<rect x="-20" y="32" width="40" height="5" fill="#e0e0e0" stroke="#757575" stroke-width="2"/></g>`);
 case 'Personal & Social Development':return g(sh+[[-30,10,'#ef9a9a'],[22,16,'#90caf9'],[-4,-14,'#ffe082']].map(([hx,hy,c])=>`<g transform="translate(${hx},${hy})"><rect x="-15" y="0" width="30" height="24" fill="${c}" stroke="#6d4c41" stroke-width="2.5"/><path d="M-19 2 L0 -16 L19 2Z" fill="#d84315" stroke="#6d4c41" stroke-width="2.5"/><rect x="-4" y="10" width="8" height="14" fill="#6d4c41"/></g>`).join('')+
  `<path class="beat" d="M0 -48 C-6 -60 -24 -56 -18 -40 L0 -26 L18 -40 C24 -56 6 -60 0 -48Z" fill="#ec407a" stroke="#fff" stroke-width="2.5"/>`);
 case 'Life Skills':return g(sh+`<rect x="-40" y="0" width="80" height="40" fill="#ffe0b2" stroke="#6d4c41" stroke-width="3"/><path d="M-48 2 L-40 -26 L40 -26 L48 2Z" fill="#fff" stroke="#6d4c41" stroke-width="3"/>${[-40,-20,0,20].map(a=>`<path d="M${a} -26 L${a+20} -26 L${a+24} 2 L${a-4} 2Z" fill="#e53935" opacity="${a%40?0:1}"/>`).join('')}
  <circle cx="-20" cy="18" r="7" fill="#ffca28" stroke="#f57f17" stroke-width="2"/><circle cx="0" cy="20" r="7" fill="#66bb6a"/><circle cx="20" cy="18" r="7" fill="#ef5350"/><text x="0" y="-36" font-size="22" text-anchor="middle">💰</text>`);
 case 'Computing':return g(sh+`<rect x="-36" y="-8" width="72" height="52" rx="8" fill="#b2ebf2" stroke="#006064" stroke-width="3"/><rect x="-24" y="-40" width="48" height="34" rx="9" fill="#e0f7fa" stroke="#006064" stroke-width="3"/>
  <circle class="blink" cx="-10" cy="-24" r="5" fill="#00bcd4"/><circle class="blink" cx="10" cy="-24" r="5" fill="#00bcd4"/><line x1="0" y1="-40" x2="0" y2="-54" stroke="#006064" stroke-width="3"/><circle cx="0" cy="-57" r="5" fill="#ff5252"/>
  <rect x="-24" y="6" width="48" height="22" rx="3" fill="#263238"/><path d="M-18 20 l6 -6 l6 4 l8 -10 l10 8" stroke="#69f0ae" stroke-width="2.5" fill="none"/>`);
 case 'Learning to Learn':return g(sh+`<path class="beam" d="M0 -46 L110 -76 L110 -16Z" fill="#fff59d" opacity=".5"/><path d="M-16 44 L-10 -36 L10 -36 L16 44Z" fill="#fff" stroke="#b71c1c" stroke-width="3"/>${[24,0,-24].map(y=>`<path d="M${-14.5+(44-y)/80*-0} ${y} h29 v9 h-29Z" fill="#e53935"/>`).join('')}
  <rect x="-13" y="-52" width="26" height="16" fill="#fff59d" stroke="#b71c1c" stroke-width="3"/><path d="M-16 -52 L0 -66 L16 -52Z" fill="#b71c1c"/>`);}
 return '';}
function trees(I,seed,n){let s='';for(let k=0;k<n;k++){const a=hash(seed+'t'+k)*2*Math.PI,rr=I.r*(.25+.65*hash(seed+'r'+k)),x=I.x+rr*Math.cos(a),y=I.y+rr*Math.sin(a),z=I.r/160*(0.8+hash(seed+'z'+k)*.6);
  s+=k%3?`<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${z.toFixed(2)})"><rect x="-2.5" y="0" width="5" height="10" fill="#6d4c41"/><circle cx="0" cy="-4" r="10" fill="#2e7d32"/><circle cx="-3" cy="-7" r="4" fill="#66bb6a"/></g>`
   :`<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${z.toFixed(2)})"><path d="M0 -18 L10 6 L-10 6Z" fill="#1b5e20"/><path d="M0 -24 L7 -6 L-7 -6Z" fill="#388e3c"/><rect x="-2" y="6" width="4" height="5" fill="#5d4037"/></g>`;}return s;}
function hills(I,seed){let s='';for(let k=0;k<3;k++){const a=hash(seed+'h'+k)*2*Math.PI,rr=I.r*(.45+.3*hash(seed+'hr'+k)),x=I.x+rr*Math.cos(a),y=I.y+rr*Math.sin(a),w=I.r*.32;
  s+=`<path d="M${(x-w).toFixed(1)},${y.toFixed(1)} Q${x.toFixed(1)},${(y-w*1.1).toFixed(1)} ${(x+w).toFixed(1)},${y.toFixed(1)}Z" fill="#558b2f" opacity=".55"/><path d="M${(x-w*.5).toFixed(1)},${(y-w*.32).toFixed(1)} Q${(x-w*.1).toFixed(1)},${(y-w*.62).toFixed(1)} ${(x+w*.2).toFixed(1)},${(y-w*.45).toFixed(1)}" stroke="#aed581" stroke-width="${(w/9).toFixed(1)}" fill="none" stroke-linecap="round" opacity=".7"/>`;}return s;}
function compass(x,y,r){return`<g transform="translate(${x},${y})" class="compass"><circle r="${r}" fill="#fff8e1" stroke="#8d6e63" stroke-width="${r/14}"/><circle r="${r*.8}" fill="none" stroke="#bcaaa4" stroke-width="${r/30}" stroke-dasharray="${r/10} ${r/14}"/>
 <path d="M0 ${-r*.9} L${r*.16} 0 L0 ${r*.9} L${-r*.16} 0Z" fill="#5d4037"/><path d="M0 ${-r*.9} L${r*.16} 0 L${-r*.16} 0Z" fill="#e53935"/><path d="M${-r*.9} 0 L0 ${r*.16} L${r*.9} 0 L0 ${-r*.16}Z" fill="#8d6e63" opacity=".8"/>
 <text y="${-r*1.08}" font-size="${r*.38}" text-anchor="middle" font-weight="800" fill="#5d4037">N</text></g>`;}
function cloud(x,y,s,d){return`<g class="cloud" style="animation-duration:${d}s;animation-delay:${-d*hash(x+'c')}s"><g transform="translate(${x},${y}) scale(${s})" opacity=".85"><ellipse cx="0" cy="0" rx="60" ry="22" fill="#fff"/><circle cx="-22" cy="-12" r="22" fill="#fff"/><circle cx="12" cy="-20" r="28" fill="#fff"/><circle cx="38" cy="-6" r="18" fill="#fff"/></g></g>`;}
// L = the equipped ship skin's look (Points Market): sail / hull / flag colours, cosmetic only
function ship(x,y,s,c,d,L){return`<g class="ship${L?' skinned':''}" style="animation-duration:${d}s"><g transform="translate(${x},${y}) scale(${s})"><path d="M-30 0 L30 0 L20 14 L-20 14Z" fill="${L?.hull||'#8d6e63'}" stroke="#4e342e" stroke-width="2"/><line x1="0" y1="0" x2="0" y2="-44" stroke="#4e342e" stroke-width="3"/><path d="M2 -42 Q26 -24 2 -6Z" fill="${L?.sail||'#fff'}" stroke="#bdbdbd"/><path d="M-2 -38 Q-20 -24 -2 -10Z" fill="${L?.sail||c}"/><path d="M0 -44 l12 4 l-12 4Z" fill="${L?.flag||'#e53935'}"/><path d="M-36 16 q8 -5 16 0 t16 0 t16 0 t16 0" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/></g></g>`;}
function banner2(I,sub,p,fs){const w=fs*((I.s||sub).length*.56+6.5),x=I.x,y=I.y-I.r*1.2-fs*.2;
 return`<g class="banner2" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><path d="M${-w/2-fs} ${-fs*.55} l${fs*.6} ${fs*.6} l${-fs*.6} ${fs*.6} h${fs*1.4} v${-fs*1.2}Z M${w/2+fs} ${-fs*.55} l${-fs*.6} ${fs*.6} l${fs*.6} ${fs*.6} h${-fs*1.4} v${-fs*1.2}Z" fill="#a1887f"/>
 <rect x="${-w/2}" y="${-fs*.85}" width="${w}" height="${fs*1.7}" rx="${fs*.3}" fill="${I.c}" stroke="#fff" stroke-width="${fs/9}"/>
 <text y="${fs*.12}" font-size="${fs}" text-anchor="middle" font-weight="800" fill="#fff" stroke="#0005" stroke-width="${fs/12}" paint-order="stroke">${I.e} ${esc(I.s||sub)} · ${p}%</text>
 <rect x="${-w/2+fs*.4}" y="${fs*.38}" width="${w-fs*.8}" height="${fs*.22}" rx="${fs*.11}" fill="#0003"/><rect x="${-w/2+fs*.4}" y="${fs*.38}" width="${((w-fs*.8)*p/100).toFixed(1)}" height="${fs*.22}" rx="${fs*.11}" fill="#ffd54f"/></g>`;}
function drawMap(){const{pos,doms,trails}=layout,codes=mapData.codes;const LK=st?.wallet?.looks||{},TH=LK.theme||{},SEA=TH.sea||['#4dd0e1','#0288d1','#01579b'],GR=TH.grass||['#9ccc65','#558b2f'],FOG=TH.fog;const vb=zoomed?`${ISL[zoomed].x-ISL[zoomed].r*1.3} ${ISL[zoomed].y-ISL[zoomed].r*1.42} ${ISL[zoomed].r*2.6} ${ISL[zoomed].r*2.72}`:'0 0 1600 1050';
 let s=`<svg viewBox="${vb}" id="msvg" class="${zoomed?'zoom':''}"><defs><radialGradient id="sea" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${SEA[0]}"/><stop offset=".6" stop-color="${SEA[1]}"/><stop offset="1" stop-color="${SEA[2]}"/></radialGradient>
 <pattern id="ripple" width="90" height="60" patternUnits="userSpaceOnUse"><path d="M5 20 q10 -7 20 0 M50 48 q10 -7 20 0" stroke="#ffffff" stroke-opacity=".18" stroke-width="2.5" fill="none" stroke-linecap="round"/></pattern>
 <radialGradient id="grass" cx="45%" cy="40%"><stop offset="0" stop-color="${GR[0]}"/><stop offset="1" stop-color="${GR[1]}"/></radialGradient>
 <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fogBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter></defs>
 <rect x="-500" y="-500" width="2600" height="2100" fill="url(#sea)"/><rect class="ripple" x="-500" y="-500" width="2600" height="2100" fill="url(#ripple)"/>`;
 for(let i=0;i<14;i++)s+=`<path class="wave" style="animation-delay:${-i*.7}s" d="M${(i*137)%1500} ${60+i*72} q15 -10 30 0 t30 0" stroke="#fff6" stroke-width="3" fill="none"/>`;
 const by=mapData.progress.by;
 for(const [sub,I] of Object.entries(ISL)){const b=by[sub],p=b?Math.round(100*(b.mastered+b.review)/b.total):0,h=hash(sub);
  s+=`<g class="isl" data-s="${sub}"><path d="${blob(I.x,I.y,I.r*1.34,h,40,1.3)}" fill="#80deea" opacity=".45"/><path class="foam" d="${blob(I.x,I.y,I.r*1.2,h+.1,40)}" fill="#b2ebf2" opacity=".7" stroke="#fff" stroke-width="${I.r/40}" stroke-dasharray="${I.r/12} ${I.r/18}"/>
  <path d="${blob(I.x,I.y,I.r*1.12,h)}" fill="#f6d58e" stroke="#e8b960" stroke-width="${I.r/60}"/><path d="${blob(I.x,I.y,I.r*1.02,h+.3)}" fill="url(#grass)"/>
  <path d="${blob(I.x,I.y,I.r*.95,h+.6)}" fill="${I.c}" opacity=".22"/>${hills(I,sub)}
  ${(trails[sub]||[]).map(d=>`<path d="${d}" stroke="#e9d3a6" stroke-width="${(I.r/(zoomed?40:70)).toFixed(1)}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/><path d="${d}" stroke="#fff3" stroke-width="${(I.r/110).toFixed(1)}" fill="none" stroke-dasharray="${I.r/40} ${I.r/40}"/>`).join('')}
  ${trees(I,sub,Math.round(I.r/14))}${landmark(sub,I.x,I.y-I.r*.04,I.r*.55)}</g>`;}
 if(zoomed){const ids=new Set();TAX.topics.forEach((t)=>{if(t.subject===zoomed)ids.add(t.id)});let ls='';for(const [a,b,h] of TAX.deps){if(!h||!ids.has(a)||!ids.has(b))continue;const ia=TAX.idx[a],ib=TAX.idx[b];const ca=codes[ia],cb=codes[ib];if(cb==='x')continue;
   ls+=`<line x1="${pos[ib][0]}" y1="${pos[ib][1]}" x2="${pos[ia][0]}" y2="${pos[ia][1]}" stroke="${ca==='r'?'#00e676':ca==='m'||ca==='v'?'#fff8e1':'#ffffff55'}" stroke-width="${ca==='r'?1.4:.7}" opacity=".75"/>`;}s+=`<g pointer-events="none">${ls}</g>`;}
 // literal fog (slice 4): dark, see-through mist over the unexplored parts only. A stone is lit (no fog) when it is
 // directly cleared (mapData.fog mask 'C') or mastered / review due (codes m|v). Fog sits BELOW the nodes so lit and
 // learning stones always show, and a mask punches clear holes around every lit stone. The quiet % chip stays.
 const fog=mapData.fog||{bySubject:{},mask:'',pct:0},mask=fog.mask||'',lit=i=>mask[i]==='C'||codes[i]==='m'||codes[i]==='v';
 // scout flares (Points Market): a 24 h peek. The fog over a flared island is thinned, never cleared; mask and counts are untouched.
 const FL=Object.fromEntries((fog.flares||[]).map(f=>[f.region,f]));
 const fogRad=zoomed?ISL[zoomed].r/58*2.6:13;let holes='';const tot={};
 TAX.topics.forEach((t,i)=>{if(zoomed&&t.subject!==zoomed)return;const b=tot[t.subject]??={n:0,lit:0};b.n++;if(lit(i)){b.lit++;const[x,y]=pos[i];holes+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${fogRad.toFixed(1)}"/>`;}});
 let fogS='';for(const [sub,I] of Object.entries(ISL)){if(zoomed&&zoomed!==sub)continue;const b=tot[sub];if(!b||!b.n||b.lit>=b.n)continue;const un=1-b.lit/b.n;
  // darker see-through mist (was ~0.18–0.50; kids called pale fog "trash"). Lit stones stay punched clear via fogHoles.
  fogS+=`<g class="fog-layer${FL[sub]?' flared':''}" opacity="${((.52+.36*un)*(FL[sub]?.35:1)).toFixed(2)}"><path class="fog-island" d="${blob(I.x,I.y,I.r*1.06,hash(sub)+.9)}" fill="${FOG||'#263238'}"/>
  <path class="fog-wisp" d="${blob(I.x+I.r*.12,I.y-I.r*.08,I.r*.62,hash(sub)+1.4)}" fill="${FOG||'#455a64'}" opacity=".65"/></g>`;}
 if(fogS)s+=`<mask id="fogHoles" maskUnits="userSpaceOnUse" x="-500" y="-500" width="2600" height="2100"><rect x="-500" y="-500" width="2600" height="2100" fill="#fff"/><g fill="#000" filter="url(#fogBlur)">${holes}</g></mask>
 <g class="fog" pointer-events="none" mask="url(#fogHoles)">${fogS}</g>`;
 const rad=zoomed?ISL[zoomed].r/58:4.4;const G={m:'',v:'',r:'',l:'',x:''},fl=[];
 TAX.topics.forEach((t,i)=>{if(zoomed&&t.subject!==zoomed)return;const c=codes[i],[x,y]=pos[i];const rr=c==='x'?rad*.8:rad;
  G[c]+=`<circle class="tp ${c}" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(2)}"/>`;
  if(zoomed&&(c==='m'||c==='v'))fl.push(`<path d="M${x.toFixed(1)} ${(y-rr).toFixed(1)} v${(-rad*2.6).toFixed(1)} l${(rad*1.6).toFixed(1)} ${(rad*.6).toFixed(1)} l${(-rad*1.6).toFixed(1)} ${(rad*.6).toFixed(1)}" fill="${c==='v'?'#ff6d00':'#ffc400'}" stroke="#5d4037" stroke-width="${(rad/6).toFixed(2)}"/>`);});
 // one group per state: one filter / one animation per group keeps ~1,900 nodes cheap on phones
 s+=`<g class="nodes" stroke-width="${(rad/4).toFixed(2)}"><g class="g-x" fill="#cfd8dc" stroke="#eceff1">${G.x}</g><g class="g-l" fill="${COL.l}" stroke="#fff">${G.l}</g><g class="g-r" fill="${COL.r}" stroke="#fff">${G.r}</g>
 <g class="g-m" fill="${COL.m}" stroke="#fff8e1" filter="url(#glow)">${G.m}</g><g class="g-v" fill="${COL.v}" stroke="#fff">${G.v}</g><g pointer-events="none">${fl.join('')}</g></g>`;
 for(const [sub,I] of Object.entries(ISL)){if(zoomed&&zoomed!==sub)continue;const b=by[sub],p=b?Math.round(100*(b.mastered+b.review)/b.total):0;const fs=zoomed?I.r/8:Math.max(20,I.r/7);s+=banner2(I,sub,p,fs);}
 if(zoomed)for(const {d,a} of doms[zoomed]){const I=ISL[zoomed];const lb=d.length>16?d.split(/ & | and /)[0]:d;s+=`<text pointer-events="none" x="${I.x+I.r*1.0*Math.cos(a)}" y="${I.y+I.r*1.0*Math.sin(a)}" font-size="${I.r/(doms[zoomed].length>10?24:17)}" text-anchor="middle" fill="#3e2723" font-weight="800" stroke="#fff8e1" stroke-width="${I.r/80}" paint-order="stroke">${esc(lb)}</text>`;}
 if(!zoomed){s+=ship(250,985,.9,'#42a5f5',22,LK.ship)+ship(1180,960,.9,'#ec407a',28,LK.ship)+ship(1500,560,.8,'#ffca28',25,LK.ship)+compass(1500,110,55);
  // big "your ship" so a worn Golden Galleon (etc.) is obvious — decorative edge boats stay too
  if(LK.ship)s+=`<g class="ship-hero">${ship(780,980,1.55,'#ffd54f',18,LK.ship)}<text x="780" y="1018" font-size="22" font-weight="800" text-anchor="middle" fill="#5d4037">${esc(LK.ship.emoji||'⛵')} Your ship</text></g>`;
  for(const [x,y,k,d] of [[200,120,1,70],[800,90,.8,90],[1300,480,.7,80],[400,980,.9,100],[1100,140,.6,75]])s+=cloud(x,y,k,d);}
 for(const [sub,f] of Object.entries(FL)){const I=ISL[sub];if(!I||(zoomed&&zoomed!==sub))continue;
  if(zoomed){const lb=[];TAX.topics.forEach((t,i)=>{if(t.subject!==sub||lit(i)||!'rl'.includes(codes[i]))return;const[x,y]=pos[i];if(lb.length<30)lb.push(`<text x="${x.toFixed(1)}" y="${(y-rad*1.6).toFixed(1)}" font-size="${(rad*1.5).toFixed(1)}" text-anchor="middle">${esc(t.sn||t.name)}</text>`);});
   s+=`<g class="flare-names" pointer-events="none" fill="#fff8e1" stroke="#3e2723" stroke-width="${(rad/5).toFixed(2)}" paint-order="stroke" font-weight="800">${lb.join('')}</g>`;}
  let mk='';for(let k=0;k<Math.min(3,f.secrets||0);k++){const a=hash(sub+'s'+k)*2*Math.PI,rr=I.r*(.35+.4*hash(sub+'sr'+k));mk+=`<text class="flare-secret" x="${(I.x+rr*Math.cos(a)).toFixed(1)}" y="${(I.y+rr*Math.sin(a)).toFixed(1)}" font-size="${(I.r/(zoomed?7:5)).toFixed(1)}" text-anchor="middle">❓<title>Something's hidden here…</title></text>`;}
  s+=`<g pointer-events="none">${mk}<text class="flare-burst" x="${I.x+I.r*.85}" y="${I.y-I.r*.85}" font-size="${(I.r/(zoomed?5:3.2)).toFixed(1)}" text-anchor="middle">🎆</text></g>`;}
 const cur=mapData.current&&TAX.idx[mapData.current];if(cur!=null&&pos[cur]&&(!zoomed||TAX.topics[cur].subject===zoomed)){const[x,y]=pos[cur];s+=`<text pointer-events="none" class="boat" x="${x}" y="${y-rad*1.5}" font-size="${rad*6}" text-anchor="middle">⛵</text>`;}
 $('world').innerHTML=s+'</svg>';const svg=$('msvg');
 svg.querySelectorAll('.isl').forEach(g=>g.onclick=()=>{if(!zoomed){zoomed=g.dataset.s;drawMap();}});
 svg.addEventListener('pointermove',tip);svg.addEventListener('click',e=>{const isl=e.target.closest?.('.isl');if(!zoomed&&isl&&!e.target.classList.contains('tp')){zoomed=isl.dataset.s;window.FX?FX.view(drawMap):drawMap();return;}if(e.target.classList.contains('tp')){if(!zoomed){tip(e,true);zoomed=TAX.topics[e.target.dataset.i].subject;drawMap();}else{$('tip').hidden=true;stoneCard(+e.target.dataset.i);}}});
 $('zoomout').hidden=!zoomed;const pr=mapData.progress,fp=mapData.fog?.pct??0,lp=pr.total?Math.round(1000*TAX.topics.reduce((n,t,i)=>n+(mapData.fog?.mask?.[i]==='C'||'mv'.includes(mapData.codes[i]||'_')?1:0),0)/pr.total)/10:0;const flH=f=>Math.max(1,Math.ceil((f.until-Date.now())/3600e3)),flT=Object.values(FL).map(f=>`🎆 ${ISL[f.region]?.s||f.region} lit (${flH(f)} h left)`).join(' · ');
 $('msub').textContent=(zoomed?`${zoomed}: tap a stone to see the skill. Fog lifts when you master a skill for real!`:`${pr.done} of ${pr.total} skills · ${lp}% lit · fog clear ${fp}% · ${pr.tot.ready} ready · tap an island`)+(flT?' · '+flT:'');
 flareBtn(FL,fog);}
// "Light it up": fire a scout flare at the island you are looking at (it still goes through the Market's confirm step)
function flareBtn(FL,fog){let b=$('flarebtn');if(!b){b=document.createElement('button');b.id='flarebtn';b.type='button';b.className='ghost';$('zoomout').after(b);b.onclick=async()=>{if(!MK)await loadMarket();const it=MK?.items?.find(i=>i.kind==='flare');if(it)mkFlare(it,zoomed);};}
 const bs=fog.bySubject?.[zoomed];b.hidden=!zoomed||!bs||bs.clear>=bs.total||!!FL[zoomed];b.textContent='🎆 Light it up!';}
function tip(e,force){const t=e.target;if(!t.classList?.contains('tp')){if(!force)$('tip').hidden=true;return;}const i=+t.dataset.i,tp=TAX.topics[i],c=mapData.codes[i];
 const box=$('world').getBoundingClientRect(),card=$('world').parentElement.getBoundingClientRect();const el=$('tip');el.hidden=false;
 const cl=mapData.fog?.mask?.[i]==='C',fogged=!!mapData.fog&&!cl&&!'mv'.includes(c||'_'),flared=fogged&&(mapData.fog.flares||[]).some(f=>f.region===tp.subject);el.innerHTML=`<b>${esc(tp.name)}</b><br><span class="small">${esc(tp.subject)} › ${esc(tp.domain)} · ages ${tp.ageRangeStart}+</span><br>${SN[c]}${flared?' · 🎆 lit by your flare (fog comes back)':fogged?' · 🌫️ under fog':(cl?' · ✨ fog cleared':'')}<br><span class="small">${esc(tp.description).slice(0,140)}…</span>`;
 el.style.left=Math.min(e.clientX-card.left+12,card.width-290)+'px';el.style.top=(e.clientY-card.top+12)+'px';}
function drawBars(){const pr=mapData.progress;let s=`<div class="big">🌍 ${pr.pct}% of ${pr.total} skills</div><div class="sbar"><div class="track">${seg(pr.tot,pr.total)}</div></div>`;
 for(const [sub,I] of Object.entries(ISL)){const b=pr.by[sub];if(!b)continue;s+=`<div class="sbar"><div class="lbl"><span>${I.e} ${esc(sub)}</span><span>${b.mastered+b.review} / ${b.total}</span></div><div class="track">${seg(b,b.total)}</div></div>`;}
 $('bars').innerHTML=s;requestAnimationFrame(()=>$('bars').querySelectorAll('.track i').forEach(i=>i.style.width=i.dataset.w));}
const seg=(b,t)=>[['mastered','m'],['review','v'],['learning','l'],['ready','r']].map(([k,c])=>`<i style="width:0;background:${COL[c]};opacity:${c==='r'?.45:1}" data-w="${(100*b[k]/t).toFixed(2)}%" title="${k}: ${b[k]}"></i>`).join('');
$('zoomout').onclick=()=>{zoomed=null;drawMap();};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{const sw=()=>{document.querySelectorAll('.tab').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-selected',x===b);x.tabIndex=x===b?0:-1;});for(const v of['play','map','trophies','quests','market'])$(v).hidden=b.dataset.v!==v;};window.FX?FX.view(sw):sw();if(b.dataset.v==='map')loadMap();if(b.dataset.v==='market')loadMarket();if(b.dataset.v==='trophies')loadTrophies();if(b.dataset.v==='quests')loadQuests();});
// learner profiles: wait for picker.js; while "Who's playing?" shows, nothing loads (the pick reloads the page)
loadGloss().finally(()=>Promise.resolve(window.janeWho).then(w=>{if(w?.picker)return;return api('/api/state').then(s=>{render(s);questDot(s);if(s.finaleReveal)finaleReveal(s.campaign);else if(s.newQuest&&!location.hash&&s.quest)questReveal(s.quest);});}));
if(location.hash==='#quests')document.querySelector('.tab[data-v=quests]').click();
if(location.hash==='#market')document.querySelector('.tab[data-v=market]').click();
if(location.hash==='#trophies')document.querySelector('.tab[data-v=trophies]').click();
if(location.hash.startsWith('#map')){const z=decodeURIComponent(location.hash.slice(5));if(z)zoomed=z;document.querySelector('.tab[data-v=map]').click();}

// ---------- Final Boss unlock reveal (slice 6 / #60) ----------
function finaleReveal(C){if(document.querySelector('.finale'))return;const o=document.createElement('div');o.className='finale';
 o.innerHTML=`<div class="fnbox"><div class="fnemo">👑</div><div class="fnnew">FINAL BOSS UNLOCKED!</div>
 <p>The Campaign Trail is complete and the Final Boss is fully lit.</p>
 <p class="ctaunt">${esc(C?.taunt||'Jane is forging the finale…')}</p>
 <p class="small">No free medals — when Jane finishes forging, a one-shot Finale quest may appear.</p>
 <button type="button" id="fnok">Awesome! 🗡️</button></div>`;
 document.body.appendChild(o);confetti(90);const close=()=>{o.classList.add('out');setTimeout(()=>o.remove(),320);};$('fnok').onclick=close;o.onclick=e=>{if(e.target===o)close();};setTimeout(()=>$('fnok')?.focus(),60);}
// ---------- fog finds (slice 5 / #59): claim once; garnish only — never invent medals ----------
function fogFindReveal(f,reward){const o=document.createElement('div');o.className='freveal';
 o.innerHTML=`<div class="frbox"><div class="fremo">${esc(f.emoji||'📦')}</div><div class="frnew">✨ Fog find! ✨</div><h3>${esc(f.title||'Treasure')}</h3>
 <p class="small">${esc(reward?.note||'You uncovered something under the fog!')}</p>
 <div class="small">Garnish only — no free medals, no skipping mastery.</div>
 <button type="button" id="frok">Collect it!</button></div>`;
 document.body.appendChild(o);confetti(40);const close=()=>{o.classList.add('out');setTimeout(()=>o.remove(),300);};o.querySelector('#frok').onclick=close;o.onclick=e=>{if(e.target===o)close();};setTimeout(()=>$('frok')?.focus(),50);}
async function claimFogFind(id){const r=await api('/api/fog/claim',{id});if(r.error){say(r.error);return null;}
 if(r.state){st=r.state;if(st.fog){if(mapData)mapData.fog=st.fog;campaignHUD(st);}chips(st);}
 if(!r.already)fogFindReveal(r.find,r.reward);return r;}
function paintFogFinds(fog){const host=$('ffinds');if(!host)return;const avail=fog?.available||[];
 if(!avail.length){host.hidden=true;host.innerHTML='';return;}
 host.hidden=false;host.innerHTML=`<div class="ffh">🌫️ Fog finds ready!</div>${avail.map(f=>`<button type="button" class="ffbtn" data-id="${esc(f.id)}">${esc(f.emoji||'📦')} ${esc(f.title)}</button>`).join('')}`;
 host.querySelectorAll('.ffbtn').forEach(b=>b.onclick=()=>claimFogFind(b.dataset.id));}
// refresh find strip whenever map fog or state fog updates
const _loadMap=loadMap;loadMap=async function(){await _loadMap();paintFogFinds(mapData?.fog||st?.fog);}
const _chipsFog=chips;chips=function(s){_chipsFog(s);if(s?.fog)paintFogFinds(s.fog);pickLine(s);}

// ---------- campaign trail HUD + Quest of Quests overlay (slices 2–3 / #56 #57) ----------
function cTrailHTML(C,{big=false}={}){const nodes=C.nodes.map((n,i)=>{const done=!!n,cur=!done&&i===C.filled;
  const label=done?`${n.emoji||'🏅'} ${n.name}`:cur?'Next boss':'Boss ahead';
  const face=done?esc(n.emoji||'🏅'):cur?'⚔️':'🌫️';
  return`<span class="cn ${done?'done':cur?'cur':'fog'}" title="${esc(label)}" aria-label="${esc(label)}">${face}</span>`;}).join('<i></i>');
 const lit=C.finalBoss.lit||0,unlocked=!!C.finalBoss.unlocked;
 const fbCls=unlocked?'unlocked':lit>=1?'lit':lit>0?'partial':'fog';
 const fb=unlocked?'👑':lit>=1?'🐲':lit>0?'🐉':'🌫️';
 return`<div class="ctrail${big?' big':''}" role="list" aria-label="Trail ${C.filled} of ${C.trailLen}">${nodes}<i class="cend"></i><span class="cn boss ${fbCls}" role="listitem" title="Final Boss" aria-label="Final Boss ${Math.round(lit*100)} percent lit">${fb}</span></div>`;}
function campaignHUD(s){if(s?.finaleReveal)finaleReveal(s.campaign);const el=$('campaign');if(!el)return;const C=s?.campaign;if(!C){el.hidden=true;return;}
 const legs='★'.repeat(C.legendaries.have)+'☆'.repeat(Math.max(0,C.legendaries.need-C.legendaries.have));
 el.hidden=false;
 el.innerHTML=`<button type="button" class="copen" id="copen" aria-haspopup="dialog" aria-controls="coverlay" aria-label="Open Quest of Quests campaign map">
<div class="chd"><span class="ctitle">🗡️ Campaign Trail</span><span class="cleg" title="Legendary wins light the Final Boss" aria-label="${C.legendaries.have} of ${C.legendaries.need} legendaries">${esc(legs)}</span></div>
${cTrailHTML(C)}
<p class="ctaunt">${esc(C.taunt)}</p>
<span class="chint">Tap for Quest of Quests ›</span></button>`;
 $('copen').onclick=()=>openCampaign();}
let _cFocus=null;
function openCampaign(){const C=st?.campaign;if(!C)return;closeCampaign();_cFocus=document.activeElement;
 const slots=(C.legendaries.slots||[]).map((s,i)=>s?`<div class="cslot on" title="${esc(s.name)}"><span class="csemo">${esc(s.ic||'🌈')}</span><span class="csnm">${esc(s.name)}</span></div>`
  :`<div class="cslot" aria-label="Legendary slot ${i+1} empty"><span class="csemo">☆</span><span class="csnm">Empty</span></div>`).join('');
 const hist=(C.history||[]).length?`<ul class="chist">${C.history.map(h=>`<li><span class="he">${esc(h.emoji||'🏅')}</span><span><b>${esc(h.name)}</b>${h.title?` · ${esc(h.title)}`:''}<br><span class="small">${esc(h.date)}</span></span></li>`).join('')}</ul>`
  :'<p class="small">No quest medals yet — beat a quest to light the first boss!</p>';
 const lit=Math.round((C.finalBoss.lit||0)*100);
 const o=document.createElement('div');o.className='coverlay';o.id='coverlay';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label','Quest of Quests');
 o.innerHTML=`<div class="cobox"><button type="button" class="x" id="cclose" aria-label="Close campaign map">✕</button>
 <h2>🗺️ Quest of Quests</h2>
 <p class="ctaunt">${esc(C.taunt)}</p>
 ${cTrailHTML(C,{big:true})}
 <div class="csec"><h3>🌈 Legendary slots · Final Boss ${lit}%</h3><div class="cslots">${slots}</div>
 <div class="small">${C.finalBoss.unlocked?'👑 Unlocked — Jane is forging the finale…':`Need ${C.legendaries.need} legendaries + a full trail of ${C.trailLen}.`}</div></div>
 <div class="csec"><h3>🏅 Quest history</h3>${hist}</div>
 <button type="button" class="bigbtn" id="cback">⬅ Back to Play</button></div>`;
 document.body.appendChild(o);
 const close=()=>closeCampaign();$('cclose').onclick=close;$('cback').onclick=close;
 o.onclick=e=>{if(e.target===o)close();};
 setTimeout(()=>$('cclose')?.focus(),50);
 if(window.FX){FX.sound?.('open');FX.enter?.(o.querySelector('.cobox'));}}
function closeCampaign(){const o=document.querySelector('.coverlay');if(!o)return;o.classList.add('out');
 const done=()=>{o.remove();(_cFocus||$('copen'))?.focus?.();_cFocus=null;};
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)done();else setTimeout(done,280);}
// ---------- medals ----------
const TIER={quest:{n:'Quest',g:['#b9f6ca','#00c853','#1b5e20']},bronze:{n:'Bronze',g:['#ffd8a8','#c87533','#7a4317']},silver:{n:'Silver',g:['#ffffff','#c3ccd6','#7b8794']},gold:{n:'Gold',g:['#fff7b0','#ffc93c','#b8860b']},legendary:{n:'Legendary',g:['#ff8bd8','#8a5cff','#2de2ff']}};
let MID=0;
function medalSVG(m,size=64){const id='m'+(MID++),T=TIER[m.tier]||TIER.bronze,c=ISL[m.subject]?.c||'#42a5f5';
 const shape={quest:'<path d="M50 12 L60 38 L88 40 L66 58 L74 86 L50 70 L26 86 L34 58 L12 40 L40 38Z"/>',bronze:'<circle cx="50" cy="52" r="34"/>',silver:'<path d="M50 14 L82 24 L80 58 Q76 80 50 92 Q24 80 20 58 L18 24 Z"/>',
  gold:(()=>{let d='';for(let i=0;i<24;i++){const a=i/24*2*Math.PI-Math.PI/2,r=i%2?32:39;d+=(i?'L':'M')+(50+r*Math.cos(a)).toFixed(1)+' '+(52+r*Math.sin(a)).toFixed(1);}return`<path d="${d}Z"/>`;})(),
  legendary:(()=>{let d='';for(let i=0;i<6;i++){const a=i/6*2*Math.PI-Math.PI/2;d+=(i?'L':'M')+(50+40*Math.cos(a)).toFixed(1)+' '+(52+40*Math.sin(a)).toFixed(1);}return`<path d="${d}Z"/>`;})()}[m.tier]||'<circle cx="50" cy="52" r="34"/>';
 const sp=m.tier==='bronze'?'':[[18,20,0],[84,30,.6],[78,84,1.2],[14,74,1.8]].slice(0,m.tier==='silver'?2:4).map(([x,y,dl])=>`<path class="spk" style="animation-delay:${dl}s;transform-origin:${x}px ${y}px" d="M${x} ${y-6} L${x+1.6} ${y-1.6} L${x+6} ${y} L${x+1.6} ${y+1.6} L${x} ${y+6} L${x-1.6} ${y+1.6} L${x-6} ${y} L${x-1.6} ${y-1.6}Z" fill="#fff"/>`).join('');
 return `<svg class="medal t-${m.tier}" viewBox="0 0 100 112" width="${size}" height="${size*1.12}" aria-label="${esc(T.n)} medal: ${esc(m.name)}"><defs>
 <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.g[0]}"/><stop offset=".5" stop-color="${T.g[1]}"/><stop offset="1" stop-color="${T.g[2]}"/></linearGradient>
 <clipPath id="${id}c">${shape}</clipPath></defs>
 <path d="M34 78 L26 108 L38 101 L44 112 L50 84Z" fill="${c}"/><path d="M66 78 L74 108 L62 101 L56 112 L50 84Z" fill="${c}" opacity=".85"/>
 <g fill="url(#${id}g)" stroke="${T.g[2]}" stroke-width="2.5">${shape}</g>
 <circle cx="50" cy="52" r="${m.tier==='gold'?24:22}" fill="${c}" stroke="#fff" stroke-width="2.5" opacity=".95"/>
 <text x="50" y="61" font-size="26" text-anchor="middle">${m.ic||'⭐'}</text>
 <g clip-path="url(#${id}c)"><rect class="shine" x="-60" y="0" width="22" height="112" fill="#fff" opacity=".55" transform="skewX(-20)"/></g>${sp}</svg>`;}
function medalRow(s){const M=s.medals||[];$('badges').innerHTML=s.medalCount?`<button class="mrow" onclick="openTrophies()"><span class="mlbl">🏆 ${s.medalCount} medal${s.medalCount>1?'s':''}</span>${M.map(m=>medalSVG(m,40)).join('')}${s.medalCount>M.length?`<span class="more">+${s.medalCount-M.length}</span>`:''}<span class="go">See all ›</span></button>`:'<div class="small mhint">🏅 Master a skill to win your first medal!</div>';}
function openTrophies(){document.querySelector('.tab[data-v=trophies]').click();}
function reveal(m,inf){const o=document.createElement('div');o.className='reveal r-'+m.tier;const T=TIER[m.tier];
 o.innerHTML=`<div class="rays"></div><div class="rbox"><div class="rtier">${m.tier==='legendary'?'🌈 LEGENDARY!':'✨ New '+T.n+' medal!'}</div><div class="rmedal">${medalSVG(m,170)}</div><div class="rname">${esc(m.name)}</div><div class="small">${esc(m.subject)}${inf?` · +${inf} skills lit up!`:''}</div><button>Collect it! 🏆</button></div>`;
 document.body.appendChild(o);confetti(m.tier==='legendary'?140:90);const close=()=>{o.classList.add('out');setTimeout(()=>o.remove(),350);};o.querySelector('button').onclick=close;o.onclick=e=>{if(e.target===o)close();};}
// Trophy Case: medal-type chips are filter buttons (public/trophies.js); the grid keeps its cells and AutoAnimate moves them
let tFilter='all',tAnim=false;
async function loadTrophies(){const d=await api('/api/trophies');const TF=window.TrophyFilter,M=d.medals||[];if(!TF.chips(M,tFilter).some(c=>c.tier===tFilter))tFilter='all';
 const grid=$('tgrid');if(!tAnim&&window.UIK?.autoAnimate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){UIK.autoAnimate(grid,{duration:260,easing:'ease-out'});tAnim=true;}
 const cells=M.map((m,i)=>{const b=document.createElement('button');b.className='tcell t-'+m.tier;b.dataset.i=i;b.innerHTML=`${medalSVG(m,72)}<span>${esc(m.name)}</span>`;b.onclick=()=>detail(m);return b;});
 const draw=()=>{$('tcount').innerHTML=TF.chipsHTML(M,tFilter);$('tcount').querySelectorAll('.tc').forEach(c=>c.onclick=()=>{const t=c.dataset.tier,kb=document.activeElement===c;tFilter=TF.next(tFilter,t);draw();if(kb)$('tcount').querySelector(`.tc[data-tier="${t}"]`)?.focus();});
  const show=TF.filter(M,tFilter).map(m=>cells[M.indexOf(m)]);
  grid.replaceChildren(...(show.length?show:[Object.assign(document.createElement('p'),{className:'tempty',textContent:TF.empty(tFilter,M.length)})]));
  $('tlive').textContent=TF.say(tFilter,show.length);};
 draw();
 function detail(m){$('tdetail').hidden=false;
  $('tdetail').innerHTML=`<div class="tdbox">${medalSVG(m,120)}<h3>${esc(m.name)}</h3><div class="tier-pill t-${m.tier}">${TIER[m.tier].n}${m.boss?' · Boss win!':''}</div><p class="small">${ISL[m.subject]?.e||''} ${esc(m.subject)} › ${esc(m.domain)}</p><p>You earned this for: <b>${esc(m.why)}</b></p><p class="small">Won ${new Date(m.at).toLocaleDateString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric'})}</p><button onclick="$('tdetail').hidden=true">Close</button></div>`;}}
// preview the unlock animation with the latest medal (no progress change): /#medal-preview
if(location.hash==='#medal-preview')api('/api/state').then(s=>s.medals?.[0]&&reveal(s.medals[0],0));
if(location.hash==='#campaign-preview'){document.querySelector('.tab[data-v=play]')?.click();api('/api/state').then(s=>{campaignHUD(s);const el=$('campaign');if(el){el.hidden=false;el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});el.classList.add('preview');}});
}

// ---------- illustrations: pack scenes (emoji or inline SVG) + app templates ----------
function cleanSVG(x){return String(x).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi,'').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi,'$1#');}
function sceneHTML(sc){sc=String(sc).trim();return sc.startsWith('<svg')?`<div class="scene">${cleanSVG(sc)}</div>`:`<div class="scene emo">${esc(sc)}</div>`;}
function nline(min,max,marks=[],val=null){const W=300,x=v=>20+(v-min)/(max-min)*(W-40);let s=`<svg viewBox="0 0 ${W} 70" class="nl"><line x1="14" y1="40" x2="${W-14}" y2="40" stroke="#4a148c" stroke-width="4" stroke-linecap="round"/>`;
 const n=Math.min(20,Math.round(max-min));for(let i=0;i<=n;i++){const v=min+(max-min)*i/n;s+=`<line x1="${x(v)}" y1="32" x2="${x(v)}" y2="48" stroke="#4a148c" stroke-width="2"/>`;}
 s+=`<text x="${x(min)}" y="66" text-anchor="middle" font-size="13" font-weight="800">${min}</text><text x="${x(max)}" y="66" text-anchor="middle" font-size="13" font-weight="800">${max}</text>`;
 for(const m of marks){const [v,l]=Array.isArray(m)?m:[m,m];s+=`<circle cx="${x(v)}" cy="40" r="6" fill="#ff6d00"/><text x="${x(v)}" y="22" text-anchor="middle" font-size="13" font-weight="800" fill="#e65100">${esc(l)}</text>`;}
 return s+'</svg>';}
function tplHTML(t){switch(t.type){
 case 'pizza':return `<div class="tpl">${pizza(t.slices||8,t.eaten||0)}</div>`;
 case 'fracbar':return `<div class="tpl">${bar(t.parts||4,t.shaded||0)}${t.label?`<div class="small">${esc(t.label)}</div>`:''}</div>`;
 case 'numberline':return `<div class="tpl">${nline(t.min??0,t.max??10,t.marks||[])}</div>`;
 case 'timeline':return `<div class="tpl tl">${(t.events||[]).map(([d,l,e])=>`<div class="tle"><div class="tld">${esc(d)}</div><div class="tldot">${esc(e||'📍')}</div><div class="tll">${esc(l)}</div></div>`).join('<div class="tlbar"></div>')}</div>`;
 case 'foodweb':return `<div class="tpl fw">${(t.chain||[]).map(([e,l])=>`<div class="fwn"><span>${esc(e)}</span><small>${esc(l)}</small></div>`).join('<div class="fwa">➜</div>')}${t.note?`<div class="small" style="width:100%">${esc(t.note)}</div>`:''}</div>`;
 case 'orbit':{const P=t.planets||[['🌍','Earth']];let s=`<svg viewBox="0 0 300 200" class="orb"><rect width="300" height="200" rx="18" fill="#0d1b4c"/>${[...Array(30)].map((_,i)=>`<circle cx="${(i*97)%300}" cy="${(i*53)%200}" r="1.2" fill="#fff" opacity=".7"/>`).join('')}<text x="150" y="112" font-size="34" text-anchor="middle">☀️</text>`;
  P.forEach(([e,l],i)=>{const rx=50+i*28,ry=rx*.42,a=(t.angles?.[i]??(40+i*65))*Math.PI/180;s+=`<ellipse cx="150" cy="100" rx="${rx}" ry="${ry}" fill="none" stroke="#fff5" stroke-dasharray="3 4"/><g class="spin" style="animation-duration:${8+i*5}s;transform-origin:150px 100px"><text x="${150+rx*Math.cos(a)}" y="${106+ry*Math.sin(a)}" font-size="${t.highlight===l?24:18}" text-anchor="middle">${esc(e)}</text></g>`;});
  return `<div class="tpl">${s}</svg>${t.note?`<div class="small">${esc(t.note)}</div>`:''}</div>`;}}
 return '';}

// ---------- interactive formats ----------
const checkBtn=(f,label='Check ✔')=>{$('extra').innerHTML=`<button class="check" id="chk">${label}</button>`;$('chk').onclick=f;};
const INTER={
 card(p){$('pcard').classList.add('cardy');
  if(p.card==='learn'||p.card==='powerup'){const ex=p.example||{},S=ex.steps||[];let k=0;
   $('q').innerHTML=`<div class="kcard k-learn"><div class="kemo">${esc(p.emoji||(p.card==='learn'?'🧠':'🔋'))}</div><div class="klbl">${p.card==='learn'?'🧠 Learn it':'🔋 Power-up'}</div><h3>${gl(p.title||p.q)}</h3><p>${gl(p.body||'')}</p>${S.length?`<div class="ex"><b>👀 Watch: ${esc(ex.prompt||'')}</b><ol id="exs"></ol></div>`:''}</div>`;$('mc').innerHTML='';
   const nb=()=>{if(k<S.length){$('extra').innerHTML=`<button class="check" id="chk">${k?'Next step ➡':'Show me how ➡'}</button>`;$('chk').onclick=()=>{$('exs').insertAdjacentHTML('beforeend',`<li>${esc(S[k++])}</li>`);nb();};}
    else{$('extra').innerHTML=`<button class="check" id="chk">${p.card==='learn'?'Got it! Let me try 🧠':'Let\'s go! ⚔️'}</button>`;$('chk').onclick=()=>send('ok');}};nb();return;}$('q').innerHTML=`<div class="kcard k-${p.card}"><div class="kemo">${esc(p.emoji||(p.card==='why'?'🧠':'🤩'))}</div><div class="klbl">${p.card==='why'?'💡 Why it works':'🤩 Fun fact!'}</div><h3>${gl(p.q)}</h3><p>${gl(p.body||'')}</p></div>`;
  $('mc').innerHTML='';$('extra').innerHTML=`<button class="check" id="chk">${p.card==='why'?'Got it! 🧠':'Whoa, cool! ➡'}</button>`;$('chk').onclick=()=>send('ok');},
 picture(p){$('mc').innerHTML=`<div class="pics">${p.choices.map((c,i)=>`<button class="pic" data-v="${esc(c)}"><span class="pe">${String(p.pics[i]||'').trim().startsWith('<svg')?cleanSVG(p.pics[i]):esc(p.pics[i]||'')}</span><span>${esc(c)}</span></button>`).join('')}</div>`;
  $('mc').querySelectorAll('.pic').forEach(b=>b.onclick=()=>{b.classList.add('picked');send(b.dataset.v);});},
 order(p){const L=document.createElement('ol');L.className='ord';L.innerHTML=p.items.map(x=>`<li><span class="grip">☰</span><span class="ot">${esc(x)}</span><span class="arr"><button class="up" aria-label="move up">▲</button><button class="dn" aria-label="move down">▼</button></span></li>`).join('');$('mc').innerHTML='<div class="small">Drag the cards (or tap ▲▼) into the right order!</div>';$('mc').appendChild(L);
  const mv=f=>window.FX?FX.flip(L,f):f();
  L.querySelectorAll('.up').forEach(b=>b.onclick=()=>{const li=b.closest('li');li.previousElementSibling&&mv(()=>L.insertBefore(li,li.previousElementSibling));b.focus();});
  L.querySelectorAll('.dn').forEach(b=>b.onclick=()=>{const li=b.closest('li');li.nextElementSibling&&mv(()=>L.insertBefore(li.nextElementSibling,li));b.focus();});
  let drag=null;L.addEventListener('pointerdown',e=>{const li=e.target.closest('li');if(!li||e.target.closest('button'))return;drag=li;li.classList.add('drag');li.setPointerCapture(e.pointerId);e.preventDefault();});
  L.addEventListener('pointermove',e=>{if(!drag)return;const o=[...L.children].find(li=>li!==drag&&(()=>{const r=li.getBoundingClientRect();return e.clientY>r.top&&e.clientY<r.bottom;})());if(o){const r=o.getBoundingClientRect(),ref=e.clientY<r.top+r.height/2?o:o.nextSibling;if(ref!==drag.nextSibling&&ref!==drag)mv(()=>L.insertBefore(drag,ref));}});
  const up=()=>{drag?.classList.remove('drag');drag=null;};L.addEventListener('pointerup',up);L.addEventListener('pointercancel',up);
  checkBtn(()=>send([...L.querySelectorAll('.ot')].map(x=>x.textContent).join('|')));},
 match(p){const C=['#7c4dff','#00b8d4','#ff6d00','#e91e63','#00c853','#ffab00'];const pair={};let selL=null;
  $('mc').innerHTML=`<div class="small">Tap one on the left, then its partner on the right!</div><div class="match"><div>${p.left.map((x,i)=>`<button class="ml" data-i="${i}">${esc(x)}</button>`).join('')}</div><div>${p.right.map((x,i)=>`<button class="mr" data-i="${i}">${esc(x)}</button>`).join('')}</div></div>`;
  const paint=()=>{$('mc').querySelectorAll('.ml').forEach(b=>{const i=+b.dataset.i;b.style.background=pair[i]!=null?C[i%6]:selL===i?'#ffd54f':'';b.classList.toggle('paired',pair[i]!=null);b.classList.toggle('sel',selL===i);});
   $('mc').querySelectorAll('.mr').forEach(b=>{const j=+b.dataset.i,k=Object.keys(pair).find(i=>pair[i]===j);b.style.background=k!=null?C[k%6]:'';b.classList.toggle('paired',k!=null);});
   $('chk').disabled=Object.keys(pair).length<p.left.length;};
  $('mc').querySelectorAll('.ml').forEach(b=>b.onclick=()=>{selL=+b.dataset.i;delete pair[selL];paint();});
  $('mc').querySelectorAll('.mr').forEach(b=>b.onclick=()=>{if(selL==null)return;const j=+b.dataset.i;for(const i in pair)if(pair[i]===j)delete pair[i];pair[selL]=j;selL=null;paint();window.FX&&(FX.bump(b),FX.sound('pop'));});
  checkBtn(()=>send(p.left.map((l,i)=>`${l}=${p.right[pair[i]]}`).join('|')));paint();},
 truefalse(p){let k=0;const ans=[];$('mc').innerHTML=`<div class="tf"><div class="tfn" id="tfn"></div><div class="tfs" id="tfs"></div><div class="tfb"><button class="tt">✅ True</button><button class="ff">❌ False</button></div></div>`;
  const show=()=>{$('tfn').textContent=`⚡ ${k+1} of ${p.statements.length}`;const e=$('tfs');e.textContent=p.statements[k];e.classList.remove('pop');void e.offsetWidth;e.classList.add('pop');};
  const pick=v=>{ans.push(v);k++;if(k<p.statements.length)show();else{$('mc').querySelector('.tfb').remove();$('tfs').textContent='Checking your speed round… ⚡';send(ans.join(''));}};
  $('mc').querySelector('.tt').onclick=()=>pick('T');$('mc').querySelector('.ff').onclick=()=>pick('F');show();},
 numberline(p){const {min,max,step}=p.line,W=300,x=v=>20+(v-min)/(max-min)*(W-40);let val=null;
  const snap=v=>Math.min(max,Math.max(min,Math.round((v-min)/step)*step+min));const fmt=v=>+v.toFixed(4)+'';
  $('mc').innerHTML=`<div class="small">Drag the 🚩 to the right spot on the number line!</div><div class="nlw">${nline(min,max,p.line.labels||[])}<div class="nlv" id="nlv">Tap or drag</div></div>`;
  const svg=$('mc').querySelector('svg');svg.insertAdjacentHTML('beforeend',`<g id="flag" style="display:none"><line x1="0" y1="10" x2="0" y2="40" stroke="#c62828" stroke-width="3"/><text x="0" y="14" font-size="22" text-anchor="start">🚩</text></g>`);
  const set=e=>{const r=svg.getBoundingClientRect(),vx=(e.clientX-r.left)/r.width*W;val=snap(min+(vx-20)/(W-40)*(max-min));const f=$('flag');f.style.display='';f.setAttribute('transform',`translate(${x(val)},0)`);$('nlv').textContent='🚩 '+fmt(val);$('chk').disabled=false;};
  let down=false;svg.style.touchAction='none';svg.addEventListener('pointerdown',e=>{down=true;svg.setPointerCapture(e.pointerId);set(e);});svg.addEventListener('pointermove',e=>down&&set(e));svg.addEventListener('pointerup',()=>down=false);
  checkBtn(()=>val!=null&&send(fmt(val)));$('chk').disabled=true;},
 fracbar(p){const n=p.parts,on=new Set();const W=300,w=(W-10)/n;
  $('mc').innerHTML=`<div class="small">Tap the pieces to color them in!</div><svg viewBox="0 0 ${W} 80" class="fb">${[...Array(n)].map((_,i)=>`<rect data-i="${i}" x="${5+i*w}" y="10" width="${w}" height="60" rx="5"/>`).join('')}</svg><div class="nlv" id="fbv">0/${n}</div>`;
  $('mc').querySelectorAll('rect').forEach(r=>r.onclick=()=>{const i=+r.dataset.i;on.has(i)?on.delete(i):on.add(i);r.classList.toggle('on');$('fbv').textContent=`${on.size}/${n}`;});
  checkBtn(()=>send(`${on.size}/${n}`));}};

// ---------- quest strip, mini-sessions ----------
// quest path: stage stones with 🗝️ review gates between them (locked = dim, open = gold)
function qpath(Q,{cur=false,big=false}={}){const G=Object.fromEntries((Q.gates||[]).map(x=>[x.before,x]));
 return `<div class="qpath${big?' big':''}">${Q.stages.map((x,i)=>`${i?'<i></i>':''}${G[i]?`<span class="qk ${G[i].state}" title="${G[i].state==='open'?'Gate open':'Review gate: answer something from before to pass'}">🗝️</span><i></i>`:''}<span class="qs ${x.complete?'done':cur&&i===Q.current?'cur':''} ${x.boss?'boss':''}" title="${esc(x.name)}">${x.complete&&!big?'✅':esc(x.emoji)}</span>`).join('')}</div>`;}
function questStrip(s,p){const el=$('qstrip');if(!el)return;const Q=s.quest;
 if(p.mini){el.hidden=false;el.className='qstrip mini';el.innerHTML=`<span>🔍 Exploring: <b>${esc(p.topic.name)}</b> · ${p.mini.n} of ${p.mini.of}</span><button class="ghost sm" onclick="miniQuit()">🗺️ Back to map</button>`;return;}
 if(!Q||!Q.started||Q.completed){// honest empty state (no stale quest title / "behind by a day" confusion)
  if(!Q&&(p.mode==='review'||p.format==='review')){el.hidden=false;el.className='qstrip empty';el.innerHTML=`<div class="qsh">📝 <b>No quest running right now</b> <span class="small">Jane writes a new one after you finish the last — keep exploring!</span></div>`;return;}
  el.hidden=true;return;}
 if(!String(p.ptype||'')&&!p.gate){el.hidden=true;return;}
 el.hidden=false;el.className='qstrip';el.innerHTML=`<div class="qsh">${esc(Q.emoji)} <b>${esc(Q.title)}</b> <span class="small">Stage ${Math.min(Q.stages.length,Q.current+1)} of ${Q.stages.length}${Q.date?` · ${esc(Q.date)}`:''}</span></div>${s.quests?.boost?`<div class="boost">${esc(s.quests.boost.emoji)} ${gl(s.quests.boost.message||'')}</div>`:''}${qpath(Q,{cur:true})}`;}
async function miniQuit(){const s=await api('/api/mini/quit',{});render(s);goMap(s.mini?.subject);}
function goMap(sub){if(window._afterMini){render(window._afterMini);window._afterMini=null;}if(sub)zoomed=sub;document.querySelector('.tab[data-v=map]').click();}
function miniEnd(r){const m=r.miniDone;$('f').style.display='none';$('mc').innerHTML='';
 $('extra').innerHTML=`<div class="miniend"><div class="big">${m.mastered?'🏆':'🌟'}</div><b>${m.mastered?`You conquered "${esc(m.name)}"!`:`Nice exploring, "${esc(m.name)}" is on your map!`}</b><br><button onclick="goMap('${esc(m.subject)}')">🗺️ Back to my map</button></div>`;
 confetti(m.mastered?70:30);window._afterMini=r.state;setTimeout(()=>{if(!$('play').hidden&&$('extra').querySelector('.miniend'))goMap(m.subject);},4500);}
function stoneCard(i){const t=TAX.topics[i],c=mapData.codes[i];const o=document.createElement('div');o.className='scard';
 const act=c==='r'||c==='l'?['🚀 Explore now!','explore']:c==='v'?['🧠 Practice now','practice']:null;
 o.innerHTML=`<div class="scbox s-${c}"><button class="x" aria-label="close">✕</button><div class="scemo">${esc(t.ic||'⭐')}</div><h3>${esc(t.sn||t.name)}</h3><div class="pill p-${c}">${SN[c]}</div><p class="small">${esc(t.domain)} · ages ${t.ageRangeStart}+</p>
 ${act?`<button class="bigbtn ${act[1]}" id="scgo">${act[0]}</button><div class="small">${act[1]==='explore'?'A quick mini-adventure, then back to your map!':'A quick memory check to keep it shiny!'}</div>`:c==='m'?'<p>⭐ You already mastered this one!</p>':'<p>🔒 Unlock the stones before it first!</p>'}</div>`;
 document.body.appendChild(o);const close=()=>o.remove();o.querySelector('.x').onclick=close;o.onclick=e=>{if(e.target===o)close();};
 if(act)$('scgo').onclick=async()=>{const s=await api('/api/explore',{topicId:t.id});close();if(s.error){say(s.error);return;}document.querySelector('.tab[data-v=play]').click();render(s);say(act[1]==='explore'?`Let's explore "${t.sn||t.name}"! 🚀`:`Memory check: "${t.sn||t.name}"! 🧠`);};}

// ---------- quests: reveal, tab, medal ----------
function questDot(s){const d=document.querySelector('.tab[data-v=quests] .dot');if(d)d.hidden=!s.newQuest;}
function questReveal(Q){const o=document.createElement('div');o.className='qreveal';
 o.innerHTML=`<div class="rays"></div><div class="qrbox"><div class="qrnew">✨ NEW QUEST! ✨</div><div class="chest"><div class="lid"></div><div class="base"><span class="lock">🔒</span></div><div class="glow"></div></div>
 <div class="scroll"><div class="rod"></div><div class="paper"><div class="qemo">${esc(Q.emoji)}</div><h2>${esc(Q.title)}</h2><p>${esc(Q.hook)}</p>
 ${qpath(Q,{big:true})}
 <div class="small">${Q.stages.length} stages · boss finale · win the <b>${esc(Q.medal.emoji)} ${esc(Q.medal.name)}</b></div><button class="bigbtn" id="qstart">⚔️ Start the quest!</button></div><div class="rod"></div></div></div>`;
 document.body.appendChild(o);confetti(50);
 $('qstart').onclick=async()=>{const s=await api('/api/quest/start',{date:Q.date});if(s.error){o.remove();say(s.error);return;}o.classList.add('out');setTimeout(()=>o.remove(),400);document.querySelector('.tab[data-v=play]').click();render(s);questDot(s);say(`Let's go! Stage 1: ${Q.stages[0].name}! ${Q.stages[0].emoji}`);};}
// v0.5: one quest at a time: the current quest big, a secret "Next up: ???" teaser, then the finished ones
function qcardHTML(q,big){return`<div class="qcard ${big?'cur':''} ${q.today&&big?'now':''} ${q.completed?'won':''}"><div class="qch"><span class="qemo">${esc(q.emoji)}</span><div><b>${esc(q.title)}</b>${big&&!q.started&&q.isQuest?'<span class="newtag">NEW!</span>':''}<div class="small">${q.today?'Today’s quest':new Date(q.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · ${q.completed?'🏅 Won!':q.started?'In progress':q.isQuest?'Not started':'Adventure'}</div></div></div>
  ${big&&q.hook?`<p>${esc(q.hook)}</p>`:''}${qpath(q)}
  <div class="track"><i style="width:${q.pct}%;background:linear-gradient(90deg,#00e676,#ffd54f)"></i></div><div class="small">${q.done} / ${q.total} steps · ${q.pct}% ${q.completed?`· ${esc(q.medal.emoji)} ${esc(q.medal.name)}`:''}</div>
  ${big&&q.boost?`<div class="boost">${esc(q.boost.emoji)} ${esc(q.boost.message||'')}</div>`:''}${big&&q.isQuest&&!q.completed?`<button class="qgo">${q.started?'▶ Keep going':'⚔️ Start'}</button>`:''}</div>`;}
async function loadQuests(){const d=await api('/api/quests');const el=$('qlist'),q=d.current;
 $('qcapline').innerHTML=q&&q.isQuest&&!q.completed?`<b>🗺️ Your quest: ${esc(q.title)}</b>`:'';
 el.innerHTML=(q?qcardHTML(q,true):'<p>No quest right now. Check back tomorrow! 🗺️</p>')
  +(d.nextUp?'<div class="qcard nextup"><div class="qch"><span class="qemo">❓</span><div><b>Next up: ???</b><div class="small">🗝️ Finish your quest to unlock it!</div></div></div></div>':'')
  +(d.finished.length?`<h3 class="qfin">🏅 Finished quests</h3>${d.finished.map(f=>qcardHTML(f,false)).join('')}`:'');
 const b=el.querySelector('.qgo');if(b)b.onclick=async()=>{if(!q.started)return questReveal(q);const s=await api('/api/quest/start',{date:q.date});document.querySelector('.tab[data-v=play]').click();if(s.error)return say(s.error);render(s);say(`Back to "${q.title}"! You've got this! 💪`);};}
function questMedal(m){reveal({tier:'quest',name:m.name,ic:m.emoji,subject:'Quest: '+m.title},0);}
if(location.hash==='#quest-preview')api('/api/state').then(s=>s.quest&&questReveal(s.quest));

// ---------- glossary: dotted key terms with kid definitions (hover on desktop, tap on phones) ----------
let GLOSS={},GRE=null,PACKT={},GUSED=new Set();
async function loadGloss(){try{const d=await (await fetch('/glossary.json')).json();for(const x of d.terms)for(const f of x.t)GLOSS[f.toLowerCase()]={w:x.t[0],e:x.e,d:x.d};}catch(e){}GRE=null;}
function glReset(){GUSED=new Set();}
function glEntries(){const all={...GLOSS};for(const [k,v] of Object.entries(PACKT||{}))all[k.toLowerCase()]=typeof v==='string'?{w:k,d:v,e:''}:{w:k,d:v.d||v.def||'',e:v.e||v.emoji||''};return all;}
let GKEY='';
function gl(text,used=GUSED){text=String(text??'');const all=glEntries(),key=Object.keys(PACKT||{}).join('|');
 if(!GRE||GKEY!==key){const ks=Object.keys(all).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));GRE=ks.length?new RegExp(`(^|[^A-Za-z0-9'’-])(${ks.join('|')})(s|es)?(?![A-Za-z0-9-])`,'gi'):null;GKEY=key;}
 if(!GRE)return esc(text);let out='',last=0;GRE.lastIndex=0;let m;
 while((m=GRE.exec(text))){const k=m[2].toLowerCase(),en=all[k];const st=m.index+m[1].length,word=m[2]+(m[3]||'');
  if(!en||used.has(en.w.toLowerCase())||/\d[\/.]?$/.test(text.slice(0,st))){continue;}used.add(en.w.toLowerCase());
  out+=esc(text.slice(last,st))+`<span class="gt" tabindex="0" role="button" data-k="${esc(k)}">${esc(word)}</span>`;last=st+word.length;}
 return out+esc(text.slice(last));}
function gpop(el){const all=glEntries(),en=all[el.dataset.k];if(!en)return;let p=$('gpop');if(!p){p=document.createElement('div');p.id='gpop';p.className='gpop';document.body.appendChild(p);}
 p.innerHTML=`<i class="garrow"></i><div class="gw">${esc(en.e||'📘')} <b>${esc(en.w)}</b></div><div>${esc(en.d)}</div>`;p.setAttribute('role','tooltip');p.hidden=false;const r=el.getBoundingClientRect(),W=Math.min(300,innerWidth-20);p.style.width=W+'px';
 if(window.FX&&FX.place(el,p,p.querySelector('.garrow'))){document.querySelectorAll('.gt.open').forEach(x=>x.classList.remove('open'));el.classList.add('open');FX.sound('pop');}else{
 p.style.position='';p.style.left=Math.max(10,Math.min(innerWidth-W-10,r.left+r.width/2-W/2))+'px';const top=r.bottom+8;p.style.top=(top+120>innerHeight?r.top-p.offsetHeight-8:top)+scrollY+'px';
 document.querySelectorAll('.gt.open').forEach(x=>x.classList.remove('open'));el.classList.add('open');}
 if(el.dataset.k!==gpop.last||Date.now()-(gpop.at||0)>5000){gpop.last=el.dataset.k;gpop.at=Date.now();fetch('/api/term',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({term:en.w})}).catch(()=>{});}}
function gclose(){const p=$('gpop');if(p)p.hidden=true;document.querySelectorAll('.gt.open').forEach(x=>x.classList.remove('open'));}
document.addEventListener('click',e=>{const t=e.target.closest?.('.gt');if(t){e.preventDefault();e.stopPropagation();t.classList.contains('open')?gclose():gpop(t);return;}if(!e.target.closest?.('#gpop'))gclose();},true);
document.addEventListener('keydown',e=>{const t=e.target.closest?.('.gt');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();gpop(t);}if(e.key==='Escape')gclose();});
if(matchMedia('(hover:hover)').matches){document.addEventListener('mouseover',e=>{const t=e.target.closest?.('.gt');if(t)gpop(t);});document.addEventListener('mouseout',e=>{const t=e.target.closest?.('.gt');if(t&&!e.relatedTarget?.closest?.('.gt'))gclose();});}
addEventListener('scroll',()=>gclose(),{passive:true});

// ---------- polish hooks (public/fx.js): entrances, springs, a11y, skeletons. Behavior is unchanged without FX. ----------
(()=>{if(!window.FX)return;let lastKey='';
 const _render=render;render=function(s){_render(s);const p=s?.item;if(!p)return;$('pcard').classList.remove('loading');const key=(p.topicId||'')+'|'+(p.q||p.title||'');
  if(key!==lastKey){lastKey=key;FX.enter($('pcard'));FX.stagger($('mc').querySelectorAll(':scope > button, .pics > button, .match button, .ord > li, .tfb > button, svg'),{delay:.08});if(p.intro)FX.enter($('intro'));}};
 let lastPts=null;const _chips=chips;chips=function(s){_chips(s);if(lastPts!=null&&s.points>lastPts)FX.bump($('pts'));if(s.streak>=3&&lastPts!=null&&s.points>lastPts)FX.bump($('streak'));lastPts=s.points;};
 const _draw=drawMap;drawMap=function(){_draw();FX.kbd($('world'),'.isl',el=>`${el.dataset.s} island: open it`);};
 const _troph=loadTrophies;loadTrophies=async function(){if(!$('tgrid').children.length)$('tgrid').innerHTML='<div class="sk sk-cell"></div>'.repeat(8);await _troph();FX.stagger($('tgrid').querySelectorAll('.tcell'),{step:.03});};
 const _quests=loadQuests;loadQuests=async function(){if(!$('qlist').children.length)$('qlist').innerHTML='<div class="card sk sk-quest"></div>'.repeat(2);await _quests();FX.stagger($('qlist').children,{step:.06});};
 const _reveal=reveal;reveal=function(m,inf){_reveal(m,inf);FX.sound('win');FX.haptic('win');const b=document.querySelector('.reveal .rbox');FX.anim(b,{transform:['scale(.6) rotate(-6deg)','scale(1) rotate(0)'],opacity:[0,1]},{stiffness:260,damping:14});const btn=document.querySelector('.reveal button');btn?.focus();};
 const _qr=questReveal;questReveal=function(Q){_qr(Q);FX.sound('open');const b=document.querySelector('.qreveal .qrbox');FX.anim(b,{transform:['translateY(40px) scale(.9)','none'],opacity:[0,1]},{stiffness:220,damping:16});setTimeout(()=>$('qstart')?.focus(),300);};
 const _conf=confetti;confetti=function(n=40){if(!FX.burst(null,n>=60))_conf(n);};
 addEventListener('scroll',()=>gclose(),{passive:true});
 FX.soundButton($('snd'));
 // tabs: arrow keys move between tabs
 const tabs=[...document.querySelectorAll('.tab')];tabs.forEach((t,i)=>t.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const n=tabs[(i+d+tabs.length)%tabs.length];n.focus();n.click();}));
 // Escape closes medal / stone / quest overlays
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;(document.querySelector('.finale #fnok')||document.querySelector('.coverlay #cclose')||document.querySelector('.scard .x')||document.querySelector('.reveal .rbox button'))?.click();});
})();

// ---------- Points Market (plans/archive/points-market.md, #74; idea credit: Christopher) ----------
// Points buy fun, choice and peeks: never mastery, medals or permanent fog clear. The server keeps the wallet
// (balance = earned − spent) and the prices; the client only sends a purchase id (pid) so a retry never charges twice.
const MK_GROUP={'skin-ship':'⛵ Ships','skin-avatar':'🙂 Avatars','skin-boss':'👾 Boss skins','skin-theme':'🎨 Map themes',sticker:'🌟 Stickers',flare:'🎆 Peek into the fog',prove:'🎟️ Prove it',path:'🧭 Choose your next quest',theme:'🧭 Choose your next quest',extra:'🎒 Handy extras',chest:'🧰 Mystery chests (found under the fog!)'};
const mkPid=()=>{const r=globalThis.crypto?.randomUUID?.()||(Date.now().toString(36)+Math.random().toString(36).slice(2,12));return('p'+r).replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);};
let MK=null,_mkFocus=null;
async function loadMarket(){let d;try{d=await api('/api/market');}catch{d=null;}if(!d||d.error){$('mlist').innerHTML='<p class="small">The Market is closed for a moment. Try again soon! 🛒</p>';return;}
 MK=d;if(st){st.wallet=d.wallet;chips(st);}paintMarket();}
function mkSetWallet(r){if(r.wallet&&r.items)MK={...MK,wallet:r.wallet,items:r.items,prove:r.prove?.due?r.prove:MK?.prove,path:r.path?.offers?r.path:MK?.path};if(r.state){st=r.state;chips(st);}}
function paintMarket(){const d=MK;if(!d)return;const W=d.wallet;
 $('mbal').innerHTML=`<div class="mkbal">⭐ ${W.balance.toLocaleString()} <span>to spend</span></div><div class="small">earned ${W.earned.toLocaleString()} · spent ${W.spent.toLocaleString()} · your medals and skills never cost points</div>${mkShelf(W,d)}`;
 const groups={};for(const it of d.items)(groups[it.slot?'skin-'+it.slot:it.kind==='theme'?'path':it.kind]??=[]).push(it);
 $('mlist').innerHTML=Object.entries(groups).map(([k,items])=>`<div class="card mksec"><h3>${esc(MK_GROUP[k]||k)}</h3><div class="mkgrid">${items.map(mkCard).join('')}</div></div>`).join('');
 $('mlist').querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const it=d.items.find(i=>i.id===b.dataset.buy);if(it?.kind==='flare')return mkFlare(it);if(it?.kind==='prove')return mkProve(it);if(it?.kind==='path'||it?.kind==='theme')return mkPick(it);mkConfirm(it,it.kind==='chest'?{after:r=>r.prize&&chestReveal(r.prize)}:{});});
 $('mlist').querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>mkEquip(b.dataset.slot,b.dataset.eq==='off'?null:b.dataset.eq));}
function mkCard(it){const bal=MK.wallet.balance,PV=MK.prove;
 if(it.kind==='prove'&&PV&&(!PV.due.length||!PV.left))return`<div class="mkcard" id="mkprove"><div class="mkemo" aria-hidden="true">${esc(it.emoji)}</div><b>${esc(it.title)}</b><div class="small">${esc(it.note||'')}</div><div class="mkprice">⭐ ${it.price}</div><button type="button" disabled>${PV.left?'No reviews due right now 🌱':'Come back tomorrow 🌙'}</button></div>`;
 const pk=(it.kind==='path'||it.kind==='theme')&&MK.wallet.choices?.[it.kind],open=pk&&!pk.used;
 if(open||(it.kind==='path'&&MK.path&&!MK.path.offers.length))return`<div class="mkcard${open?' on':''}"><div class="mkemo" aria-hidden="true">${esc(it.emoji)}</div><b>${esc(it.title)}</b><div class="small">${esc(it.note||'')}</div><div class="mkprice">⭐ ${it.price}</div><button type="button" disabled>${open?`✓ Picked: ${esc(pk.name||((pk.emoji||'')+' '+pk.title))}`:'No ready topics right now 🌱'}</button></div>`;
 const btn=it.owned&&it.slot?(it.equipped?`<button type="button" class="ghost" data-eq="off" data-slot="${esc(it.slot)}">✓ Wearing · take off</button>`:`<button type="button" data-eq="${esc(it.id)}" data-slot="${esc(it.slot)}">Wear it</button>`)
  :it.owned&&it.once?`<span class="mkown">✓ ${it.kind==='chest'?'Opened!':'Yours!'}</span>`
  :`<button type="button" data-buy="${esc(it.id)}"${it.affordable?'':' disabled'}>${it.affordable?`Buy · ⭐ ${it.price}`:`Need ${it.price-bal} more ⭐`}</button>`;
 return`<div class="mkcard${it.owned?' own':''}${it.equipped?' on':''}"><div class="mkemo" aria-hidden="true">${esc(it.emoji)}</div><b>${esc(it.title)}</b><div class="small">${esc(it.note||'')}</div><div class="mkprice">⭐ ${it.price}</div>${btn}</div>`;}
function mkClose(){const o=document.querySelector('.mkconfirm');if(!o)return;o.remove();(_mkFocus&&document.contains(_mkFocus)?_mkFocus:$('mbal'))?.focus?.();_mkFocus=null;}
// buy → confirm → owned. opt.meta goes to the server (e.g. a flare's region); opt.after(r) runs after a good buy.
function mkConfirm(it,opt={}){if(!it||!MK)return;mkClose();_mkFocus=document.activeElement;const pid=mkPid(),left=MK.wallet.balance-it.price;
 const o=document.createElement('div');o.className='mkconfirm';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label','Buy '+it.title);
 o.innerHTML=`<div class="mkbox"><div class="mkemo" aria-hidden="true">${esc(it.emoji)}</div><h3>Buy ${esc(it.title)}?</h3>${opt.extra||''}<p id="mkmsg">It costs <b>⭐ ${it.price}</b>. You'll have <b>⭐ ${left}</b> left.</p>
 <div class="small">Points buy fun stuff. Your medals and skills stay exactly the same.</div><div class="hb"><button type="button" id="mkyes">Yes, buy it! 🛒</button><button type="button" class="ghost" id="mkno">Not now</button></div></div>`;
 document.body.appendChild(o);const yes=o.querySelector('#mkyes'),no=o.querySelector('#mkno');
 no.onclick=mkClose;o.onclick=e=>{if(e.target===o)mkClose();};
 o.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();mkClose();}if(e.key==='Tab'){const f=[...o.querySelectorAll('button:not([disabled]),select')];const i=f.indexOf(document.activeElement);e.preventDefault();f[(i+(e.shiftKey?-1:1)+f.length)%f.length]?.focus();}};
 yes.onclick=async()=>{yes.disabled=true;let r;const meta=opt.meta?.(o);
  try{r=await api('/api/market/buy',{pid,item:it.id,meta});}catch{yes.disabled=false;o.querySelector('#mkmsg').textContent='Oops, the internet hiccuped. Tap again: you will only pay once.';return;}
  if(r.error){o.querySelector('#mkmsg').textContent=r.error;return;}
  mkSetWallet(r);
  if(it.slot&&!r.already){try{const e=await api('/api/market/equip',{slot:it.slot,item:it.id});if(!e.error)mkSetWallet(e);}catch{}}
  mkClose();paintMarket();if(!r.already){if(!(window.FX&&FX.good?.($('mbal'),true)))confetti(30);banner(`🛒 ${esc(it.title)} is yours!`);}opt.after?.(r);};
 setTimeout(()=>yes.focus(),50);}
async function mkEquip(slot,item){let r;try{r=await api('/api/market/equip',{slot,item});}catch{return;}if(r.error){say(r.error);return;}mkSetWallet(r);paintMarket();}
// scout flare: pick a fogged island (least clear first), buy, then fly to it on the Map
function mkFlare(it,pre){const F=st?.fog||mapData?.fog||{},by=F.bySubject||{},on=new Set((F.flares||[]).map(f=>f.region));
 const opts=Object.entries(by).filter(([k,b])=>b.total&&b.clear<b.total&&!on.has(k)).sort((a,b)=>a[1].clear/a[1].total-b[1].clear/b[1].total);
 if(!opts.length){say('No foggy islands left to light up right now! ✨');return;}
 mkConfirm(it,{extra:`<label for="mkreg"><b>Which island?</b></label><br><select id="mkreg">${opts.map(([k,b])=>`<option value="${esc(k)}"${k===pre?' selected':''}>${esc((ISL[k]?.e||'🏝️')+' '+(ISL[k]?.s||k))} · ${Math.round(100*b.clear/b.total)}% clear</option>`).join('')}</select>
  <div class="small">For 24 hours you'll see skill names and where secrets hide. Then the fog rolls back. Only mastering skills clears it for good!</div>`,
  meta:o=>({region:o.querySelector('#mkreg').value}),after:r=>{if(r.flare)goMap(r.flare.region);}});}
// prove-it: pick a due review (most overdue first); a gate's own topic is not offered while its gate item is on screen
function openProve(){document.querySelector('.tab[data-v=market]').click();setTimeout(()=>$('mkprove')?.scrollIntoView({behavior:'smooth',block:'center'}),600);}
function mkProve(it){const gt=st?.item?.gate?st.item.topicId:null,due=(MK?.prove?.due||[]).filter(d=>d.topicId!==gt);
 if(!due.length){say('No reviews are due right now. Nice work! 🌱');return;}
 mkConfirm(it,{extra:`<label for="mkpv"><b>Which review?</b></label><br><select id="mkpv">${due.map(d=>`<option value="${esc(d.topicId)}">${esc((d.ic||ISL[d.subject]?.e||'🧠')+' '+d.name)}${d.overdueDays?` · due ${d.overdueDays} day${d.overdueDays>1?'s':''} ago`:' · due now'}</option>`).join('')}</select>
  <div class="small">One HARDER question, one try. Right: the review is cleared + ${MK.prove.bonus} bonus points. Wrong: the review stays, and the ticket is used up. ${MK.prove.left} left today.</div>`,
  meta:o=>({topicId:o.querySelector('#mkpv').value}),after:r=>{if(r.state?.item?.format==='prove'){document.querySelector('.tab[data-v=play]').click();render(r.state);say('🎟️ Here is your Prove-It question. Show me what you know!');}}});}
// pick your path: the NEXT new quest is built around the pick (the nightly author honors it); Play shows it until then
function mkPick(it){const P=MK?.path||{offers:[],themes:[]},path=it.kind==='path',opts=path?P.offers.map(o=>[o.topicId,`${o.ic||ISL[o.subject]?.e||'📚'} ${o.name} · ${o.subject}`]):P.themes.map(t=>[t.id,`${t.emoji} ${t.title}`]);
 if(!opts.length){say('Nothing to pick right now. Check back tomorrow! 🌱');return;}
 mkConfirm(it,{extra:`<label for="mkpk"><b>${path?'Your next quest will be about…':'Your next quest happens in…'}</b></label><br><select id="mkpk">${opts.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>
  <div class="small">${path?'You still learn it step by step: learn card, practice, then the boss!':'Jane writes the story in that world.'} It shows up in your next NEW quest.</div>`,
  meta:o=>path?{topicId:o.querySelector('#mkpk').value}:{theme:o.querySelector('#mkpk').value},after:()=>pickLine(st)});}
function pickLine(s){const C=s?.wallet?.choices||{},p=C.path&&!C.path.used?C.path:null,t=C.theme&&!C.theme.used?C.theme:null;let el=$('pickline');
 if(!p&&!t){if(el)el.hidden=true;return;}
 if(!el){el=document.createElement('div');el.id='pickline';el.className='card pickline';el.setAttribute('role','status');$('campaign').after(el);}
 el.hidden=false;el.innerHTML=`🧭 <b>Next quest: your pick!</b> ${p?esc(p.name):''}${p&&t?' · ':''}${t?esc((t.emoji||'')+' '+t.title):''}<span class="small"> Jane is building it.</span>`;}
// stickers, titles, extras in your pocket, and a teaser for rows still hidden in the fog
function mkShelf(W,d){const st0=(d.items||[]).filter(i=>i.kind==='sticker'&&i.owned).map(i=>({emoji:i.emoji,title:i.title})),sts=[...st0,...(W.stickers||[])];
 const pk=[W.hintTokens&&`🤫 ×${W.hintTokens}`,W.shield&&`🛡️ ×${W.shield}`,W.freeze&&`🧊 ×${W.freeze}`].filter(Boolean);
 return(sts.length?`<div class="mkshelf" aria-label="Your stickers">${sts.map(x=>`<span title="${esc(x.title)}">${esc(x.emoji)}</span>`).join('')}</div>`:'')
  +((W.titles||[]).length?`<div class="small">🏷️ Titles: ${W.titles.map(t=>`<b>${esc(t.title)}</b>`).join(' · ')}</div>`:'')
  +(pk.length?`<div class="small">🎒 In your pocket: ${pk.join(' · ')}</div>`:'')
  +(d.hidden?`<div class="small mkfog">🌫️ ${d.hidden} more thing${d.hidden>1?'s are':' is'} hidden in the fog… master skills to find ${d.hidden>1?'them':'it'}!</div>`:'');}
function chestReveal(p){const o=document.createElement('div');o.className='freveal';
 o.innerHTML=`<div class="frbox"><div class="fremo">${esc(p.emoji||'🎁')}</div><div class="frnew">🧰 The chest pops open!</div><h3>${esc(p.title||'A prize')}</h3>
 <p class="small">${p.type==='skin'?'A RARE skin! Wear it from the Market.':p.type==='title'?'A new title for your collection!':'A new sticker for your shelf!'}</p><button type="button" id="frok">Awesome!</button></div>`;
 document.body.appendChild(o);confetti(50);const close=()=>{o.remove();};o.querySelector('#frok').onclick=close;o.onclick=e=>{if(e.target===o)close();};setTimeout(()=>$('frok')?.focus(),50);}
// Jane whisper: spends one hint token on the question on screen (ungraded: never costs a try, a heart or the streak)
function showWhisper(text){const h=$('help');if(!h)return;h.hidden=false;let box=h.querySelector('.whisper-box');if(!box){box=document.createElement('div');box.className='whisper-box';h.prepend(box);}
 box.innerHTML=`<span class="wlbl">💡 Jane whisper (not the free pep talk above)</span>${esc(text)}`;}
async function whisperTap(){if($('pcard').classList.contains('busy'))return;let r;try{r=await api('/api/whisper',{});}catch{return;}if(r.error){say(r.error);return;}
 showWhisper(r.whisper);say('💡 That was a Jane whisper — a trap tip for THIS question (not just a pep talk).');if(r.state){st=r.state;if(st.item)st.item.whisper=r.whisper;chips(st);}
 const b=document.querySelector('.whisperb');if(b){b.textContent=r.tokens?`💡 Jane whisper (${r.tokens})`:'💡 Whisper used';b.disabled=true;}}
