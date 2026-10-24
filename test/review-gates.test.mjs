// Slices 10 + 12: review gates between quest stages, drawn from the due Leitner queue at runtime; spot-checks of inferred topics.
import {test} from 'node:test';import assert from 'node:assert/strict';import {loadEngine} from './helpers.mjs';
const {E,g}=await loadEngine();const DAY=864e5,now=Date.parse('2026-02-02T18:00:00Z'),D='2026-02-02';
const pool=g.topics.filter(t=>t.kq&&t.subject!=='Mathematics'&&!g.boss.has(t.id)).map(t=>t.id);
const REV=pool.slice(0,8),STG=pool.slice(20,30);
const mc=i=>({type:'mc',prompt:`Stop question ${i}?`,choices:['yes','no','maybe'],answer:'yes',hint:'h',explanation:'e'});
const quest=n=>({date:D,quest:{title:'Test Quest',hook:'Go!',medal:{name:'Test Medal',emoji:'🏅'}},topics:STG.slice(0,n).map((id,i)=>({topicId:id,stage:{name:'Stop '+i,emoji:'⭐'},format:i===n-1?'boss':'quest',questions:[mc(1),mc(2),...(i===n-1?[mc(3)]:[])]}))});
function setup({due=5,inferred=0,n=3}={}){const S=E.blank();S.firstDone=true;S.placement.done=true;S.itemsServed=10;S.quests={[D]:{started:now-1e5}};S.questFocus=D;
  REV.slice(0,due).forEach((id,i)=>S.ts[id]={st:'mastered',how:'direct',conf:.9,box:1,due:now-(10-i)*DAY,at:now-20*DAY,c:3,ft:3});
  pool.slice(40,40+inferred).forEach((id,i)=>S.ts[id]={st:'mastered',how:'inferred',conf:.6+i/100,box:2,due:now+30*DAY,at:now-20*DAY});return{S,pack:quest(n)};}
const step=(S,pack,t,right=true)=>{const it=E.next(S,g,pack,t);const x=E.submit(S,g,right?it.answer:'zzz wrong',t);if(!right&&!x.r.done)E.submit(S,g,'zzz wrong',t);return{it,x};};
test('finishing stage 1 opens a gate for the most overdue direct topic before stage 2',()=>{const {S,pack}=setup();
  for(let i=0;i<2;i++){const {it}=step(S,pack,now);assert.equal(it.topicId,STG[0]);}
  const gi=E.next(S,g,pack,now);assert.equal(gi.mode,'review');assert.equal(gi.format,'gate');assert.equal(gi.topicId,REV[0],'most overdue first');assert.deepEqual([gi.gate.k,gi.gate.n,gi.gate.of],[1,1,2]);});
test('a first-try right gate answer moves the topic up a box; a missed one demotes it; the gate still opens',()=>{const {S,pack}=setup();
  for(let i=0;i<2;i++)step(S,pack,now);const a=step(S,pack,now);assert.equal(a.it.format,'gate');assert.equal(S.ts[a.it.topicId].box,2);assert.ok(S.ts[a.it.topicId].due>now+6*DAY);
  const b=step(S,pack,now,false);assert.equal(b.it.format,'gate');assert.equal(S.ts[b.it.topicId].st,'learning');
  const nx=E.next(S,g,pack,now);assert.equal(nx.topicId,STG[1],'gate open: stage 2 next');assert.equal(S.quests[D].gates[1].open,true);});
test('no due topics and no inferred skills → no gate, the quest flows straight on',()=>{const {S,pack}=setup({due:0});for(let i=0;i<2;i++)step(S,pack,now);
  for(const [id,r] of Object.entries(S.ts)){r.due=now+5*DAY;if(r.how==='inferred')delete S.ts[id];} // nothing due, nothing due soon, nothing inferred to spot-check
  const nx=E.next(S,g,pack,now);assert.notEqual(nx.format,'gate');assert.equal(nx.topicId,STG[1]);});
test('at most 3 gates and 4 gate items a day in a 7-stage quest, and quest total/pct do not count gates',()=>{const {S,pack}=setup({due:8,n:7});const total=E.questInfo(S,g,pack).total;
  let gates=0;for(let i=0;i<60&&!S.quests[D].done;i++){const {it}=step(S,pack,now+i);if(it.format==='gate')gates++;if(E.completeQuest(S,g,pack,now+i))break;}
  assert.ok(S.quests[D].done,'quest finished');assert.ok(gates<=4&&gates>=3,String(gates));assert.deepEqual(Object.keys(S.quests[D].gates).map(Number),E.gateStages(7));
  assert.equal(E.questInfo(S,g,pack).total,total);assert.equal(E.questInfo(S,g,pack).pct,100);});
test('outside quests, Play never serves gates and still serves its own reviews',()=>{const {S}=setup();delete S.quests;S.questFocus=null;let rev=0;
  for(let i=0;i<30;i++){const it=E.next(S,g,null,now+i);assert.notEqual(it.format,'gate');if(it.mode==='review')rev++;S.current=null;}assert.ok(rev>=1);});
