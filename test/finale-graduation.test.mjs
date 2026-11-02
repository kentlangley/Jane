// Finale quest (LESSONS.md "Finale quest"): "finale": true on the quest block gives a crown "FINAL BOSS" reveal, accurate
// Campaign Trail text, and a graduation screen (banner, cap toss, recap of the real quest medals, the grown-up's message).
// Placeholders only: no real learner names or messages in tests.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {loadEngine,ROOT,example,validate,tmpDir} from './helpers.mjs';
const {E,g}=await loadEngine();
const js=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8'),css=fs.readFileSync(path.join(ROOT,'public/app.css'),'utf8');
const D='2026-03-03',now=Date.parse('2026-03-03T19:00:00Z');
const MSG='Placeholder line one.\n\nPlaceholder sign-off';
const qm=i=>({date:`2026-02-${String(i+1).padStart(2,'0')}`,title:'Quest '+i,name:'Medal '+i,emoji:'🏅',at:1000+i});
// a learner who unlocked the Final Boss: 12 quest medals + 4 legendaries
function unlocked(){const S=E.blank();S.firstDone=true;S.placement.done=true;S.questMedals=Array.from({length:12},(_,i)=>qm(i));
  S.medals=Array.from({length:4},(_,i)=>({id:'leg'+i,tier:'legendary',at:2000+i}));return S;}
function finalePack(extra={}){const p=example();p.date=D;p.quest.finale=true;
  p.quest.graduation={title:'You graduated!',message:'Welcome to the big leagues, champion!',parentMessage:MSG,...extra};return p;}

test('finaleState: none, ready, started, done (newest finale pack wins)',()=>{const S=E.blank();
  assert.equal(E.finaleState(S,{[D]:example()}),null,'a normal quest is not the Finale');
  const p=finalePack();assert.deepEqual(E.finaleState(S,{[D]:p}),{date:D,title:p.quest.title,status:'ready'});
  S.quests={[D]:{started:1}};assert.equal(E.finaleState(S,{[D]:p}).status,'started');
  S.quests[D].done=2;assert.equal(E.finaleState(S,{[D]:p}).status,'done');
  assert.equal(E.finaleState(S,{'2026-01-01':finalePack(),[D]:null}).date,'2026-01-01');});

test('Campaign Trail text is accurate before and after a Finale quest is published',()=>{const S=unlocked();
  let C=E.campaignState(S,g);assert.equal(C.finalBoss.unlocked,true);assert.match(C.taunt,/forging the finale/);assert.match(C.finalBoss.note,/forging/);
  const fin={date:D,title:'The Finale',status:'ready'};
  C=E.campaignState(S,g,fin);assert.match(C.taunt,/The Final Boss awaits!/);assert.doesNotMatch(C.taunt+C.finalBoss.note,/forging/);
  assert.match(C.finalBoss.note,/awaits in "The Finale"/);assert.deepEqual(C.finalBoss.finale,fin);assert.equal(C.finalBoss.graduated,false);
  C=E.campaignState(S,g,{...fin,status:'started'});assert.match(C.taunt,/awaits.*Finish the Finale/);
  C=E.campaignState(S,g,{...fin,status:'done'});assert.equal(C.finalBoss.graduated,true);assert.match(C.taunt,/Graduated to the Big Leagues/);
  // a Finale pack published before the unlock does not change the normal taunts
  const S2=E.blank();C=E.campaignState(S2,g,fin);assert.equal(C.finalBoss.finale,null);assert.doesNotMatch(C.taunt,/awaits/);});

test('questInfo flags the Finale and keeps the send-off secret until the medal is won',()=>{const S=unlocked(),p=finalePack();
  let qi=E.questInfo(S,g,p);assert.equal(qi.finale,true);assert.equal(qi.graduation,undefined);
  assert.equal(E.questInfo(S,g,example()).finale,undefined,'normal quests are unchanged');
  S.quests={[D]:{started:1,done:2}};qi=E.questInfo(S,g,p);assert.equal(qi.graduation.parentMessage,MSG);assert.equal(qi.graduation.title,'You graduated!');});

test('winning the Finale: graduation payload with every real quest medal; nothing else changes',()=>{const S=unlocked(),p=finalePack();
  const before=JSON.stringify({m:S.medals,q:S.questMedals,pts:S.points,ts:S.ts});
  for(const t of p.topics)for(let j=0;j<t.questions.length;j++)S.packSeen[`${D}:${t.topicId}:${j}`]=1;
  const m=E.completeQuest(S,g,p,now);assert.ok(m);assert.equal(m.finale,true);
  assert.equal(m.recap.length,13);assert.deepEqual(m.recap.slice(0,12).map(r=>r.name),S.questMedals.slice(0,12).map(q=>q.name));
  assert.equal(m.recap[12].finale,true);assert.equal(m.recap[12].name,p.quest.medal.name);
  assert.equal(m.graduation.parentMessage,MSG,'line breaks kept');assert.equal(m.graduation.message,'Welcome to the big leagues, champion!');
  // the old medals, legendaries, mastery and points are untouched; only the new quest medal row was added
  assert.deepEqual(JSON.parse(JSON.stringify({m:S.medals,q:S.questMedals.slice(0,12),pts:S.points,ts:S.ts})),JSON.parse(before));
  assert.equal(S.questMedals.length,13);assert.equal(S.questMedals[12].finale,true);
  const C=E.campaignState(S,g);assert.equal(C.finalBoss.graduated,true,'graduated survives without the pack');assert.equal(C.filled,12);
  const T=E.trophies(S,g).medals.find(x=>x.id==='quest:'+D);assert.equal(T.grad,true);assert.match(T.why,/graduating/);
  assert.equal(E.trophies(S,g).medals.filter(x=>x.grad).length,1);
  // a normal quest win has no graduation payload
  const S3=E.blank();const q=example();for(const t of q.topics)for(let j=0;j<t.questions.length;j++)S3.packSeen[`${q.date}:${t.topicId}:${j}`]=1;
  const m3=E.completeQuest(S3,g,q,now);assert.equal(m3.finale,undefined);assert.equal(m3.graduation,undefined);assert.equal(S3.questMedals[0].finale,undefined);});

