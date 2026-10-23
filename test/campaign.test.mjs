// Slice 1 (#55): campaign trail + fog state API (quest medals fill trail; legendaries light Final Boss; fog clear counts).
import {test} from 'node:test';import assert from 'node:assert/strict';import {loadEngine} from './helpers.mjs';
const {E,g}=await loadEngine();
const qm=(date,at,name='Medal',emoji='🏅')=>({date,title:'Q '+date,name,emoji,at});
const blank=()=>E.blank();

test('empty progress: empty trail, no legendaries, fog clear 0',()=>{
  const S=blank(),C=E.campaignState(S,g),F=E.fogState(S,g);
  assert.equal(C.trailLen,12);assert.equal(C.filled,0);assert.equal(C.nodes.length,12);
  assert.ok(C.nodes.every(n=>n===null));assert.deepEqual(C.legendaries,{have:0,need:4});
  assert.equal(C.finalBoss.lit,0);assert.equal(C.finalBoss.unlocked,false);assert.equal(typeof C.taunt,'string');
  assert.equal(F.clear,0);assert.equal(F.total,g.topics.length);assert.equal(F.pct,0);
  assert.deepEqual(F.finds,[]);assert.ok(Object.keys(F.bySubject).length>0);
  for(const b of Object.values(F.bySubject)){assert.equal(b.clear,0);assert.ok(b.total>0);}});

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
  let C=E.campaignState(S,g);assert.equal(C.legendaries.have,2);assert.equal(C.finalBoss.lit,0.5);assert.equal(C.finalBoss.unlocked,false);
  S.medals.push({id:'d',tier:'legendary',at:4},{id:'e',tier:'legendary',at:5});
  C=E.campaignState(S,g);assert.equal(C.legendaries.have,4);assert.equal(C.finalBoss.lit,1);assert.equal(C.finalBoss.unlocked,false,'need trail too');
  S.questMedals=Array.from({length:12},(_,i)=>qm(`2026-02-${String(i+1).padStart(2,'0')}`,100+i));
  C=E.campaignState(S,g);assert.equal(C.filled,12);assert.equal(C.finalBoss.unlocked,true);assert.match(C.taunt,/Final Boss|finale/i);
  S.medals.push({id:'f',tier:'legendary',at:6});C=E.campaignState(S,g);assert.equal(C.finalBoss.lit,1,'lit caps at 1');});

test('fog counts direct mastery only; inferred does not clear',()=>{
  const S=blank(),ids=g.topics.slice(0,5).map(t=>t.id);
  S.ts[ids[0]]={st:'mastered',how:'direct',c:3,w:0};S.ts[ids[1]]={st:'mastered',how:'direct',c:2,w:0};
  S.ts[ids[2]]={st:'mastered',how:'inferred',conf:.9};S.ts[ids[3]]={st:'learning',how:'direct',c:1,w:0};
  const F=E.fogState(S,g);assert.equal(F.clear,2);assert.equal(F.total,g.topics.length);
  assert.equal(F.pct,Math.round(1000*2/g.topics.length)/10);assert.deepEqual(F.finds,[]);
  for(const [sub,b] of Object.entries(F.bySubject)){
    const want=g.topics.filter(t=>t.subject===sub&&S.ts[t.id]?.st==='mastered'&&S.ts[t.id]?.how==='direct').length;
    assert.equal(b.clear,want);assert.equal(b.total,g.topics.filter(t=>t.subject===sub).length);}});
