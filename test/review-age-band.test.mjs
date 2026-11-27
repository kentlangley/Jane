// v0.9.3–v0.9.4: runtime review picks (gates, spot-checks, map grind, post-quest practice) stay at or above
// the learner's age floor; a leftover minigame from a previous Pacific day is cleared without touching medals, mastery or points.
import {test,after} from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {loadEngine,ROOT,tmpDir} from './helpers.mjs';
import {fileStore} from '../server/file-kv.mjs';import {assets} from '../server/assets.mjs';
import worker from '../src/worker.js';
const {E,g}=await loadEngine();
const DAY=864e5,now=Date.parse('2026-11-23T21:25:00Z'),D='2026-11-23';
after(()=>E.configure({}));

const young=g.topics.filter(t=>t.kq&&(t.ageRangeStart??0)<=7&&!g.boss.has(t.id));
const mid=g.topics.filter(t=>t.kq&&t.ageRangeStart>=9&&t.ageRangeStart<=10&&!g.boss.has(t.id));
const older=g.topics.filter(t=>t.kq&&t.ageRangeStart>=12&&!g.boss.has(t.id));
assert.ok(young.length>=3&&mid.length>=3&&older.length>=3,`need age bands, got young=${young.length} mid=${mid.length} older=${older.length}`);

const mc=i=>({type:'mc',prompt:`Stop question ${i}?`,choices:['yes','no','maybe'],answer:'yes',hint:'h',explanation:'e'});
function packOf(stageTopics,date=D){
  const ids=stageTopics.map(t=>t.id||t);
  return{date,quest:{title:'Test Quest',hook:'Go!',medal:{name:'Test Medal',emoji:'🏅'}},
    topics:ids.map((id,i)=>({topicId:id,stage:{name:'Stop '+i,emoji:'⭐'},format:i===ids.length-1?'boss':'quest',
      questions:[mc(1),mc(2),...(i===ids.length-1?[mc(3)]:[])]}))};
}
function startS(dueTopics,how='direct'){
  const S=E.blank();S.firstDone=true;S.placement.done=true;S.itemsServed=10;S.quests={[D]:{started:now-1e5}};S.questFocus=D;
  for(const [i,t] of dueTopics.entries())S.ts[t.id]={st:'mastered',how,conf:.6,box:1,due:now-(10-i)*DAY,at:now-20*DAY,c:3,ft:3};
  return S;
}
const step=(S,pack,t,right=true)=>{const it=E.next(S,g,pack,t);const x=E.submit(S,g,right?it.answer:'zzz wrong',t);if(!right&&!x.r.done)E.submit(S,g,'zzz wrong',t);return{it,x};};

test('reviewAgeFloor is max(9, floor(age)-3) when age is known, and null when it is not',()=>{
  E.configure({});assert.equal(E.reviewAgeFloor(),null);
  E.configure({LEARNER_AGE:'10.5'});assert.equal(E.learner().age,10.5);assert.equal(E.reviewAgeFloor(),9);
  E.configure({LEARNER_AGE:'13.5'});assert.equal(E.reviewAgeFloor(),10);
  E.configure({LEARNER_AGE:'8'});assert.equal(E.reviewAgeFloor(),9);
  E.configure({LEARNER_AGE:'17'});assert.equal(E.reviewAgeFloor(),14);
  E.configure({});assert.equal(E.reviewAgeFloor(),null);
});

test('an 8th-grade learner (age 13.5) is not served below-floor due reviews at a gate',()=>{
  E.configure({LEARNER_AGE:'13.5'});
  const pack=packOf(older.slice(0,3));
  const S=startS([young[0],young[1],older[0],older[1]]);
  for(let i=0;i<2;i++){const {it}=step(S,pack,now);assert.equal(it.topicId,older[0].id);}
  const gi=E.next(S,g,pack,now);assert.equal(gi.format,'gate');
  assert.ok(g.byId[gi.topicId].ageRangeStart>=10,`gate served age ${g.byId[gi.topicId].ageRangeStart} ${g.byId[gi.topicId].name}`);
  assert.ok(![young[0].id,young[1].id].includes(gi.topicId),'must not serve a below-floor due topic');
});