test('publisher: a valid Finale pack passes; bad finale/graduation fields fail',()=>{
  let r=validate(finalePack());assert.equal(r.status,0,r.stderr);
  const bad=(mut,re)=>{const p=finalePack();mut(p);const x=validate(p);assert.equal(x.status,1,x.stdout);assert.match(x.stderr,re);};
  bad(p=>p.quest.finale='yes',/quest\.finale: true/);
  bad(p=>{delete p.quest.finale;},/only the Finale quest/);
  bad(p=>p.quest.graduation.signature='x',/quest\.graduation\.signature/);
  bad(p=>p.quest.graduation.parentMessage='<b>hi</b>',/plain text only/);
  bad(p=>p.quest.graduation.parentMessage='x'.repeat(1001),/≤ 1000 characters/);
  bad(p=>{p.placement=true;},/placement quest cannot be the Finale/);
  // the send-off as the boss stage's last fun-fact card gets a warning pointing to quest.graduation
  const p=finalePack();p.topics[p.topics.length-1].questions.push({type:'fact',emoji:'🎓',title:'You graduated!',body:'Placeholder send-off.'});
  r=validate(p);assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/put the send-off in "quest\.graduation"/);});

test('a started Finale can gain the finale/graduation fields on refresh; other quest-block edits still exit 6',()=>{
  const dir=tmpDir('jane-finale-');const stored=example();stored.date=D;fs.writeFileSync(path.join(dir,`lessons%3A${D}.json`),JSON.stringify(stored));
  fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify({v:2,ts:{},packSeen:{[`${D}:${stored.topics[0].topicId}:0`]:1},quests:{[D]:{started:1}}}));
  const f=path.join(dir,'pack.json'),run=()=>spawnSync(process.execPath,['publish-lessons.mjs',f,'--local','--refresh','--date',D],{cwd:ROOT,encoding:'utf8',env:{...process.env,DATA_DIR:dir}});
  fs.writeFileSync(f,JSON.stringify(finalePack()));let r=run();assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,`lessons%3A${D}.json`),'utf8')).quest.graduation.parentMessage,MSG);
  const p=finalePack();p.quest.hook='A different hook';fs.writeFileSync(f,JSON.stringify(p));r=run();assert.equal(r.status,6);assert.match(r.stderr,/quest block/);
  fs.rmSync(dir,{recursive:true,force:true});});

test('client: crown FINAL BOSS reveal, graduation screen, reduced motion, previews',()=>{
  assert.match(js,/Q\.finale\?`<div class="qrnew fbnew">👑 FINAL BOSS 👑<\/div>/);assert.match(js,/className='qreveal'\+\(Q\.finale\?' qfinale':''\)/);
  assert.match(js,/function gradHTML\(m\)/);assert.match(js,/Graduated to the Big Leagues!/);assert.match(js,/function gradCaps\(\)\{if\(matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\)return'';/);
  assert.match(js,/m\.finale\?gradHTML\(m\)/);assert.match(js,/esc\(G\.parentMessage\)/);assert.match(js,/#graduation-preview/);
  // the normal high-five and its three choices are still there, for the Finale too
  assert.match(js,/High five — quest complete!/);for(const id of['qc-reinforce','qc-grind','qc-play'])assert.match(js,new RegExp(id));
  assert.match(css,/\.gpm\{white-space:pre-line/);assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{\.capfly\{display:none\}/);
  assert.match(js,/C\.finalBoss\.note\|\|/);assert.match(js,/gradbadge/);assert.match(js,/gradrib/);
  const w=fs.readFileSync(path.join(ROOT,'src/worker.js'),'utf8');assert.match(w,/E\.campaignState\(S,g,E\.finaleState\(S,/);});

test('docs: LESSONS.md documents the Finale fields; the example packs carry no parent message',()=>{
  const les=fs.readFileSync(path.join(ROOT,'LESSONS.md'),'utf8');assert.match(les,/"finale": true/);assert.match(les,/parentMessage/);assert.match(les,/The Final Boss awaits!/);
  for(const f of fs.readdirSync(path.join(ROOT,'packs/examples')))assert.doesNotMatch(fs.readFileSync(path.join(ROOT,'packs/examples',f),'utf8'),/parentMessage/);});
