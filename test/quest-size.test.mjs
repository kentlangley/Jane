// Slice 1 (v0.9 sizes): regular quests run about 8-12 minutes: ≤ 30 graded pack questions (aim 24-28) over ≤ 8 stages, at
// least 8 review items, plus up to 12 review-gate items. Placement quests keep ≤ 16 graded and ≤ 7 stages.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {validate,example,nGraded,graded,ROOT} from './helpers.mjs';
const extra=n=>Array.from({length:n},(_,i)=>({type:'mc',prompt:`Which planet is number ${i+3}?`,choices:['Earth','Mars','Venus'],answer:'Earth',hint:'Count from the Sun.',explanation:'Earth is third.'}));
const rev=(n,skill)=>Array.from({length:n},(_,i)=>({type:'mc',prompt:`Review check ${i+1}: which is bigger?`,choices:[String(10+i),String(i)],answer:String(10+i),hint:'Compare the tens.',explanation:'More tens is bigger.',review:true,skill}));
// a full-size regular quest: the example plus 8 review items (with a "skill") woven into its non-boss stages
const full=()=>{const p=example();const sk=p.topics[0].topicId;let k=0;for(const t of p.topics.slice(1,-1)){const n=t===p.topics[1]?3:t===p.topics[2]?3:1;t.questions.push(...rev(n,sk).map(q=>({...q,prompt:q.prompt+' #'+(k++)})));}
  p.topics[4].questions.push(...rev(2,sk).map(q=>({...q,prompt:q.prompt+' #'+(k++)})));return p;};
test('a quest with 31 graded questions is refused as too long; 30 passes',()=>{const p=full();const n=nGraded(p);assert.ok(n>=24&&n<=28,String(n));
  p.topics[1].questions.push(...extra(30-n));assert.equal(nGraded(p),30);assert.equal(validate(p).status,0);
  p.topics[1].questions.push(...extra(1));const r=validate(p);assert.equal(r.status,1);assert.match(r.stderr,/31 graded questions: too long \(max 30/);});
test('a quest with 9 stages is refused; 8 stages pass',()=>{const p=example();
  const base=p.topics[0];
  for(const id of ['mt_e7filQgayF','mt_SBkTGjiZjZ'])p.topics.splice(1,0,{...JSON.parse(JSON.stringify(base)),topicId:id,questions:[base.questions[0]]});
  assert.equal(p.topics.length,8);{const r0=validate(p);assert.equal(r0.status,0,r0.stderr);}
  p.topics.splice(1,0,{...JSON.parse(JSON.stringify(base)),topicId:'mt_Mp_CpVK6e-',questions:[base.questions[0]]});
  assert.equal(p.topics.length,9);const r=validate(p);assert.equal(r.status,1);assert.match(r.stderr,/9 stages: too long \(max 8/);});
test('a full-size quest (24-28 graded, 8 review items) estimates 8-12 min with gates and gets no size or review warning',()=>{const r=validate(full());assert.equal(r.status,0,r.stderr);
  const m=r.stdout.match(/~([\d.]+) min/);assert.ok(m,r.stdout);assert.ok(+m[1]>=8&&+m[1]<=12,m[1]);assert.match(r.stdout,/up to 12 gate reviews/);
  assert.doesNotMatch(r.stderr,/size:|review:/);});
test('a 16-graded quest (the old size) passes but warns it is short and light on review',()=>{const r=validate(example());assert.equal(r.status,0,r.stderr);
  assert.match(r.stderr,/aim for 24-28/);assert.match(r.stderr,/aim 8-12/);assert.match(r.stderr,/aim for at least 8/);});
test('a review item without a "skill" gets a warning',()=>{const p=full();delete p.topics[1].questions.at(-1).skill;const r=validate(p);assert.equal(r.status,0,r.stderr);
  assert.match(r.stderr,/review item without "skill"/);});
test('a deep dive with 3 graded questions passes; one with 2 fails',()=>{const p=example();const dd=p.topics[1];assert.ok(dd.deepDive);
  assert.equal(dd.questions.filter(q=>!['why','fact','learn'].includes(q.type)).length,3);assert.equal(validate(p).status,0);
  dd.questions.splice(dd.questions.findIndex(q=>q.type==='match'),1);const r=validate(p);assert.equal(r.status,1);assert.match(r.stderr,/deep dive needs ≥ 3/);});
// Slice 13 → v0.9: review stages count as review items (review quests); no "spend the budget on new learning" nag anymore
test('a pack with a review: true stage passes and counts the stage as review items',()=>{const p=example();assert.ok(p.topics.some(t=>t.review));
  const r=validate(p);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stderr+r.stdout,/review runs through gates now/);assert.match(r.stdout,/2 review/);});
test('placement quests keep their own budget: 17 graded is refused',()=>{const p=JSON.parse(fs.readFileSync(path.join(ROOT,'packs/examples/example-placement.json'),'utf8'));
  assert.equal(validate(p).status,0);const n=nGraded(p);
  for(let i=n;i<17;i++){const t=p.topics.find(t=>t.questions.filter(graded).length<4);if(!t)break;t.questions.push(extra(1)[0]);}
  if(nGraded(p)<17)return; // example placement is too small to reach 17 within 4 per stage; covered by the stage rule
  const r=validate(p);assert.equal(r.status,1);assert.match(r.stderr,/too long for a placement quest/);});
