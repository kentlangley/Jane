// Jane's own topics (data/jane/, lib-jane-topics.mjs): the Money Math and Money Models paths on the Life Skills island (2026-11-01).
// They load into tax.json after every Marble topic, sit on the Life Skills island as their own path (domain), have
// valid prerequisites, start unmastered, unlock through the normal ready/locked rules, can be quest stages, and never
// change a Marble topic (position, tier, prerequisites) or campaign state.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {ROOT,loadEngine,tmpDir,validate,example} from './helpers.mjs';import {loadJaneTopics} from '../lib-jane-topics.mjs';
const {E,g}=await loadEngine();const J=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const tax=J('public/tax.json'),marble=J('data/marble/topics.json').topics,src=J('data/jane/topics.json').topics,srcDeps=J('data/jane/dependencies.json').dependencies;
const now=Date.parse('2026-11-01T16:00:00Z'),DAY=864e5;
const MM={compound:'jane_mm_compound_growth',r72:'jane_mm_rule_of_72',real:'jane_mm_real_return',pv:'jane_mm_present_value',geo:'jane_mm_true_average_return'};
const MOD={profit:'jane_mmod_profit_per_customer',payback:'jane_mmod_payback_period',ladder:'jane_mmod_offer_ladder',price:'jane_mmod_price_testing',billing:'jane_mmod_billing_math'};
const COSTREV='mt_9gpUHWVKMR',MONEYWP='mt_3tz3Otap5j',MKT='mt_M2Gou3O6qT',MDWP='mt_Zdv-b-iW5K',CALCPCT='mt_PNSyfH56eQ',CAL='mt_EXlmTURK_o';
const PCT12='mt_iEXqN48w3x',POW='mt_hCVPYlF-7Y',BANK='mt_uSUqTjOl8m',PLAN='mt_r1hw-KenpK',ECON='mt_udgPy5oAvR',MEAN='mt_Cg8VPguS_V';
const master=(S,id)=>{S.ts[id]={st:'mastered',how:'direct',c:3,w:0,ft:3,lvl:3,box:0,due:now+7*DAY,at:now};};
const pre=id=>Object.fromEntries(g.pre[id].map(e=>[e.id,e.h?'hard':'soft']));

test('the five Money Math topics load into tax.json on the Life Skills island, after every Marble topic',()=>{
  const ids=Object.values(MM);assert.deepEqual(src.map(t=>t.id).slice(0,5),ids,'source order');
  const at=ids.map(id=>tax.topics.findIndex(t=>t.id===id));assert.ok(at.every(i=>i>=0),'all in tax.json');
  const firstJane=tax.topics.findIndex(t=>t.id.startsWith('jane_'));assert.ok(tax.topics.slice(0,firstJane).every(t=>t.id.startsWith('mt_')),'Marble topics keep their positions');
  assert.ok(tax.topics.slice(firstJane).every(t=>t.id.startsWith('jane_')),'Jane topics are appended');
  for(const id of ids){const t=g.byId[id];assert.equal(t.subject,'Life Skills');assert.equal(t.domain,'Money Math');assert.equal(t.ic,'📈');
    assert.ok(t.kq&&t.ka&&t.kw?.length===2,id+' has a kid prompt');assert.ok(['bronze','silver','gold'].includes(t.tier));}
  for(const t of src){for(const k of['type','subject','domain','name','description','ageRangeStart','ageRangeEnd','centrality','evidence','assessmentPrompt','standards'])assert.ok(k in t,`${t.id}.${k}`);
    assert.ok(!marble.some(m=>m.id===t.id),'distinct from Marble ids');}
  assert.deepEqual(src.slice(0,5).map(t=>[t.ageRangeStart,t.ageRangeEnd]),[[11,14],[10,14],[12,14],[13,15],[13,15]]);
  const lsDomains=new Set(g.topics.filter(t=>t.subject==='Life Skills').map(t=>t.domain));
  for(const d of['Entrepreneurship','Food & Cooking','Money & Finance','Money Math'])assert.ok(lsDomains.has(d),d);});

