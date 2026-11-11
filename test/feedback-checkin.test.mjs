// "Help shape Jane" check-in (v0.8.3, src/feedback.js): 1-2 open questions on the next app open, then every 8 finished
// quests; "Not now" snoozes for the day. Answers live in their own per-learner "feedback" key, never in progress,
// so medals, mastery and points can't change. /parent lists them newest first; the export prints the new ones.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {ROOT,tmpDir} from './helpers.mjs';import {fileStore} from '../server/file-kv.mjs';import {assets} from '../server/assets.mjs';
import worker from '../src/worker.js';import * as FB from '../src/feedback.js';import * as PF from '../src/profiles.js';import * as LV from '../src/level.js';
const done=n=>({quests:Object.fromEntries([...Array(n)].map((_,i)=>[`2026-10-${String(i+1).padStart(2,'0')}`,{started:i*10+1,done:i*10+5}]))});
const D1='2026-11-11',D2='2026-11-12';

test('first open: a learner with no check-in yet gets one, with the default questions',()=>{
  const f=FB.feedbackState(null,done(7),D1);assert.equal(f.pending,true);
  assert.deepEqual(f.questions,['What was the most fun part of Jane lately, and why?','If you could add or change one thing in Jane, what would it be?']);
  assert.equal(FB.feedbackState(null,{},D1).pending,true,'even before any quest');});

test('after answering it waits for 8 more finished quests, and the questions rotate',()=>{
  const a=FB.feedbackApply(null,done(7),{answers:['the dragon boss','more maps']},{now:1,today:D1,questTitle:d=>'Quest '+d});
  assert.ok(a.entry);assert.equal(a.entry.quests,7);assert.deepEqual(a.entry.quest,{date:'2026-10-07',title:'Quest 2026-10-07'});
  assert.equal(FB.feedbackState(a.F,done(7),D1).pending,false);assert.equal(FB.EVERY,8);assert.equal(FB.feedbackState(a.F,done(10),D2).pending,false,'3 more: not yet');assert.equal(FB.feedbackState(a.F,done(14),D2).pending,false,'7 more: not yet');
  const f=FB.feedbackState(a.F,done(15),D2);assert.equal(f.pending,true,'8 more: ask again');assert.equal(f.nextAt,15);assert.deepEqual(f.questions,FB.POOL[1]);
  assert.notDeepEqual(f.questions,a.entry.questions);
  let F=a.F;for(let i=0;i<FB.POOL.length;i++){F=FB.feedbackApply(F,done(15+8*i),{answers:['x']},{now:2+i,today:D2}).F;}
  assert.deepEqual(FB.questionsFor(F),FB.POOL[1],'the pool wraps around');});

test('"Not now" snoozes for the rest of the day, re-asks next day, and two in a row wait for the next 8 quests',()=>{
  const s1=FB.feedbackApply(null,done(4),{skip:true},{now:1,today:D1});assert.ok(s1.skipped);assert.equal(s1.F.entries.length,0);
  assert.equal(FB.feedbackState(s1.F,done(4),D1).pending,false,'no nagging on every load');
  assert.equal(FB.feedbackState(s1.F,done(4),D1).snoozed,true);
  assert.equal(FB.feedbackState(s1.F,done(4),D2).pending,true,'asks again the next day');
  const k=FB.feedbackApply(null,done(2),{skip:true},{now:1,today:D1});assert.equal(FB.feedbackState(k.F,done(2),D2).pending,true,'a first "not now" re-asks next day even with few quests');
  const s2=FB.feedbackApply(s1.F,done(4),{skip:true},{now:2,today:D2});
  assert.equal(FB.feedbackState(s2.F,done(4),'2026-11-13').pending,false,'2 skips: treated as asked');
  assert.equal(FB.feedbackState(s2.F,done(11),'2026-11-13').pending,false,'7 more: still waiting');assert.equal(FB.feedbackState(s2.F,done(12),'2026-11-13').pending,true,'back after 8 more quests');
  const a=FB.feedbackApply(s1.F,done(4),{answers:['ok']},{now:3,today:D2});assert.equal(a.F.skips,0);assert.equal(a.F.skipDay,null);});

test('answers are cleaned, capped and never empty',()=>{
  assert.ok(FB.feedbackApply(null,done(1),{answers:['  ','']},{now:1,today:D1}).error,'blank answers are refused');
  const a=FB.feedbackApply(null,done(1),{answers:['<b>hi</b> '+'z'.repeat(900),'','extra']},{now:1,today:D1});
  assert.equal(a.entry.answers.length,2);assert.equal(a.entry.answers[1],'');assert.ok(!/[<>]/.test(a.entry.answers[0]));assert.equal(a.entry.answers[0].length,FB.MAX_ANSWER);});

// ---- the Worker ----
const mk=()=>{const dir=tmpDir('jane-fb-');return{dir,env:{ASSETS:assets(path.join(ROOT,'public')),JANE_KV:fileStore(dir),LEARNER_NAME:'Sam',LEARNER_AGE:'10.5',LEARNER_GRADE:'5th grade'}};};
const call=async(env,p,body,cookie='')=>{const r=await worker.fetch(new Request('http://x'+p,{method:body?'POST':'GET',headers:{'content-type':'application/json',cookie},body:body&&JSON.stringify(body)}),env);return{status:r.status,j:await r.json()};};
const page=async(env,q='')=>{const r=await worker.fetch(new Request('http://x/parent'+q),env);const h=await r.text();return JSON.parse(h.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g,'<'));};
const hash=(dir,k)=>{try{return crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,encodeURIComponent(k).replace(/\./g,'%2E')+'.json'))).digest('hex');}catch{return null;}};
// a real record (made by the Worker), then some finished quests and points; feedback keys stay absent
const seed=async env=>{const R=PF.synth(env);R.learners.push({id:'kid',name:'Robin',grade:'8th grade',interests:[],avatar:'🦉',pin:null,prefix:'L:kid:'});env.JANE_KV.putSync('profiles',JSON.stringify(R));
  for(const [q,pre,n,pts] of [['','',5,777],['?learner=kid','L:kid:',2,50]]){await worker.fetch(new Request('http://x/api/state'+q),env);
    const P=env.JANE_KV.getSync(pre+'progress','json');P.points=pts;P.quests={...(P.quests||{}),...done(n).quests};env.JANE_KV.putSync(pre+'progress',JSON.stringify(P));}
  for(const k of ['feedback','L:kid:feedback'])env.JANE_KV.deleteSync(k);};

