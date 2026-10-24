// Jane's adaptive engine: topic states over the full Marble taxonomy, graph-based placement & inference,
// Leitner spaced review, lesson packs -> procedural math -> kid MCQs -> kid self-check (never the raw assessmentPrompt).
import {G,kindFor,parseNum,gcd} from './gen.js';import {solve,scaffold,isStuck,IDEA} from './stuck.js';
export {isStuck,scaffold};
const DAY=864e5, BOXES=[1,3,7,21,60];
// Learner settings (wrangler.toml [vars]: LEARNER_NAME, LEARNER_AGE, LEARNER_GRADE). Kid-facing strings use the
// placeholder {name}; the Worker substitutes it in every response, so it is never stored in progress or packs.
let NAME='Explorer', TARGET_AGE=10, GRADE='upper elementary';
export function configure(env={}){NAME=String(env.LEARNER_NAME||'Explorer').trim()||'Explorer';const a=parseFloat(env.LEARNER_AGE);TARGET_AGE=a>=4&&a<=16?a:10;GRADE=String(env.LEARNER_GRADE||'upper elementary').trim();}
export const learner=()=>({name:NAME,age:TARGET_AGE,grade:GRADE});
export const withName=(s,name=NAME)=>String(s).replace(/\{\{name\}\}|\{name\}/g,()=>name);
const PIZZA_ID='mt_e7filQgayF';
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1)), pick=a=>a[Math.floor(Math.random()*a.length)];
export function graph(TAX){const byId={},pre={},post={};for(const t of TAX.topics){byId[t.id]=t;pre[t.id]=[];post[t.id]=[];}
  for(const [t,p,h] of TAX.deps)if(byId[t]&&byId[p]){pre[t].push({id:p,h:!!h});post[p].push({id:t,h:!!h});}
  // domain-end topics (no dependents inside the same domain) -> boss battles
  // boss battles: per domain, the 2 deepest "domain end" topics (no dependents inside the same domain)
  const depth={};const dd=id=>depth[id]??=(depth[id]=0,1+Math.max(0,...pre[id].filter(e=>byId[e.id].domain===byId[id].domain).map(e=>dd(e.id))));
  const ends={};for(const t of TAX.topics)if(!post[t.id].some(e=>byId[e.id].domain===t.domain))(ends[t.subject+'|'+t.domain]??=[]).push(t.id);
  const boss=new Set(Object.values(ends).flatMap(a=>a.filter(id=>dd(id)>=3).sort((a,b)=>dd(b)-dd(a)).slice(0,2)));
  // topics a household hides (HIDE_REGIONS, lib-regions.mjs) are not in the graph; their small records only let medals earned on them still list
  const hidden={};for(const t of TAX.hidden?.topics||[])if(!byId[t.id])hidden[t.id]=t;
  return{topics:TAX.topics,byId,pre,post,boss,aliases:TAX.aliases||{},hidden};}
export const blank=()=>({v:2,name:NAME,points:0,stars:0,streak:0,bestStreak:0,solved:0,badges:[],medals:[],firstDone:false,ts:{},current:null,
  focus:null,placement:{done:false,asked:0,per:{},queue:[]},sinceReview:0,sinceChoice:0,recent:[],packSeen:{},itemsServed:0});
export function migrate(old,g){if(old&&old.v===2){if(!old.medals)backfillMedals(old,g);upgrade(old,g);return old;}const S=blank();if(!old)return S;
  for(const k of['points','stars','streak','bestStreak','solved','badges'])if(old[k]!=null)S[k]=old[k];
  S.firstDone=!!old.firstDone&&old.solved>0;
  for(const [id0,t] of Object.entries(old.topics||{})){const id=g.aliases?.[id0]||id0;if(g.byId[id]&&!S.ts[id])S.ts[id]=t.mastered?{st:'mastered',how:'direct',conf:.9,box:0,due:Date.now()+DAY,c:t.correct,w:t.incorrect}:{st:'learning',how:'direct',c:t.correct,w:t.incorrect,lvl:old.level||3};}
  backfillMedals(S,g);return S;}
// additive schema upgrades for v2 records (idempotent): finished quests from before completion snapshots are marked legacy
function upgrade(S,g){for(const q of Object.values(S.quests||{}))if(q?.done&&!q.snap&&!q.legacy)q.legacy=true;if(g)foldAliases(S,g.aliases);dedupeMedals(S);return S;}
// Topic ids removed upstream (data/topic-aliases.json, bundled as tax.aliases) are folded into their replacement
// (idempotent). Topic state: the stronger record wins (mastered > learning; direct > inferred; then more correct
// answers, then the newer one). Medals move to the new id (one per topic: dedupeMedals keeps the higher tier, earliest
// date). Per-topic help state, the current item, focus and requeued items follow. History (logs, packSeen, quest
// snapshots) is left as it was.
const REC_RANK=r=>[r?.st==='mastered'?2:r?.st?1:0,r?.how==='direct'?1:0,r?.c||0,r?.at||0];
const better=(a,b)=>{const x=REC_RANK(a),y=REC_RANK(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]>y[i]?a:b;return b;};
export function foldAliases(S,aliases){if(!S||!aliases)return S;const map=id=>aliases[id]||id;
  for(const [a,b] of Object.entries(aliases)){
    if(S.ts?.[a]){S.ts[b]=S.ts[b]?better(S.ts[a],S.ts[b]):S.ts[a];delete S.ts[a];}
    for(const k of['support','teach'])if(S[k]?.[a]){if(!S[k][b])S[k][b]=S[k][a];delete S[k][a];}}
  for(const m of S.medals||[])m.id=map(m.id);
  if(Array.isArray(S.recent))S.recent=S.recent.map(map);
  for(const k of['focus','packFocus'])if(typeof S[k]==='string')S[k]=map(S[k]);
  for(const o of[S.current,S.mini,S.miniHold,...(S.requeue||[]).map(x=>x?.item)])if(o?.topicId)o.topicId=map(o.topicId);
  return S;}
// one trophy per achievement: one medal per topic, one quest medal per quest date (the earliest is kept)
const TIER_RANK={bronze:0,silver:1,gold:2,legendary:3};
function dedupeBy(a,key){const m=new Map();for(const x of a||[]){const k=key(x),o=m.get(k);if(!o){m.set(k,{...x});continue;}
  const keep=(x.at||0)<(o.at||0)?{...x}:o;if((TIER_RANK[x.tier]??-1)>(TIER_RANK[keep.tier]??-1)||(TIER_RANK[o.tier]??-1)>(TIER_RANK[keep.tier]??-1))keep.tier=(TIER_RANK[x.tier]??-1)>(TIER_RANK[o.tier]??-1)?x.tier:o.tier;m.set(k,keep);}
  return[...m.values()].sort((a,b)=>(a.at||0)-(b.at||0));}
function dedupeMedals(S){if(S.medals){const d=dedupeBy(S.medals,m=>m.id);if(d.length!==S.medals.length)S.medals=d;}if(S.questMedals){const d=dedupeBy(S.questMedals,m=>m.date);if(d.length!==S.questMedals.length)S.questMedals=d;}}
// the trophy list (kid Trophies tab and parent report): deduped, newest first, with counts per tier
export function trophies(S,g){const M=[...dedupeBy(S.medals,m=>m.id).map(m=>medalInfo(m,g)).filter(Boolean),
  ...dedupeBy(S.questMedals,q=>q.date).map(q=>({id:'quest:'+q.date,tier:'quest',at:q.at,name:q.name,ic:q.emoji,subject:'Quest',domain:q.title,why:`finishing the quest "${q.title}"`}))].sort((a,b)=>b.at-a.at);
  const counts={};M.forEach(m=>counts[m.tier]=(counts[m.tier]||0)+1);return{medals:M,counts};}
// ---------- campaign trail + fog map (slice 1) ----------
// Quest medals fill a fixed-length trail; legendary topic medals light the Final Boss. Pure: no unlock persistence here.
export const TRAIL_LEN=12, LEGENDARY_NEED=4;
export function campaignState(S,g){const trailLen=TRAIL_LEN,need=LEGENDARY_NEED;
  const qs=[...dedupeBy(S.questMedals,q=>q.date)].sort((a,b)=>(a.at||0)-(b.at||0));
  const filled=Math.min(trailLen,qs.length);
  const nodes=Array.from({length:trailLen},(_,i)=>i<qs.length?{date:qs[i].date,name:qs[i].name,emoji:qs[i].emoji||'🏅'}:null);
  const history=qs.map(q=>({date:q.date,name:q.name,emoji:q.emoji||'🏅',title:q.title||''}));
  const legs=(S.medals||[]).filter(m=>m.tier==='legendary').sort((a,b)=>(a.at||0)-(b.at||0));
  const have=legs.length;
  const slots=Array.from({length:need},(_,i)=>{const m=legs[i];if(!m)return null;const t=g.byId?.[m.id]||g.hidden?.[m.id];return{id:m.id,name:t?.sn||t?.name||m.name||'Legendary',ic:t?.ic||'🌈',at:m.at};});
  const lit=Math.min(1,have/need),unlocked=filled>=trailLen&&have>=need;
  const leftBoss=trailLen-filled,leftLeg=Math.max(0,need-have);
  let taunt;
  if(unlocked)taunt='The Final Boss is unlocked — Jane is forging the finale…';
  else if(!filled&&!have)taunt='Beat quests to light the Campaign Trail. Legendaries wake the Final Boss!';
  else if(leftBoss>0&&leftLeg>0)taunt=leftBoss===1?`1 boss till the Final Boss — and ${leftLeg} legendary${leftLeg===1?'':'s'} to light it!`:`${leftBoss} bosses till the Final Boss…`;
  else if(leftBoss>0)taunt=leftBoss===1?'1 boss left — then the Final Boss!':`${leftBoss} bosses till the Final Boss…`;
  else taunt=leftLeg===1?'Trail full! 1 legendary win lights the Final Boss!':`Trail full! ${leftLeg} legendary wins to fully light the Final Boss!`;
  const revealedAt=S.campaign?.finalBossRevealedAt||null;
  return{trailLen,filled,nodes,history,legendaries:{have,need,slots},finalBoss:{lit,unlocked,revealedAt},taunt};}
// Persist Final Boss unlock once (slice 6). Never invents medals. Returns {justUnlocked, revealedAt}.
export function syncFinale(S,g,now=Date.now()){const C=campaignState(S,g);
  if(!C.finalBoss.unlocked)return{justUnlocked:false,revealedAt:S.campaign?.finalBossRevealedAt||null};
  if(S.campaign?.finalBossRevealedAt)return{justUnlocked:false,revealedAt:S.campaign.finalBossRevealedAt};
  const medalsBefore=(S.medals||[]).length,qmBefore=(S.questMedals||[]).length;
  S.campaign??={};S.campaign.finalBossRevealedAt=now;
  if((S.medals||[]).length!==medalsBefore||(S.questMedals||[]).length!==qmBefore)throw new Error('syncFinale must not invent medals');
  return{justUnlocked:true,revealedAt:now};}
