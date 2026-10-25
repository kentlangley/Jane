// Free-play grind trail: after a map mini-session, offer the next open stone in the same subject.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {loadEngine,ROOT} from './helpers.mjs';
const {E,g}=await loadEngine();const js=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8');
const now=Date.parse('2026-10-24T19:00:00Z');
const math=g.topics.filter(t=>t.subject==='Mathematics');
const readyish=math.filter(t=>t.ageRangeStart>=10).slice(0,6);
assert.ok(readyish.length>=3,'need a few math topics for the trail test');
const fresh=()=>{const S=E.blank();S.firstDone=true;S.placement.done=true;return S;};
// Unlock a short trail: master prereqs so three topics are ready in Mathematics.
function unlockTrail(S){
  for(const t of math){ // master everything soft enough that our picks become ready
    if(t.ageRangeStart<=9)S.ts[t.id]={st:'mastered',how:'direct',c:3,w:0,ft:2,lvl:3,box:0,due:now+7*864e5,at:now};
  }
  return readyish.map(t=>t.id).filter(id=>E.stateOf(S,g,id,now)==='ready').slice(0,4);
}
test('nextTrailTopic prefers the next open stone in the same domain, then elsewhere in the subject',()=>{
  const S=fresh();const ids=unlockTrail(S);assert.ok(ids.length>=2,ids.join(','));
  const a=g.byId[ids[0]],n=E.nextTrailTopic(S,g,'Mathematics',a.id,now);
  assert.ok(n,'expected a next trail topic');assert.equal(n.subject,'Mathematics');assert.notEqual(n.topicId,a.id);
  assert.ok(['ready','learning','review'].includes(n.state));
  // Forward in the same domain wins when a later open stone exists there
  const later=math.filter(t=>t.domain===a.domain&&(t.ageRangeStart>a.ageRangeStart||(t.ageRangeStart===a.ageRangeStart&&t.id>a.id))&&E.stateOf(S,g,t.id,now)==='ready');
  if(later.length)assert.equal(n.domain,a.domain);
});
test('nextTrailTopic returns null when the subject has no other open stones',()=>{
  const S=fresh();const t=math[0];
  // Lock everything else: leave only this one ready by mastering its hard prereqs only, master all other math
  for(const x of math){if(x.id===t.id)continue;S.ts[x.id]={st:'mastered',how:'direct',c:3,w:0,ft:2,lvl:3,box:0,due:now+7*864e5,at:now};}
  for(const e of g.pre[t.id]||[])S.ts[e.id]={st:'mastered',how:'direct',c:3,w:0,ft:2,lvl:3,box:0,due:now+7*864e5,at:now};
  assert.equal(E.stateOf(S,g,t.id,now),'ready');
  assert.equal(E.nextTrailTopic(S,g,'Mathematics',t.id,now),null);
});
test('miniAfter includes next trail topic without awarding medals or starting a quest',()=>{
  const S=fresh();const ids=unlockTrail(S);assert.ok(ids.length>=2);
  const it=E.startMini(S,g,ids[0],null,now);assert.ok(it&&!it.error);assert.ok(S.mini);
  // Drain the mini by answering until miniAfter returns a summary
  let summary=null,guard=0;
  while(S.mini&&guard++<10){
    const cur=S.current;assert.ok(cur);
    const ans=cur.answer??cur.ka??(cur.choices&&cur.choices[0])??'ok';
    const x=E.submit(S,g,typeof ans==='object'?ans.label||ans:String(ans),now+guard);
    if(x.r?.done){summary=E.miniAfter(S,g,null,now+guard,x.r);if(!summary&&S.mini)continue;break;}
  }
  // If submit path didn't finish (generators vary), force-end via left=0
  if(!summary&&S.mini){S.mini.left=0;summary=E.miniAfter(S,g,null,now+20,{ok:true});}
  assert.ok(summary);assert.equal(summary.subject,'Mathematics');
  assert.ok(summary.next===null||summary.next.topicId!==summary.topicId);
  assert.equal(S.mini,null,'mini session must clear');
  assert.ok(!(S.questMedals||[]).length,'must not auto-award quest medals');
});
test('client offers Continue on this trail as the primary action after a mini',()=>{
  assert.match(js,/Continue on this trail/);
  assert.match(js,/m\.next/);
  assert.match(js,/trailgo/);
  assert.match(js,/Keep grinding/);
  // Auto-return to map only when there is no next stone (so grind mode is not yanked away)
  assert.match(js,/else setTimeout\(\(\)=>\{if\(!\$\('play'\)\.hidden&&\$\('extra'\)\.querySelector\('\.miniend'\)\)goMap\(m\.subject\);\},4500\);/);
  assert.doesNotMatch(js,/A quick mini-adventure, then back to your map!/);
});