test('a ~10.5 year-old learner still gets age 9-10 reviews, and not age-8 filler',()=>{
  E.configure({LEARNER_AGE:'10.5'});assert.equal(E.reviewAgeFloor(),9);
  const age8=g.topics.filter(t=>t.kq&&t.ageRangeStart===8&&!g.boss.has(t.id));
  assert.ok(age8.length>=1&&mid.length>=2);
  const pack=packOf(older.slice(0,3));
  const S=startS([age8[0],mid[0],mid[1]]);
  for(let i=0;i<2;i++)step(S,pack,now);
  const gi=E.next(S,g,pack,now);assert.equal(gi.format,'gate');
  assert.ok(g.byId[gi.topicId].ageRangeStart>=9,`should allow age 9+, got ${g.byId[gi.topicId].ageRangeStart}`);
  assert.notEqual(gi.topicId,age8[0].id);
  assert.equal(gi.topicId,mid[0].id);
});

test('when age is unset, below-floor topics can still be served (default install)',()=>{
  E.configure({});
  const pack=packOf(older.slice(0,3));
  const S=startS([young[0],young[1]]);
  for(let i=0;i<2;i++)step(S,pack,now);
  const gi=E.next(S,g,pack,now);assert.equal(gi.format,'gate');assert.equal(gi.topicId,young[0].id);
});

test('if nothing in band is due, the gate opens without serving elementary filler',()=>{
  E.configure({LEARNER_AGE:'13.5'});
  const pack=packOf(older.slice(0,3));
  const S=startS([young[0],young[1],young[2]]);
  for(let i=0;i<2;i++)step(S,pack,now);
  // answering stage 1 may infer other skills; drop those so the only leftover reviews are below the floor
  for(const [id,r] of Object.entries(S.ts)){if(r.how==='inferred')delete S.ts[id];}
  const nx=E.next(S,g,pack,now);
  if(nx.format==='gate'){
    assert.ok(g.byId[nx.topicId].ageRangeStart>=10,`spot-check must stay in band, got ${g.byId[nx.topicId].ageRangeStart} ${g.byId[nx.topicId].name}`);
    assert.ok(!young.some(t=>t.id===nx.topicId),'must not fill the gate with a below-floor topic');
  }else{
    assert.equal(nx.topicId,older[1].id,'stage 2 next, gate opened for free');
    assert.equal(S.quests[D].gates[1].open,true);
    assert.equal((S.quests[D].gates[1].items||[]).length,0);
  }
});

test('spotPick prefers an in-band unverified inferred topic, never a below-floor one',()=>{
  E.configure({LEARNER_AGE:'13.5'});
  const S=E.blank();
  S.ts[young[0].id]={st:'mastered',how:'inferred',conf:.2,box:2,due:now+30*DAY,at:now,verified:undefined};
  S.ts[older[0].id]={st:'mastered',how:'inferred',conf:.4,box:2,due:now+30*DAY,at:now};
  const id=E.spotPick(S,g,new Set());
  assert.equal(id,older[0].id);
  E.configure({LEARNER_AGE:'13.5'});
  const S2=E.blank();
  S2.ts[young[0].id]={st:'mastered',how:'inferred',conf:.2,box:2,due:now+30*DAY,at:now};
  assert.equal(E.spotPick(S2,g,new Set()),null);
});

test('authored pack items below the floor are still served',()=>{
  E.configure({LEARNER_AGE:'13.5'});
  const pack=packOf([young[0],older[0],older[1]]);
  const S=E.blank();S.firstDone=true;S.placement.done=true;S.itemsServed=10;S.quests={[D]:{started:now-1e5}};S.questFocus=D;
  const it=E.next(S,g,pack,now);
  assert.notEqual(it.format,'gate');
  assert.equal(it.topicId,young[0].id,'pack stage 1 is below the floor and still served');
});

