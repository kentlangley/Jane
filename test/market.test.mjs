// Points Market (plans/archive/points-market.md, #74; idea credit: Christopher). Points buy fun, choice and peeks:
// never mastery or medals. balance = earned − spent; purchases are server-side and idempotent.
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import {ROOT,tmpDir,loadEngine,validate,example} from './helpers.mjs';
const {E,g}=await loadEngine();const DAY=864e5,NOW=Date.parse('2026-10-23T19:00:00Z');
const rich=(pts=1000)=>{const S=E.blank();S.points=pts;S.firstDone=true;return S;};
const pid=(n=0)=>'test-pid-'+n;
const m0=S=>JSON.stringify([S.medals,S.questMedals||[],S.ts]);

// ---------- slice 1: wallet + ledger ----------
test('balance = earned − spent; S.points (earned) never decreases',()=>{
  const S=rich(100);assert.equal(E.walletState(S,g,NOW).balance,100);
  const x=E.buy(S,g,{pid:pid(1),item:'test-sticker'},NOW);assert.ok(x.ok,x.error);
  const w=E.walletState(S,g,NOW);assert.equal(S.points,100,'earned untouched');assert.equal(w.earned,100);assert.equal(w.spent,25);assert.equal(w.balance,75);
  assert.equal(S.wallet.ledger.length,1);assert.deepEqual(S.wallet.ledger[0],{id:pid(1),item:'test-sticker',kind:'sticker',price:25,at:NOW});});
test('insufficient balance is refused and charges nothing',()=>{
  const S=rich(10);const x=E.buy(S,g,{pid:pid(2),item:'test-sticker'},NOW);assert.match(x.error,/Not enough points/);assert.equal(x.need,15);
  assert.equal(S.wallet?.spent||0,0);assert.equal((S.wallet?.ledger||[]).length,0);});
test('same pid twice charges once; a one-time item twice → already',()=>{
  const S=rich(100);const a=E.buy(S,g,{pid:pid(3),item:'test-sticker'},NOW),b=E.buy(S,g,{pid:pid(3),item:'test-sticker'},NOW+1);
  assert.ok(a.ok&&!a.already);assert.ok(b.ok&&b.already);assert.equal(b.row.at,NOW,'original row returned');assert.equal(S.wallet.spent,25);
  const c=E.buy(S,g,{pid:pid(4),item:'test-sticker'},NOW+2);assert.ok(c.ok&&c.already&&c.owned);assert.equal(S.wallet.spent,25);assert.equal(S.wallet.ledger.length,1);});
test('bad pid, unknown item and client-sent prices are ignored or refused',()=>{
  const S=rich(100);assert.match(E.buy(S,g,{pid:'x',item:'test-sticker'},NOW).error,/purchase id/);
  assert.match(E.buy(S,g,{pid:pid(5),item:'medal-gold'},NOW).error,/unknown/);
  const x=E.buy(S,g,{pid:pid(6),item:'test-sticker',price:0},NOW);assert.equal(x.row.price,25);});
test('medals and mastery are unchanged after any buy',()=>{
  const S=rich(5000);const t=g.topics[0];S.ts[t.id]={st:'mastered',how:'direct',conf:.9,box:1,due:NOW+DAY,c:3,ft:3};S.medals=[{id:t.id,tier:'bronze',at:1}];
  const before=m0(S);for(const [i,d] of E.MARKET.entries()){if(d.chest)continue;const meta={};try{E.buy(S,g,{pid:pid(100+i),item:d.id,meta},NOW);}catch(e){assert.fail(e.message);}}
  assert.equal(m0(S),before);assert.equal(S.points,5000);});
test('day snapshots: one per PT day, capped; export has a market block with earned7d/spent7d',()=>{
  const S=rich(0);for(let i=0;i<70;i++){S.points=i*10;E.snapDay(S,new Date(Date.UTC(2026,0,1)+i*DAY).toISOString().slice(0,10));}
  assert.equal(Object.keys(S.wallet.days).length,E.WALLET_DAYS);
  const S2=rich(500);S2.wallet={spent:0,ledger:[],owned:{},equipped:{},active:{},choices:{},days:{'2026-10-15':200,'2026-10-16':300,'2026-10-23':500}};
  E.buy(S2,g,{pid:pid(7),item:'test-sticker'},NOW);const X=E.marketExport(S2,g,NOW);
  assert.equal(X.balance,475);assert.equal(X.earned,500);assert.equal(X.spent,25);assert.equal(X.spent7d,25);assert.equal(X.earned7d,200);assert.equal(X.earnedSince,'2026-10-16');
  assert.equal(X.ledger.length,1);assert.ok(X.prices['test-sticker']);});

