// v0.5 slice 4: the nightly REFRESHES the quest in progress instead of starting another one.
// publish-lessons --refresh keeps reached stages and the quest block byte-identical (exit 6 otherwise), budgets the
// remaining stages, refuses a new quest while one is unfinished (exit 3) and retires catch-up boosts.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {ROOT,example,tmpDir} from './helpers.mjs';
import {questReached} from '../lib-cli.mjs';
const D='2026-03-03',D2='2026-03-04';
const run=(dir,file,...a)=>spawnSync(process.execPath,['publish-lessons.mjs',file,'--local',...a],{cwd:ROOT,encoding:'utf8',env:{...process.env,DATA_DIR:dir}});
// a stored quest at D, started, with stage 1 answered (or a custom progress record)
function setup({stored=example(),seen=[[0,0]],quest={started:1},current=null}={}){const dir=tmpDir('jane-refresh-');stored.date=D;
  const lessons=path.join(dir,`lessons%3A${D}.json`);fs.writeFileSync(lessons,JSON.stringify(stored));
  const packSeen=Object.fromEntries(seen.map(([i,j])=>[`${D}:${stored.topics[i].topicId}:${j}`,1]));
  fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify({v:2,ts:{},packSeen,quests:{[D]:quest},current}));
  const f=path.join(dir,'pack.json');const write=p=>fs.writeFileSync(f,JSON.stringify(p));return{dir,f,lessons,write,done:()=>fs.rmSync(dir,{recursive:true,force:true})};}
const fresh=()=>{const p=example();p.date=D;return p;};

test('questReached: answered stages, the item on screen, and every stage before them',()=>{const p=fresh();
  assert.equal(questReached({packSeen:{}},p),0);
  assert.equal(questReached({packSeen:{[`${D}:${p.topics[2].topicId}:1`]:1}},p),3,'stage 3 answered → stages 1-3 reached');
  assert.equal(questReached({packSeen:{},current:{packKey:`${D}:${p.topics[1].topicId}:0`}},p),2,'the item on screen counts');
  assert.equal(questReached({packSeen:{[`${D}:${p.topics[5].topicId}:powerup`]:1}},p),6,'the boss power-up card counts');});

test('a refresh that changes only unreached stages publishes',()=>{const t=setup();const p=fresh();p.topics[3].questions[1].prompt='Fresh speed round: spot the true ones!';t.write(p);
  const r=run(t.dir,t.f,'--refresh','--date',D);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/refresh: stages 1-1 locked, 5 remaining/);
  assert.equal(JSON.parse(fs.readFileSync(t.lessons,'utf8')).topics[3].questions[1].prompt,'Fresh speed round: spot the true ones!');t.done();});

test('a refresh that edits a reached stage exits 6 and writes nothing (also in a dry run)',()=>{const t=setup({seen:[[1,0]]});const before=fs.readFileSync(t.lessons);
  const p=fresh();p.topics[1].questions[1].prompt='Sneaky edit to a reached stage';t.write(p);
  for(const extra of [[],['--dry-run']]){const r=run(t.dir,t.f,'--refresh','--date',D,...extra);assert.equal(r.status,6,r.stderr);assert.match(r.stderr,/stage 2 .* changed/);}
  assert.deepEqual(fs.readFileSync(t.lessons),before);t.done();});

test('removing a reached stage or changing the quest block exits 6',()=>{const t=setup();
  const p=fresh();p.topics.shift();t.write(p);assert.equal(run(t.dir,t.f,'--refresh','--date',D).status,6);
  const q=fresh();q.quest.title='A Different Story';t.write(q);const r=run(t.dir,t.f,'--refresh','--date',D);assert.equal(r.status,6);assert.match(r.stderr,/quest block/);t.done();});

test('the stage holding the item on screen is reached: editing it exits 6',()=>{const p0=fresh();
  const t=setup({current:{packKey:`${D}:${p0.topics[2].topicId}:0`}});const p=fresh();p.topics[2].questions[1].prompt='Changed under the learner';t.write(p);
  assert.equal(run(t.dir,t.f,'--refresh','--date',D).status,6);t.done();});

test('republishing the quest in progress without --refresh gets the same protection',()=>{const t=setup({seen:[[1,0]]});const p=fresh();p.topics[0].questions[0].prompt='Edited';t.write(p);
  const r=run(t.dir,t.f,'--date',D);assert.equal(r.status,6);t.done();});

test('the budget applies to the remaining stages (a long legacy quest can still be refreshed)',()=>{const stored=example();const mc=stored.topics[4].questions[2];
  stored.topics[0].questions.push(...Array.from({length:16},(_,i)=>({...mc,prompt:`Extra ${i+1}?`}))); // 32 graded in total: over the 30 budget
  const t=setup({stored:JSON.parse(JSON.stringify(stored))});stored.date=D2;t.write(stored);
  assert.equal(run(t.dir,t.f,'--date',D2,'--dry-run','--offline').status,1,'as a new quest it is too long');
  stored.date=D;t.write(stored);const r=run(t.dir,t.f,'--refresh','--date',D);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/14 graded/);t.done();});

test('a new quest while one is in progress exits 3 and points to --refresh',()=>{const t=setup();const p=example();t.write(p);
  for(const extra of [[],['--dry-run']]){const r=run(t.dir,t.f,'--date',D2,...extra);assert.equal(r.status,3,r.stderr);assert.match(r.stderr,new RegExp(`--refresh --date ${D}`));}
  assert.ok(!fs.existsSync(path.join(t.dir,`lessons%3A${D2}.json`)));t.done();});

test('--refresh needs a started, unfinished quest: not started exits 1, finished exits 4',()=>{
  let t=setup({quest:{}});t.write(fresh());assert.equal(run(t.dir,t.f,'--refresh','--date',D).status,1);t.done();
  t=setup({quest:{started:1,done:2}});t.write(fresh());assert.equal(run(t.dir,t.f,'--refresh','--date',D).status,4);t.done();});

test('catch-up boosts are retired: exit 1 with the refresh command',()=>{const t=setup();const b=path.join(t.dir,'boost.json');
  fs.writeFileSync(b,JSON.stringify({boostFor:D,message:'You can do it!'}));const r=run(t.dir,b);assert.equal(r.status,1);assert.match(r.stderr,/retired/);assert.match(r.stderr,/--refresh/);
  assert.ok(!fs.existsSync(path.join(t.dir,`boost%3A${D}.json`)));t.done();});

test('the export says REFRESH, lists locked/refreshable stages and writes the stored pack to start from',()=>{const t=setup({seen:[[1,0]]});
  const out=path.join(t.dir,'exports','progress-x.json');
  spawnSync(process.execPath,['export-progress.mjs','--local','--date',D,'--out',out],{cwd:ROOT,encoding:'utf8',env:{...process.env,DATA_DIR:t.dir}});
  const X=JSON.parse(fs.readFileSync(out,'utf8')),c=X.quests.current;assert.match(X.quests.nextStep,new RegExp(`^REFRESH: .*--refresh --date ${D}`));
  assert.equal(c.reachedStages,2);assert.equal(c.lockedStages.length,2);assert.equal(c.refreshableStages[0].i,2);
  assert.deepEqual(JSON.parse(fs.readFileSync(c.packFile,'utf8')),JSON.parse(fs.readFileSync(t.lessons,'utf8')));
  // and that file, unchanged, is a valid refresh
  const r=run(t.dir,c.packFile,'--refresh','--date',D,'--dry-run');assert.equal(r.status,0,r.stderr);t.done();});