// ---- slice 12: spot-checks of inferred, never-verified skills ----
const used=new Set([...REV,...STG]);
const X=pool.filter(id=>!used.has(id)&&g.post[id].some(e=>!used.has(e.id))).sort((a,b)=>g.post[b].length-g.post[a].length)[0];
const Y=g.post[X].map(e=>e.id).find(id=>!used.has(id)&&g.post[id].length<g.post[X].length);
const inf=(S,id,conf=.6)=>S.ts[id]={st:'mastered',how:'inferred',conf,box:2,due:now+30*DAY,at:now-20*DAY};
const toGate=(S,pack)=>{for(let i=0;i<2;i++)step(S,pack,now);for(const [id,r] of Object.entries(S.ts))if(r.how!=='inferred')r.due=now+5*DAY;return E.next(S,g,pack,now);};
test('with inferred skills around, about 1 gate item in 3 is a spot-check, picked by most dependents then lowest confidence',()=>{const {S,pack}=setup({due:8,inferred:4,n:7});
  const want=()=>{const u=new Set(Object.values(S.quests[D].gates||{}).flatMap(x=>x.items||[]));return Object.keys(S.ts).filter(id=>S.ts[id].how==='inferred'&&S.ts[id].st==='mastered'&&!S.ts[id].verified&&!u.has(id))
    .sort((a,b)=>g.post[b].length-g.post[a].length||(S.ts[a].conf??1)-(S.ts[b].conf??1)||a.localeCompare(b))[0];};
  const items=[],picks=[];for(let i=0;i<60&&!S.quests[D].done;i++){const w=want();const {it}=step(S,pack,now+i);if(it.format==='gate'){items.push(it);if(it.spot)picks.push([it.topicId,w]);}if(E.completeQuest(S,g,pack,now+i))break;}
  // one day, so the v0.5 day budget applies: 4 gate items, and the 3rd is a spot-check (about 1 in 3)
  const spots=items.filter(it=>it.spot);assert.equal(items.length,4);assert.equal(spots.length,1,'1 of 4 gate items');assert.ok(items[2].spot);
  for(const [got,w] of picks)assert.equal(got,w,'D2 picking rule');assert.ok(spots.every(x=>x.mode==='review'&&!x.boss&&!x.bonus));
  assert.equal(E.publicItem(spots[0],g).gate.spot,true);});
test('nothing due but inferred skills exist → the gate is all spot-checks; a right one is verified, shown directly, and earns no medal',()=>{const {S,pack}=setup({due:0});inf(S,X,.5);inf(S,Y,.7);
  const gi=toGate(S,pack);assert.equal(gi.format,'gate');assert.equal(gi.spot,true);assert.equal(gi.topicId,X,'most dependents first');assert.equal(gi.gate.of,2);
  const x=E.submit(S,g,gi.answer,now);assert.equal(x.r.correct,true);const r=S.ts[X];
  assert.equal(r.how,'direct');assert.equal(r.st,'mastered');assert.equal(r.verified,now);assert.equal(r.box,2,'keeps its box');assert.equal(r.due,now+7*DAY);
  assert.ok(!x.r.medal&&!x.ev.some(e=>e.event==='medal'),'no medal');assert.ok(x.ev.some(e=>e.event==='verified'&&e.topicId===X));
  const g2=E.next(S,g,pack,now);assert.equal(g2.spot,true,'second gate item is a spot-check too');assert.notEqual(g2.topicId,X);
  assert.equal(E.unverified(S,X),false);});
test('a missed spot-check sends the skill back to learning, withdraws the guesses built on it, and logs spotMiss',()=>{const {S,pack}=setup({due:0});inf(S,X,.5);inf(S,Y,.7);
  const gi=toGate(S,pack);assert.equal(gi.topicId,X);let x=E.submit(S,g,'zzz wrong',now);assert.equal(x.r.retry,true);x=E.submit(S,g,'zzz wrong',now);
  assert.equal(x.r.done,true);assert.equal(S.ts[X].st,'learning');assert.equal(S.ts[X].how,'direct');assert.equal(S.ts[X].box,0);
  assert.equal(S.ts[Y],undefined,'inferred dependent withdrawn (failUp)');const m=x.ev.find(e=>e.event==='spotMiss');assert.ok(m);assert.equal(m.topicId,X);assert.ok(m.withdrawn>=1);
  assert.equal(S.quests[D].gates[1].n,1,'counts toward the gate');});
