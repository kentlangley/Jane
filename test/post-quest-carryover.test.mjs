// #106: after questDone, a late/double boss answer must not grade the next free-play/review item.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {loadEngine,ROOT} from './helpers.mjs';
const {E,g}=await loadEngine();
const now=Date.parse('2026-10-28T01:00:00Z');

/** Mimic worker answer path: questCheck then optionally next (held when questDone). */
function afterDone(S,pack,r,t,{holdOnQuestDone=true}={}){
  const m=E.completeQuest(S,g,pack,t);if(m)r.questDone=m;
  if(!S.current&&!r.askChoice&&!(holdOnQuestDone&&r.questDone))E.next(S,g,pack,t);
  return r;
}

test('held next: stray boss answer after questDone cannot hit free-play/review',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(ROOT,'packs/examples/example-quest.json'),'utf8'));
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  // Leave exactly one graded pack question unmarked so the finishing submit completes the quest.
  const last=[];
  for(const t of pack.topics)for(let j=0;j<(t.questions||[]).length;j++){
    const q=t.questions[j];if(['why','fact','learn'].includes(q.type)){S.packSeen[`${pack.date}:${t.topicId}:${j}`]=1;continue;}
    last.push([t,j,q]);}
  assert.ok(last.length>=1);
  const keep=last.pop();
  for(const [t,j] of last)S.packSeen[`${pack.date}:${t.topicId}:${j}`]=1;

  // Serve the last quest item and answer it correctly → questDone; hold next.
  const it=E.next(S,g,pack,now);
  assert.ok(it.packKey||it.kind==='pack'||pack.topics.some(t=>t.topicId===it.topicId));
  const bossAns=String(it.answer);
  const x=E.submit(S,g,bossAns,now);
  assert.equal(x.r.correct,true);assert.equal(x.r.done,true);
  afterDone(S,pack,x.r,now,{holdOnQuestDone:true});
  assert.ok(x.r.questDone,'quest should complete');
  assert.equal(S.current,null,'server must not advance while celebrating');

  // Late/double submit of the boss answer while current is null → no item, no log against a new topic.
  const stray=E.submit(S,g,bossAns,now+1);
  assert.equal(stray.error,'no item');
  assert.equal(S.current,null);

  // After celebrate (Mini-games), next() loads free-play/review — unrelated to bossAns.
  const next=E.next(S,g,pack,now+2);
  assert.ok(next);assert.ok(next.q);
  assert.notEqual(String(next.answer),bossAns,'post-quest item is a different question');
  // Answering with the old boss string must not silently "succeed" as the new item's answer.
  const bad=E.submit(S,g,bossAns,now+3);
  assert.notEqual(bad.error,'no item');
  if(bad.r?.correct===true&&String(next.answer)===bossAns)assert.fail('unexpected identical answer');
  assert.equal(bad.r?.correct===true&&normish(bossAns)===normish(next.answer),false);
});

test('legacy bug: advancing immediately lets boss answer grade the next item',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(ROOT,'packs/examples/example-quest.json'),'utf8'));
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  const graded=[];
  for(const t of pack.topics)for(let j=0;j<(t.questions||[]).length;j++){
    const q=t.questions[j];if(['why','fact','learn'].includes(q.type)){S.packSeen[`${pack.date}:${t.topicId}:${j}`]=1;continue;}
    graded.push([t,j]);}
  const keep=graded.pop();for(const [t,j] of graded)S.packSeen[`${pack.date}:${t.topicId}:${j}`]=1;
  const it=E.next(S,g,pack,now);
  const bossAns=String(it.answer);
  const x=E.submit(S,g,bossAns,now);
  afterDone(S,pack,x.r,now,{holdOnQuestDone:false}); // old behavior
  assert.ok(x.r.questDone);assert.ok(S.current,'old path advanced');
  const nextQ=S.current.q,nextId=S.current.topicId,nextAns=String(S.current.answer);
  // Only demonstrate carry-over when the next item would mark bossAns wrong (typical free-play/review).
  if(normish(nextAns)===normish(bossAns))return; // skip flaky identical-answer case
  const y=E.submit(S,g,bossAns,now+1);
  assert.equal(y.error,undefined);
  assert.ok(y.ev?.some(e=>!e.event&&e.topicId===nextId&&e.given===bossAns&&e.correct===false)
    ||(y.r&&y.r.correct===false&&S.ts[nextId]),
    `carry-over would log bossAns on next item (${nextQ})`);
});

function normish(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,'');}

test('worker-style answer: null current rejects without advancing (#106)',()=>{
  const pack=JSON.parse(fs.readFileSync(path.join(ROOT,'packs/examples/example-quest.json'),'utf8'));
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  // Finish quest, hold next (current null)
  for(const t of pack.topics)for(let j=0;j<(t.questions||[]).length;j++)S.packSeen[`${pack.date}:${t.topicId}:${j}`]=1;
  const m=E.completeQuest(S,g,pack,now);assert.ok(m);assert.equal(S.current,null);
  // Mimic fixed worker: do NOT E.next before submit when !current
  const stray=E.submit(S,g,'Many fossils show the same mix of features',now+1);
  assert.equal(stray.error,'no item');
  assert.equal(S.current,null,'must stay null — no free-play item created under the stray answer');
});