// Fog clear = direct mastery (map "lights on"); inferred mastery does not clear fog.
// Finds (slice 5): table-driven chests/secrets/power-ups revealed when clear thresholds hit; claim once; never invent medals or skip mastery (D11).
export const FOG_FINDS=[
  {id:'chest-world-5',kind:'chest',emoji:'📦',title:'Explorer\'s Chest',when:{clear:5},reward:{type:'fun',note:'A brass compass sticker for your map!'}},
  {id:'chest-math-25',kind:'chest',emoji:'💎',title:'Math Island Treasure',when:{subject:'Mathematics',pct:25},reward:{type:'fun',note:'Sparkly fraction gems (cosmetic).'}},
  {id:'secret-sci-30',kind:'secret',emoji:'🔮',title:'Hidden Lab Path',when:{subject:'Science',pct:30},reward:{type:'path',note:'A ready Science stretch is glowing — explore it on the Map.'}},
  {id:'power-hint-10',kind:'power',emoji:'💡',title:'Hint Token',when:{clear:10},reward:{type:'hintToken',note:'One extra hint next time you\'re stuck. Never skips teach→practice→graded→boss.'}},
  {id:'chest-eng-20',kind:'chest',emoji:'📜',title:'Story Scroll',when:{subject:'English',pct:20},reward:{type:'skin',note:'A parchment story skin Jane can weave into tomorrow\'s hook.'}},
  {id:'power-fact-15',kind:'power',emoji:'🃏',title:'Fun-Fact Card',when:{clear:15},reward:{type:'funFact',note:'A cool fact card for the next quest intro — garnish only.'}},
];
function fogClearCounts(S,g){const bySubject={};let clear=0,total=0,mask='';
  for(const t of g.topics){total++;const ok=S.ts[t.id]?.st==='mastered'&&S.ts[t.id]?.how==='direct';if(ok)clear++;mask+=ok?'C':'F';
    const b=bySubject[t.subject]??={clear:0,total:0};b.total++;if(ok)b.clear++;}
  return{clear,total,pct:total?Math.round(1000*clear/total)/10:0,bySubject,mask};}
function findEligible(def,counts){const w=def.when||{};
  if(w.clear!=null&&counts.clear<w.clear)return false;
  if(w.subject){const b=counts.bySubject[w.subject];if(!b||!b.total)return false;const pct=Math.round(1000*b.clear/b.total)/10;if(w.pct!=null&&pct<w.pct)return false;if(w.clear!=null&&b.clear<w.clear)return false;}
  return true;}
export function fogState(S,g){const counts=fogClearCounts(S,g);const claimed=S.fog?.finds||[];
  const have=new Set(claimed.map(f=>f.id));
  const available=FOG_FINDS.filter(d=>!have.has(d.id)&&findEligible(d,counts)).map(d=>({id:d.id,kind:d.kind,emoji:d.emoji,title:d.title,reward:d.reward}));
  const finds=claimed.map(f=>{const d=FOG_FINDS.find(x=>x.id===f.id);return{id:f.id,kind:f.kind||d?.kind,emoji:f.emoji||d?.emoji,title:f.title||d?.title,claimedAt:f.claimedAt,reward:d?.reward};});
  return{...counts,finds,available};}
// Idempotent claim. Never awards medals, mastery, quest medals, or bypasses teach→practice→graded→boss.
export function claimFind(S,g,id,now=Date.now()){const def=FOG_FINDS.find(d=>d.id===id);if(!def)return{error:'unknown find'};
  S.fog??={finds:[]};S.fog.finds??=[];
  if(S.fog.finds.some(f=>f.id===id))return{ok:true,already:true,find:S.fog.finds.find(f=>f.id===id)};
  const counts=fogClearCounts(S,g);if(!findEligible(def,counts))return{error:'not yet uncovered'};
  const medalsBefore=(S.medals||[]).length,qmBefore=(S.questMedals||[]).length;
  const find={id:def.id,kind:def.kind,emoji:def.emoji,title:def.title,claimedAt:now};
  S.fog.finds.push(find);
  if(def.reward?.type==='hintToken'){S.fog.buffs??={};S.fog.buffs.hintToken=(S.fog.buffs.hintToken||0)+1;}
  if((S.medals||[]).length!==medalsBefore||(S.questMedals||[]).length!==qmBefore)throw new Error('claimFind must not invent medals');
  return{ok:true,find,reward:def.reward};}
// ---------- Points Market (plans/points-market.md, #74; idea credit: Christopher) ----------
// M0 points buy fun, choice and peeks: never mastery, medals, boss hearts, gate opening, quest-stage skips or permanent fog clear.
// M1 S.points is the lifetime EARNED total and is never decremented. M2 balance = S.points − S.wallet.spent, server-side only.
// M3 purchases are idempotent by purchase id (pid), one-time items also by item id. M4 prices are knobs in MARKET; a ledger
// row keeps the price paid, so retuning never rewrites history. Rows with `when` (like FOG_FINDS) show only after fog clears.
export const MARKET=[
  {id:'test-sticker',kind:'sticker',once:true,price:25,emoji:'🌟',title:'Gold star sticker',note:'A shiny sticker for your collection.'},
];
export const WALLET_DAYS=60;
const PID=/^[A-Za-z0-9_-]{6,64}$/;
function walletOf(S){const W=S.wallet??={};W.spent??=0;W.ledger??=[];W.owned??={};W.equipped??={};W.active??={};W.choices??={};W.days??={};return W;}
export const balanceOf=S=>(S.points||0)-(S.wallet?.spent||0);
// what a purchase may never touch (M0): points earned, medals, quest medals, mastery records, fog finds
function m0Sig(S){return JSON.stringify([S.points||0,S.medals||[],S.questMedals||[],Object.entries(S.ts||{}).map(([id,r])=>[id,r.st,r.how,r.box,r.due,r.ft]).sort(),(S.fog?.finds||[]).length]);}
const activeOf=(W,now)=>Object.fromEntries(Object.entries(W?.active||{}).map(([k,v])=>[k,Array.isArray(v)?v.filter(x=>!(x?.until<=now)):v]));
export function walletState(S,g,now=Date.now()){const W=S.wallet||{};
  return{balance:balanceOf(S),earned:S.points||0,spent:W.spent||0,owned:{...(W.owned||{})},equipped:{...(W.equipped||{})},active:activeOf(W,now),choices:{...(W.choices||{})}};}
const visible=(def,counts)=>!def.when||findEligible(def,counts);
export function marketItems(S,g,now=Date.now()){const counts=fogClearCounts(S,g),bal=balanceOf(S),W=S.wallet||{};
  return MARKET.filter(d=>visible(d,counts)).map(d=>({id:d.id,kind:d.kind,slot:d.slot,price:d.price,emoji:d.emoji,title:d.title,note:d.note,once:!!d.once,
    owned:!!W.owned?.[d.id],equipped:!!(d.slot&&W.equipped?.[d.slot]===d.id),affordable:d.price<=bal}));}
// buy(S,g,{pid,item,meta},now): one ledger row per pid. The client never sends a price.
export function buy(S,g,{pid,item,meta}={},now=Date.now()){pid=String(pid||'');if(!PID.test(pid))return{error:'bad purchase id'};
  const prev=(S.wallet?.ledger||[]).find(r=>r.id===pid);if(prev)return{ok:true,already:true,row:prev};
  const def=MARKET.find(d=>d.id===item);if(!def)return{error:'unknown item'};
  if(!visible(def,fogClearCounts(S,g)))return{error:'That one is still hidden in the fog! 🌫️'};
  if(def.once&&S.wallet?.owned?.[def.id])return{ok:true,already:true,owned:true};
  const m=def.check?def.check(S,g,meta&&typeof meta==='object'?meta:{},now):{};if(m.error)return{error:m.error};
  const price=def.price,bal=balanceOf(S);if(price>bal)return{error:`Not enough points yet: you need ${price-bal} more ⭐`,need:price-bal};
  const sig=m0Sig(S),W=walletOf(S);
  const row={id:pid,item:def.id,kind:def.kind,price,at:now};if(m.meta)row.meta=m.meta;
  W.ledger.push(row);W.spent+=price;if(def.once)W.owned[def.id]=now;
  const extra=def.apply?def.apply(S,g,row,now)||{}:{};
  if(m0Sig(S)!==sig)throw new Error('Market purchases must not change points, medals or mastery');
  return{ok:true,row,...extra};}
// M6: one snapshot of the earned total per Pacific day (last WALLET_DAYS days) so the export can show earned7d
export function snapDay(S,day){const W=walletOf(S);if(W.days[day]===(S.points||0))return;W.days[day]=S.points||0;
  const ks=Object.keys(W.days).sort();for(const k of ks.slice(0,Math.max(0,ks.length-WALLET_DAYS)))delete W.days[k];}
export function marketExport(S,g,now=Date.now()){const W=S.wallet||{},ws=walletState(S,g,now),cut=ptDay(now-7*DAY),ds=Object.keys(W.days||{}).sort();
  const base=[...ds].reverse().find(d=>d<=cut)??ds[0];const ledger=W.ledger||[];
  return{balance:ws.balance,earned:ws.earned,spent:ws.spent,spent7d:ledger.filter(r=>r.at>=now-7*DAY).reduce((a,r)=>a+r.price,0),
    earned7d:base!=null?Math.max(0,ws.earned-W.days[base]):null,earnedSince:base??null,ledger:ledger.slice(-30),owned:ws.owned,equipped:ws.equipped,active:ws.active,choices:ws.choices,
    prices:Object.fromEntries(MARKET.map(d=>[d.id,d.price]))};}
// medals: one per directly-mastered topic (not inferred, not self-rated); boss wins are legendary
export function tierOf(g,id,boss){return boss?'legendary':(g.byId[id]||g.hidden?.[id])?.tier||'bronze';}
function backfillMedals(S,g){S.medals=[];for(const [id,r] of Object.entries(S.ts))if(r.st==='mastered'&&r.how==='direct'&&(g.byId[id]||g.hidden?.[id]))S.medals.push({id,tier:tierOf(g,id,false),at:r.at||Date.now()});S.medals.sort((a,b)=>a.at-b.at);}
// honest medals (LESSONS.md "Mastery and medals"): mastery needs ≥ 2 first-try correct graded answers, a medal ≥ 3.
// A self-check never counts. A repeated identical question counts at most once per Pacific day. Guided practice doesn't count.
export const MASTERY_MIN=2,MEDAL_MIN=3,BOSS_LEGEND=3;
const ptDay=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
// Boss hearts = THIS fight only: first-try boss hits on this topic today (rec.bossRun, reset by a miss or a new PT day),
// never the topic's lifetime/cross-day streak. Target is honest per topic: 3 (BOSS_LEGEND) for a Play boss, but a pack
// boss topic with fewer graded questions can only take that many hits (and can't be legendary).
export function bossHP(rec,it,now){const max=it.kind==='quiz'?1:it.kind==='pack'?Math.max(1,Math.min(BOSS_LEGEND,it.packN||BOSS_LEGEND)):BOSS_LEGEND;
  const run=rec&&rec.bossDay===ptDay(now)?(rec.bossRun||0):0,hits=Math.min(max,run);return{max,hp:max-hits,hits,legend:max>=BOSS_LEGEND};}