test('prerequisites are valid, playable and as planned; no Marble topic depends on a Jane topic',()=>{
  assert.deepEqual(pre(MM.compound),{[PCT12]:'hard',[POW]:'hard',[BANK]:'soft',[PLAN]:'soft'});
  assert.deepEqual(pre(MM.r72),{[CALCPCT]:'hard'},'early unlock: basic percentages only');
  assert.deepEqual(pre(MM.real),{[MM.compound]:'hard',[ECON]:'soft'});
  assert.deepEqual(pre(MM.pv),{[MM.compound]:'hard'});
  assert.deepEqual(pre(MM.geo),{[MM.compound]:'hard',[MEAN]:'hard',[POW]:'hard'});
  for(const d of srcDeps){assert.ok(g.byId[d.prerequisiteId],'playable prerequisite '+d.prerequisiteId);assert.ok(d.topicId.startsWith('jane_'));}
  for(const t of g.topics)if(t.id.startsWith('mt_'))assert.ok(!g.pre[t.id].some(e=>e.id.startsWith('jane_')),t.id);
  // unlocks are the other direction of the same edges
  assert.deepEqual(g.post[MM.compound].map(e=>e.id).sort(),[MM.real,MM.pv,MM.geo].sort());
  assert.ok(g.post[PCT12].some(e=>e.id===MM.compound)&&g.post[MEAN].some(e=>e.id===MM.geo));});

test('new topics start unmastered and unlock through the normal ready/locked rules',()=>{
  const S=E.blank();for(const id of Object.values(MM)){assert.equal(S.ts[id],undefined);assert.equal(E.stateOf(S,g,id,now),'locked');}
  master(S,PCT12);assert.equal(E.stateOf(S,g,MM.compound,now),'locked','powers still needed');
  master(S,POW);assert.equal(E.stateOf(S,g,MM.compound,now),'ready','soft prerequisites do not block');
  assert.equal(E.stateOf(S,g,MM.r72,now),'locked','needs Calculating Percentages');master(S,MM.compound);
  for(const id of[MM.real,MM.pv])assert.equal(E.stateOf(S,g,id,now),'ready',id);
  assert.equal(E.stateOf(S,g,MM.geo,now),'locked','needs the mean');master(S,MEAN);assert.equal(E.stateOf(S,g,MM.geo,now),'ready');
  // the trail and the map payload reach them
  const n=E.nextTrailTopic(S,g,'Life Skills',MM.compound,now);assert.equal(n.domain,'Money Math');
  const m=E.mapPayload(S,g,now);assert.equal(m.codes.length,g.topics.length);assert.equal(m.progress.by['Life Skills'].total,g.topics.filter(t=>t.subject==='Life Skills').length);});

test('adding Jane topics leaves Marble tiers, bosses and campaign state as they were',()=>{
  const d=tmpDir('jane-mm-');
  try{for(const p of['build.mjs','lib-regions.mjs','lib-jane-topics.mjs','prototype/server.js','vendor/entry.mjs','data'])fs.cpSync(path.join(ROOT,p),path.join(d,p),{recursive:true});
    for(const p of['src','public'])fs.mkdirSync(path.join(d,p),{recursive:true});fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(d,'node_modules'));
    fs.rmSync(path.join(d,'data/jane'),{recursive:true});fs.rmSync(path.join(d,'data/kid-prompts/b12.txt'));
    const r=spawnSync(process.execPath,['build.mjs'],{cwd:d,encoding:'utf8',env:{...process.env,HIDE_REGIONS:(tax.hidden?.regions||[]).join(',')}});assert.equal(r.status,0,r.stderr);
    const base=JSON.parse(fs.readFileSync(path.join(d,'public/tax.json'),'utf8'));
    assert.equal(base.topics.length,tax.topics.length-src.length);base.topics.forEach((t,i)=>assert.deepEqual(tax.topics[i],t,t.id));
    const g0=E.graph(base);assert.deepEqual([...g.boss].filter(id=>!id.startsWith('jane_')).sort(),[...g0.boss].sort(),'same boss topics');
    const S=E.blank();S.questMedals=Array.from({length:11},(_,i)=>({date:`2026-10-${String(i+10)}`,name:'Q'+i,emoji:'🏅',title:'Q'+i,at:now-(20-i)*DAY}));
    S.medals=[{id:[...g0.boss][0],tier:'legendary',at:now-DAY}];assert.deepEqual(E.campaignState(S,g),E.campaignState(S,g0));}
  finally{fs.rmSync(d,{recursive:true,force:true});}});

test('a quest stage can target a Jane topic (publish-lessons accepts it)',()=>{const p=example();p.topics[3].topicId=MM.r72;
  const r=validate(p);assert.equal(r.status,0,r.stderr+r.stdout);});

