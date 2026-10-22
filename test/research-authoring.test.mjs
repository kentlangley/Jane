// Slice 5 (#41): research in nightly authoring. The publisher warns (never fails) when a researched Math/Science stage
// has no misconception-based wrong choice, or skips the re-teach prerequisite for a topic the learner got stuck on; and
// choice questions may carry per-wrong-choice "feedback" that the app shows instead of the generic hint.
// Synthetic packs and progress only.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {ROOT,example,validate,tmpDir} from './helpers.mjs';
const E=await import('../src/engine.js');const g=E.graph(JSON.parse(fs.readFileSync(path.join(ROOT,'public/tax.json'),'utf8')));
const COVE=4,BOSS=5,RESEARCHED=/researched stage "([^"]+)": no choice question has a wrong choice from a listed misconception/g;
const warnsOf=r=>[...(r.stdout+r.stderr).matchAll(RESEARCHED)].map(m=>m[1]);

test('the example quest follows the rules: researched stages tagged, no research warnings, dry-runs clean',()=>{
  const r=validate(example());assert.equal(r.status,0,r.stderr);assert.deepEqual(warnsOf(r),[]);assert.match(r.stdout,/3 researched stages/);
  const p=example();const q=p.topics[COVE].questions.find(q=>q.type==='mc');assert.equal(q.misconception,'1/2');assert.ok(q.feedback['1/2']);});

test('a researched stage with no misconception-based distractor gets a warning, not an error',()=>{
  const p=example();for(const i of [COVE,BOSS])for(const q of p.topics[i].questions){delete q.misconception;delete q.feedback;}
  const r=validate(p);assert.equal(r.status,0,r.stderr);assert.deepEqual(warnsOf(r).sort(),['Multiplying fractions (age 10+)','Real-world fraction multiplication']);
  assert.match(r.stderr,/npm run research -- mt_AabJisinfi/);
  // a stage on an English topic (no research) is never asked for one
  assert.ok(!warnsOf(r).some(n=>/Simile|Relative/i.test(n)));});

test('misconception and feedback are validated: wrong choices only, choice questions only, short replies',()=>{
  const bad=(edit,re)=>{const p=example();edit(p);const r=validate(p);assert.equal(r.status,1,'should fail: '+re);assert.match(r.stderr,re);};
  const mc=p=>p.topics[COVE].questions.find(q=>q.type==='mc');
  bad(p=>{mc(p).misconception='1/6';},/misconception: must be one of the wrong choices/);
  bad(p=>{mc(p).misconception='3/4';},/misconception: must be one of the wrong choices/);
  bad(p=>{mc(p).feedback={'1/6':'Yes!'};},/feedback\["1\/6"\]: keys must be wrong choices/);
  bad(p=>{mc(p).feedback=['x'];},/feedback: object/);
  bad(p=>{p.topics[COVE].questions.find(q=>q.type==='numeric').feedback={'2':'no'};},/"feedback" and "misconception" are for mc, picture and blank-with-choices/);
  const p=example();mc(p).feedback['2/5']='This reply is far too long for a kid to read quickly after a wrong pick so it should warn here.';
  const r=validate(p);assert.equal(r.status,0);assert.match(r.stderr,/words \(feedback ≤ 20\)/);});

test('a stuck topic should scaffold down to the research re-teach prerequisite (warning)',()=>{
  const d=tmpDir('jane-s5-');try{
    const S=E.blank();S.firstDone=true;S.support={mt_AabJisinfi:{stuck:2,skipped:0,at:Date.parse('2026-03-01T18:00:00Z')}};
    fs.writeFileSync(path.join(d,'progress.json'),JSON.stringify(S));
    const run=p=>validate(p,{args:['--dry-run','--local'],env:{DATA_DIR:d}});
    let r=run(example());assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/"Multiplying fractions \(age 10\+\)" needs support \(the learner got stuck\): scaffold down to a prerequisite to re-teach first, e\.g\. mt_TgHxujL81r "Multiplying fractions"/);
    const p=example();p.topics[COVE].teaches.push('mt_TgHxujL81r');r=run(p);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stderr,/needs support/);
  }finally{fs.rmSync(d,{recursive:true,force:true});}});

test('without the research file the checks are skipped and the pack still publishes',()=>{
  const p=example();for(const q of p.topics[COVE].questions)delete q.misconception;
  const r=validate(p,{env:{RESEARCH_FILE:'/nonexistent/teaching-research.json'}});assert.equal(r.status,0,r.stderr);assert.deepEqual(warnsOf(r),[]);assert.doesNotMatch(r.stdout,/researched stage/);});

// ---- the app: per-wrong-choice feedback ----
const now=Date.parse('2026-03-02T18:00:00Z');
function serve(q){const S=E.blank();S.firstDone=true;S.placement.done=true;const id='mt_AabJisinfi';
  const pack={date:'2026-03-02',title:'t',topics:[{topicId:id,questions:[q]}]};const it=E.buildItem(S,g,id,'learn',pack,now);
  S.current={...it,id:'x',topicId:id,mode:'learn',tries:0,stage:'main',issued:now};return S;}
const Q={type:'mc',prompt:'What is 1/3 of 1/2?',choices:['1/6','1/2','2/5'],answer:'1/6',misconception:'1/2',hint:'Tops: 1 × 1. Bottoms: 3 × 2.',
  explanation:'Multiply both bottoms.',feedback:{'1/2':'Careful! Times is not like adding. Multiply the bottoms too.','1/6':'ignored: that is the answer','nope':'ignored'}};
test('a wrong choice with feedback gets that reply instead of the generic hint; others get the hint',()=>{
  let S=serve(Q);assert.equal(S.current.type,'mc');
  const pub=JSON.stringify(E.publicItem(S.current,g));assert.doesNotMatch(pub,/Careful|feedback|misconception/,'feedback stays server-side');
  assert.deepEqual(S.current.feedback,{'1/2':Q.feedback['1/2']},'only wrong choices are kept');
  let x=E.submit(S,g,'1/2',now);assert.equal(x.r.retry,true);assert.equal(x.r.hint,Q.feedback['1/2']);assert.match(x.r.jane,/Times is not like adding/);assert.doesNotMatch(x.r.jane,/Here's a hint/);
  assert.equal(x.ev.find(e=>e.topicId)?.feedback,true,'the log notes the feedback');
  x=E.submit(S,g,'1/2',now);assert.equal(x.r.learningMoment,true);assert.match(x.r.jane,/Learning moment! 🌱 Careful!.*The answer is "1\/6"\. Multiply both bottoms\./);
  S=serve(Q);x=E.submit(S,g,'2/5',now);assert.equal(x.r.hint,Q.hint);assert.match(x.r.jane,/Here's a hint: Tops/);
  const {feedback,misconception,...plain}=Q;S=serve(plain);assert.equal(S.current.feedback,undefined);x=E.submit(S,g,'1/2',now);assert.equal(x.r.hint,Q.hint);
  S=serve(Q);x=E.submit(S,g,'1/6',now);assert.equal(x.r.correct,true);});
test('picture choices take feedback by label',()=>{
  const S=serve({type:'picture',prompt:'Which shows 1/2 of 1/4?',choices:[{label:'1/8',pic:'🟦'},{label:'1/4',pic:'🟩'}],answer:'1/8',hint:'Half of a quarter.',explanation:'1/8.',feedback:{'1/4':'The bottom stayed 4: multiply 2 × 4.'}});
  const x=E.submit(S,g,'1/4',now);assert.equal(x.r.hint,'The bottom stayed 4: multiply 2 × 4.');});