function countFt(rec,q,now){const k=ptDay(now)+'|'+String(q||'').slice(0,120);rec.ftQ??=[];if(rec.ftQ.includes(k))return false;rec.ftQ=[...rec.ftQ.slice(-7),k];rec.ft=(rec.ft||0)+1;return true;}
function maybeMedal(S,g,id,boss,now){const r=S.ts[id];if(!r||r.st!=='mastered'||r.how!=='direct'||(r.ft||0)<MEDAL_MIN)return null;return award(S,g,id,boss,now);}
function award(S,g,id,boss,now){S.medals??=[];if(S.medals.some(m=>m.id===id))return null;const m={id,tier:tierOf(g,id,boss),at:now,boss:boss||undefined};S.medals.push(m);return m;}
// ---------- one-time re-score of old medals and mastery under the honest rules (slice 9, migrate-medals.mjs) ----------
// Pure: returns a new record. logs = every answer-log entry (all days). Idempotent: S.rules >= 2 means already done.
const OPENERS=/^(?:Hey \{name\}! |Hey [^!]{1,20}! |Quick one! |Ooh, try this! |Your turn! )/;
// opt.keepLegendary (default true, the documented policy): legendary medals already awarded stay legendary and their
// topics keep their mastery; everything else is re-scored. Pass {keepLegendary:false} for the strict re-score.
export function rescore(S0,g,logs,now=Date.now(),{keepLegendary=true}={}){const S=JSON.parse(JSON.stringify(S0));
  const legend=new Set(keepLegendary?(S.medals||[]).filter(m=>m.tier==='legendary').map(m=>m.id):[]);
  const count=o=>({direct:Object.values(o.ts).filter(r=>r.st==='mastered'&&r.how==='direct').length,self:Object.values(o.ts).filter(r=>r.st==='mastered'&&r.how==='self').length,
    inferred:Object.values(o.ts).filter(r=>r.st==='mastered'&&r.how==='inferred').length,medals:(o.medals||[]).length,
    tiers:(o.medals||[]).reduce((a,m)=>(a[m.tier]=(a[m.tier]||0)+1,a),{}),legendary:(o.medals||[]).filter(m=>m.tier==='legendary').length,questMedals:(o.questMedals||[]).length});
  const before=count(S);if((S.rules||0)>=2)return{S2:S,before,after:before,changes:[],already:true};
  const ev={};for(const l of logs||[]){if(l.event||!l.topicId||l.expected==='(self-check)'||l.regraded==='neutral')continue;const e=ev[l.topicId]??={any:0,ft:new Set(),placed:false,boss:{}};e.any++;
    if(l.try!==1||!l.correct||l.format==='guided'||l.stage==='bonus')continue;const day=ptDay(Date.parse(l.ts)||now);
    e.ft.add(day+'|'+String(l.question||'').replace(OPENERS,'').slice(0,120));if(l.mode==='diagnostic')e.placed=true;if(l.format==='boss')e.boss[day]=(e.boss[day]||0)+1;}
  const changes=[],lost=new Set(),fallback=[];
  for(const [id,r] of Object.entries(S.ts)){if(legend.has(id)&&g.byId[id]){if(r.st!=='mastered'||r.how!=='direct'){Object.assign(r,{st:'mastered',how:'direct'});}changes.push({id,change:'kept (legendary)'});continue;}
    if(r.st!=='mastered'||r.how==='inferred'||!g.byId[id])continue;const e=ev[id],fb=!e;if(fb)fallback.push(id);
    const ft=fb?(r.c||0):e.ft.size;r.ft=Math.max(r.ft||0,ft);
    const ok=fb?(r.how!=='self'&&ft>=MASTERY_MIN):(ft>=MASTERY_MIN||(r.how!=='self'&&e.placed));
    if(ok){if(r.how==='self'){r.how='direct';changes.push({id,change:'self→direct'});}if(e?.placed)r.placed??=r.at||now;continue;}
    lost.add(id);changes.push({id,change:'lost mastery',was:r.how,ft});Object.assign(r,{st:'mastered',how:'inferred',conf:.5,reverify:true,box:0,due:now});}
  const medals=[];for(const m of S.medals||[]){const r=S.ts[m.id],e=ev[m.id];if(m.tier==='legendary'&&legend.has(m.id)&&r){medals.push(m);continue;}
    if(lost.has(m.id)||!r||r.st!=='mastered'||r.how!=='direct'||(r.ft||0)<MEDAL_MIN){changes.push({id:m.id,change:'medal removed',tier:m.tier});continue;}
    if(m.tier==='legendary'&&!Object.values(e?.boss||{}).some(n=>n>=BOSS_LEGEND)){const t=tierOf(g,m.id,false);changes.push({id:m.id,change:'legendary→'+t});medals.push({...m,tier:t,boss:undefined});continue;}
    medals.push(m);}
  S.medals=medals;const n0=S.medals.length+(S.questMedals||[]).length;dedupeMedals(S);const dup=n0-S.medals.length-(S.questMedals||[]).length;if(dup)changes.push({change:'duplicates removed',count:dup});
  S.rules=2;S.rescoredAt=now;const after=count(S);
  return{S2:S,before,after,changes,requeued:lost.size,fallback,duplicates:dup,keptLegendary:legend.size};}
// ---------- topic states ----------
export function stateOf(S,g,id,now){const r=S.ts[id];if(r?.st==='mastered')return r.due<=now?'review':'mastered';if(r?.st==='learning')return 'learning';
  return g.pre[id].every(e=>!e.h||S.ts[e.id]?.st==='mastered')?'ready':'locked';}
export function summary(S,g,now){const by={},tot={mastered:0,review:0,ready:0,learning:0,locked:0};let codes='';
  for(const t of g.topics){const s=stateOf(S,g,t.id,now);tot[s]++;codes+={mastered:'m',review:'v',ready:'r',learning:'l',locked:'x'}[s];
    const b=by[t.subject]??={total:0,mastered:0,review:0,ready:0,learning:0,locked:0};b.total++;b[s]++;}
  const done=tot.mastered+tot.review;return{codes,total:g.topics.length,done,pct:Math.round(1000*done/g.topics.length)/10,tot,by};}
// ---------- inference ----------
function setMastered(S,g,id,how,conf,now,ev){const r=S.ts[id]||{};const was=r.st==='mastered';
  Object.assign(r,{st:'mastered',how,conf,box:how==='inferred'?2:0,due:now+(how==='inferred'?R(7,30):BOXES[0])*DAY,at:now});S.ts[id]=r;
  if(!was&&how!=='inferred')ev.push({event:'mastered',topicId:id,topic:g.byId[id].name,how});}
function inferDown(S,g,id,conf,now,ev){const st=[[id,conf]];let n=0;
  while(st.length){const [x,c]=st.pop();for(const e of g.pre[x]){const c2=c*(e.h?.95:.7);if(c2<.5)continue;const r=S.ts[e.id];
    if(r?.st==='mastered'&&(r.how!=='inferred'||r.conf>=c2))continue; if(r&&r.st==='learning'&&r.how==='direct')continue;
    S.ts[e.id]={...(r||{}),st:'mastered',how:'inferred',conf:Math.round(c2*100)/100,box:2,due:now+R(10,40)*DAY,at:now};n++;st.push([e.id,c2]);}}
  if(n)ev.push({event:'inferred',topicId:id,count:n});return n;}
function failUp(S,g,id){const st=[id];let n=0;while(st.length){const x=st.pop();for(const e of g.post[x]){const r=S.ts[e.id];if(r?.how==='inferred'){delete S.ts[e.id];n++;st.push(e.id);}}}return n;}
function unknown(S,id){const r=S.ts[id];return !r||(r.st!=='mastered'&&!(r.how==='direct'&&r.st==='learning'));}
// binary search along prerequisite chain: middle depth of unknown hard ancestors
function probeDown(S,g,id){const seen=new Map([[id,0]]),q=[id];while(q.length){const x=q.shift();for(const e of g.pre[x])if(e.h&&!seen.has(e.id)){seen.set(e.id,seen.get(x)+1);q.push(e.id);}}
  const c=[...seen].filter(([x,d])=>d>0&&unknown(S,x));if(!c.length)return null;const max=Math.max(...c.map(x=>x[1])),mid=Math.max(1,Math.ceil(max/2));
  const at=c.filter(x=>x[1]===mid);return pick(at.length?at:c)[0];}
function probeUp(S,g,id){const sub=g.byId[id].subject,seen=new Map([[id,0]]),q=[id];while(q.length){const x=q.shift();if(seen.get(x)>=4)continue;for(const e of g.post[x])if(!seen.has(e.id)&&g.byId[e.id].subject===sub){seen.set(e.id,seen.get(x)+1);q.push(e.id);}}
  const a0=Math.max(8,g.byId[id].ageRangeStart),dom=g.byId[id].domain;let c=[...seen].filter(([x,d])=>d>0&&unknown(S,x)&&g.byId[x].ageRangeStart>=a0&&g.byId[x].ageRangeStart<=12);
  const sd=c.filter(([x])=>g.byId[x].domain===dom);if(sd.length)c=sd;if(!c.length)return null;const max=Math.max(...c.map(x=>x[1])),mid=Math.ceil(max/2);
  const at=c.filter(x=>x[1]===mid);return pick(at.length?at:c)[0];}
function ancestors(g,id){const s=new Set(),q=[id];while(q.length)for(const e of g.pre[q.pop()])if(!s.has(e.id)){s.add(e.id);q.push(e.id);}return s.size;}
// ---------- placement ----------
const BUDGET={Mathematics:6,Science:4,English:4,History:3,'Personal & Social Development':2,'Life Skills':2,Computing:2,'Learning to Learn':2};
function seedPlacement(S,g,pack){const subs=Object.keys(BUDGET),q=[];const packIds=new Set((pack?.topics||[]).map(t=>t.topicId));
  for(const sub of subs){const c=g.topics.filter(t=>t.subject===sub&&t.ageRangeStart>=9&&t.ageRangeStart<=11&&unknown(S,t.id));
    c.sort((a,b)=>(packIds.has(b.id)-packIds.has(a.id))*100+(ancestors(g,b.id)-ancestors(g,a.id))-(Math.abs(a.ageRangeStart-TARGET_AGE)-Math.abs(b.ageRangeStart-TARGET_AGE))*2);
    if(c[0])q.push(c[0].id);}
  const m=q.shift();S.placement.queue=[m,...q];}
function placementNext(S,g,pack){const P=S.placement;if(P.done)return null;if(!P.seeded){const keep=P.queue;seedPlacement(S,g,pack);P.queue=[...keep,...P.queue];P.seeded=true;}
  while(P.queue.length){const id=P.queue.shift();const sub=g.byId[id].subject;if((P.per[sub]||0)>=BUDGET[sub])continue;if(!unknown(S,id))continue;return id;}
  P.done=true;return null;}
function placementResult(S,g,id,ok){const P=S.placement;const sub=g.byId[id].subject;P.per[sub]=(P.per[sub]||0)+1;P.asked++;
  if((P.per[sub]||0)>=BUDGET[sub])return;const nx=ok?probeUp(S,g,id):probeDown(S,g,id);if(nx)P.queue.unshift(nx);}
// ---------- content ----------
// fuzzy text matching: case/accents/punctuation/articles ignored, plural~singular, small typos forgiven
const stem=w=>w.length>4&&w.endsWith('ies')?w.slice(0,-3)+'y':w.length>4&&/(ches|shes|sses|xes|oes)$/.test(w)?w.slice(0,-2):w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w;
const stemAll=s=>norm(s).split(' ').map(stem).join(' ');
function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(Math.abs(m-n)>2)return 9;let p=[...Array(n+1).keys()];for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[n];}
export function fuzzyEq(x,y){const a=stemAll(x),b=stemAll(y);if(!a||!b)return false;if(a===b)return true;if(/\d/.test(a+b))return false;const L=Math.min(a.length,b.length);return lev(a,b)<=(L>=8?2:L>=4?1:0);}
// creative answers: any sensible word/phrase (not junk, not the subject itself)
const JUNK=new Set(['idk','dunno','i dont know','i don t know','nothing','none','no','yes','ok','okay','asdf','qwerty','test','lol','um','hmm','whatever','something','anything','stuff','thing','blah','x','xx','xxx','na','n a','pass','skip','help']);
function creativeOk(it,a){const n=norm(a);if(!n||n.replace(/[^a-z]/g,'').length<(it.minLength||2))return false;if(/\d/.test(n)&&!it.allowNumbers)return false;
  if(JUNK.has(n)||(it.block||[]).some(b=>fuzzyEq(b,n)))return false;if((it.notAnswers||[]).some(b=>fuzzyEq(b,n)))return false;
  const words=n.split(' ');if(words.length>(it.maxWords||5))return false;
  return words.every(w=>/[aeiouy]/.test(w)&&!/(.)\1\1/.test(w)&&w.length<=20&&!/[bcdfghjklmnpqrstvwxz]{5}/.test(w));}