test('the loader rejects mt_ ids, Marble collisions, unknown subjects, Marble→Jane edges and cycles',()=>{
  const ok=src[0],T=x=>({topics:x}),run=(topics,deps=[])=>{const d=tmpDir('jane-bad-');try{fs.mkdirSync(path.join(d,'data/jane'),{recursive:true});
    fs.writeFileSync(path.join(d,'data/jane/topics.json'),JSON.stringify(T(topics)));fs.writeFileSync(path.join(d,'data/jane/dependencies.json'),JSON.stringify({dependencies:deps}));
    return loadJaneTopics(d,marble);}finally{fs.rmSync(d,{recursive:true,force:true});}};
  assert.equal(run([ok]).janeTopics.length,1);
  assert.throws(()=>run([{...ok,id:'mt_abc'}]),/must start with jane_/);
  assert.throws(()=>run([{...ok,subject:'Wizardry'}]),/not a Marble subject/);
  assert.throws(()=>run([ok,ok]),/duplicate id/);
  assert.throws(()=>run([{...ok,standards:['made up']}]),/standards/);
  const e=(a,b)=>({topicId:a,prerequisiteId:b,strength:'hard',reason:'r'});
  assert.throws(()=>run([ok],[e(PCT12,ok.id)]),/Marble topic may not depend on a Jane topic/);
  assert.throws(()=>run([ok],[e(ok.id,'mt_nope')]),/unknown prerequisite/);
  const b={...ok,id:'jane_b'};assert.throws(()=>run([ok,b],[e(ok.id,b.id),e(b.id,ok.id)]),/cycle/);});

test('research.mjs knows Jane topics (no Marble research for them)',async()=>{const R=await import('../research.mjs');R.reset();
  const d=R.briefData(MM.compound);assert.equal(d.known,true);assert.equal(d.status,'playable');assert.equal(d.research,false);assert.equal(d.subject,'Life Skills');});

test('the Money Models path (business math, after FounderOS designing-money-models) sits on Life Skills with valid prerequisites',()=>{
  const ids=Object.values(MOD);assert.deepEqual(src.slice(5).map(t=>t.id),ids,'source order');
  assert.deepEqual(src.slice(5).map(t=>[t.ageRangeStart,t.ageRangeEnd]),[[9,12],[9,12],[10,13],[11,14],[11,14]]);
  for(const t of src.slice(5)){assert.match(t.description,/FounderOS — designing-money-models/,t.id+' credits its source');assert.equal(t.domain,'Money Models');}
  for(const id of ids){const t=g.byId[id];assert.equal(t.subject,'Life Skills');assert.equal(t.ic,'🍋');assert.ok(t.kq&&t.ka&&t.kw?.length===2,id);}
  assert.deepEqual(pre(MOD.profit),{[COSTREV]:'hard',[MONEYWP]:'hard',[MKT]:'soft'});
  assert.deepEqual(pre(MOD.payback),{[MOD.profit]:'hard',[MDWP]:'hard'});
  assert.deepEqual(pre(MOD.ladder),{[MOD.profit]:'hard',[CALCPCT]:'hard'});
  assert.deepEqual(pre(MOD.price),{[MOD.profit]:'hard',[MOD.ladder]:'hard'});
  assert.deepEqual(pre(MOD.billing),{[MOD.profit]:'hard',[MDWP]:'hard',[CALCPCT]:'hard',[CAL]:'soft'});
  assert.ok(g.byId[CALCPCT].ageRangeStart<12,'the percent prerequisite is a ~10-11 topic, not Percentages (age 12+)');
  // unlocks: a fresh learner has every stone locked; Costs & Revenue + Money word problems open the first one
  const S=E.blank();for(const id of ids)assert.equal(E.stateOf(S,g,id,now),'locked',id);
  master(S,COSTREV);master(S,MONEYWP);assert.equal(E.stateOf(S,g,MOD.profit,now),'ready');
  master(S,MOD.profit);assert.equal(E.stateOf(S,g,MOD.payback,now),'locked');master(S,MDWP);assert.equal(E.stateOf(S,g,MOD.payback,now),'ready');
  master(S,CALCPCT);assert.equal(E.stateOf(S,g,MOD.ladder,now),'ready');assert.equal(E.stateOf(S,g,MOD.price,now),'locked');assert.equal(E.stateOf(S,g,MOD.billing,now),'ready');
  master(S,MOD.ladder);assert.equal(E.stateOf(S,g,MOD.price,now),'ready');
  assert.equal(E.nextTrailTopic(S,g,'Life Skills',MOD.profit,now).domain,'Money Models');});