test('nextTrailTopic skips stones below the age floor for an older learner',()=>{
  E.configure({LEARNER_AGE:'13.5'});
  const math=g.topics.filter(t=>t.subject==='Mathematics');
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  for(const t of math){if(t.ageRangeStart<=12)S.ts[t.id]={st:'mastered',how:'direct',c:3,w:0,ft:2,lvl:3,box:0,due:now+7*DAY,at:now};}
  const low=math.filter(t=>t.ageRangeStart<=9&&['ready','learning','review'].includes(E.stateOf(S,g,t.id,now)));
  const high=math.filter(t=>t.ageRangeStart>=10&&['ready','learning','review'].includes(E.stateOf(S,g,t.id,now)));
  assert.ok(high.length>=1,'need an in-band open math stone');
  const start=low[0]||math.find(t=>t.ageRangeStart<=8)||math[0];
  const n=E.nextTrailTopic(S,g,'Mathematics',start.id,now);
  assert.ok(n);assert.ok(g.byId[n.topicId].ageRangeStart>=10,`trail served age ${g.byId[n.topicId].ageRangeStart}`);
  E.configure({});
  if(low.length){
    const n0=E.nextTrailTopic(S,g,'Mathematics',start.id,now);
    // without a floor a young stone may be offered; just confirm the function still returns something or null cleanly
    assert.ok(n0===null||n0.topicId);
  }
});

test('clearStalePlay drops a previous-day minigame and does not touch medals, mastery or points',()=>{
  E.configure({});
  const S=E.blank();S.firstDone=true;S.points=5682;S.stars=102;S.solved=355;
  S.medals=[{id:older[0].id,tier:'silver',at:now-10*DAY}];
  const tid=young[0].id;
  S.ts[tid]={st:'mastered',how:'inferred',conf:.6,box:2,due:now+7*DAY,at:now-30*DAY,c:4,ft:2};
  const issued=now-30*DAY;
  S.mini={topicId:tid,mode:'learn',left:1,n:1,ret:'Mathematics',startedAt:issued};
  S.current={kind:'quiz',type:'mc',q:'Your turn! A unit square has area of…',format:'minigame',id:issued+'-176',topicId:tid,mode:'learn',issued};
  S.miniHold={kind:'self',type:'self',q:'Hey {name}! Could you explain types of angles to a friend?',format:'explore',id:issued+'-313',topicId:young[1].id,mode:'learn',issued,tries:0};
  S.grindTrail={subject:'Mathematics',done:[tid]};
  const medals=JSON.stringify(S.medals),ts=JSON.stringify(S.ts),points=S.points,stars=S.stars,solved=S.solved;
  assert.equal(E.clearStalePlay(S,now),true);
  assert.equal(S.mini,null);assert.equal(S.current,null);assert.equal(S.miniHold,null);assert.equal(S.grindTrail,null);
  assert.equal(S.points,points);assert.equal(S.stars,stars);assert.equal(S.solved,solved);
  assert.equal(JSON.stringify(S.medals),medals);assert.equal(JSON.stringify(S.ts),ts);
});

test('clearStalePlay leaves an in-progress quest item and a same-day mini alone',()=>{
  E.configure({});
  const S=E.blank();S.firstDone=true;
  S.current={kind:'pack',q:'A pack question',packKey:D+':'+older[0].id+':0',format:'story',type:'mc',id:(now-2*DAY)+'-1',topicId:older[0].id,mode:'learn',issued:now-2*DAY};
  assert.equal(E.clearStalePlay(S,now),false);assert.ok(S.current);
  const S2=E.blank();S2.mini={topicId:older[0].id,mode:'learn',left:1,n:1,ret:'Mathematics',startedAt:now};
  S2.current={kind:'quiz',q:'today',format:'minigame',id:now+'-2',topicId:older[0].id,mode:'learn',issued:now};
  assert.equal(E.clearStalePlay(S2,now),false);assert.ok(S2.mini);assert.ok(S2.current);
});

