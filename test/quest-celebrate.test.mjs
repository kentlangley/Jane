// Quest completion high-five: medal + trail + Reinforcement / Grind a Trail / Mini-games.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {loadEngine,ROOT} from './helpers.mjs';
const {E,g}=await loadEngine();const js=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'public/app.css'),'utf8');
const now=Date.parse('2026-10-24T19:00:00Z');

test('completeQuest returns celebration fields (subjects, trail, topicIds)',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(ROOT,'packs/examples/example-quest.json'),'utf8'));
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  // Mark every pack question seen so the quest completes
  for(const t of pack.topics)for(let j=0;j<(t.questions||[]).length;j++)S.packSeen[`${pack.date}:${t.topicId}:${j}`]=1;
  const m=E.completeQuest(S,g,pack,now);
  assert.ok(m);assert.ok(m.title);assert.ok(m.name);assert.ok(m.emoji);
  assert.ok(Array.isArray(m.subjects)&&m.subjects.length>=1);
  assert.ok(m.preferSubject);assert.ok(Array.isArray(m.topicIds)&&m.topicIds.length>=1);
  assert.ok(m.trail&&m.trail.trailLen>=1);assert.ok(m.trail.filled>=1,'finishing a quest fills a trail node');
  assert.equal(E.completeQuest(S,g,pack,now+1),null,'fires once');
});

test('startReinforce queues light practice and next() serves reinforce items',()=>{
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  // Make a few topics review-due
  const math=g.topics.filter(t=>t.subject==='Mathematics').slice(0,5);
  for(const t of math)S.ts[t.id]={st:'mastered',how:'direct',c:3,w:0,ft:2,lvl:3,box:0,due:now-864e5,at:now};
  const ids=math.map(t=>t.id);
  const r=E.startReinforce(S,g,ids,now);
  assert.ok(r.ok);assert.ok(r.of>=1);assert.ok(S.reinforce?.queue?.length);
  const it=E.next(S,g,null,now);
  assert.ok(it.reinforce);assert.equal(it.reinforce.n,1);assert.equal(it.mode==='review'||it.format==='guided'||it.format==='review',true);
});

test('client shows high-five celebration with three post-quest options',()=>{
  assert.match(js,/function questCelebrate\(/);
  assert.match(js,/High five — quest complete!/);
  assert.match(js,/qc-reinforce/);
  assert.match(js,/qc-grind/);
  assert.match(js,/qc-play/);
  assert.match(js,/\/api\/reinforce/);
  assert.match(js,/Grind a Trail/);
  assert.match(js,/Mini-games/);
  assert.match(js,/Reinforcement/);
  // Must not silently dismiss into free play on questDone
  assert.match(js,/if\(r\.questDone\)\{lockAnswers\(\);chips\(r\.state\);window\._afterQuest=r\.state/);
  assert.doesNotMatch(js,/if\(r\.questDone\)setTimeout\(\(\)=>questMedal/);
  assert.match(css,/\.qcelebrate\{/);
  assert.match(js,/#quest-celebrate-preview/);
});

test('FX reveal wrap forwards onClose so questDone+medal still celebrates',()=>{
  // questDone path passes go (questCelebrate) as reveal's third arg when a skill medal also fires
  assert.match(js,/if\(r\.medal\)\{reveal\(r\.medal,r\.inferred,go\);return;\}/);
  // FX polish must forward onClose — dropping it was #104 (high-five never after Collect)
  assert.match(js,/reveal=function\(m,inf,onClose\)\{_reveal\(m,inf,onClose\);/);
  assert.doesNotMatch(js,/reveal=function\(m,inf\)\{_reveal\(m,inf\);/);
});

test('post-quest: client locks answers and Mini-games always fetches /api/next (#106)',()=>{
  assert.match(js,/function lockAnswers\(/);
  assert.match(js,/if\(answerLock\|\|!v\|\|\$\('pcard'\)\.classList\.contains\('busy'\)\)return/);
  assert.match(js,/function render\(s\)\{answerLock=false;/);
  assert.match(js,/if\(r\.questDone\)\{lockAnswers\(\);chips\(r\.state\);window\._afterQuest=r\.state;setTimeout/);
  assert.doesNotMatch(js,/\$\('qc-play'\)\.onclick=\(\)=>\{close\(\);const s=state\|\|window\._afterQuest/);
  assert.match(js,/\$\('qc-play'\)\.onclick=async\(\)=>\{close\(\);window\._afterQuest=null/);
  assert.match(js,/await api\('\/api\/next',\{\}\)/);
});

test('worker holds next item while questDone celebrates (#106)',()=>{
  const w=fs.readFileSync(path.join(ROOT,'src/worker.js'),'utf8');
  assert.match(w,/if\(!S\.current&&!x\.r\.askChoice&&!x\.r\.questDone\)E\.next/);
  assert.match(w,/if\(!S\.current&&!x\.r\.questDone\)E\.next/);
  // Stray /api/answer with no current must not invent+grade the next item (#106)
  assert.match(w,/\/api\/answer[\s\S]*?if\(!S\.current\)return J\(\{error:'no item'/);
  assert.doesNotMatch(w,/\/api\/answer'&&req\.method==='POST'\)\{if\(!S\.current\)E\.next/);
  assert.doesNotMatch(w,/questHold/);
});
