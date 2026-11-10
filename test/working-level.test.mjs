// Working level on the parent report (src/level.js): a per-subject age/grade RANGE from direct mastery vs Marble
// target ages, pulled down where recent answers slip. Read-only: never changes progress, medals, mastery or points.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {ROOT,tmpDir,loadEngine} from './helpers.mjs';import {fileStore} from '../server/file-kv.mjs';import {assets} from '../server/assets.mjs';
import worker from '../src/worker.js';import * as LV from '../src/level.js';import * as PF from '../src/profiles.js';
const {g}=await loadEngine();
const math=a=>g.topics.filter(t=>t.subject==='Mathematics'&&t.ageRangeStart===a);
const mastered=ids=>Object.fromEntries(ids.map(id=>[id,{st:'mastered',how:'direct',c:5,w:0,ft:4,conf:.9,box:1,due:Date.now()+864e5,at:Date.now()}]));
const deepFreeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);for(const v of Object.values(o))deepFreeze(v);}return o;};
const firstTries=(id,right,wrong)=>[...Array(right).fill(1),...Array(wrong).fill(0)].map(c=>({topicId:id,try:1,correct:!!c,expected:'x'}));

test('grade is age minus 5, labels read as a range',()=>{assert.equal(LV.gradeOf(10),'5th');assert.equal(LV.gradeOf(6),'1st');assert.equal(LV.gradeOf(7),'2nd');assert.equal(LV.gradeOf(8),'3rd');assert.equal(LV.gradeOf(5),'K');assert.equal(LV.gradeOf(16),'11th');
  assert.equal(LV.ageLabel(10,11),'about age 10-11, roughly 5th-6th grade');assert.equal(LV.ageLabel(9,9),'about age 9, roughly 4th grade');});

test('range from the top direct masteries; no slips means "no ceiling yet"; never writes',()=>{
  const ids=[...math(8).slice(0,2),...math(9).slice(0,2),...math(10).slice(0,2)].map(t=>t.id);
  const S=deepFreeze({ts:mastered(ids),points:500,medals:[{id:ids[0],tier:'gold'}]});const before=JSON.stringify(S);
  const r=LV.workingLevel(S,g,[],{actual:{grade:'5th grade',age:10.5}});assert.equal(JSON.stringify(S),before,'S unchanged');
  const m=r.subjects.find(s=>s.name==='Mathematics');assert.equal(m.lo,10);assert.equal(m.hi,10);assert.equal(m.label,'about age 10, roughly 5th grade');
  assert.equal(m.vs,'on level');assert.equal(m.confidence,'medium');assert.ok(m.notes.some(n=>/no ceiling yet/.test(n)));
  assert.equal(r.actual.grade,'5th grade');assert.equal(r.actual.age,10.5);});

test('a slip near the top widens the range down a year and lists the spot',()=>{
  const top=math(11).slice(0,2),ids=[...math(9).slice(0,2),...top].map(t=>t.id);const slip=math(10)[0];
  const S={ts:mastered(ids)};const r=LV.workingLevel(S,g,firstTries(slip.id,1,3),{actual:{grade:'5th grade'}});const m=r.subjects.find(s=>s.name==='Mathematics');
  assert.equal(m.lo,10);assert.equal(m.hi,11);assert.equal(m.label,'about age 10-11, roughly 5th-6th grade');assert.equal(m.confidence,'good');
  assert.equal(m.behind.length,1);assert.equal(m.behind[0].age,10);assert.match(m.behind[0].why,/1\/4 right first try/);
  assert.equal(r.actual.age,null,'no stored age: age not shown');assert.equal(r.actual.fromGrade,true);assert.equal(r.actual.compareAge,10.5);
  // two learning moments also count as slipping; a failed review too
  assert.ok(LV.isSlip({first:1,firstRight:1,lm:2,failed:0}));assert.ok(LV.isSlip({first:0,firstRight:0,lm:0,failed:1}));assert.ok(!LV.isSlip({first:4,firstRight:3,lm:1,failed:0}));});

test('few data points are flagged and not compared; no grade/age stored means no comparison',()=>{
  const S={ts:mastered([math(12)[0].id])};const r=LV.workingLevel(S,g,[],{});const m=r.subjects.find(s=>s.name==='Mathematics');
  assert.equal(m.confidence,'low');assert.ok(m.notes.some(n=>/few data points/.test(n)));assert.equal(m.vs,null);assert.equal(r.actual.grade,null);assert.equal(r.actual.compareAge,null);
  const r2=LV.workingLevel(S,g,[],{actual:{grade:'5th grade'}});assert.equal(r2.subjects.find(s=>s.name==='Mathematics').vs,'too few to compare');
  assert.deepEqual(LV.workingLevel({ts:{}},g,[],{}).subjects,[],'nothing played: no subjects');});

test('inferred mastery alone never sets the level',()=>{const id=math(11)[0].id;const S={ts:{[id]:{st:'mastered',how:'inferred',conf:.7,box:2,due:0,at:0}}};
  assert.equal(LV.workingLevel(S,g,[],{}).subjects.length,0);});

// ---- the Worker: /parent carries the level, read-only, with the stored grade/age (profile / [vars]) ----
const mk=()=>{const dir=tmpDir('jane-lvl-');return{dir,env:{ASSETS:assets(path.join(ROOT,'public')),JANE_KV:fileStore(dir),LEARNER_NAME:'Sam',LEARNER_AGE:'10.5',LEARNER_GRADE:'5th grade'}};};
const page=async(env,q='')=>{const r=await worker.fetch(new Request('http://x/parent'+q),env);assert.equal(r.status,200);const h=await r.text();return JSON.parse(h.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g,'<'));};
const snap=dir=>Object.fromEntries(fs.readdirSync(dir).sort().map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex')]));
test('/parent shows the working level and writes nothing',async()=>{const {dir,env}=mk();
  const ids=[...math(9).slice(0,2),...math(10).slice(0,2)].map(t=>t.id);env.JANE_KV.putSync('progress',JSON.stringify({v:2,ts:mastered(ids),points:321}));
  const R=PF.synth(env);R.learners.push({id:'kid',name:'Robin',grade:'7th grade',interests:[],avatar:'🦉',pin:null,prefix:'L:kid:'});env.JANE_KV.putSync('profiles',JSON.stringify(R));
  const before=snap(dir);const D=await page(env);assert.deepEqual(snap(dir),before,'no KV writes from /parent');
  assert.equal(D.level.actual.grade,'5th grade');assert.equal(D.level.actual.age,10.5);const m=D.level.subjects.find(s=>s.name==='Mathematics');assert.equal(m.label,'about age 10, roughly 5th grade');
  const D2=await page(env,'?learner=kid');assert.deepEqual(snap(dir),before,'no KV writes for the second learner either');
  assert.equal(D2.level.actual.grade,'7th grade');assert.equal(D2.level.actual.age,null,'no stored age for the kid');assert.deepEqual(D2.level.subjects,[]);
  const js=fs.readFileSync(path.join(ROOT,'public/parent.js'),'utf8');assert.match(js,/Working level/);});