// ---------- slice 2: skins ----------
test('skins: 4 slots priced 300–1,500, bought once, equip owned-only and free, unequip; looks go out with the wallet',()=>{
  const skins=E.MARKET.filter(d=>d.kind==='skin'&&!d.chest);assert.deepEqual([...new Set(skins.map(d=>d.slot))].sort(),['avatar','boss','ship','theme']);
  assert.ok(skins.every(d=>d.once&&d.price>=300&&d.price<=1500&&d.look),'skin prices 300–1,500');
  const S=rich(2000);assert.match(E.equip(S,g,'ship','ship-pirate').error,/Buy it first/);
  assert.ok(E.buy(S,g,{pid:pid(20),item:'ship-pirate'},NOW).ok);const spent=S.wallet.spent;
  assert.match(E.equip(S,g,'avatar','ship-pirate').error,/does not go there/);assert.match(E.equip(S,g,'hat','ship-pirate').error,/unknown slot/);
  const before=m0(S);assert.ok(E.equip(S,g,'ship','ship-pirate').ok);assert.equal(S.wallet.spent,spent,'equip is free');assert.equal(m0(S),before);
  let w=E.walletState(S,g,NOW);assert.equal(w.equipped.ship,'ship-pirate');assert.equal(w.looks.ship.sail,'#263238');
  assert.ok(E.marketItems(S,g,NOW).find(i=>i.id==='ship-pirate').equipped);
  assert.ok(E.equip(S,g,'ship',null).ok);w=E.walletState(S,g,NOW);assert.equal(w.equipped.ship,undefined);assert.ok(w.owned['ship-pirate'],'still owned after taking it off');
  assert.ok(E.buy(S,g,{pid:pid(21),item:'ship-pirate'},NOW).already,'owned skins are not sold twice');});

// ---------- scout flare / fog finds: fully deleted ----------
test('scout flare and fog finds are gone from MARKET and engine exports',()=>{
  assert.ok(!E.MARKET.some(i=>i.kind==='flare'||i.id==='scout-flare'||i.when));
  assert.equal(typeof E.fogState,'undefined');assert.equal(typeof E.claimFind,'undefined');
  assert.match(E.buy(rich(1000),g,{pid:pid(30),item:'scout-flare',meta:{region:'Science'}},NOW).error,/unknown/);
});

// ---------- slice 4: prove-it ticket ----------
const whyT=g.topics.find(t=>t.ck?.y),genT=g.topics.find(t=>t.subject==='Mathematics'&&t.domain==='Multiplication & Division'&&!t.ck);
const dueRec=(lvl=3)=>({st:'mastered',how:'direct',conf:.9,box:1,due:NOW-DAY,at:NOW-9*DAY,c:3,w:0,ft:3,lvl});
const proveSetup=()=>{const S=rich(1000);S.ts[whyT.id]=dueRec();S.ts[genT.id]=dueRec(3);S.medals=[{id:whyT.id,tier:'bronze',at:1},{id:genT.id,tier:'bronze',at:1}];S.current={id:'hold',topicId:genT.id,q:'held',type:'input',kind:'math',answer:'1',mode:'learn',tries:0,stage:'main',issued:NOW};return S;};
test('prove-it: a not-due or unknown topic is refused',()=>{const S=proveSetup();S.ts[whyT.id].due=NOW+DAY;
  assert.match(E.buy(S,g,{pid:pid(40),item:'prove-it',meta:{topicId:whyT.id}},NOW).error,/due right now/);
  assert.match(E.buy(S,g,{pid:pid(41),item:'prove-it',meta:{topicId:'nope'}},NOW).error,/Pick a review/);assert.equal(S.wallet?.spent||0,0);});