test('nextTrailTopic skips stones finished earlier in this grind session',()=>{
  const S=fresh();
  // Unlock a wide Mathematics frontier so we have ≥3 open stones after marking two done
  for(const t of math){if(t.ageRangeStart<=11)S.ts[t.id]={st:'mastered',how:'direct',c:3,w:0,ft:2,lvl:3,box:0,due:now+7*864e5,at:now};}
  const open=math.filter(t=>['ready','learning','review'].includes(E.stateOf(S,g,t.id,now))).map(t=>t.id);
  assert.ok(open.length>=3,'need ≥3 open math stones, got '+open.length);
  const a=open[0],b=open[1];
  S.ts[a]={st:'learning',how:'direct',c:1,w:0,lvl:3,at:now};
  S.ts[b]={st:'learning',how:'direct',c:1,w:0,lvl:3,at:now};
  S.grindTrail={subject:'Mathematics',done:[a,b]};
  const n=E.nextTrailTopic(S,g,'Mathematics',b,now);
  assert.ok(n,'expected another open stone');
  assert.notEqual(n.topicId,a);assert.notEqual(n.topicId,b);
  assert.ok(!S.grindTrail.done.includes(n.topicId));
});

test('miniAfter records the finished stone on grindTrail so Continue will not re-offer it',()=>{
  const S=fresh();const ids=unlockTrail(S);assert.ok(ids.length>=2);
  E.startMini(S,g,ids[0],null,now);assert.ok(S.mini);
  S.mini.left=0;
  const summary=E.miniAfter(S,g,null,now,{ok:true});
  assert.ok(summary);assert.ok(S.grindTrail?.done?.includes(ids[0]));
  if(summary.next)assert.notEqual(summary.next.topicId,ids[0]);
  // Continue path keeps the session
  E.startMini(S,g,summary.next?.topicId||ids[1],null,now,{continue:true});
  assert.ok(S.grindTrail.done.includes(ids[0]),'continue must keep prior done list');
  // Fresh Explore from the map resets the session
  E.clearGrind(S);E.startMini(S,g,ids[1],null,now,{});
  assert.deepEqual(S.grindTrail.done,[]);
});

test('mapPayload exposes codes so the client can recolor stones live',()=>{
  const S=fresh();const ids=unlockTrail(S);
  S.ts[ids[0]]={st:'mastered',how:'direct',c:3,w:0,ft:2,lvl:3,box:0,due:now+7*864e5,at:now};
  const m=E.mapPayload(S,g,now);
  assert.ok(typeof m.codes==='string'&&m.codes.length===g.topics.length);
  assert.equal(m.codes[g.topics.findIndex(t=>t.id===ids[0])],'m');
  assert.ok(m.progress&&m.fog);
});

test('client refreshes map after mini and filters trailDone next',()=>{
  assert.match(js,/function applyMap\(/);
  assert.match(js,/async function refreshMap\(/);
  assert.match(js,/await refreshMap\(\)/);
  assert.match(js,/trailDone\.has\(n\.topicId\)/);
  assert.match(js,/continue:true/);
  assert.match(js,/r\.map\)applyMap/);
});
test('grind live progress keeps X/Y, bar fill and header % in sync',()=>{
  assert.match(js,/function progressFromCodes\(/);
  assert.match(js,/segDone/);
  assert.match(js,/st\.progress=m\.progress/);
  assert.match(js,/🗺️ \$\{m\.progress\.pct\}%/);
  assert.match(js,/mapData\.progress=progressFromCodes/);
});