test('clearStalePlay restores a held same-day quest item when the leftover mini is from yesterday',()=>{
  E.configure({});
  const S=E.blank();
  const hold={kind:'pack',q:'Quest Q',packKey:D+':'+older[0].id+':0',id:now+'-q',topicId:older[0].id,mode:'learn',issued:now};
  S.mini={topicId:young[0].id,mode:'learn',left:1,n:1,ret:'Mathematics',startedAt:now-2*DAY};
  S.current={kind:'quiz',q:'stale',format:'minigame',id:(now-2*DAY)+'-m',topicId:young[0].id,mode:'learn',issued:now-2*DAY};
  S.miniHold=hold;
  assert.equal(E.clearStalePlay(S,now),true);
  assert.equal(S.mini,null);assert.equal(S.miniHold,null);assert.equal(S.current,hold);
});

test('procedural reviews for a learner aged 11+ do not emit single-digit facts',()=>{
  E.configure({LEARNER_AGE:'13.5'});
  const mul=g.topics.find(t=>t.subject==='Mathematics'&&t.domain==='Multiplication & Division');
  assert.ok(mul);
  const S=E.blank();S.firstDone=true;S.ts[mul.id]={st:'mastered',how:'direct',conf:.9,box:1,due:now-DAY,at:now,c:4,ft:3,lvl:3};
  const fact=/^What is (\d+)\s*[×+\-−÷]\s*(\d+)\s*\??$/;
  for(let i=0;i<30;i++){
    const it=E.buildItem(S,g,mul.id,'review',null,now+i);
    const m=String(it.q||'').match(fact);
    if(m)assert.ok(+m[1]>=10||+m[2]>=10,`single-digit fact: ${it.q}`);
  }
});