test('prove-it: right first try → box +1, new due, normal points + bonus; the held item comes back',()=>{
  const S=proveSetup(),medals=JSON.stringify(S.medals),p0=S.points;const x=E.buy(S,g,{pid:pid(42),item:'prove-it',meta:{topicId:whyT.id}},NOW);assert.ok(x.ok,x.error);
  assert.equal(S.current.format,'prove');assert.equal(S.current.mode,'review');assert.match(S.current.q,/WHY/);assert.equal(S.current.answer,whyT.ck.y.a);assert.equal(S.proveHold.id,'hold');
  const y=E.submit(S,g,S.current.answer,NOW+5000);assert.equal(y.r.correct,true);assert.equal(y.r.proveIt.passed,true);
  const r=S.ts[whyT.id];assert.equal(r.box,2);assert.equal(r.due,NOW+5000+7*DAY);assert.equal(r.st,'mastered');assert.equal(r.how,'direct');
  assert.ok(S.points>=p0+E.PROVE_BONUS+10,'normal review points + bonus (earned)');assert.equal(S.wallet.spent,150,'spent stays spent');
  assert.equal(S.current.id,'hold');assert.equal(S.proveHold,undefined);assert.equal(JSON.stringify(S.medals),medals);
  assert.ok(y.ev.some(e=>e.event==='proveIt'&&e.passed));});
test('prove-it: wrong → review stays due (≤ now + 1 day), not demoted, no refund',()=>{
  const S=proveSetup();E.buy(S,g,{pid:pid(43),item:'prove-it',meta:{topicId:whyT.id}},NOW);const wrong=S.current.choices.find(c=>c!==S.current.answer);
  const y=E.submit(S,g,wrong,NOW+5000);assert.equal(y.r.done,true);assert.equal(y.r.correct,false);assert.equal(y.r.reveal,whyT.ck.y.a);
  const r=S.ts[whyT.id];assert.ok(r.due<=NOW+5000+DAY);assert.equal(r.st,'mastered');assert.equal(r.box,1);assert.equal(S.wallet.spent,150);assert.equal(S.current.id,'hold');});
test('prove-it: a generator topic gets a question one level up; skip forfeits the ticket',()=>{
  const S=proveSetup();E.buy(S,g,{pid:pid(44),item:'prove-it',meta:{topicId:genT.id}},NOW);assert.equal(S.current.lvl,4);assert.equal(S.current.type,'input');assert.equal(S.current.bonus,null);
  const k=E.skip(S,g,null,NOW+1);assert.equal(k.r.skipped,true);assert.equal(S.current.id,'hold');assert.equal(S.ts[genT.id].box,1);assert.equal(S.wallet.spent,150);});
test('prove-it: max 2 per Pacific day, offers list only due provable topics',()=>{
  const S=proveSetup();assert.equal(E.proveOffers(S,g,NOW).due.length,2);
  for(const i of [0,1]){assert.ok(E.buy(S,g,{pid:pid(50+i),item:'prove-it',meta:{topicId:whyT.id}},NOW+i).ok);E.skip(S,g,null,NOW+i);}
  assert.match(E.buy(S,g,{pid:pid(52),item:'prove-it',meta:{topicId:whyT.id}},NOW+2).error,/tomorrow/);assert.equal(E.proveOffers(S,g,NOW+2).left,0);
  assert.ok(E.buy(S,g,{pid:pid(53),item:'prove-it',meta:{topicId:whyT.id}},NOW+DAY).ok,'a new day, a new ticket');});

// ---------- slice 5: pick your path ----------
test('pick your path: 2–3 READY topics, one per subject, stable all day; only an offered topic can be picked; one open pick per kind',()=>{
  const S=rich(1000);const o=E.pathOffers(S,g,NOW);assert.ok(o.length>=2&&o.length<=3,'2–3 offers');
  assert.ok(o.every(x=>E.stateOf(S,g,x.topicId,NOW)==='ready'),'prereqs met');assert.equal(new Set(o.map(x=>x.subject)).size,o.length);
  assert.deepEqual(E.pathOffers(S,g,NOW+3600e3),o,'same offers later the same day');
  const notOffered=g.topics.find(t=>E.stateOf(S,g,t.id,NOW)==='locked');
  assert.match(E.buy(S,g,{pid:pid(60),item:'pick-path',meta:{topicId:notOffered.id}},NOW).error,/on offer/);
  const x=E.buy(S,g,{pid:pid(61),item:'pick-path',meta:{topicId:o[0].topicId}},NOW);assert.ok(x.ok,x.error);assert.equal(S.wallet.choices.path.topicId,o[0].topicId);
  assert.match(E.buy(S,g,{pid:pid(62),item:'pick-path',meta:{topicId:o[1].topicId}},NOW).error,/already picked/);
  assert.ok(E.buy(S,g,{pid:pid(63),item:'pick-theme',meta:{theme:'pirates'}},NOW).ok);assert.match(E.buy(S,g,{pid:pid(64),item:'pick-theme',meta:{theme:'space'}},NOW).error,/already picked/);
  assert.match(E.buy(rich(500),g,{pid:pid(65),item:'pick-theme',meta:{theme:'nope'}},NOW).error,/Pick a theme/);
  assert.equal(S.wallet.spent,200);});