test('a gate behind the learner (its stage already started, e.g. a quest begun before gates) shows as open, not locked',()=>{const {S,pack}=setup({n:7});
  for(const [j] of pack.topics[1].questions.entries())S.packSeen[`${D}:${pack.topics[1].topicId}:${j}`]=1;for(const [j] of pack.topics[0].questions.entries())S.packSeen[`${D}:${pack.topics[0].topicId}:${j}`]=1;
  const q=E.questInfo(S,g,pack);const g1=q.gates.find(x=>x.before===1);assert.equal(g1.state,'open');assert.equal(g1.passed,true);
  assert.equal(q.gates.find(x=>x.before===3).state,'locked','gates ahead stay locked');assert.notEqual(E.next(S,g,pack,now).gate?.k,1,'no gate served behind the learner');});
// ---- v0.5 slice 1: reviews reach the learner in every quest session (warm-up gate, ≤ 4 gate items per quest per day) ----
const longQuest=(n=9,q=4)=>({date:D,quest:{title:'Long Quest',hook:'Go!',medal:{name:'Long Medal',emoji:'🏅'}},topics:STG.concat(pool.slice(30,40)).slice(0,n).map((id,i)=>({topicId:id,stage:{name:'Stop '+i,emoji:'⭐'},format:i===n-1?'boss':'quest',questions:Array.from({length:q},(_,j)=>mc(j+1))}))});
const resumeMid=(pack,stage,answered)=>{const S=setup().S;S.quests[D].gates={1:{before:1,items:[],right:0,n:0,open:true,of:0}};
  pack.topics.forEach((t,i)=>t.questions.forEach((q,j)=>{if(i<stage||(i===stage&&j<answered))S.packSeen[`${D}:${t.topicId}:${j}`]=1;}));return S;};
const DAY2=now+DAY;
test('repro: resuming mid-stage, far from the next stage gate, a session of 6 items still gets reviews (warm-up first)',()=>{const pack=longQuest();const S=resumeMid(pack,2,1);
  assert.ok(E.gateStages(9).join()==='1,4,8');const served=[];for(let i=0;i<6;i++){const it=E.next(S,g,pack,DAY2+i);served.push(it.format==='gate'?'gate':'stage');E.submit(S,g,it.answer,DAY2+i);}
  const n=served.filter(x=>x==='gate').length;assert.ok(n>=1&&n<=2,served.join());assert.equal(served[0],'gate','warm-up comes first');});
test('a quest serves at most 4 gate items per day (warm-up + stage gates), and a new day gets a new warm-up',()=>{const pack=longQuest(9,1);const S=resumeMid(pack,1,1);
  let day1=0;for(let i=0;i<20&&!S.quests[D].done;i++){const it=E.next(S,g,pack,DAY2+i);if(it.format==='gate')day1++;E.submit(S,g,it.answer,DAY2+i);if(E.completeQuest(S,g,pack,DAY2+i))break;}
  assert.ok(day1<=4,'day 1: '+day1);assert.ok(day1>=3,'day 1: '+day1);
  const pack2=longQuest(9,4);const S2=resumeMid(pack2,2,1);for(let i=0;i<3;i++){const it=E.next(S2,g,pack2,DAY2+i);E.submit(S2,g,it.answer,DAY2+i);}
  const nx=E.next(S2,g,pack2,DAY2+2*DAY);assert.equal(nx.format,'gate','new day, new warm-up');assert.equal(nx.gate.warm,true);});
const pt=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date(ms));
test('an item in flight is never interrupted by a warm-up',()=>{const pack=longQuest();const S=resumeMid(pack,2,1);S.quests[D].gateDay={day:pt(now),n:0,warm:true};const it=E.next(S,g,pack,now);assert.notEqual(it.format,'gate');
  // the learner leaves mid-item and comes back the next day: the same item is still current
  assert.equal(S.current,it);const again=S.current||E.next(S,g,pack,DAY2);assert.equal(again,it);E.submit(S,g,it.answer,DAY2);const nx=E.next(S,g,pack,DAY2);assert.equal(nx.format,'gate');});

// ---- free-play review pacing (no active quest): no random dump, no same-topic streak ----
test('free-play reviews skip a topic just served and wait ~9 items between reviews',()=>{
  const S=E.blank();S.firstDone=true;S.placement.done=true;S.itemsServed=3;S.sinceReview=9;
  const dueIds=g.topics.filter(t=>t.subject==='Mathematics').slice(0,6).map(t=>t.id);
  dueIds.forEach((id,i)=>{S.ts[id]={st:'mastered',how:'direct',c:3,w:0,lvl:3,box:2,due:now-DAY*(i+1)};});
  const a=E.next(S,g,null,now);assert.equal(a.mode,'review');const first=a.topicId;S.current=null;S.sinceReview=9;S.recent=[first,first,first];
  const b=E.next(S,g,null,now+1);assert.equal(b.mode,'review');assert.notEqual(b.topicId,first,'must not repeat the same overdue topic back-to-back');
  S.current=null;S.sinceReview=2;S.itemsServed=10;const c=E.next(S,g,null,now+2);assert.notEqual(c.mode,'review','sinceReview < 9 → no free-play review');});