const norm=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9.\/\s-]/g,'').replace(/\b(the|a|an)\b/g,'').replace(/\s+/g,' ').trim();
function packQ(S,pack,id){if(!pack||questLocked(S,pack))return null;const t=pack.topics.find(x=>x.topicId===id);if(!t)return null;
  for(let i=0;i<t.questions.length;i++){const k=`${pack.date}:${id}:${i}`;if(!S.packSeen[k]&&!t.questions[i]._skip)return{t,q:t.questions[i],i,key:k};}return null;}
const OPEN=['Hey {name}! ','Quick one! ','Ooh, try this! ','Your turn! ',''];
function opener(q){const o=pick(OPEN);return o&&q.split(' ').length+o.split(' ').length-1<=15?o+q:q;}
function kidMcq(g,id){const t=g.byId[id];if(!t.kq)return null;const ch=[t.ka,...t.kw].sort(()=>Math.random()-.5);
  return{kind:'quiz',type:'mc',q:opener(t.kq),base:t.kq,choices:ch,answer:t.ka,hint:`Think it through. Which one makes the most sense?`,explain:`It's "${t.ka}".`};}
// check-understanding item (data/checks, slice 6): a kid-voice mc written from the research's two-tier assessment.
// Review gates and spot-checks prefer it over the kid prompt; the "why" tier, when present, is the explanation.
function checkItem(g,id){const t=g.byId[id],c=t?.ck;if(!c)return null;const ch=shuf([c.a,...c.w]);
  return{kind:'quiz',type:'mc',ptype:'check',check:true,q:c.q,base:c.q,choices:ch,answer:c.a,hint:'Read every choice. Which one really fits the idea?',explain:c.y?`It's "${c.a}": ${c.y.a.replace(/^./,x=>x.toLowerCase())}.`:`It's "${c.a}".`};}
function selfCheck(g,id){const t=g.byId[id];
  return{kind:'self',type:'self',q:t.self||`Hey {name}! Could you explain ${t.sn||t.name}?`,choices:['👍 Got it!','🤔 Sort of','🌱 Not yet']};}
// interactive pack formats -> internal item. Answers stay server-side; the client only gets what it must render.
const shuf=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
const shufNot=a=>{if(a.length<2)return[...a];let b;do b=shuf(a);while(b.join('|')===a.join('|'));return b;};
// optional per-wrong-choice feedback on mc / picture / blank-with-choices: {"<wrong choice>": "short reply"} (LESSONS.md
// "Researched stages"). Kept server-side like the answer (publicItem never sends it); unknown keys are ignored.
function choiceFeedback(q){const f=q.feedback,ch=q.type==='picture'?(q.choices||[]).map(c=>c?.label):q.choices;
  if(!f||typeof f!=='object'||!Array.isArray(ch))return undefined;const o={};for(const [k,v] of Object.entries(f))if(typeof v==='string'&&v.trim()&&ch.includes(k)&&k!==String(q.answer))o[k]=v.trim();
  return Object.keys(o).length?o:undefined;}
const fbFor=(it,a)=>it.feedback?.[String(a??'').trim()];
function packItem(pq,q){const graded=pq.t.questions.filter(x=>!CARD.includes(x.type)&&!x._skip).length;
  const it={kind:'pack',packN:graded,deep:!!pq.t.deepDive,packReview:!!pq.t.review,ptype:q.type,q:q.prompt,hint:q.hint,explain:q.explanation,feedback:choiceFeedback(q),packKey:pq.key,format:q.format||pq.t.format,scene:q.scene,tpl:q.template,stage:'main',guided:q.guided||undefined,steps:q.steps,example:q.example};
  if(q.guided&&!q.format)it.format='guided';
  switch(q.type){
   case 'mc':return{...it,type:'mc',choices:q.choices,answer:q.answer};
   case 'picture':return{...it,type:'picture',choices:q.choices.map(c=>c.label),pics:q.choices.map(c=>c.pic),answer:q.answer};
   case 'blank':return q.choices?{...it,type:'mc',blank:true,choices:q.choices,answer:q.answer}:(q.creative?{...it,type:'input',blank:true,creative:true,answer:q.answer,accept:[...(q.accept||[]),...(q.acceptedAnswers||[])],notAnswers:q.notAnswers,block:q.block,celebrate:q.celebrate}:{...it,type:'input',blank:true,answer:q.answer,accept:[...(q.accept||[]),...(q.acceptedAnswers||[])],fuzzy:q.fuzzy!==false});
   case 'numeric':return{...it,type:'input',numeric:true,answer:q.answer,tol:q.tolerance,form:q.form};
   case 'text':return{...it,type:'input',answer:q.answer,accept:[...(q.accept||[]),...(q.acceptedAnswers||[])],fuzzy:q.fuzzy!==false};
   case 'creative':return{...it,type:'input',creative:true,answer:q.answer,accept:[...(q.accept||[]),...(q.acceptedAnswers||[])],notAnswers:q.notAnswers,block:q.block,minLength:q.minLength,maxWords:q.maxWords,celebrate:q.celebrate,placeholder:q.placeholder||'Your idea!'};
   case 'order':return{...it,type:'order',items:shufNot(q.items),answer:q.items.join('|'),explain:q.explanation||q.items.join(' → ')};
   case 'match':return{...it,type:'match',left:q.pairs.map(p=>p[0]),right:shufNot(q.pairs.map(p=>p[1])),pairs:q.pairs,answer:q.pairs.map(p=>p.join(' = ')).join(' · ')};
   case 'truefalse':return{...it,type:'truefalse',statements:q.statements.map(x=>x[0]),tf:q.statements.map(x=>x[1]?'T':'F').join(''),answer:q.statements.map(x=>`${x[0]} → ${x[1]?'True':'False'}`).join(' · '),timed:q.seconds||30};
   case 'numberline':return{...it,type:'numberline',line:{min:q.min,max:q.max,step:q.step??1,labels:q.labels},answer:String(q.answer),tol:q.tolerance??(q.step??1)/2};
   case 'fracbar':return{...it,type:'fracbar',parts:q.parts,answer:String(q.answer)};
   case 'why':case 'fact':case 'learn':return{...it,type:'card',card:q.type,title:q.title,body:q.body||q.prompt,q:q.title||q.prompt,emoji:q.emoji,format:'card'};}
  return{...it,type:'input',answer:q.answer};}
export const CARD=['why','fact','learn'];
// Boss questions must be fair for the target grade: no answers past thousandths, no decimal percents (e.g. 3/16 = 0.1875).
export const BOSS_MAX_LVL=4;
export function bossFair(p){const a=String(p?.a??p?.answer??'');return !/\.\d{4,}/.test(a)&&!(/%$/.test(a)&&/\./.test(a));}
const avoided=(sp,q,now)=>!!sp?.avoid?.some(x=>x.q===q&&x.until>now);
function genFair(k,lvl,sp,boss,now){let p;for(let n=0;n<25;n++){p=G[k](lvl);if(avoided(sp,p.q,now))continue;if(boss&&!bossFair(p))continue;return p;}return p;}
// a Play boss only tests a skill that was taught or practised first (2+ right answers), and pauses after repeated misses
function bossReady(S,r,id,now){return (r?.c||0)>=2&&!(S.support?.[id]?.bossOff>now);}
function powerText(pack,t){if(t.powerup)return t.powerup;const src=pack.topics.find(x=>x!==t&&(x.teaches||[]).includes(t.topicId));
  const c=src?.questions.find(q=>q.type==='learn'||q.type==='why');if(c)return c.body;const h=t.questions.find(q=>!CARD.includes(q.type))?.hint;return h?`Remember: ${h}`:'Take a breath. You\'ve practised this!';}
export function buildItem(S,g,id,mode,pack,now){const t=g.byId[id],r=S.ts[id];let it,bossOk=true;const sp=S.support?.[id];
  const pq=mode!=='review'?packQ(S,pack,id):null;
  if(pq){const q=pq.q,pk=`${pack.date}:${id}:powerup`;
    // "Boss ahead! Here's your power-up": a recap card right before the first question of a quest boss stage
    if(pq.t.format==='boss'&&!S.packSeen[pk]&&!pq.t.questions.some((x,j)=>!CARD.includes(x.type)&&S.packSeen[`${pack.date}:${id}:${j}`]))
      it={kind:'pack',type:'card',card:'powerup',q:'Boss ahead! Here\'s your power-up',title:'Boss ahead! Here\'s your power-up',body:powerText(pack,pq.t),emoji:'🔋',packKey:pk,format:'card'};
    else it=packItem(pq,q);
    if(!S.packSeen[`${pack.date}:${id}:intro`]){it.intro=pq.t.intro;S.packSeen[`${pack.date}:${id}:intro`]=1;}}
  // review (gates, Play review): a check item replaces the kid prompt; on a generator topic it is used for spot-checks
  // of an inferred skill (unverified), where a conceptual check says more than one more sum
  else if(mode==='review'&&t.ck&&(!kindFor(t)||unverified(S,id))){it=checkItem(g,id);bossOk=false;}
  else if(kindFor(t)){const k=kindFor(t),T=S.teach?.[id];
    let lvl=mode==='review'?Math.max(2,(r?.lvl||4)-1):mode==='diagnostic'?(t.ageRangeStart>=10?4:3):(r?.lvl||(t.ageRangeStart>=10?3:2));
    // teach before test: a new or shaky skill gets a Learn-it card (idea + worked example), then 2 guided practice items
    if(mode==='learn'&&((!(r?.c>0)&&!T)||sp?.teachDue)){const ex=genFair(k,Math.max(1,lvl-1),sp,true,now),so=solve(ex.q);
      (S.teach??={})[id]={at:now,left:2};if(sp)sp.teachDue=false;
      it={kind:'teach',type:'card',card:'learn',q:`Learn it: ${t.sn||t.name}`,title:`Learn it: ${t.sn||t.name}`,body:IDEA[k],emoji:'🧠',example:{prompt:ex.q,steps:so?so.steps:[ex.explain],answer:ex.a},format:'card',lvl};}
    else{const guided=mode!=='review'&&T?.left>0,boss=mode==='learn'&&!guided&&g.boss.has(id)&&bossReady(S,r,id,now);bossOk=boss;
      if(guided)lvl=Math.max(1,lvl-1);if(boss)lvl=Math.min(lvl,BOSS_MAX_LVL);
      if(boss&&!(r?.streak>0)&&!(T?.power>now-6*3600e3)){const ex=genFair(k,Math.max(1,lvl-1),sp,true,now),so=solve(ex.q);(S.teach??={})[id]={...(T||{}),left:0,power:now};
        it={kind:'teach',type:'card',card:'powerup',q:'Boss ahead! Here\'s your power-up',title:'Boss ahead! Here\'s your power-up',body:IDEA[k],emoji:'🔋',example:{prompt:ex.q,steps:so?so.steps:[ex.explain],answer:ex.a},format:'card',lvl};}
      else{const p=genFair(k,lvl,sp,boss,now);
        it={kind:'math',type:'input',q:p.q,answer:p.a,cmp:p.cmp,needSimplest:p.needSimplest,hint:p.hint,explain:p.explain,vis:p.vis,bonus:p.bonus,lvl};
        if(guided){const so=solve(p.q);it.guided=true;it.steps=so?so.start:[p.hint];it.format='guided';it.bonus=null;}}}}
  else{it=kidMcq(g,id)||selfCheck(g,id);bossOk=false;} // a one-question MCQ or a self-check is never a boss
  if(!it.format)it.format=mode==='review'?'review':mode==='diagnostic'?'explore':g.boss.has(id)&&bossOk?'boss':(it.kind==='math'&&Math.random()<.25)?'timed':(it.type==='mc'?'minigame':'quest');
  if(it.type!=='card'){if(mode==='review')it.format='review';if(mode==='diagnostic')it.format='explore';}
  if(it.format==='timed'&&!it.timed)it.timed=it.kind==='math'?60:45;if(it.type==='card'){it.timed=null;it.format='card';}
  if(it.format==='boss'&&it.type!=='card')it.boss=bossHP(r,it,now);
  return{...it,id:now+'-'+R(0,999),topicId:id,mode,tries:0,stage:'main',issued:now};}
