// Slice 11: review gates on the quest path, end to end on the standalone server (seeded synthetic progress with due topics).
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import {ROOT,tmpDir,example,loadEngine} from './helpers.mjs';
const {E,g}=await loadEngine();const DATA=tmpDir('jane-gates-');const DAY=864e5;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let srv,B;const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const api=async(p,body)=>{const r=await fetch(B+p,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,p);return r.json();};
const pack=example();
before(async()=>{const S=E.blank();S.firstDone=true;S.placement.done=true;S.itemsServed=5;const now=Date.now();
  g.topics.filter(t=>t.kq&&t.subject!=='Mathematics'&&!g.boss.has(t.id)).slice(0,4).forEach((t,i)=>S.ts[t.id]={st:'mastered',how:'direct',conf:.9,box:1,due:now-(5-i)*DAY,at:now-9*DAY,c:3,ft:3});
  fs.writeFileSync(path.join(DATA,'progress.json'),JSON.stringify(S));
  execFileSync(process.execPath,['publish-lessons.mjs','packs/examples/example-quest.json','--date',today,'--local'],{cwd:ROOT,env:{...process.env,DATA_DIR:DATA},stdio:'ignore'});
  const port=await freePort();B=`http://127.0.0.1:${port}`;
  srv=spawn(process.execPath,['server/index.mjs'],{cwd:ROOT,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:DATA,LEARNER_NAME:'Sam'},stdio:['ignore','pipe','inherit']});
  for(let i=0;i<100;i++){try{if((await fetch(B+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('server did not start');});
after(()=>{srv?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const rightAnswer=(st,q)=>q.type==='truefalse'?q.statements.map(x=>x[1]?'T':'F').join(''):q.type==='order'?q.items.join('|'):q.type==='match'?q.pairs.map(p=>p.join('=')).join('|'):q.answer??'ok';
test('finish stage 1, meet a locked gate, open it, then stage 2 comes next; the parent report shows the gate',async()=>{
  let s=await api('/api/quest/start',{date:today});const s0=pack.topics[0];
  for(let i=0;i<10&&s.item.topicId===s0.topicId;i++){const q=s0.questions.find(x=>x.prompt===s.item.q);assert.ok(q,s.item.q);s=(await api('/api/answer',{answer:rightAnswer(s,q)})).state;}
  assert.equal(s.item.format,'gate');assert.equal(s.item.mode,'review');assert.deepEqual([s.item.gate.n,s.item.gate.of],[1,E.GATE_ITEMS]); // 4 due topics, v0.9: up to 4 per gateassert.equal(s.quest.gates[0].state,'locked');assert.equal(s.quest.gates[0].before,1);
  for(let i=0;i<12&&s.item?.format==='gate';i++){const a=await api('/api/answer',{answer:s.item.choices?.[0]??'1'});s=a.state;if(!a.done&&a.retry){s=(await api('/api/answer',{answer:s.item.choices?.[1]??'2'})).state;}
    if(!s.item)s=await api('/api/next',{});} // the every-6-items "keep going?" choice pauses the item; Next carries on
  assert.equal(s.quest.gates[0].state,'open');assert.equal(s.item.topicId,pack.topics[1].topicId,'stage 2 next');assert.equal(s.quest.gates[0].items,E.GATE_ITEMS);
  const html=await (await fetch(B+'/parent')).text();const data=JSON.parse(html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g,'<'));
  const q=data.quests.find(x=>x.date===today);assert.equal(q.gates[0].state,'open');assert.equal(q.gates[0].items,E.GATE_ITEMS);});