test('/api/state on a new Pacific day clears a leftover minigame and starts nothing from it',async()=>{
  const dir=tmpDir('jane-stale-');
  const env={ASSETS:assets(path.join(ROOT,'public')),JANE_KV:fileStore(dir),LEARNER_NAME:'Sam',LEARNER_AGE:'13.5',LEARNER_GRADE:'8th grade'};
  const S=E.blank();S.firstDone=true;S.placement.done=true;S.points=4000;S.stars=10;S.solved=20;
  S.medals=[{id:older[0].id,tier:'silver',at:now-10*DAY}];
  const issued=now-30*DAY,tid=young[0].id;
  S.ts[tid]={st:'mastered',how:'inferred',conf:.6,box:2,due:now+7*DAY,at:issued,c:2,ft:1};
  S.mini={topicId:tid,mode:'learn',left:1,n:1,ret:young[0].subject,startedAt:issued};
  S.current={kind:'quiz',type:'mc',q:'What is 2 × 2?',format:'minigame',id:issued+'-176',topicId:tid,mode:'learn',issued};
  S.grindTrail={subject:young[0].subject,done:[tid]};
  env.JANE_KV.putSync('progress',JSON.stringify(S));
  const r=await worker.fetch(new Request('http://x/api/state'),env);
  assert.equal(r.status,200);const j=await r.json();
  assert.notEqual(j.item?.q,'What is 2 × 2?');
  assert.notEqual(j.item?.topicId,tid);
  const P=env.JANE_KV.getSync('progress','json');
  assert.equal(P.mini,null);assert.equal(P.grindTrail,null);
  assert.equal(P.points,4000);assert.equal(P.stars,10);assert.equal(P.solved,20);
  assert.equal(JSON.stringify(P.medals),JSON.stringify(S.medals));
  assert.deepEqual(P.ts[tid],S.ts[tid]);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('startReinforce does not queue below-floor due reviews for a ~10.5 year-old learner',()=>{
  E.configure({LEARNER_AGE:'10.5'});
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  // Older overdue topics are below the floor; in-band reviews are less overdue.
  for(const [i,t] of [young[0],young[1],mid[0],mid[1]].entries())
    S.ts[t.id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-(20-i)*DAY,at:now-30*DAY,c:3,ft:3};
  const questIds=[older[0].id,older[1].id];
  const r=E.startReinforce(S,g,questIds,now);
  assert.ok(r.ok);const q=S.reinforce.queue;
  assert.ok(!q.includes(young[0].id)&&!q.includes(young[1].id),'must not fill practice with a below-floor due review');
  assert.ok(q.includes(mid[0].id),'in-band due review should be queued as a filler');
});

test('startReinforce still queues an authored quest topic below the floor',()=>{
  E.configure({LEARNER_AGE:'13.5'});
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  S.ts[young[0].id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-20*DAY,at:now-30*DAY,c:3,ft:3};
  S.ts[young[1].id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-19*DAY,at:now-30*DAY,c:3,ft:3};
  S.ts[older[0].id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-2*DAY,at:now-30*DAY,c:3,ft:3};
  // Quest included a below-floor topic (unlock probe) plus an in-band one. The other below-floor topic is only a due filler.
  const r=E.startReinforce(S,g,[young[0].id,older[0].id],now);
  assert.ok(r.ok);const q=S.reinforce.queue;
  assert.ok(q.includes(young[0].id),'authored quest topic below the floor stays in the queue');
  assert.ok(q.includes(older[0].id));
  assert.ok(!q.includes(young[1].id),'below-floor due filler must not be queued');
  const it=E.next(S,g,null,now);
  assert.ok(it.reinforce);assert.ok([young[0].id,older[0].id].includes(it.topicId));
});

test('when age is unset, startReinforce can still queue a below-floor due review',()=>{
  E.configure({});
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  S.ts[young[0].id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-20*DAY,at:now-30*DAY,c:3,ft:3};
  const r=E.startReinforce(S,g,[older[0].id],now);
  assert.ok(r.ok);assert.ok(S.reinforce.queue.includes(young[0].id));
});

test('if only below-floor reviews are due, startReinforce queues quest topics and no elementary fillers',()=>{
  E.configure({LEARNER_AGE:'13.5'});
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  S.ts[young[0].id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-20*DAY,at:now-30*DAY,c:3,ft:3};
  S.ts[young[1].id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-19*DAY,at:now-30*DAY,c:3,ft:3};
  // Quest topics are in-band and still open (learning), not reviews.
  S.ts[older[0].id]={st:'learning',how:'direct',c:1,w:0,lvl:3,at:now};
  S.ts[older[1].id]={st:'learning',how:'direct',c:1,w:0,lvl:3,at:now};
  const r=E.startReinforce(S,g,[older[0].id,older[1].id],now);
  assert.ok(r.ok);const q=S.reinforce.queue;
  assert.ok(q.includes(older[0].id)&&q.includes(older[1].id));
  assert.ok(!q.includes(young[0].id)&&!q.includes(young[1].id));
  assert.equal(q.length,2,'no below-floor fillers when nothing in band is due');
});

test('next() free-play review (no reinforce queue) stays in band for a ~10.5 year-old learner',()=>{
  E.configure({LEARNER_AGE:'10.5'});
  const S=E.blank();S.firstDone=true;S.placement.done=true;S.itemsServed=10;S.sinceReview=9;
  S.ts[young[0].id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-20*DAY,at:now-30*DAY,c:3,ft:3};
  S.ts[mid[0].id]={st:'mastered',how:'direct',conf:.8,box:1,due:now-5*DAY,at:now-30*DAY,c:3,ft:3};
  const it=E.next(S,g,null,now);
  assert.equal(it.mode,'review');
  assert.equal(it.topicId,mid[0].id,'periodic free-play review must stay in band');
  assert.notEqual(it.topicId,young[0].id);
});
