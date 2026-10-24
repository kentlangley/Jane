// Placement quests (plans/learner-profiles.md Slice 5, LESSONS.md "Placement quests"): ladders from the grade-level band
// down; a pass skips the rest of the ladder; the result is recorded once the quest is done; beyondMap at the ceiling.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {ROOT,loadEngine,validate} from './helpers.mjs';
const {E,g}=await loadEngine();
const pack=()=>{const p=JSON.parse(fs.readFileSync(path.join(ROOT,'packs/examples/example-placement.json'),'utf8'));p.date='2026-01-05';return p;};
const right=it=>it.type==='truefalse'?it.tf:it.type==='match'?it.pairs.map(p=>p.join('=')).join('|'):it.answer;
// play the quest: answer(stageTopicId) → true = right first try, false = wrong twice
function play(S,P,answer,now){S.quests={[P.date]:{started:now}};const served=[];let guard=0,done=null;
  E.next(S,g,P,now);while(S.current&&guard++<80){const it=S.current;if(!it.packKey){break;}const id=it.topicId;if(!served.includes(id))served.push(id);
    if(it.type==='card'){E.submit(S,g,'ok',now);}else if(answer(id)){E.submit(S,g,right(it),now);}else{E.submit(S,g,'zzz-wrong',now);if(S.current===it)E.submit(S,g,'zzz-wrong',now);}
    if(!S.current||S.current===null){const m=E.completeQuest(S,g,P,now);if(m)done=m;if(done)break;E.next(S,g,P,now);}}
  return{served,done};}
test('the example placement pack validates',()=>{const r=validate(pack());assert.equal(r.status,0,r.stderr);});
test('pass at grade level skips the ladder; a miss serves the fallback; result recorded on completion',()=>{E.configure({LEARNER_NAME:'T',LEARNER_AGE:'12.5'});
  const P=pack(),S=E.blank(),now=Date.parse('2026-01-05T18:00:00Z');
  const {served,done}=play(S,P,id=>id!=='mt_tXxxCFl32J',now); // everything right except the science grade-level stage
  assert.ok(done,'the placement quest completes');
  assert.ok(!served.includes('mt_ALUrJpY0cZ')&&!served.includes('mt_b7T-CjOYUR'),'math fallbacks skipped after a pass');
  assert.ok(served.includes('mt_q-1a86ydgU'),'science fallback served after a miss');
  const R=S.placementQuest;assert.equal(R.date,P.date);assert.equal(R.ladders.math.passed,true);assert.equal(R.ladders.math.level,12);
  assert.equal(R.ladders.science.passed,true);assert.equal(R.ladders.science.level,11);assert.equal(R.ladders.english.level,11);
  const qi=E.questInfo(S,g,P);assert.equal(qi.stages.filter(s=>s.skipped).length,2,'skipped fallbacks stay marked');assert.ok(qi.stages.every(s=>s.complete));assert.equal(qi.pct,100);
  assert.equal(S.ts['mt_iEXqN48w3x']?.st,'mastered','passing the grade-level stage gives the adaptive start point');});
test('skipped stages show as skipped and complete while the quest runs; no review gates in placement',()=>{E.configure({LEARNER_NAME:'T',LEARNER_AGE:'12.5'});
  const P=pack(),S=E.blank(),now=Date.parse('2026-01-05T18:00:00Z');S.quests={[P.date]:{started:now}};S.placeQ={[P.date]:{'mt_iEXqN48w3x':{r:3,a:3}}};
  const qi=E.questInfo(S,g,P);assert.deepEqual(qi.stages.filter(s=>s.skipped).map(s=>s.topicId),['mt_ALUrJpY0cZ','mt_b7T-CjOYUR']);assert.equal(qi.gates.length,0);
  assert.ok(qi.stages.find(s=>s.topicId==='mt_ALUrJpY0cZ').complete);});
test('missing every stage: ladders not passed, "below" = lowest band tried',()=>{E.configure({LEARNER_NAME:'T',LEARNER_AGE:'12.5'});
  const P=pack(),S=E.blank(),now=Date.parse('2026-01-05T18:00:00Z');const {done}=play(S,P,()=>false,now);assert.ok(done);
  assert.equal(S.placementQuest.ladders.math.passed,false);assert.equal(S.placementQuest.ladders.math.below,10);assert.deepEqual(S.placementQuest.beyondMap,[]);});
test('beyondMap: passing the top stage at the taxonomy ceiling flags the subject',()=>{const P=pack();
  P.topics[0]={...P.topics[0],topicId:'mt_mqgu72aCMz',band:13};const S=E.blank(),now=Date.parse('2026-01-05T18:00:00Z');S.placeQ={[P.date]:{'mt_mqgu72aCMz':{r:3,a:3}}};
  assert.equal(E.subjectCeiling(g,'Mathematics'),13);const R=E.placementSummary(S,g,P,now);assert.deepEqual(R.beyondMap,['Mathematics']);assert.equal(R.ladders.math.level,13);});
test('validator: placement rules',()=>{const bad=pack();bad.topics[1].band=13;assert.match(validate(bad).stderr,/must run from the highest band down/);
  const b2=pack();delete b2.topics[0].ladder;assert.match(validate(b2).stderr,/ladder/);
  const b3=pack();b3.topics=b3.topics.slice(0,3);assert.match(validate(b3).stderr,/4-7 stages/);
  const b4=pack();b4.topics[0].questions=b4.topics[0].questions.slice(0,1);assert.match(validate(b4).stderr,/2-4 graded/);});
test('built-in diagnostic: same window for a 10.5-year-old, top band for an older learner',()=>{
  E.configure({LEARNER_AGE:'10.5'});const S=E.blank();E.next(S,g,null,Date.now());S.current=null;E.next(S,g,null,Date.now());assert.ok(S.placement.queue.length>3);const a=S.placement.queue.map(id=>g.byId[id]).filter(Boolean);
  assert.ok(a.every(t=>t.ageRangeStart>=9&&t.ageRangeStart<=11),'ages 9-11 as before');
  E.configure({LEARNER_AGE:'13.5'});const S2=E.blank();E.next(S2,g,null,Date.now());S2.current=null;E.next(S2,g,null,Date.now());const b=S2.placement.queue.map(id=>g.byId[id]).filter(Boolean);
  for(const t of b){const top=E.subjectCeiling(g,t.subject);assert.ok(t.ageRangeStart>=Math.min(12,top-1),`${t.subject} ${t.ageRangeStart}`);}
  E.configure({});});