// ---------- next item ----------
// Coverage (LESSONS.md "Coverage"): an area (Marble domain) is seen with a direct record that has a correct answer
// (the engine has no logs; src/coverage.js adds logged graded answers). Ready topics in unseen areas get +10 (below +40 for the pack).
export const AREA_BONUS=10;
export function seenAreas(S,g,logs=[]){const seen=new Map();const k=t=>t.subject+'|'+t.domain;
  for(const l of logs)if(l&&!l.event&&l.topicId&&l.expected!=='(self-check)'&&l.regraded!=='neutral'){const t=g.byId[l.topicId];if(t){const x=seen.get(k(t))||{answered:0};x.answered++;seen.set(k(t),x);}}
  for(const [id,r] of Object.entries(S.ts||{})){const t=g.byId[id];if(t&&r.how==='direct'&&(r.c||0)>=1&&!seen.has(k(t)))seen.set(k(t),{answered:0});}
  return seen;}
export function focusScore(S,g,id,packIds=new Set(),seenA=null){const t=g.byId[id];let s=-Math.abs(t.ageRangeStart-TARGET_AGE)*4;if(packIds.has(id))s+=40;
  if(seenA&&!seenA.has(t.subject+'|'+t.domain)&&S.ts[id]?.st!=='learning')s+=AREA_BONUS;if(S.ts[id]?.st==='learning')s+=15;if(kindFor(t))s+=4;
  if(t.ageRangeStart<8)s-=30;const recentSubs=S.recent.slice(-3).map(x=>g.byId[x]?.subject);if(recentSubs.filter(x=>x===t.subject).length>=2)s-=12;return s+Math.random()*6;}
export function pickFocus(S,g,pack,now,opt={}){const packIds=new Set((pack?.topics||[]).map(t=>t.topicId).filter(id=>g.byId[id]&&packQ(S,pack,id)));
  let c=g.topics.filter(t=>{const s=stateOf(S,g,t.id,now);return s==='ready'||s==='learning';});
  if(opt.subject)c=c.filter(t=>t.subject===opt.subject);if(opt.notSubject)c=c.filter(t=>t.subject!==opt.subject&&t.subject!==opt.notSubject);if(opt.domain)c=c.filter(t=>t.domain===opt.domain);
  if(opt.minAge)c=c.filter(t=>t.ageRangeStart>=opt.minAge);if(opt.maxAge)c=c.filter(t=>t.ageRangeStart<=opt.maxAge);
  if(opt.unseen){const sa=seenAreas(S,g);c=c.filter(t=>!sa.has(t.subject+'|'+t.domain));}
  if(!c.length)return null;const seenA=seenAreas(S,g),sc=new Map(c.map(t=>[t.id,focusScore(S,g,t.id,packIds,seenA)]));c.sort((a,b)=>sc.get(b.id)-sc.get(a.id));return c[0].id;}
export function next(S,g,pack,now){
  if(!S.firstDone){S.firstDone=true;const it={kind:'math',type:'input',q:'Your pizza has 8 slices. You eat 3, your friend eats 2. What fraction is left?',answer:'3/8',
    hint:'Count the slices that are still on the plate: 8 − 3 − 2. Put that number over 8, the total slices.',explain:'8 − 3 − 2 = 3 slices left out of 8, so 3/8 of the pizza is left!',
    vis:{type:'pizza',slices:8,eaten:5},bonus:{q:'Bonus ⭐: write 3/8 as a decimal!',a:'0.375'},first:true,format:'explore',lvl:4};
    S.current={...it,id:now+'-0',topicId:PIZZA_ID,mode:'diagnostic',tries:0,stage:'main',issued:now};return S.current;}
  // a skipped item comes back a day later, guided (steps visible) and never as a boss
  const rq=(S.requeue||[]).findIndex(x=>x.notBefore<=now&&g.byId[x.item?.topicId]);
  if(rq>=0&&!questActive(S,pack)&&!S.mini){const x=S.requeue.splice(rq,1)[0],so=solve(x.item.q);S.itemsServed++;S.recent=[...S.recent.slice(-9),x.item.topicId];
    S.current={...x.item,id:now+'-rq',mode:'learn',tries:0,stage:'main',issued:now,guided:true,steps:x.item.steps?.length?x.item.steps:(so?so.start:[x.item.hint].filter(Boolean)),format:'guided',boss:null,timed:null,bonus:null,requeued:x.n,packKey:undefined,intro:undefined};return S.current;}
  const due=g.topics.filter(t=>stateOf(S,g,t.id,now)==='review').sort((a,b)=>S.ts[a.id].due-S.ts[b.id].due);
  let id,mode;
  const qa=questActive(S,pack);
  // review gates: before some later quest stages, 1-2 due reviews open the way (LESSONS.md "Review gates")
  if(qa&&!id){const gi=gateItem(S,g,pack,due,now);if(gi){S.sinceReview=0;S.itemsServed++;S.recent=[...S.recent.slice(-9),gi.topicId];return S.current=gi;}}
  if(!qa&&due.length&&S.itemsServed>=3&&(S.sinceReview>=9||Math.random()<.08)){const direct=due.filter(t=>S.ts[t.id].how!=='inferred');id=(direct[0]||due[0]).id;mode='review';}
  const packNext=()=>{if(!pack)return null;
    if(pack.quest){const st=pack.topics.find(t=>g.byId[t.topicId]&&packQ(S,pack,t.topicId));return st?st.topicId:null;} // quests run stage by stage
    const cand=pack.topics.filter(t=>g.byId[t.topicId]&&packQ(S,pack,t.topicId)&&!(S.ts[t.topicId]?.st==='mastered'&&S.ts[t.topicId].how!=='inferred'));
    if(!cand.length)return null;const cur=cand.find(t=>t.topicId===S.packFocus);if(cur)return cur.topicId;
    const recent=S.recent.slice(-2).map(x=>g.byId[x]?.subject);const c2=cand.filter(t=>!recent.includes(g.byId[t.topicId].subject));return S.packFocus=(c2[0]||cand[0]).topicId;};
  const placeNext=()=>placementNext(S,g,pack);
  const order=qa?[[packNext,'learn']]:S.itemsServed%2?[[placeNext,'diagnostic'],[packNext,'learn']]:[[packNext,'learn'],[placeNext,'diagnostic']];
  if(!id)for(const [f,m] of order){const x=f();if(x){id=x;mode=m;break;}}
  if(!id){if(S.focus&&['ready','learning'].includes(stateOf(S,g,S.focus,now)))id=S.focus;else id=S.focus=pickFocus(S,g,pack,now);mode='learn';}
  if(!id){id=g.topics[0].id;mode='learn';}
  S.sinceReview=mode==='review'?0:S.sinceReview+1;S.itemsServed++;S.recent=[...S.recent.slice(-9),id];
  S.current=buildItem(S,g,id,mode,pack,now);return S.current;}
// ---------- review gates ----------
// Gates sit before stage 2, the middle stage and the boss (max 3 per quest). Items come from the due Leitner queue at
// runtime (most overdue first, directly shown before inferred), are graded as normal reviews, and a gate opens once
// its items are answered (right, learning moment or skipped). Gates never count toward quest progress.
// Spot-checks: about 1 gate item in 3 (and every gate item when nothing is due) checks a skill that was only inferred
// and never verified, picked by most dependents, then lowest confidence. Right -> shown directly; miss -> learning,
// and the guesses built on it are withdrawn (failUp). A spot-check never awards a medal.
// v0.5: at most GATE_DAY_MAX gate items per quest per Pacific day (the frozen "≤ 4 gate items" budget, per sitting), and a
// warm-up gate (1-2 due reviews) at the first item boundary of each day when the learner resumes a started quest.
export const GATE_MAX=3,GATE_ITEMS=2,GATE_DAY_MAX=4;
const gateDay=(S,pack,now)=>{const q=S.quests[pack.date],d=ptDay(now);if(q.gateDay?.day!==d)q.gateDay={day:d,n:0,warm:false};return q.gateDay;};
const resumed=(S,pack)=>pack.topics.some(t=>t.questions.some((q,j)=>S.packSeen[`${pack.date}:${t.topicId}:${j}`]));
export function gateStages(n){return[...new Set([1,Math.floor(n/2),n-1])].filter(k=>k>0&&k<n).sort((a,b)=>a-b).slice(0,GATE_MAX);}
const gateRec=(S,pack)=>{const q=(S.quests??={})[pack.date]??={};return q.gates??={};};
export const unverified=(S,id)=>{const r=S.ts[id];return !!r&&r.st==='mastered'&&r.how==='inferred'&&!r.verified;};
export function spotPick(S,g,used=new Set()){return g.topics.filter(t=>unverified(S,t.id)&&!used.has(t.id))
  .sort((a,b)=>(g.post[b.id]?.length||0)-(g.post[a.id]?.length||0)||(S.ts[a.id].conf??1)-(S.ts[b.id].conf??1)||a.id.localeCompare(b.id))[0]?.id||null;}
function gatePick(S,g,pack,due,now,used){const inf=id=>S.ts[id].how==='inferred'?1:0;
  const c=due.filter(t=>!used.has(t.id)).sort((a,b)=>inf(a.id)-inf(b.id)||S.ts[a.id].due-S.ts[b.id].due);if(c.length)return c[0].id;
  // soon-due fallback: a directly mastered topic in box 0-1 due within 2 days
  const soon=g.topics.filter(t=>{const r=S.ts[t.id];return r?.st==='mastered'&&r.how!=='inferred'&&(r.box||0)<=1&&r.due<=now+2*DAY&&!used.has(t.id);}).sort((a,b)=>S.ts[a.id].due-S.ts[b.id].due);
  return soon[0]?.id||null;}
function gateItem(S,g,pack,due,now){if(!pack?.quest||!S.quests?.[pack.date]?.started)return null;const k=pack.topics.findIndex(t=>g.byId[t.topicId]&&packQ(S,pack,t.topicId));if(k<0)return null;
  const G=gateRec(S,pack),day=gateDay(S,pack,now),left=GATE_DAY_MAX-day.n;
  const used=new Set(Object.values(G).flatMap(x=>x.items||[]));
  const nSpot=g.topics.filter(t=>unverified(S,t.id)&&!used.has(t.id)).length,avail=due.filter(t=>!used.has(t.id)).length;
  let key,gk;const wk='w:'+day.day;
  if(G[wk]&&!G[wk].open){key=wk;gk=G[wk];}
  else if(!day.warm&&left>0&&resumed(S,pack)&&(avail||nSpot)){day.warm=true;key=wk;gk=G[wk]={before:'warm',warm:true,day:day.day,items:[],right:0,n:0,open:false,of:Math.min(left,avail>1||(avail&&nSpot)?GATE_ITEMS:1)};}
  else{day.warm=true;if(k<1)return null;const st=pack.topics[k];if(!gateStages(pack.topics.length).includes(k))return null;if(st.questions.some((q,j)=>S.packSeen[`${pack.date}:${st.topicId}:${j}`]))return null;
    key=k;gk=G[k]??={before:k,items:[],right:0,n:0,open:false};if(gk.open)return null;
    if(gk.of==null)gk.of=Math.min(Math.max(0,left),avail>2||(avail>0&&nSpot)?GATE_ITEMS:avail>0?1:nSpot?Math.min(GATE_ITEMS,nSpot):(gatePick(S,g,pack,[],now,used)?1:0));}
  if(gk.n>=gk.of||GATE_DAY_MAX-day.n<=0){gk.open=true;gk.of=gk.n;return null;}
  const served=Object.values(G).reduce((a,x)=>a+(x.items?.length||0),0),dueLeft=due.some(t=>!used.has(t.id));
  let id=nSpot&&(!dueLeft||served%3===2)?spotPick(S,g,used):null;if(!id)id=gatePick(S,g,pack,due,now,used);if(!id){gk.open=true;gk.of=gk.n;return null;}
  const it=buildItem(S,g,id,'review',null,now);gk.items.push(id);
  return{...it,format:'gate',timed:null,boss:null,bonus:null,spot:unverified(S,id)||undefined,gate:{k:key,n:gk.n+1,of:gk.of,date:pack.date,warm:gk.warm||undefined}};}
