// Slice 1 (#55): campaign trail API (quest medals fill trail; legendaries light Final Boss). Fog fully removed.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {loadEngine} from './helpers.mjs';
const DIR=path.dirname(fileURLToPath(import.meta.url));
const {E,g}=await loadEngine();
const qm=(date,at,name='Medal',emoji='🏅')=>({date,title:'Q '+date,name,emoji,at});
const blank=()=>E.blank();

test('empty progress: empty trail, no legendaries',()=>{
  const S=blank(),C=E.campaignState(S,g);
  assert.equal(C.trailLen,12);assert.equal(C.filled,0);assert.equal(C.nodes.length,12);
  assert.ok(C.nodes.every(n=>n===null));assert.equal(C.legendaries.have,0);assert.equal(C.legendaries.need,4);
  assert.equal(C.legendaries.slots.length,4);assert.ok(C.legendaries.slots.every(s=>s===null));assert.deepEqual(C.history,[]);
  assert.equal(C.finalBoss.lit,0);assert.equal(C.finalBoss.unlocked,false);assert.equal(typeof C.taunt,'string');});

test('N quest medals fill N trail nodes in at-order',()=>{
  const S=blank();S.questMedals=[qm('2026-01-03',30,'C','💎'),qm('2026-01-01',10,'A','⭐'),qm('2026-01-02',20,'B','🔥')];
  const C=E.campaignState(S,g);assert.equal(C.filled,3);
  assert.deepEqual(C.nodes.slice(0,3),[{date:'2026-01-01',name:'A',emoji:'⭐'},{date:'2026-01-02',name:'B',emoji:'🔥'},{date:'2026-01-03',name:'C',emoji:'💎'}]);
  assert.ok(C.nodes.slice(3).every(n=>n===null));assert.match(C.taunt,/9 bosses/i);});

test('more than 12 quest medals caps trail length; extras do not extend',()=>{
  const S=blank();S.questMedals=Array.from({length:15},(_,i)=>qm(`2026-01-${String(i+1).padStart(2,'0')}`,(i+1)*10,`M${i}`));
  const C=E.campaignState(S,g);assert.equal(C.trailLen,12);assert.equal(C.filled,12);assert.equal(C.nodes.length,12);
  assert.ok(C.nodes.every(n=>n&&n.date));assert.equal(C.nodes[0].name,'M0');assert.equal(C.nodes[11].name,'M11');
  assert.equal(C.finalBoss.unlocked,false,'trail full alone does not unlock');});

test('legendary medals light the Final Boss; unlocked only when trail full AND need met',()=>{
  const S=blank();
  S.medals=[{id:'a',tier:'legendary',at:1},{id:'b',tier:'legendary',at:2},{id:'c',tier:'bronze',at:3}];
  let C=E.campaignState(S,g);assert.equal(C.legendaries.have,2);assert.ok(C.legendaries.slots[0]&&C.legendaries.slots[1]);assert.equal(C.legendaries.slots[2],null);
  assert.equal(C.finalBoss.lit,0.5);assert.equal(C.finalBoss.unlocked,false);
  S.medals.push({id:'d',tier:'legendary',at:4},{id:'e',tier:'legendary',at:5});
  C=E.campaignState(S,g);assert.equal(C.legendaries.have,4);assert.equal(C.finalBoss.lit,1);assert.equal(C.finalBoss.unlocked,false,'need trail too');
  S.questMedals=Array.from({length:12},(_,i)=>qm(`2026-02-${String(i+1).padStart(2,'0')}`,100+i));
  C=E.campaignState(S,g);assert.equal(C.filled,12);assert.equal(C.finalBoss.unlocked,true);assert.match(C.taunt,/Final Boss|finale/i);
  S.medals.push({id:'f',tier:'legendary',at:6});C=E.campaignState(S,g);assert.equal(C.finalBoss.lit,1,'lit caps at 1');});