test('the Rule of 72 unlocks early: Calculating Percentages alone opens it, before Compound growth (approved 2026-11-01)',()=>{
  assert.ok(g.post[CALCPCT].some(e=>e.id===MM.r72&&e.h),'Calculating Percentages unlocks it');
  assert.ok(!g.pre[MM.r72].some(e=>e.id===MM.compound)&&!g.pre[MM.compound].some(e=>e.id===MM.r72),'no edge either way, so mastering one never credits the other');
  const r72=src.find(t=>t.id===MM.r72);assert.equal(r72.ageRangeStart,10,'a 5th-grade (age 10) topic');assert.match(r72.description,/double/);
  // a learner who has only basic percentages: the Rule of 72 is ready, the rest of Money Math stays locked
  const S=E.blank();master(S,CALCPCT);assert.equal(E.stateOf(S,g,MM.r72,now),'ready');
  for(const id of[MM.compound,MM.real,MM.pv,MM.geo])assert.equal(E.stateOf(S,g,id,now),'locked',id);
  // a mastered prerequisite that is due for review still counts
  S.ts[CALCPCT].due=now-DAY;assert.equal(E.stateOf(S,g,CALCPCT,now),'review');assert.equal(E.stateOf(S,g,MM.r72,now),'ready');
  // an inferred (not direct) percentages mastery counts too, like every other hard prerequisite
  const S2=E.blank();S2.ts[CALCPCT]={st:'mastered',how:'inferred',conf:.8,box:2,due:now+9*DAY,at:now};assert.equal(E.stateOf(S2,g,MM.r72,now),'ready');
  // mastering the Rule of 72 leaves Compound growth unmastered and locked
  master(S,MM.r72);assert.equal(S.ts[MM.compound],undefined);assert.equal(E.stateOf(S,g,MM.compound,now),'locked');
  // a quest or the map can reach it once ready
  assert.equal(E.mapPayload(S,g,now).codes[g.topics.findIndex(t=>t.id===MM.compound)],'x');});

test('money topics carry verified curriculum standards (Common Core math, Jump$tart 2021); none invented',()=>{
  const want={
    [MM.compound]:['ccss-math:7.RP.3','ccss-math:7.EE.2','ccss-math:HSA-SSE.A.1b','ccss-math:HSF-LE.A.1c','ccss-math:HSF-LE.A.2','jumpstart-2021:Saving-8-5a','jumpstart-2021:Saving-8-5b','jumpstart-2021:Investing-8-7a','jumpstart-2021:Investing-8-7b'],
    [MM.r72]:['jumpstart-2021:Saving-8-4c'],
    [MM.real]:['ccss-math:7.RP.3','ccss-math:7.EE.2','jumpstart-2021:Saving-12-4b','jumpstart-2021:Investing-12-4a','jumpstart-2021:Investing-12-4b'],
    [MM.pv]:['ccss-math:HSA-SSE.A.1b'],
    [MM.geo]:['ccss-math:7.EE.2','ccss-math:HSF-LE.A.1a'],
    [MOD.profit]:['ccss-math:4.OA.3','jumpstart-2021:EarningIncome-4-4c'],
    [MOD.payback]:['ccss-math:4.OA.3','ccss-math:6.RP.3b'],
    [MOD.ladder]:['ccss-math:6.RP.3c'],
    [MOD.price]:['ccss-math:7.EE.3','jumpstart-2021:EarningIncome-4-4c'],
    [MOD.billing]:['ccss-math:6.RP.3b','ccss-math:6.RP.3d','ccss-math:7.RP.3']};
  for(const t of src)assert.deepEqual(t.standards,want[t.id]||[],t.id);
  // code shapes: CCSS K-8 in Marble's short form (no cluster letter), high school with its cluster; Jump$tart area-grade-standard+outcome
  const CCSS=/^ccss-math:(?:[3-8]\.(?:OA|RP|EE)\.\d+[a-e]?|HS[AF]-(?:SSE|LE)\.[A-B]\.\d+[a-e]?)$/,JS=/^jumpstart-2021:(?:Saving|Investing|EarningIncome|Spending|ManagingCredit|ManagingRisk)-(?:4|8|12)-\d+[a-z]$/;
  for(const t of src)for(const c of t.standards)assert.ok(CCSS.test(c)||JS.test(c),`${t.id}: ${c}`);
  // the Jump$tart outcome's grade matches its standard number (8-4c is a grade 8 outcome)
  for(const t of src)for(const c of t.standards.filter(c=>c.startsWith('jumpstart-2021:'))){const [,gr,std]=c.match(/-(\d+)-(\d+)[a-z]$/);assert.ok(Number(gr)>=4&&Number(std)>=1,c);}
  // the build still accepts them (Marble's source:code rule)
  assert.equal(loadJaneTopics(ROOT).janeTopics.length,src.length);});