function spotDone(S,g,it,x,now){const rec=S.ts[it.topicId],t=g.byId[it.topicId];if(!rec)return;
  if(x.r.correct){const box=rec.box0??rec.box;rec.st='mastered';rec.how='direct';rec.verified=now;rec.box=box||0;rec.due=now+BOXES[rec.box]*DAY;delete rec.box0;
    x.ev.push({event:'verified',topicId:it.topicId,topic:t.name,subject:t.subject});}
  else{rec.st='learning';rec.how='direct';rec.box=0;delete rec.box0;const n=failUp(S,g,it.topicId);x.ev.push({event:'spotMiss',topicId:it.topicId,topic:t.name,subject:t.subject,withdrawn:n});}
  x.r.spot={verified:!!x.r.correct};}
function gateDone(S,it,r){const q=S.quests?.[it.gate.date];const gk=q?.gates?.[it.gate.k];if(!gk)return;gk.n++;if(q.gateDay)q.gateDay.n++;if(r.correct&&!it.tries)gk.right++;if(gk.n>=gk.of)gk.open=true;r.gate={k:it.gate.k,n:gk.n,of:gk.of,open:gk.open};
  if(gk.open)r.jane=(r.jane?r.jane+' ':'')+(gk.warm?'🔥 Warm-up done! Back to your quest!':'🗝️ Gate open! On to the next stop!');}
// ---------- grading ----------
// Answer form: when a question asks for a percent, a decimal, a fraction or a whole number, only that form counts.
// The right value in another form is a gentle nudge ('wrongForm'), never a miss.
export const FORMS=['percent','decimal','fraction','whole'];
export function formOf(it,isBonus){const q=String((isBonus?it.bonus?.q:it.q)||'');if(!isBonus&&FORMS.includes(it.form))return it.form;
  if(/\bas an? percent|\bpercent\?|\bin percent/i.test(q))return 'percent';if(/\bas an? decimal/i.test(q))return 'decimal';if(/\bas an? fraction|\bwhat fraction\b/i.test(q))return 'fraction';
  if(isBonus)return null;return /^-?\d+$/.test(String(it.answer??'').trim())?'whole':null;}