test('pick your path: a later quest pack with "honors" marks it used; "declined" refunds with a new ledger row',()=>{
  const S=rich(1000);const o=E.pathOffers(S,g,NOW);E.buy(S,g,{pid:pid(66),item:'pick-path',meta:{topicId:o[0].topicId}},NOW);E.buy(S,g,{pid:pid(67),item:'pick-theme',meta:{theme:'space'}},NOW);
  const day=E.walletState(S,g,NOW).choices.path.at,d0=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date(day));
  assert.deepEqual(E.honorChoices(S,{[d0]:{date:d0,quest:{},honors:{path:o[0].topicId}}},NOW),[],'a pack from the same day does not count');
  const d1='2099-01-01';const done=E.honorChoices(S,{[d1]:{date:d1,quest:{title:'x'},honors:{path:o[0].topicId,theme:'declined',note:'no space quest fits'}}},NOW+DAY);
  assert.equal(done.length,2);assert.equal(S.wallet.choices.path.used.date,d1);assert.equal(S.wallet.choices.theme.used.declined,true);
  assert.equal(S.wallet.spent,100,'theme refunded');assert.equal(S.wallet.ledger.length,3);assert.equal(S.wallet.ledger[2].price,-100);assert.equal(S.wallet.ledger[1].price,100,'earlier rows untouched');
  assert.equal(E.honorChoices(S,{[d1]:{date:d1,quest:{},honors:{theme:'declined'}}},NOW+DAY).length,0,'idempotent');assert.equal(S.wallet.spent,100);
  assert.ok(E.buy(S,g,{pid:pid(68),item:'pick-path',meta:{topicId:E.pathOffers(S,g,NOW+DAY)[0].topicId}},NOW+DAY).ok,'a new pick after the old one was used');});
test('publish: "honors" is validated (topic must be a stage, theme from the table); publish:dry still passes',()=>{
  const p=example();p.honors={path:p.topics[0].topicId,theme:'pirates',note:'You picked it!'};assert.equal(validate(p).status,0,validate(p).stderr);
  const bad=example();bad.honors={path:'mt_nope',theme:'unicorns',x:1};const r=validate(bad);assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/honors\.path/);assert.match(r.stdout+r.stderr,/honors\.theme/);
  assert.equal(execFileSync(process.execPath,['publish-lessons.mjs','packs/examples/example-quest.json','--dry-run','--offline'],{cwd:ROOT,encoding:'utf8'}).length>0,true);});

// ---------- cheap extras (fog finds / fog-gated chests deleted) ----------
test('fog-gated mystery chests are gone; chest-only skins stay unlisted until owned',()=>{
  const S=rich(2000);assert.ok(!E.MARKET.some(i=>i.id==='chest-world-20'||i.when));
  assert.match(E.buy(S,g,{pid:pid(70),item:'chest-world-20'},NOW).error,/unknown/);
  assert.equal(E.hiddenCount(S,g),0);
  assert.match(E.buy(S,g,{pid:pid(71),item:'ship-ghost'},NOW).error,/mystery chest/);assert.ok(!E.marketItems(S,g,NOW).some(i=>i.id==='ship-ghost'));
  S.wallet={spent:0,ledger:[],owned:{'ship-ghost':NOW},equipped:{},active:{},choices:{},days:{}};
  assert.ok(E.marketItems(S,g,NOW).some(i=>i.id==='ship-ghost'&&i.owned));
  assert.ok(E.equip(S,g,'ship','ship-ghost').ok);});