test('Play mounts Campaign Trail HUD + preview hash (slice 2)',()=>{
  const html=fs.readFileSync(path.join(DIR,'../public/index.html'),'utf8');
  const js=fs.readFileSync(path.join(DIR,'../public/app.js'),'utf8');
  const css=fs.readFileSync(path.join(DIR,'../public/app.css'),'utf8');
  assert.ok(html.includes('id="campaign"'),'index has #campaign');
  assert.match(js,/function campaignHUD/);assert.match(js,/#campaign-preview/);
  assert.match(css,/\.campaign/);assert.match(css,/cnPulse|prefers-reduced-motion:reduce/);
});

test('campaign overlay helpers present; strip is actionable (slice 3)',()=>{
  const js=fs.readFileSync(path.join(DIR,'../public/app.js'),'utf8');
  const css=fs.readFileSync(path.join(DIR,'../public/app.css'),'utf8');
  assert.match(js,/function openCampaign/);assert.match(js,/function closeCampaign/);
  assert.match(js,/campaignHUD[\s\S]*openCampaign|onclick=.*openCampaign|campaign.*button/s);
  assert.match(css,/\.coverlay|\.qomap/);
});

test('fog purged: no fog API helpers, no fog fields on worker pub/map, no fog finds UI',()=>{
  const js=fs.readFileSync(path.join(DIR,'../public/app.js'),'utf8');
  const w=fs.readFileSync(path.join(DIR,'../src/worker.js'),'utf8');
  const eng=fs.readFileSync(path.join(DIR,'../src/engine.js'),'utf8');
  assert.equal(typeof E.fogState,'undefined');assert.equal(typeof E.claimFind,'undefined');assert.equal(E.FOG_FINDS,undefined);
  assert.doesNotMatch(js,/fog-island|fog-wisp|fogHoles|claimFogFind|paintFogFinds|Light it up!|mkFlare|scout-flare/);
  assert.doesNotMatch(w,/fog:E\.fogState|\/api\/fog\/claim|fogState/);
  assert.doesNotMatch(eng,/export function fogState|export const FOG_FINDS|export function claimFind|id:'scout-flare'/);
});

test('upgrade migrates hint tokens off S.fog and strips fog + flares',()=>{
  const S=blank();S.fog={finds:[{id:'chest-world-5',claimedAt:1}],buffs:{hintToken:2}};S.wallet={spent:0,ledger:[],owned:{},equipped:{},active:{flares:[{region:'Science',until:9e15}]},choices:{},days:{}};
  E.migrate(S,g);assert.equal(S.fog,undefined);assert.equal(S.wallet.active.flares,undefined);
  assert.equal(S.wallet.active.hintToken,2);assert.equal(E.walletState(S,g).hintTokens,2);
});
test('export and UI have no fog finds surface',()=>{
  const js=fs.readFileSync(path.join(DIR,'../public/app.js'),'utf8');
  const html=fs.readFileSync(path.join(DIR,'../public/index.html'),'utf8');
  const ex=fs.readFileSync(path.join(DIR,'../export-progress.mjs'),'utf8');
  assert.ok(!html.includes('id="ffinds"'));
  assert.doesNotMatch(js,/claimFogFind|fogFindReveal|Fog finds ready/);
  assert.doesNotMatch(ex,/fog:E\.fogState|fogState/);
});

test('syncFinale persists reveal once; no fake medals (slice 6)',()=>{
  const S=blank();
  S.questMedals=Array.from({length:12},(_,i)=>qm(`2026-03-${String(i+1).padStart(2,'0')}`,100+i));
  S.medals=[{id:'a',tier:'legendary',at:1},{id:'b',tier:'legendary',at:2},{id:'c',tier:'legendary',at:3},{id:'d',tier:'legendary',at:4}];
  const medals0=S.medals.length;
  let C=E.campaignState(S,g);assert.equal(C.finalBoss.unlocked,true);assert.equal(C.finalBoss.revealedAt,null);
  const r1=E.syncFinale(S,g,5000);assert.equal(r1.justUnlocked,true);assert.equal(r1.revealedAt,5000);
  assert.equal(S.campaign.finalBossRevealedAt,5000);assert.equal(S.medals.length,medals0);assert.deepEqual(S.questMedals.length,12);
  C=E.campaignState(S,g);assert.equal(C.finalBoss.revealedAt,5000);
  const r2=E.syncFinale(S,g,9000);assert.equal(r2.justUnlocked,false);assert.equal(r2.revealedAt,5000);
  assert.equal(S.campaign.finalBossRevealedAt,5000,'idempotent');
  // not unlocked → no persist
  const S2=blank();assert.equal(E.syncFinale(S2,g,1).justUnlocked,false);assert.equal(S2.campaign?.finalBossRevealedAt,undefined);
});
test('finale reveal UI + docs + export campaign flag (slice 6)',()=>{
  const js=fs.readFileSync(path.join(DIR,'../public/app.js'),'utf8');
  const les=fs.readFileSync(path.join(DIR,'../LESSONS.md'),'utf8');
  const night=fs.readFileSync(path.join(DIR,'../NIGHTLY.md'),'utf8');
  const ex=fs.readFileSync(path.join(DIR,'../export-progress.mjs'),'utf8');
  const w=fs.readFileSync(path.join(DIR,'../src/worker.js'),'utf8');
  assert.match(js,/function finaleReveal/);assert.match(w,/syncFinale/);
  assert.match(ex,/campaign:E\.campaignState/);assert.match(les,/Finale quest|forging the finale/i);
  assert.match(night,/Finale/i);
});
