// Map must render for every taxonomy subject (a missing island blanked the whole map), fog only veils unexplored stones,
// and boss hearts count THIS fight (today's first-try boss hits on the topic), not the topic's lifetime streak.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {loadEngine,ROOT} from './helpers.mjs';
const {E,g}=await loadEngine();const js=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8');
const DAY=864e5,now=Date.parse('2026-10-23T03:00:00Z'),DEC='mt_SBkTGjiZjZ';
const fresh=()=>{const S=E.blank();S.firstDone=true;S.placement.done=true;return S;};
test('every subject in the taxonomy has a Map island (Geography blanked the map), and unknown subjects get a spare islet',()=>{
  const ISL=Function('return '+js.match(/const ISL=(\{[\s\S]*?\});\n/)[1])();
  for(const s of new Set(g.topics.map(t=>t.subject)))assert.ok(ISL[s],`no island for subject "${s}"`);
  assert.match(js,/if\(!layout\)\{ensureIslands\(\);layout=doLayout\(\)/);assert.match(js,/function ensureIslands\(\)/);
  assert.match(js,/try\{drawMap\(\);\}catch/,'a draw error must not leave the skeleton forever');});
test('fog is dark and see-through, sits under the nodes, and has clear holes at lit (cleared / mastered) stones',()=>{
  const d=js.slice(js.indexOf('function drawMap'),js.indexOf('function tip('));
  assert.ok(d.indexOf('class="fog"')>0&&d.indexOf('class="fog"')<d.indexOf('class="nodes"'),'fog must be drawn before (under) the nodes');
  assert.match(d,/mask="url\(#fogHoles\)"/);assert.match(d,/lit=i=>mask\[i\]==='C'\|\|codes\[i\]==='m'\|\|codes\[i\]==='v'/);
  assert.doesNotMatch(d,/fill="#cfd8dc" filter="url\(#fogBlur\)"/,'no pale opaque fog blanket');});
test('boss hearts start full at the start of a fight even with an old streak, drop per first-try hit, reset on a miss',()=>{
  const S=fresh();S.ts[DEC]={st:'learning',how:'direct',c:4,w:0,ft:2,lvl:4,streak:2,bossDay:'2026-10-21',bossRun:2};S.teach={[DEC]:{left:0,power:now}};S.focus=DEC;
  S.current=E.buildItem(S,g,DEC,'learn',null,now);assert.equal(S.current.format,'boss');assert.deepEqual([S.current.boss.max,S.current.boss.hp],[3,3],'yesterday\'s run / lifetime streak must not pre-fill');
  let x=E.submit(S,g,S.current.answer,now);assert.deepEqual([x.r.boss.max,x.r.boss.hp],[3,2]);if(S.current?.stage==='bonus')S.current=null;
  S.current=E.buildItem(S,g,DEC,'learn',null,now+1);assert.equal(E.publicItem(S.current,g,S,now+1).boss.hp,2);
  x=E.submit(S,g,'definitely wrong',now+1);assert.equal(x.r.boss.hp,3,'a miss resets the fight');assert.equal(E.publicItem(S.current,g,S,now+1).boss.hp,3);
  assert.equal(E.bossHP({bossDay:'2026-10-22',bossRun:2},{kind:'math'},now+DAY).hp,3,'a new PT day is a new fight');});
test('a pack boss topic with 1 graded question shows 1 heart (honest target), not 1 of 3 from an old streak',()=>{
  const S=fresh();S.ts[DEC]={st:'learning',how:'direct',c:4,w:0,ft:1,streak:2,lvl:4};
  const pack={date:'2026-10-22',topics:[{topicId:DEC,format:'boss',questions:[{type:'numeric',prompt:'Write 1/4 as a decimal.',answer:'0.25',hint:'h',explanation:'e'}]}]};
  S.packSeen['2026-10-22:'+DEC+':powerup']=1;S.current=E.buildItem(S,g,DEC,'learn',pack,now);assert.equal(S.current.format,'boss');
  assert.deepEqual([S.current.boss.max,S.current.boss.hp,S.current.boss.legend],[1,1,false]);
  const x=E.submit(S,g,'0.25',now);assert.equal(x.r.boss.hp,0);assert.notEqual(x.r.medal?.tier,'legendary');});
test('client boss bar: hearts and "N more" text come from the same numbers and update on every answer',()=>{
  assert.match(js,/function bossHTML\(b,topicId\)/);assert.match(js,/if\(r\.boss\)\{if\(st\?\.item\)st\.item\.boss=r\.boss;\$\('bossbar'\)\.innerHTML=bossHTML/);});
