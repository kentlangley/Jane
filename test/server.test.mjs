// End-to-end smoke test for the standalone Node server (no Cloudflare, no network):
// starts server/index.mjs on a free port with a temp DATA_DIR, plays the first pizza question,
// publishes the example quest locally and checks the new-quest flag, then checks /parent and /about.
// Run: npm test   (runs the build first if public/tax.json is missing)
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
const ROOT=path.resolve(import.meta.dirname,'..');
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'jane-test-'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let srv,B,cookie='';
const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const api=async(p,body)=>{const r=await fetch(B+p,body===undefined?{headers:{cookie}}:{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)});assert.equal(r.status,200,p);return r.json();};
before(async()=>{
  if(!fs.existsSync(path.join(ROOT,'public/tax.json')))execFileSync(process.execPath,['build.mjs'],{cwd:ROOT,stdio:'ignore'});
  const port=await freePort();B=`http://127.0.0.1:${port}`;
  srv=spawn(process.execPath,['server/index.mjs'],{cwd:ROOT,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:DATA,LEARNER_NAME:'Sam',LEARNER_AGE:'10',LEARNER_GRADE:'5th grade'},stdio:['ignore','pipe','inherit']});
  for(let i=0;i<100;i++){try{if((await fetch(B+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
  throw new Error('server did not start');});
after(()=>{srv?.kill();fs.rmSync(DATA,{recursive:true,force:true});});

test('serves the kid app, /about and static assets',async()=>{
  {const r=await fetch(B+'/trophies.js');assert.equal(r.status,200);assert.match(await r.text(),/TrophyFilter/);}
  for(const [p,re] of [['/',/<html/i],['/about',/Marble/],['/app.js',/function/],['/vendor/ui.js',/./]]){
    const r=await fetch(B+p);assert.equal(r.status,200,p);assert.match(await r.text(),re,p);}
  assert.equal((await fetch(B+'/nope')).status,404);assert.equal((await fetch(B+'/.env')).status,404);
  assert.equal((await fetch(B+'/..%2fpackage.json')).status,404);});

test('pizza flow: first question, a miss, then 3/8 is right',async()=>{
  const s=await api('/api/state');assert.equal(s.name,'Sam');assert.match(s.item.q,/pizza/i);
  const miss=await api('/api/answer',{answer:'5/8'});assert.equal(miss.correct,false);
  const ok=await api('/api/answer',{answer:'3/8'});assert.equal(ok.correct,true);
  assert.ok(fs.existsSync(path.join(DATA,'progress.json')),'progress saved to DATA_DIR');
  assert.ok(fs.existsSync(path.join(DATA,`log%3A${today}.json`)),'answer log saved');});

test('a pack publishes locally and shows as a new quest',async()=>{
  const out=execFileSync(process.execPath,['publish-lessons.mjs','packs/examples/example-quest.json','--date',today,'--local'],{cwd:ROOT,env:{...process.env,DATA_DIR:DATA},encoding:'utf8'});
  assert.match(out,/published \(local\) lessons:/);
  const s=await api('/api/state');assert.equal(s.newQuest,true);assert.ok(s.quest?.title);
  const st=await api('/api/quest/start',{date:today});assert.equal(st.quest.title,s.quest.title);
  const ex=execFileSync(process.execPath,['export-progress.mjs','--local'],{cwd:ROOT,env:{...process.env,DATA_DIR:DATA},encoding:'utf8'});
  assert.match(ex,/wrote .*exports/);
  const xf=ex.match(/wrote (\S+\.json)/)[1];const X=JSON.parse(fs.readFileSync(path.isAbsolute(xf)?xf:path.join(ROOT,xf),'utf8'));
  for(const k of ['due','overdue','oldestOverdueDays','gateItems7d','spotChecks7d','unverifiedInferred','reviewsServed7d','gatesOpened7d','gatesAhead'])assert.equal(typeof X.reviewHealth?.[k],'number',k);
  assert.equal(typeof X.reviewHealth.lastPlayed,'string');assert.equal(X.reviewHealth.note,'ok','answers in the window and nothing due');});

test('export reviewHealth says "not played since …" when there are no answers in the window',()=>{
  const D2=fs.mkdtempSync(path.join(os.tmpdir(),'jane-rh-'));
  const ex=execFileSync(process.execPath,['export-progress.mjs','--local'],{cwd:ROOT,env:{...process.env,DATA_DIR:D2},encoding:'utf8'});
  const xf=ex.match(/wrote (\S+\.json)/)[1];const X=JSON.parse(fs.readFileSync(path.isAbsolute(xf)?xf:path.join(ROOT,xf),'utf8'));
  assert.match(X.reviewHealth.note,/^not played since .*: gates not reached yet$/);assert.equal(X.reviewHealth.reviewsServed7d,0);assert.equal(X.reviewHealth.lastPlayed,null);});

test('parent report renders with the learner name',async()=>{
  const r=await fetch(B+'/parent');assert.equal(r.status,200);const h=await r.text();assert.match(h,/Sam/);});

test('parent report includes coverage',async()=>{const h=await (await fetch(B+'/parent')).text();
  const D=JSON.parse(h.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g,'<'));
  const sub=n=>D.coverage.subjects.find(s=>s.name===n);assert.equal(sub('Mathematics').total,12);assert.equal(sub('Science').total,20);
  assert.equal(typeof D.coverage.seen,'number');assert.ok(sub('Mathematics').domains.every(d=>typeof d.seen==='boolean'));});