test('pending on the next open for every learner; /parent says so and writes nothing',async()=>{const {dir,env}=mk();await seed(env);
  const before=fs.readdirSync(dir).sort().map(f=>[f,hash(dir,decodeURIComponent(f.slice(0,-5)))]);
  for(const q of ['','?learner=kid']){const D=await page(env,q);assert.equal(D.feedback.pending,true);assert.deepEqual(D.feedback.entries,[]);assert.equal(D.feedback.every,8);}
  assert.deepEqual(fs.readdirSync(dir).sort().map(f=>[f,hash(dir,decodeURIComponent(f.slice(0,-5)))]),before,'no KV writes');
  const s=await call(env,'/api/state');assert.equal(s.j.feedback.pending,true);assert.deepEqual(s.j.feedback.questions,FB.POOL[0]);});

test('saving answers writes only the feedback key: progress, medals, mastery and points are untouched',async()=>{const {dir,env}=mk();await seed(env);
  await call(env,'/api/state');const p0=hash(dir,'progress'),P0=env.JANE_KV.getSync('progress','json');
  const r=await call(env,'/api/feedback',{answers:['the boss fights','a space island']});assert.equal(r.status,200);assert.equal(r.j.saved,true);assert.equal(r.j.feedback.pending,false);
  assert.equal(hash(dir,'progress'),p0,'progress record byte-for-byte the same');assert.deepEqual(env.JANE_KV.getSync('progress','json'),P0);
  const F=env.JANE_KV.getSync('feedback','json');assert.equal(F.entries.length,1);assert.deepEqual(F.entries[0].answers,['the boss fights','a space island']);assert.equal(F.entries[0].quests,5);
  assert.equal(env.JANE_KV.getSync('L:kid:feedback','json'),null,'the other learner is separate');
  assert.equal((await call(env,'/api/state')).j.feedback.pending,false,'not asked again on the next load');
  const D=await page(env);assert.equal(D.feedback.entries.length,1);assert.equal((await page(env,'?learner=kid')).feedback.pending,true);
  assert.equal((await call(env,'/api/feedback',{answers:['','']})).status,400);});

test('"Not now" from the app stores a snooze, not an answer; sandbox writes go to sandbox keys',async()=>{const {dir,env}=mk();await seed(env);
  const r=await call(env,'/api/feedback',{skip:true});assert.equal(r.j.skipped,true);assert.equal(r.j.feedback.pending,false);
  assert.equal(env.JANE_KV.getSync('feedback','json').entries.length,0);
  const {env:e2}=mk();await seed(e2);const p0=e2.JANE_KV.getSync('progress','utf8');
  await call(e2,'/api/feedback?sandbox=1',{answers:['sandbox test']});assert.equal(e2.JANE_KV.getSync('feedback','json'),null,'real key untouched');
  assert.equal(e2.JANE_KV.getSync('sandbox:feedback','json').entries.length,1);assert.equal(e2.JANE_KV.getSync('progress','utf8'),p0);});

test('/parent lists answers newest first; every 8 quests it comes back',async()=>{const {env}=mk();await seed(env);
  await call(env,'/api/feedback',{answers:['first']});const P=env.JANE_KV.getSync('progress','json');Object.assign(P.quests,done(12).quests);const s0=await call(env,'/api/state');assert.equal(s0.j.feedback.pending,false,'7 more: not yet');Object.assign(P.quests,done(13).quests);env.JANE_KV.putSync('progress',JSON.stringify(P));
  const s=await call(env,'/api/state');assert.equal(s.j.feedback.pending,true,'8 more quests finished');assert.deepEqual(s.j.feedback.questions,FB.POOL[1]);
  await call(env,'/api/feedback',{answers:['second','']});const D=await page(env);assert.deepEqual(D.feedback.entries.map(e=>e.answers[0]),['second','first']);});

test('the app shows the check-in at a break (app open, after the high-five) and it fits short screens',()=>{
  const js=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8'),css=fs.readFileSync(path.join(ROOT,'public/app.css'),'utf8'),pj=fs.readFileSync(path.join(ROOT,'public/parent.js'),'utf8');
  assert.match(js,/Help shape Jane!/);assert.match(js,/s\.feedback\?\.pending&&!location\.hash\)feedbackCard/);assert.match(js,/state\?\.feedback\?\.pending.*feedbackCard\(state\.feedback\)/);
  assert.match(js,/id="fblater">Not now/);assert.match(css,/\.fbcheck\{[^}]*overflow-y:auto/);assert.match(pj,/Feedback from/);});

test('working level says kindergarten, not "K grade"',()=>{assert.equal(LV.ageLabel(5,5),'about age 5, roughly kindergarten');
  assert.equal(LV.ageLabel(5,6),'about age 5-6, roughly kindergarten-1st grade');assert.equal(LV.ageLabel(10,11),'about age 10-11, roughly 5th-6th grade');});