const pctWord=a=>String(a).replace(/\s*percent\s*$/i,'%');
export function formOk(a,form){a=pctWord(String(a).trim());if(form==='percent')return /%\s*$/.test(a);if(form==='decimal')return !/[\/%]/.test(a);
  if(form==='fraction')return /\//.test(a);if(form==='whole')return !/[\/%]/.test(a)&&!/\.\d*[1-9]/.test(a);return true;}
// value right? then form right? (percent asked: "27" for 27% is also the right value, just missing its % sign)
function formCheck(a,x,e,tol,form){if(!form)return null;if(!isNaN(x)&&Math.abs(x-e)<=tol)return formOk(a,form)?null:'wrongForm';
  if(form==='percent'&&!/%/.test(a)&&!isNaN(x)&&Math.abs(x/100-e)<=tol)return 'wrongForm';return null;}
const FORM_EX={percent:'like 50%',decimal:'like 0.5',fraction:'like 3/4',whole:'like 7'};
const FORM_NAME={percent:'a percent',decimal:'a decimal',fraction:'a fraction',whole:'a whole number'};
function nudgeText(it,isBonus){const f=formOf(it,isBonus),n=it.nudges||0,exp=isBonus?it.bonus.a:it.answer;
  return n>=3?`Right value! Write it as ${FORM_NAME[f]}, like this: ${exp} ✍️`:`Right value! Now write it as ${FORM_NAME[f]} (${FORM_EX[f]}). ✍️`;}
function grade(it,ans,isBonus){const a=String(ans??'').trim();if(isBonus){const g=parseNum(pctWord(a)),e=parseNum(it.bonus.a);if(Math.abs(g-e)<1e-6)return formCheck(a,g,e,1e-6,formOf(it,true))||true;return formCheck(a,g,e,1e-6,formOf(it,true))||false;}
  if(it.type==='self')return a;
  if(it.type==='order')return a.split('|').map(norm).join('|')===it.answer.split('|').map(norm).join('|');
  if(it.type==='match'){const m=Object.fromEntries(a.split('|').map(x=>x.split('=')).map(([l,r])=>[norm(l),norm(r||'')]));return it.pairs.every(([l,r])=>m[norm(l)]===norm(r));}
  if(it.type==='truefalse')return a.toUpperCase().replace(/[^TF]/g,'')===it.tf;
  if(it.type==='numberline'){const x=parseNum(a),e=parseNum(it.answer);return !isNaN(x)&&Math.abs(x-e)<=it.tol+1e-9;}
  if(it.type==='fracbar'){const x=parseNum(a),e=parseNum(it.answer);return !isNaN(x)&&Math.abs(x-e)<1e-6;}
  if(it.type==='picture')return norm(a)===norm(it.answer);
  if(it.type==='mc')return norm(a)===norm(it.answer)||(/^[a-d]$/i.test(a)&&it.choices[a.toLowerCase().charCodeAt(0)-97]===it.answer);
  if(it.kind==='math'){if(it.cmp)return a.replace(/\s/g,'')===it.answer;const x=parseNum(pctWord(a)),e=parseNum(it.answer);const fc=formCheck(a,x,e,1e-6,formOf(it));if(fc)return fc;if(isNaN(x)||Math.abs(x-e)>1e-6)return false;
    if(it.needSimplest){const m=a.match(/^(\d+)\s*\/\s*(\d+)$/);if(m&&gcd(+m[1],+m[2])>1)return 'notSimplest';}return true;}
  if(it.creative){if(fuzzyEq(it.answer,a))return true;if((it.notAnswers||[]).some(b=>fuzzyEq(b,a)))return false;return (it.accept||[]).some(x=>fuzzyEq(x,a))||creativeOk(it,a)?'creative':false;}
  if(it.numeric){const a2=pctWord(a).replace(/[$,]/g,''),pc=/%\s*$/.test(a2);const m0=a2.match(/^\s*(-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?|-?\.\d+)\s*[a-z%][a-z %.]*$/i);
    let x=parseNum(m0?m0[1]:a2.replace(/\s*(cups?|grams?|g|weeks?|hours?|hrs?|dollars?|cookies?|years?)\.?$/i,''));if(pc&&m0)x/=100;const e=parseNum(it.answer),tol=it.tol??1e-6;
    const ex=/%\s*$/.test(String(it.answer))||formOf(it)==='percent';if(ex&&!pc&&!isNaN(x)&&Math.abs(x/100-e)<=tol)return 'wrongForm';
    const fc=formCheck(m0?m0[1]+(pc?'%':''):a2,x,e,tol,formOf(it));if(fc)return fc;return !isNaN(x)&&Math.abs(x-e)<=tol;}
  return [it.answer,...(it.accept||[])].some(x=>norm(x)===norm(a)||(it.fuzzy&&it.kind==='pack'&&fuzzyEq(x,a)));}
const praise=['Amazing, {name}! 🎉','You nailed it! 🌟','Brilliant thinking! 🧠','Wow, superstar! ⭐','That\'s exactly right! 🙌','You\'re on fire! 🔥'];
const comfort=['Ooh, so close! Let\'s think it through together.','Good try! Mistakes help our brains grow. 🌱','Not quite — but I love that you tried!'];
export function submit(S,g,answer,now){const it=S.current,rec=it?.spot&&S.ts[it.topicId];if(rec&&rec.box0==null)rec.box0=rec.box||0;
  const x=submit0(S,g,answer,now);if(it?.spot&&x.r?.done)spotDone(S,g,it,x,now);if(it?.gate&&x.r?.done)gateDone(S,it,x.r);return x;}
function submit0(S,g,answer,now){const it=S.current;if(!it)return{error:'no item'};const ev=[],r={};const isBonus=it.stage==='bonus';const t=g.byId[it.topicId];
  // "idk", "skip", "help", "don't show this"... opens the stuck help instead of being graded wrong
  if((it.type==='input'||isBonus)&&isStuck(answer))return stuck(S,g,now,String(answer));
  if(it.type==='card'){if(it.packKey)S.packSeen[it.packKey]=1;S.points+=2;S.current=null;ev.push({event:'card',card:it.card,topicId:it.topicId,topic:t.name,title:it.q});
    return finish(S,{done:true,correct:true,card:true,jane:{why:'Now you know WHY it works! 🧠 +2',learn:'Nice! Now you try one. 🧠 +2',powerup:'Powered up! 🔋 Go get that boss! +2'}[it.card]||'Cool fact unlocked! 🤩 +2'},ev,true);}
  const rec=S.ts[it.topicId]??={st:'learning',how:'direct',c:0,w:0,lvl:it.lvl||3,streak:0};rec.c??=0;rec.w??=0;rec.streak??=0;
  const ok=grade(it,answer,isBonus);const logE={topicId:it.topicId,topic:t.name,subject:t.subject,mode:it.mode,format:it.format,qtype:it.ptype||it.kind,pack:it.packKey?it.packKey.split(':')[0]:undefined,mini:it.mini||undefined,level:it.lvl,stage:it.stage,question:isBonus?it.bonus.q:it.q,expected:isBonus?it.bonus.a:(it.type==='self'?'(self-check)':it.answer),given:String(answer),correct:it.type==='self'?answer==='yes':ok===true||ok==='creative',creative:ok==='creative'||undefined,try:it.tries+1,elapsedSec:Math.round((now-it.issued)/1000),gate:it.gate?String(it.gate.k):undefined};
  if(ok==='wrongForm'){it.nudges=(it.nudges||0)+1;const jane=nudgeText(it,isBonus);ev.push({event:'formNudge',formNudge:true,topicId:it.topicId,topic:t.name,subject:t.subject,question:logE.question,expected:logE.expected,given:logE.given,form:formOf(it,isBonus),pack:logE.pack});
    return finish(S,{correct:false,retry:true,formNudge:true,jane},ev);}
  ev.push(logE);
  if(isBonus){if(ok){S.points+=15;S.stars++;r.jane='BONUS! You\'re a decimal wizard! 🧙‍♂️ +15 points and a ⭐';r.correct=true;}else{r.jane=`Good try! ${it.bonus.a} is the decimal. Tip: divide the top number by the bottom number.`;r.reveal=it.bonus.a;r.correct=false;}
    r.done=true;S.current=null;return finish(S,r,ev);}
  if(it.type==='self'){S.current=null;r.done=true;rec.last=now;
    if(answer==='yes'&&it.mode==='review'&&rec.st==='mastered'){S.points+=5;r.correct=true;r.jane=`Awesome! ⭐ +5 points.`;}
    else if(answer==='yes'){S.points+=5;r.correct=true;rec.st='learning';rec.how='direct';rec.selfYes=now;if(it.mode!=='diagnostic'&&!S.mini)S.focus=it.topicId;
      r.jane=`Awesome, I believe in you! ⭐ +5 points. Show me with a quick question!`;}
    else{rec.st='learning';rec.how='direct';r.correct=false;S.points+=2;r.jane=answer==='kinda'?`Thanks for being honest! We'll practise "${t.sn||t.name}" together. +2 points for honesty 💜`:`No worries — that's what I'm here for! 🌱 +2 points for honesty.`;
      if(answer==='no'){const p=probeDown(S,g,it.topicId);if(p&&it.mode!=='diagnostic')S.focus=p;}}
    if(it.mode==='diagnostic')placementResult(S,g,it.topicId,answer==='yes');
    if(it.mode==='review'){if(answer==='yes'){rec.box=Math.min(4,(rec.box||0)+1);rec.due=now+BOXES[rec.box]*DAY;}else{rec.st='learning';}}
    return finish(S,r,ev);}
  if(ok==='notSimplest'){it.tries++;return finish(S,{correct:false,retry:true,jane:'Yes, that\'s the right amount! Can you simplify it even more? 🤏'},ev);}
  if(it.packKey&&(ok||it.tries>=1))S.packSeen[it.packKey]=1;
  if(ok){rec.c++;rec.last=now;if(!it.tries&&!it.guided)countFt(rec,it.base||it.q,now);
    if(it.format==='boss'){const d=ptDay(now);if(rec.bossDay!==d){rec.bossDay=d;rec.bossRun=0;}rec.bossRun=it.tries?0:(rec.bossRun||0)+1;}const fast=it.timed&&(now-it.issued)/1000<=it.timed;const pts=(it.tries?5:10+(it.lvl||3)*2)+(fast?5:0)+(it.format==='boss'?5:0);
    S.points+=pts;S.streak++;S.bestStreak=Math.max(S.bestStreak,S.streak);S.solved++;if(S.streak%3===0)S.stars++;r.correct=true;
    r.jane=`${pick(praise)} +${pts} points${fast?' (speed bonus ⚡)':''}${S.streak>=3?` — ${S.streak} in a row!`:''}`;
    if(ok==='creative'){const g0=String(answer).trim();r.creative=true;r.jane=(it.celebrate||'Nice! "{given}" works! "{answer}" is the classic one, but your idea is great too. 🎨').replace(/\{given\}/g,g0).replace(/\{answer\}/g,it.answer)+` +${pts} points`;}
    if(it.guided){guidedDone(S,it);r.guided=true;r.jane+=' Practice done! ✅';}
    else if(it.packReview&&rec.st==='mastered'){if(!it.tries&&rec.due<=now+DAY){rec.box=Math.min(4,(rec.box||0)+1);rec.due=now+BOXES[rec.box]*DAY;r.jane+=' Memory check passed! 🧠';}}
    else if(it.mode==='review'){if(it.practice){}else if(!it.tries){rec.box=Math.min(4,(rec.box||0)+1);rec.due=now+BOXES[rec.box]*DAY;r.jane+=` Memory check passed — see you in ${BOXES[rec.box]} days, "${t.sn||t.name}"! 🧠`;}else rec.due=now+DAY;}
    else if(it.mode==='diagnostic'){if(!it.tries){setMastered(S,g,it.topicId,'direct',.9,now,ev);rec.placed=now;const n=inferDown(S,g,it.topicId,.9,now,ev);r.mastered=t.sn||t.name;r.inferred=n;
        if(n)r.jane+=` That tells me you already know ${n} earlier skill${n>1?'s':''} — I lit them up on your map! 🗺️`;}
      else{rec.st='learning';rec.how='direct';}placementResult(S,g,it.topicId,!it.tries);}
    else if(!it.tries){rec.streak=(rec.streak||0)+1;if(it.kind==='math'&&(rec.lvl||3)<5){rec.lvl=(rec.lvl||3)+1;r.levelUp=rec.lvl;}
      const need=it.kind==='quiz'?MASTERY_MIN:it.kind==='pack'?Math.max(MASTERY_MIN,Math.min(it.format==='boss'||it.deep?3:2,it.packN)):it.format==='boss'?3:it.kind==='math'?3:2;if(it.boss){r.boss=bossHP(rec,it,now);it.boss=r.boss;}
      if(!(rec.st==='mastered'&&rec.how==='direct')&&rec.streak>=need&&(rec.ft||0)>=MASTERY_MIN){setMastered(S,g,it.topicId,'direct',.9,now,ev);const n=inferDown(S,g,it.topicId,.9,now,ev);S.badges.push(t.sn||t.name);r.mastered=t.sn||t.name;r.inferred=n;S.focus=null;
        r.jane+=it.format==='boss'?` 💥 You defeated the ${t.domain} BOSS! "${t.sn||t.name}" mastered! 🏆`:` You MASTERED "${t.sn||t.name}"! 🏆`;}}
    // legendary only for a real boss fight: ≥ 3 first-try right boss answers on this skill in one day
    if(!it.tries){const md=maybeMedal(S,g,it.topicId,it.format==='boss'&&(rec.bossRun||0)>=BOSS_LEGEND,now);if(md)r.medal=md;}
    if(it.bonus){it.stage='bonus';it.tries=0;r.bonus=it.bonus.q;r.jane+=' Want a bonus challenge?';}else{r.done=true;S.current=null;}
    return finish(S,r,ev);}
  it.tries++;S.streak=0;if(it.format==='boss'){rec.bossRun=0;rec.bossDay=ptDay(now);if(it.boss){it.boss=bossHP(rec,it,now);r.boss=it.boss;}}
  const fb=fbFor(it,answer);if(fb)logE.feedback=true;
  if(it.tries===1){r.retry=true;r.hint=fb||it.hint;r.correct=false;r.jane=fb?`${pick(comfort)} ${fb}`:`${pick(comfort)} Here's a hint: ${it.hint}`;return finish(S,r,ev);}
  rec.streak=0;rec.last=now;r.correct=false;r.reveal=it.answer;
  if(it.kind==='pack'){/* learning moment: show the answer kindly, small points, no big penalty */rec.learn=(rec.learn||0)+1;S.points+=2;r.learningMoment=true;logE.learningMoment=true;
    r.jane=`Learning moment! 🌱 ${fb?fb+' ':''}The answer is "${String(it.answer).replace(/\|/g," → ")}". ${it.explain} +2 points for sticking with it! 💪`;}
  else{rec.w++;r.jane=`Let me show you how: ${it.explain} You'll get the next one! 💪`;}
  const sp=sup(S,it.topicId);if(it.kind==='math'){(sp.avoid??=[]).push({q:it.q,until:now+DAY});sp.avoid=sp.avoid.filter(x=>x.until>now).slice(-8);} // no same-question loops
  if(it.guided){guidedDone(S,it);r.guided=true;}
  else if(it.packReview&&rec.st==='mastered'){rec.due=Math.min(rec.due,now+DAY);ev.push({event:'reviewMiss',topicId:it.topicId,topic:t.name});}
  else if(it.mode==='review'&&it.practice){}
  else if(it.mode==='review'){rec.st='learning';rec.how='direct';rec.box=0;r.jane+=` We'll practise "${t.sn||t.name}" again soon.`;ev.push({event:'demoted',topicId:it.topicId,topic:t.name});}
  else if(it.mode==='diagnostic'){rec.st='learning';rec.how='direct';failUp(S,g,it.topicId);placementResult(S,g,it.topicId,false);}
  else if(it.kind==='pack'){}
  else{if(it.kind==='math'&&(rec.lvl||3)>1){rec.lvl--;r.levelDown=rec.lvl;}rec.wrongInRow=(rec.wrongInRow||0)+1;
    // retry cap: two boss misses on the same skill pause that boss until tomorrow and re-teach it first
    if(it.format==='boss'&&it.kind==='math'){sp.bossMiss=(sp.bossMiss||0)+1;if(sp.bossMiss>=2){sp.bossMiss=0;sp.bossOff=now+DAY;sp.teachDue=true;r.jane+=' Let\'s practise this one first. The boss can wait! 💪';}}
    if(rec.wrongInRow>=2){rec.wrongInRow=0;sp.teachDue=true;const p=probeDown(S,g,it.topicId);if(p){S.focus=p;r.jane+=` Let's power up with "${g.byId[p].sn||g.byId[p].name}" first.`;}}}
  r.done=true;S.current=null;return finish(S,r,ev);}
const sup=(S,id)=>(S.support??={})[id]??={stuck:0,skipped:0};
function guidedDone(S,it){const T=S.teach?.[it.topicId];if(T?.left>0)T.left--;}
function helpFor(it){if(!it?.stuckStep)return null;const sc=scaffold(it),two=it.stuckStep>=2;return{step:it.stuckStep,hint:sc.hint,example:two?sc.example:null,start:two?sc.start:[],canSkip:two};}
// "I'm stuck 🤔": each tap goes one step further: 1 a hint, 2 a worked example + how to start this one, with "Skip for now".
// Nothing is graded: no points, hearts, streak or boss hits change.
export function stuck(S,g,now,given){const it=S.current;if(!it)return{error:'no item'};const t=g.byId[it.topicId];
  if(it.type==='card'||it.type==='self')return{r:{jane:'Just tap the button to keep going! 😊'},ev:[]};
  it.stuckStep=Math.min(3,(it.stuckStep||0)+1);const sp=sup(S,it.topicId);sp.stuck++;sp.at=now;
  const ev=[{event:'stuck',step:it.stuckStep,topicId:it.topicId,topic:t?.name,subject:t?.subject,mode:it.mode,format:it.format,level:it.lvl,question:it.stage==='bonus'?it.bonus?.q:it.q,given:given||undefined,pack:it.packKey?it.packKey.split(':')[0]:undefined}];
  return{r:{stuck:helpFor(it),jane:['','Hey, want a hint? 💡','Let\'s do one together! 👀','No worries! You can skip this one for now. ⏭️'][it.stuckStep]},ev};}
// "Skip for now": no heart, no lost streak, no boss miss. The item comes back tomorrow, easier (guided), and the topic is flagged for support.
export function skip(S,g,pack,now){const it=S.current,x=skip0(S,g,pack,now);if(it?.spot&&S.ts[it.topicId])delete S.ts[it.topicId].box0;if(it?.gate&&x.r?.done)gateDone(S,it,x.r);return x;}
function skip0(S,g,pack,now){const it=S.current;if(!it)return{error:'no item'};const t=g.byId[it.topicId],ev=[];
  if(it.stage==='bonus'){S.current=null;return finish(S,{done:true,skipped:true,jane:'No problem! Here\'s a new one. 😊'},ev,true);}
  const sp=sup(S,it.topicId);sp.skipped++;sp.at=now;sp.teachDue=true;(sp.avoid??=[]).push({q:it.q,until:now+DAY});sp.avoid=sp.avoid.filter(x=>x.until>now).slice(-8);
  ev.push({event:'skipped',topicId:it.topicId,topic:t?.name,subject:t?.subject,mode:it.mode,format:it.format,level:it.lvl,question:it.q,expected:it.answer,stuckStep:it.stuckStep||0,pack:it.packKey?it.packKey.split(':')[0]:undefined});
  if(it.packKey)S.packSeen[it.packKey]=1;const rec=S.ts[it.topicId];
  if(it.kind==='math'&&rec&&(rec.lvl||3)>1)rec.lvl--;
  if(it.mode==='diagnostic'&&g.byId[it.topicId])placementResult(S,g,it.topicId,false);
  if(it.mode==='review'&&rec?.st==='mastered')rec.due=Math.min(rec.due,now+DAY);
  if(it.type!=='card'&&it.type!=='self'&&(it.requeued||0)<2){const {id,tries,stuckStep,issued,...item}=it;(S.requeue??=[]).push({item:{...item,stage:'main'},n:(it.requeued||0)+1,notBefore:now+DAY,at:now});S.requeue=S.requeue.slice(-12);}
  if(it.guided)guidedDone(S,it);
  if(it.kind==='math'&&it.mode==='learn'&&!S.mini)S.focus=it.topicId;
  S.current=null;const playBoss=it.format==='boss'&&it.kind==='math';
  return finish(S,{done:true,skipped:true,jane:playBoss?'Skipped! No heart lost. 💜 Let\'s power up, then back to the boss!':it.format==='boss'?'Skipped! No heart lost. 💜 On to the next one!':'Skipped for now! We\'ll come back to it later. 💜'},ev,true);}
function finish(S,r,ev,noChoice){if(r.done&&!noChoice&&!S.mini){S.sinceChoice++;if(S.sinceChoice>=6){r.askChoice=true;S.sinceChoice=0;}}return{r,ev};}
export function choose(S,g,c,pack,now){const cur=S.focus&&g.byId[S.focus];let msg='Keep going — you\'re doing great!',id=null;
  if(c==='harder'){id=pickFocus(S,g,pack,now,{subject:cur?.subject,minAge:(cur?.ageRangeStart||10)+1});msg='Ooh, a challenge! Let\'s go! 🚀';}
  else if(c==='easier'){if(cur&&S.ts[S.focus]?.lvl>1)S.ts[S.focus].lvl--;else id=pickFocus(S,g,pack,now,{subject:cur?.subject,maxAge:(cur?.ageRangeStart||10)-1});msg='Great choice — practice makes perfect!';}
  else if(c==='different'){const ns={notSubject:cur?.subject||'Mathematics'};id=pickFocus(S,g,pack,now,{...ns,unseen:true})||pickFocus(S,g,pack,now,{unseen:true})||pickFocus(S,g,pack,now,ns);msg=id?`Something new: ${g.byId[id].sn||g.byId[id].name}! 🎨`:msg;}
  else if(c==='fractions'){id=pickFocus(S,g,pack,now,{domain:'Fractions'});msg='Back to fractions! 🍕';}
  if(id)S.focus=id;S.current=null;return{jane:msg};}
export function publicItem(it,g,S,now=Date.now()){if(!it)return null;const boss=it.boss&&S?bossHP(S.ts?.[it.topicId],it,now):it.boss;const t=g.byId[it.topicId];const b=it.stage==='bonus';
  return{id:it.id,topicId:it.topicId,topic:{name:t.sn||t.name,subject:t.subject,domain:t.domain,ic:t.ic},q:b?it.bonus.q:it.q,type:b?'input':it.type,choices:b?null:it.choices,vis:it.vis,ptype:it.ptype,creative:it.creative,placeholder:it.placeholder,pics:it.pics,items:it.items,left:it.left,right:it.right,statements:it.statements,line:it.line,parts:it.parts,blank:it.blank,card:it.card,body:it.body,emoji:it.emoji,scene:it.scene,tpl:it.tpl,mini:it.mini,stage:it.stage,mode:it.mode,format:b?'bonus':it.format,intro:b?null:it.intro,timed:b?null:it.timed,boss,level:it.lvl,issued:it.issued,title:it.title,example:it.example,guided:b?undefined:it.guided,steps:b||!it.guided?undefined:it.steps,requeued:it.requeued,gate:it.gate?{n:it.gate.n,of:it.gate.of,k:it.gate.k,spot:!!it.spot,warm:!!it.gate.warm}:undefined,help:helpFor(it)};}
export function medalInfo(m,g){const t=g.byId[m.id]||g.hidden?.[m.id];if(!t)return null;return{id:m.id,tier:m.tier,at:m.at,boss:!!m.boss,name:t.sn||t.name,ic:t.ic,subject:t.subject,domain:t.domain,why:t.kq?`${t.kq} → ${t.ka}`:t.self};}
// upgrade an in-flight old-style self-check (raw assessmentPrompt) to the kid-friendly item, keeping its mode
export function refresh(S,g,pack,now){const c=S.current;if(c&&c.kind==='self'&&/Yes, I can/.test(c.choices?.[0]||'')&&g.byId[c.topicId]){S.current=buildItem(S,g,c.topicId,c.mode,pack,now);return true;}return false;}

// ---------- quests ----------
export function questActive(S,pack){if(!pack?.quest)return false;const q=S.quests?.[pack.date];return !!(q?.started&&!q.done);}
// a finished quest is locked: its pack serves nothing more, and its progress is read from the completion snapshot
export const questLocked=(S,pack)=>!!(pack?.quest&&S.quests?.[pack.date]?.done);
// v0.5: ONE quest at a time. current = the started, unfinished quest (focused, else oldest); with none, the newest
// unstarted quest pack (a "New quest!"). Other unfinished quest packs are queued: hidden, no alert, can't be started.
// Older unstarted packs are superseded once a newer one is current. packs: {date: pack} for dates <= today.
export function questLineup(S,packs,today){const Q=S?.quests||{},ds=Object.keys(packs||{}).filter(d=>packs[d]?.quest&&d<=today).sort();
  const active=ds.filter(d=>Q[d]?.started&&!Q[d]?.done),fresh=ds.filter(d=>!Q[d]?.started&&!Q[d]?.done);
  let current=active.includes(S?.questFocus)?S.questFocus:active[0]||null,newQuest=false;
  if(!current&&fresh.length){current=fresh[fresh.length-1];newQuest=true;}
  const queued=ds.filter(d=>d!==current&&!Q[d]?.done&&(active.includes(d)||(!newQuest&&fresh.includes(d))));
  return{current,newQuest,queued,finished:ds.filter(d=>Q[d]?.done).reverse()};}
export function questInfo(S,g,pack){if(!pack)return null;const Q=pack.quest||{},rec=S.quests?.[pack.date]||{};
  const seen=(t,j)=>S.packSeen[`${pack.date}:${t.topicId}:${j}`];
  let stages=pack.topics.map((t,i)=>{const live=t.questions.map((q,j)=>[q,j]).filter(([q])=>!q._skip),n=live.length,d=live.filter(([,j])=>seen(t,j)).length,tp=g.byId[t.topicId];
    return{topicId:t.topicId,name:t.stage?.name||t.intro?.title||tp?.sn||t.topicId,emoji:t.stage?.emoji||t.intro?.emoji||tp?.ic||'⭐',n,done:d,complete:d>=n,boss:t.format==='boss',deep:!!t.deepDive,review:!!t.review};});
  if(pack.quest&&rec.done){const snap=rec.snap?Object.fromEntries(rec.snap.stages.map(x=>[x.topicId,x.n])):null;
    stages=stages.filter(st=>snap?st.topicId in snap:st.done>0||st.complete).map(st=>{const n=snap?snap[st.topicId]:st.n;return{...st,n,done:n,complete:true};});}
  const total=stages.reduce((a,s)=>a+s.n,0),done=stages.reduce((a,s)=>a+s.done,0);
  const gates=pack.quest?gateStages(pack.topics.length).filter(k=>k<stages.length).map(k=>{const r=rec.gates?.[k],st=pack.topics[k],passed=!r?.open&&!!st&&(st.questions||[]).some((q,j)=>S.packSeen?.[`${pack.date}:${st.topicId}:${j}`]);
    // a stage the learner already started without meeting this gate (e.g. a quest begun before gates existed) shows it as passed
    return{before:k,state:r?.open||passed?'open':'locked',passed:passed||undefined,items:r?.n||0,of:r?.of??null,right:r?.right||0};}):[];
  return{date:pack.date,isQuest:!!pack.quest,title:Q.title||pack.title||('Adventure '+pack.date),hook:Q.hook||'',emoji:Q.emoji||'🗺️',medal:Q.medal||{name:(pack.title||'Adventure')+' medal',emoji:'🏅'},
    stages,gates,current:stages.findIndex(s=>!s.complete),total,done,pct:total?Math.round(100*done/total):0,started:rec.started||null,completed:rec.done||null};}
// called after an answer: when every stage is done, the quest is finished once and for all (snapshot + quest medal)
export function completeQuest(S,g,pack,now){if(!pack?.quest)return null;S.quests??={};const q=S.quests[pack.date]??={};if(q.done)return null;
  const qi=questInfo(S,g,pack);if(!qi.total||qi.done<qi.total)return null;
  q.started??=now;q.done=now;q.snap={stages:qi.stages.map(st=>({topicId:st.topicId,n:st.n})),total:qi.total};if(S.questFocus===pack.date)S.questFocus=null;
  const m={date:pack.date,title:qi.title,name:qi.medal.name,emoji:qi.medal.emoji,at:now};S.questMedals??=[];if(!S.questMedals.some(x=>x.date===pack.date))S.questMedals.push(m);return m;}
// ---------- map mini-sessions ("Explore now!" on green/blue stones, "Practice now" on orange ones) ----------
export function startMini(S,g,id,pack,now){const s=stateOf(S,g,id,now);if(!['ready','learning','review'].includes(s))return{error:'That stone is not open yet!'};
  const t=g.byId[id],math=!!kindFor(t),review=s==='review';
  S.mini={topicId:id,mode:review?'review':'learn',left:review?(math?2:1):(math?3:2),n:0,ret:t.subject,startedAt:now};
  S.miniHold=S.current&&S.current.topicId!==id?S.current:null;return miniItem(S,g,pack,now);}
function miniItem(S,g,pack,now){const M=S.mini;let mode=M.mode,it;
  if(mode==='learn'&&M.n>0&&!kindFor(g.byId[M.topicId])&&!packQ(S,pack,M.topicId)){it={...selfCheck(g,M.topicId),format:'explore',id:now+'-'+R(0,999),topicId:M.topicId,mode:'learn',tries:0,stage:'main',issued:now};}
  else it=buildItem(S,g,M.topicId,mode,pack,now);
  it.mini={n:M.n+1,of:M.n+M.left,mode:M.mode};if(M.mode==='review'&&M.n>0)it.practice=true;if(M.mode==='learn'&&it.format==='review')it.format='explore';
  M.n++;M.left--;S.current=it;return it;}
// after an answer is done: next mini item, or end the mini-session (returns summary)
export function miniAfter(S,g,pack,now,r){const M=S.mini;if(!M)return null;
  const st=stateOf(S,g,M.topicId,now),mastered=M.mode==='learn'&&S.ts[M.topicId]?.st==='mastered';
  if(M.left>0&&!mastered&&!(M.mode==='review'&&st==='mastered'&&M.n>=1&&!kindFor(g.byId[M.topicId]))){miniItem(S,g,pack,now);return null;}
  const t=g.byId[M.topicId];S.mini=null;S.current=S.miniHold||null;S.miniHold=null;
  return{topicId:M.topicId,name:t.sn||t.name,subject:M.ret,state:st,mastered:!!mastered||(M.mode==='review'&&st==='mastered')};}
// catch-up boost for an unfinished quest (KV boost:<questDate>): shorter remaining stages, extra hints, a cheer message
export function applyBoost(pack,b){const p=JSON.parse(JSON.stringify(pack));const CARDS=CARD;
  for(const t of p.topics){const n=b.trim?.[t.topicId];if(n>0){let g=0;for(const q of t.questions)if(!CARDS.includes(q.type)&&++g>n)q._skip=1;}
    const h=b.hints?.[t.topicId];if(h)for(const q of t.questions)if(!CARDS.includes(q.type))q.hint=`${h} ${q.hint||''}`.trim();}
  p.boost={message:b.message,emoji:b.emoji||'🚀',date:b.date};if(b.terms)p.terms={...(p.terms||{}),...b.terms};return p;}