test('hint token: Market tokens live on wallet.active; a whisper uses one per question and never changes grading',()=>{
  const S=rich(1000);assert.ok(E.buy(S,g,{pid:pid(72),item:'hint-token'},NOW).ok);assert.equal(S.wallet.active.hintToken,1);
  assert.ok(E.buy(S,g,{pid:pid('72b'),item:'hint-token'},NOW).ok);assert.equal(S.wallet.active.hintToken,2);
  const t=g.topics.find(t=>t.ck?.w);S.current={id:'q1',topicId:t.id,type:'mc',kind:'quiz',q:t.ck.q,choices:[t.ck.a,...t.ck.w],answer:t.ck.a,misconception:t.ck.w[0],mode:'review',tries:0,stage:'main',issued:NOW};
  const before=JSON.stringify(S.current),pts=S.points,streak=S.streak;const w=E.whisper(S,g,NOW);assert.ok(w.ok);assert.match(w.whisper,new RegExp(t.ck.w[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.equal(S.wallet.active.hintToken,1);const w2=E.whisper(S,g,NOW);assert.ok(w2.already);assert.equal(S.wallet.active.hintToken,1,'once per question');
  assert.equal(S.current.tries,0);assert.equal(S.points,pts);assert.equal(S.streak,streak);assert.deepEqual({...S.current,whisper:undefined},{...JSON.parse(before),whisper:undefined});
  assert.equal(E.submit(S,g,t.ck.a,NOW+1).r.correct,true,'graded exactly as without the whisper');
  S.wallet.active.hintToken=0;S.current={...S.current,id:'q2',whisper:undefined,tries:0};assert.match(E.whisper(S,g,NOW).error,/No whispers/);});
test('whisper without trap data does not charge a token',()=>{
  const S=rich(1000);S.wallet={spent:0,ledger:[],owned:{},equipped:{},active:{hintToken:2},choices:{},days:{}};
  S.current={id:'q3',topicId:g.topics[0].id,type:'mc',kind:'quiz',q:'Which is a noun?',choices:['run','cat','quickly'],answer:'cat',mode:'learn',tries:0,stage:'main',issued:NOW};
  const none=g.topics.find(t=>!t.ck);S.current.topicId=none.id;delete S.current.misconception;
  const eng=g.topics.find(t=>t.subject==='English'&&!t.ck);if(eng)S.current.topicId=eng.id;
  const n0=S.wallet.active.hintToken;const w=E.whisper(S,g,NOW);
  if(w.error&&/trap on file|keep your whisper/i.test(w.error)){assert.equal(S.wallet.active.hintToken,n0);assert.ok(!S.current.whisper);}
  else{assert.ok(w.ok);assert.ok(S.current.whisper);}});
test('theme looks include app bg colors; sticker buy lands on the shelf list',()=>{
  const night=E.MARKET.find(d=>d.id==='theme-night');assert.ok(night.look.bg?.length>=2);
  assert.match(night.note,/whole app|My World/i);
  const gold=E.MARKET.find(d=>d.id==='ship-gold');assert.match(gold.note,/My World|galleon/i);
  const S=rich(100);const x=E.buy(S,g,{pid:pid(90),item:'test-sticker'},NOW);assert.ok(x.ok);
  assert.ok((S.wallet.stickers||[]).some(s=>s.id==='test-sticker'));
  assert.ok(E.walletState(S,g,NOW).stickers.some(s=>s.id==='test-sticker'));});
test('streak shield: keeps 🔥 on one miss; hearts, boss HP, mastery and the star run identical to an unshielded miss',()=>{
  const mk=()=>{const S=rich(1000);const t=g.topics.find(t=>t.subject==='Mathematics'&&g.boss.has(t.id));S.streak=5;S.starRun=5;S.ts[t.id]={st:'learning',how:'direct',c:3,w:0,lvl:3,streak:2,bossRun:2,bossDay:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date(NOW))};
    S.current={id:'b1',topicId:t.id,type:'input',kind:'math',q:'7 × 8 = ?',answer:'56',hint:'h',explain:'e',format:'boss',boss:{max:3,hp:1},mode:'learn',tries:0,stage:'main',issued:NOW,lvl:3};return S;};
  const A=mk(),B=mk();assert.ok(E.buy(A,g,{pid:pid(73),item:'streak-shield'},NOW).ok);
  const ra=E.submit(A,g,'1',NOW+1).r,rb=E.submit(B,g,'1',NOW+1).r;assert.equal(A.streak,5,'shielded');assert.equal(B.streak,0);assert.equal(ra.shielded,5);assert.equal(A.wallet.active.shield,0);
  const strip=S=>JSON.stringify([S.ts,S.support,S.current?.boss,S.current?.tries,S.stars,S.starRun,S.points]);assert.equal(strip(A),strip(B),'hearts/boss HP/mastery identical');assert.deepEqual(ra.boss,rb.boss);
  E.submit(A,g,'2',NOW+2);assert.equal(A.streak,5,'the same question stays covered');
  A.current={...mk().current,id:'b2',tries:0};E.submit(A,g,'1',NOW+3);assert.equal(A.streak,0,'no shield left → reset');
  const C=mk();C.wallet={spent:0,ledger:[],owned:{},equipped:{},active:{shield:1},choices:{},days:{}};E.submit(C,g,'1',NOW);C.current={...mk().current,id:'b3',tries:0,format:'quest',boss:null};
  const s0=C.stars;E.submit(C,g,'56',NOW+5);assert.equal(C.streak,6);assert.equal(C.stars,s0,'6 in the 🔥 chip, but no star: the star run restarted at the miss');});
test('days played: +1 per PT day, a freeze covers exactly one missed day, two missed days reset it',()=>{
  const D=d=>Date.parse(d+'T19:00:00Z');const S=rich(1000);S.wallet={spent:0,ledger:[],owned:{},equipped:{},active:{},choices:{},days:{}};
  E.playDay(S,D('2026-10-01'));E.playDay(S,D('2026-10-01'));E.playDay(S,D('2026-10-02'));assert.equal(S.days.n,2);
  E.playDay(S,D('2026-10-04'));assert.equal(S.days.n,1,'one missed day, no freeze → reset');
  assert.ok(E.buy(S,g,{pid:pid(74),item:'streak-freeze'},D('2026-10-04')).ok);assert.equal(E.dayStreak(S,D('2026-10-06')).atRisk,true);
  E.playDay(S,D('2026-10-06'));assert.equal(S.days.n,2,'freeze covered 10-05');assert.deepEqual(S.days.frozen,['2026-10-05']);assert.equal(S.wallet.active.freeze,0);
  E.buy(S,g,{pid:pid(75),item:'streak-freeze'},D('2026-10-06'));E.playDay(S,D('2026-10-09'));assert.equal(S.days.n,1,'two missed days, one freeze → reset');assert.equal(S.wallet.active.freeze,1,'freeze kept');
  assert.equal(S.days.best,2);assert.equal(E.dayStreak(S,D('2026-10-12')).n,0);});
test('extras have stock caps and cost 25–100',()=>{const ex=E.MARKET.filter(d=>d.kind==='extra');assert.equal(ex.length,3);assert.ok(ex.every(d=>d.price>=25&&d.price<=100));
  const S=rich(5000);for(let i=0;i<E.SHIELD_MAX;i++)assert.ok(E.buy(S,g,{pid:pid(80+i),item:'streak-shield'},NOW).ok);assert.match(E.buy(S,g,{pid:pid(89),item:'streak-shield'},NOW).error,/already have/);});

// ---------- server: routes, purchase log, export ----------
const DATA=tmpDir('jane-market-');let srv,B;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const call=async(p,body)=>{const r=await fetch(B+p,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return{status:r.status,j:await r.json()};};
before(async()=>{const S=rich(1000);S.placement.done=true;S.ts[whyT.id]={...dueRec(),due:Date.now()-DAY};S.medals=[{id:whyT.id,tier:'bronze',at:1}];fs.writeFileSync(path.join(DATA,'progress.json'),JSON.stringify(S));
  const port=await freePort();B=`http://127.0.0.1:${port}`;
  srv=spawn(process.execPath,['server/index.mjs'],{cwd:ROOT,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:DATA,LEARNER_NAME:'Sam'},stdio:['ignore','pipe','inherit']});
  for(let i=0;i<100;i++){try{if((await fetch(B+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('server did not start');});
after(()=>{srv?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
test('server: /api/state wallet, GET /api/market, idempotent POST /api/market/buy, purchase log, export market',async()=>{
  const s=(await call('/api/state')).j;assert.deepEqual([s.wallet.balance,s.wallet.earned,s.wallet.spent],[1000,1000,0]);
  const m=(await call('/api/market')).j;assert.ok(m.items.some(i=>i.id==='test-sticker'&&i.affordable&&!i.owned));
  const a=await call('/api/market/buy',{pid:'srv-pid-1',item:'test-sticker'});assert.equal(a.status,200);assert.equal(a.j.state.wallet.balance,975);assert.equal(a.j.state.points,1000);
  const b=await call('/api/market/buy',{pid:'srv-pid-1',item:'test-sticker'});assert.equal(b.j.already,true);assert.equal(b.j.wallet.spent,25);
  assert.equal((await call('/api/market/buy',{pid:'srv-pid-2',item:'nope'})).status,400);
  const log=JSON.parse(fs.readFileSync(path.join(DATA,`log%3A${today}.json`),'utf8')).filter(l=>l.event==='purchase');assert.equal(log.length,1);assert.equal(log[0].price,25);
  const ex=execFileSync(process.execPath,['export-progress.mjs','--local'],{cwd:ROOT,env:{...process.env,DATA_DIR:DATA},encoding:'utf8'});
  const X=JSON.parse(fs.readFileSync(ex.match(/wrote (\S+\.json)/)[1],'utf8'));assert.equal(X.market.spent,25);assert.equal(X.market.balance,975);assert.equal(X.market.ledger.length,1);
  assert.equal(typeof X.market.earned7d,'number');});
test('server: buy a ship skin, equip it, /api/state carries the look; equip without owning is refused',async()=>{
  assert.equal((await call('/api/market/equip',{slot:'avatar',item:'avatar-fox'})).status,400);
  const a=await call('/api/market/buy',{pid:'srv-pid-3',item:'ship-candy'});assert.equal(a.status,200);
  const e=await call('/api/market/equip',{slot:'ship',item:'ship-candy'});assert.equal(e.status,200);assert.equal(e.j.state.wallet.looks.ship.id,'ship-candy');
  const s=(await call('/api/state')).j;assert.equal(s.wallet.equipped.ship,'ship-candy');assert.equal(s.wallet.balance,s.wallet.earned-s.wallet.spent);assert.equal(s.points,1000);
  assert.equal((await call('/api/market/buy',{pid:'srv-pid-4',item:'scout-flare',meta:{region:'Mathematics'}})).status,400);
  const m1=(await call('/api/map')).j;assert.equal(m1.fog,undefined);assert.ok(m1.codes);assert.ok(m1.progress);
  const h=await (await fetch(B+'/parent')).text();assert.match(h,/"wallet":\{"balance":675,"earned":1000,"spent":325/,"parent data carries both earned and spendable");});
test('server: POST /api/market/prove serves the harder question; answering it right clears the review',async()=>{
  const m=(await call('/api/market')).j;assert.ok(m.prove.due.some(d=>d.topicId===whyT.id));
  const a=await call('/api/market/prove',{pid:'srv-pid-5',topicId:whyT.id});assert.equal(a.status,200,JSON.stringify(a.j));assert.equal(a.j.state.item.format,'prove');
  const r=(await call('/api/answer',{answer:whyT.ck.y.a})).j;assert.equal(r.proveIt.passed,true);assert.equal(r.state.wallet.spent,475);
  assert.ok(r.state.points>=1000+20);assert.equal(r.state.wallet.balance,r.state.wallet.earned-r.state.wallet.spent);
  assert.equal((await call('/api/market/prove',{pid:'srv-pid-6',topicId:whyT.id})).status,400,'no longer due');});
test('server: buy a pick; /api/state shows it; export carries market.choices and the MARKET CHOICE step',async()=>{
  const m=(await call('/api/market')).j;assert.ok(m.path.offers.length>=2);assert.ok(m.path.themes.length>=4);
  const a=await call('/api/market/buy',{pid:'srv-pid-7',item:'pick-path',meta:{topicId:m.path.offers[0].topicId}});assert.equal(a.status,200,JSON.stringify(a.j));
  assert.equal(a.j.state.wallet.choices.path.topicId,m.path.offers[0].topicId);
  const ex=execFileSync(process.execPath,['export-progress.mjs','--local'],{cwd:ROOT,env:{...process.env,DATA_DIR:DATA},encoding:'utf8'});
  const X=JSON.parse(fs.readFileSync(ex.match(/wrote (\S+\.json)/)[1],'utf8'));assert.equal(X.market.choices.path.topicId,m.path.offers[0].topicId);
  assert.equal(X.market.openChoices.path.topicId,m.path.offers[0].topicId);assert.match(X.quests.nextStep,/MARKET CHOICE/);assert.match(X.quests.nextStep,/"honors"/);});
