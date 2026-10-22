// Slice 6 (#42): check-understanding items (data/checks), written offline in kid voice from the research's two-tier and
// interpret/translate assessments. Review gates and spot-checks prefer them over the kid prompt; a quest boss may end
// with a two-tier "answer + why" pair. Raw adult assess text never reaches the learner; progress is untouched.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {ROOT,example,validate,tmpDir} from './helpers.mjs';
const E=await import('../src/engine.js');const TAX=JSON.parse(fs.readFileSync(path.join(ROOT,'public/tax.json'),'utf8'));const g=E.graph(TAX);
const J=f=>JSON.parse(fs.readFileSync(f,'utf8'));const R=Object.fromEntries(J(path.join(ROOT,'data/marble/teaching-research.json')).records.map(r=>[r.topicId,r]));
const lines=fs.readFileSync(path.join(ROOT,'data/checks/checks.txt'),'utf8').split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>l.split('|').map(x=>x.trim()));
const pending=new Set(fs.readFileSync(path.join(ROOT,'data/kid-prompts/PENDING.txt'),'utf8').split('\n').map(l=>l.replace(/#.*/,'').trim()).filter(Boolean));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function lcs(a,b){let best=0,prev=new Array(b.length+1).fill(0);for(let i=1;i<=a.length;i++){const cur=new Array(b.length+1).fill(0);for(let j=1;j<=b.length;j++)if(a[i-1]===b[j-1]){cur[j]=prev[j-1]+1;if(cur[j]>best)best=cur[j];}prev=cur;}return best;}
const DAY=864e5,now=Date.parse('2026-02-02T18:00:00Z'),D='2026-02-02';
const withCk=g.topics.filter(t=>t.ck),kidCk=withCk.filter(t=>t.kq&&!g.boss.has(t.id));

test('the items: from two-tier / interpret-translate research, kid-sized, three different choices, never raw assess text',()=>{
  assert.ok(lines.length>=100,`${lines.length} items`);const seen=new Set();
  for(const p of lines){const [id,q,a,...w]=p,r=R[id];assert.ok(!seen.has(id),'duplicate '+id);seen.add(id);
    assert.ok(r,'has research: '+id);assert.ok(['two_tier','interpret_translate'].includes(r.assess.method),`${id}: ${r.assess.method}`);
    assert.ok([5,8].includes(p.length),id);assert.ok(q.split(/\s+/).length<=15,id+' question ≤ 15 words');for(const c of p.slice(2))assert.ok(c.split(/\s+/).length<=12,`${id}: "${c}"`);
    assert.equal(new Set(p.slice(2,5)).size,3,id);if(p.length===8)assert.equal(new Set(p.slice(5)).size,3,id);
    assert.doesNotMatch(p.join(' '),/\b(the child|learner|pupil|say:|ask:|watch|tier|misconception|reasoning correctly)\b/i,id+': adult wording');
    // never raw adult assess text: no long run shared with the diagnostic, answer, error patterns or response levels
    const A=r.assess,raw=norm([A.diagnosticPrompt,A.correctAnswer,A.whatMakesItDiscriminate,...(A.errorPatterns||[]).flatMap(e=>[e.pattern,e.distractor,e.nextMove,e.revealedBy]),...Object.values(A.responseLevels||{})].join(' | '));
    for(const x of p.slice(1))assert.ok(lcs(norm(x),raw)<45,`${id}: "${x}" copies assess text`);}
  // learn wins here too: the Moon item doesn't teach the shadow "points away" idea
  assert.doesNotMatch(lines.find(p=>p[0]==='mt_4V-vYhFUcm').join(' '),/points away/i);});

test('build attaches them to playable topics only; pending and hidden-region topics are skipped',()=>{
  const ids=new Set(lines.map(p=>p[0]));for(const t of withCk){assert.ok(ids.has(t.id));assert.deepEqual(Object.keys(t.ck).sort(),t.ck.y?['a','q','w','y']:['a','q','w']);}
  assert.equal(withCk.length,[...ids].filter(id=>g.byId[id]).length);assert.ok(!(TAX.hidden?.topics||[]).some(t=>t.ck));
  for(const t of TAX.topics)assert.ok(!pending.has(t.id));
  // scratch build: a line for a pending topic and one for an AU topic are skipped (not errors) under HIDE_REGIONS=AU
  const d=tmpDir('jane-ck-');try{for(const p of['build.mjs','lib-regions.mjs','prototype/server.js','vendor/entry.mjs','data','src'])fs.cpSync(path.join(ROOT,p),path.join(d,p),{recursive:true});
    fs.mkdirSync(path.join(d,'public'),{recursive:true});fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(d,'node_modules'));
    const au=fs.readFileSync(path.join(ROOT,'data/regions/AU.txt'),'utf8').split('\n').map(l=>l.replace(/#.*/,'').trim()).filter(id=>id&&!pending.has(id))[0],pd=[...pending][0];
    fs.writeFileSync(path.join(d,'data/checks/zz-test.txt'),`${pd}|Question one here?|Right|Wrong one|Wrong two\n${au}|Question two here?|Right|Wrong one|Wrong two\n`);
    const env={...process.env,HIDE_REGIONS:'AU'};const r=spawnSync(process.execPath,['build.mjs'],{cwd:d,encoding:'utf8',env});assert.equal(r.status,0,r.stderr);
    assert.match(r.stdout,/checks: \d+ check-understanding items \(2 skipped: pending or hidden here\)/);
    const T2=J(path.join(d,'public/tax.json'));assert.ok(!T2.topics.some(t=>t.id===pd||t.id===au));assert.ok(!T2.hidden.topics.some(t=>t.ck));
    fs.writeFileSync(path.join(d,'data/checks/zz-test.txt'),`${pd}|The child should say why.|Right|Wrong one|Wrong two\n`);
    const b=spawnSync(process.execPath,['build.mjs'],{cwd:d,encoding:'utf8',env});assert.notEqual(b.status,0);assert.match(b.stderr,/adult\/teacher wording/);
  }finally{fs.rmSync(d,{recursive:true,force:true});}});

// ---- gates and spot-checks ----
const plain=g.topics.filter(t=>t.kq&&!t.ck&&t.subject!=='Mathematics'&&!g.boss.has(t.id)).map(t=>t.id);
const mcq=i=>({type:'mc',prompt:`Stop question ${i}?`,choices:['yes','no','maybe'],answer:'yes',hint:'h',explanation:'e'});
function setup(rev){const STG=plain.slice(30,33);const S=E.blank();S.firstDone=true;S.placement.done=true;S.itemsServed=10;S.quests={[D]:{started:now-1e5}};S.questFocus=D;
  rev.forEach((id,i)=>S.ts[id]={st:'mastered',how:'direct',conf:.9,box:1,due:now-(10-i)*DAY,at:now-20*DAY,c:3,ft:3});
  const pack={date:D,quest:{title:'Test Quest',hook:'Go!',medal:{name:'M',emoji:'🏅'}},topics:STG.map((id,i)=>({topicId:id,stage:{name:'Stop '+i,emoji:'⭐'},format:i===2?'boss':'quest',questions:[mcq(1),mcq(2),...(i===2?[mcq(3)]:[])]}))};return{S,pack};}
const toGate=(S,pack)=>{for(let i=0;i<2;i++){const it=E.next(S,g,pack,now);E.submit(S,g,it.answer,now);}return E.next(S,g,pack,now);};
test('a gate serves the check item for a topic that has one, and the kid MCQ otherwise',()=>{
  const c=kidCk[0];let {S,pack}=setup([c.id,plain[0]]);let gi=toGate(S,pack);
  assert.equal(gi.format,'gate');assert.equal(gi.topicId,c.id);assert.equal(gi.ptype,'check');assert.equal(gi.q,c.ck.q);assert.deepEqual([...gi.choices].sort(),[c.ck.a,...c.ck.w].sort());assert.equal(gi.answer,c.ck.a);
  const pub=E.publicItem(gi,g);assert.equal(pub.answer,undefined);assert.doesNotMatch(JSON.stringify(pub),/"ck"|"y":/);
  const x=E.submit(S,g,c.ck.a,now);assert.equal(x.r.correct,true);assert.equal(x.ev.find(e=>e.topicId===c.id)?.qtype,'check','logged as a check item');
  ({S,pack}=setup([plain[0]]));gi=toGate(S,pack);assert.equal(gi.topicId,plain[0]);assert.notEqual(gi.ptype,'check');assert.match(gi.q,new RegExp(g.byId[plain[0]].kq.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));});
test('the why tier becomes the explanation; a miss shows it kindly',()=>{const c=kidCk.find(t=>t.ck.y);const S=E.blank();S.firstDone=true;S.placement.done=true;
  S.ts[c.id]={st:'mastered',how:'direct',conf:.9,box:1,due:now-DAY,at:now-20*DAY,c:3,ft:3};const it=E.buildItem(S,g,c.id,'review',null,now);
  S.current={...it,id:'x',topicId:c.id,mode:'review',tries:0,stage:'main',issued:now};E.submit(S,g,c.ck.w[0],now);const x=E.submit(S,g,c.ck.w[0],now);
  assert.match(x.r.jane,new RegExp(c.ck.y.a.slice(1,20).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));});
test('generator topics: a spot-check of an inferred skill uses the check item, a regular review keeps the generator',()=>{
  const gen=withCk.find(t=>!t.kq&&E.buildItem(E.blank(),g,t.id,'review',null,now).kind==='math');assert.ok(gen,'a generator topic with a check item');
  const S=E.blank();S.ts[gen.id]={st:'mastered',how:'inferred',conf:.6,box:2,due:now+30*DAY,at:now-20*DAY};
  assert.equal(E.buildItem(S,g,gen.id,'review',null,now).ptype,'check','unverified inferred → check item');
  S.ts[gen.id]={st:'mastered',how:'direct',conf:.9,box:1,due:now-DAY,at:now-20*DAY,c:3};assert.equal(E.buildItem(S,g,gen.id,'review',null,now).kind,'math');
  // Play and quests outside review never use them
  for(const m of['learn','diagnostic'])assert.notEqual(E.buildItem(E.blank(),g,kidCk[0].id,m,null,now).ptype,'check');});
test('check items change no stored progress, medals or reached stages, and gates pick the same topics',()=>{
  const strip=JSON.parse(JSON.stringify(TAX));for(const t of strip.topics)delete t.ck;const g0=E.graph(strip);
  const S=E.blank();S.firstDone=true;const ids=withCk.slice(0,6).map(t=>t.id);ids.forEach((id,i)=>S.ts[id]={st:'mastered',how:i%2?'inferred':'direct',conf:.8,box:1,due:now-(i+1)*DAY,at:now-9e8,c:3});
  S.medals=[{id:ids[0],tier:g.byId[ids[0]].tier,at:now-9e8}];S.quests={[D]:{started:now-1e5,gates:{1:{before:1,items:[ids[0]],right:1,n:1,of:2,open:false}}}};
  const a=JSON.stringify(E.migrate(JSON.parse(JSON.stringify(S)),g)),b=JSON.stringify(E.migrate(JSON.parse(JSON.stringify(S)),g0));assert.equal(a,b,'migrate identical');
  assert.deepEqual(E.trophies(JSON.parse(a),g),E.trophies(JSON.parse(b),g0),'trophies identical');assert.deepEqual(E.summary(JSON.parse(a),g,now),E.summary(JSON.parse(b),g0,now));
  const order=gr=>{const {S,pack}=setup(withCk.filter(t=>t.kq).slice(0,4).map(t=>t.id));const seq=[];for(let i=0;i<12;i++){const it=E.next(S,gr,pack,now+i);seq.push(it.topicId+':'+(it.format==='gate'));E.submit(S,gr,it.answer,now+i);}return{seq,reached:E.questInfo(S,gr,pack).done};};
  assert.deepEqual(order(g),order(g0),'same gate topics in the same order, same quest progress');});

// ---- bosses: two-tier finale ----
test('a boss may end with a two-tier answer + why pair (npm run research -- <id> --check); misuse is an error',()=>{
  const R2=spawnSync(process.execPath,['research.mjs','mt_lvaSGHwvQ5','--check'],{cwd:ROOT,encoding:'utf8'});assert.match(R2.stdout,/no check item/);
  const id=kidCk.find(t=>t.ck.y).id;const r=spawnSync(process.execPath,['research.mjs',id,'--check'],{cwd:ROOT,encoding:'utf8'});assert.equal(r.status,0);const pair=JSON.parse(r.stdout);
  assert.deepEqual(pair.map(q=>q.twoTier),['answer','why']);
  const p=example();const boss=p.topics.at(-1);boss.questions.splice(-2,2,...JSON.parse(JSON.stringify(pair)));
  // (a real boss uses its own topic's check item, or one for a skill taught earlier; this only checks the shape)
  let v=validate(p);assert.equal(v.status,0,v.stderr);
  const bad=(edit,re)=>{const q=example();edit(q);const x=validate(q);assert.equal(x.status,1,String(re));assert.match(x.stderr,re);};
  bad(q=>{q.topics[4].questions.push(...JSON.parse(JSON.stringify(pair)));},/"twoTier" items are for the boss finale/);
  bad(q=>{const b=q.topics.at(-1);b.questions.push(...JSON.parse(JSON.stringify(pair)).reverse());},/exactly two questions at the end of the boss/);
  bad(q=>{const b=q.topics.at(-1);b.questions.splice(1,0,...JSON.parse(JSON.stringify(pair)));},/exactly two questions at the end of the boss/);
  bad(q=>{const b=q.topics.at(-1);b.questions.push({...pair[0],twoTier:'maybe'});},/"answer" or "why"/);});
