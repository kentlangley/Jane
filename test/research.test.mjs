// Slice 4 (#40): research.mjs turns Marble's teaching research into a short, author-facing brief (learn first; learn
// constraints override pedagogy/assess), export-progress.mjs attaches compact briefs for the topics tonight's pack is
// likely to touch, and the research never reaches public/, the Worker bundle or the Docker image.
// Fixtures are the research file itself (vendored, public upstream data) and synthetic progress: no learner data.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {ROOT,tmpDir} from './helpers.mjs';
import * as R from '../research.mjs';
const J=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const EIGHTHS='mt_SBkTGjiZjZ',TRIANGLE='mt_ML5t7n2-U8',MOON='mt_4V-vYhFUcm',ENGLISH='mt_scBgiMKhG_';
const upstream=J(path.join(ROOT,'data/marble/topics.json')).topics;
const pendingIds=fs.readFileSync(path.join(ROOT,'data/kid-prompts/PENDING.txt'),'utf8').split('\n').map(l=>l.replace(/#.*/,'').trim()).filter(Boolean);
// run with a temporary environment, then restore it and the module's caches
function withEnv(env,fn){const was={};for(const k of Object.keys(env)){was[k]=process.env[k];if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}R.reset();
  try{return fn();}finally{for(const k of Object.keys(env)){if(was[k]===undefined)delete process.env[k];else process.env[k]=was[k];}R.reset();}}
const sections=t=>[...t.matchAll(/^## (.+)$/gm)].map(m=>m[1]);

test('the three example topics: learn first, every field present, under the size caps',()=>{
  for(const id of [EIGHTHS,TRIANGLE,MOON]){const t=R.briefText(id),d=R.briefData(id),c=R.briefCompact(id);
    assert.equal(d.research,true,id);assert.ok(t.length<=R.BRIEF_MAX,`${id}: ${t.length}`);assert.ok(JSON.stringify(c).length<=R.COMPACT_MAX,id);
    const s=sections(t);assert.match(s[0],/^Constraints \(learn/,id+': constraints come first');
    for(const want of [/^Summary \(learn\)/,/^Top misconceptions/,/^Error patterns → next move/,/^Diagnostic \(/,/^Response levels/,/^Key activities → intended insight/])assert.ok(s.some(x=>want.test(x)),`${id}: ${want}`);
    assert.match(t,/revealed by: /);assert.match(t,/next move: /);assert.match(t,/^gap: .+$/m);assert.match(t,/^full: .+$/m);
    assert.match(t,/filters: pending topics .* are respected/);assert.match(t,/not empirically validated/);
    assert.ok(d.constraints.length&&d.misconceptions.length&&d.errorPatterns.length&&d.activities.length&&d.diagnosticPrompt&&d.responseLevels,id);
    assert.ok(c.constraints.length&&c.errorPatterns.length&&c.cmd.includes(id),id);}
  const e=R.briefText(EIGHTHS);assert.match(e,/^# Research brief: Decimals and fractions/m);assert.match(e,/0\.375/);});

test('prerequisite re-teach ids come with their titles',()=>{
  const t=R.briefText(TRIANGLE);assert.match(t,/re-teach first: mt_eiB3-6pu6a "Area and perimeter of rectangles"/);
  const d=R.briefData(EIGHTHS);const r=d.errorPatterns.map(e=>e.reteach).filter(Boolean);assert.ok(r.length);
  for(const x of r)assert.equal(x.title,upstream.find(t=>t.id===x.id).name);
  assert.match(R.briefCompact(TRIANGLE).errorPatterns.map(e=>e.reteach||'').join(' '),/mt_eiB3-6pu6a Area and perimeter of rectangles/);});

test('learn wins: the Moon "points away" advice that learn forbids is dropped from assess and flagged',()=>{
  const raw=J(path.join(ROOT,'data/marble/teaching-research.json')).records.find(r=>r.topicId===MOON);
  assert.match(raw.assess.errorPatterns[0].nextMove,/points AWAY/,'fixture still has the conflict');assert.match(raw.learn.constraints.join(' '),/do not teach that Earth's shadow 'points away'/);
  const d=R.briefData(MOON),t=R.briefText(MOON);
  assert.doesNotMatch(d.errorPatterns[0].nextMove,/points away/i);assert.doesNotMatch(d.responseLevels.full,/points away/i);
  assert.match(d.errorPatterns[0].nextMove,/own unlit side/,'the rest of the next move stays');
  assert.ok(d.conflicts.some(c=>c.strong&&c.where==='assess.errorPatterns[0].nextMove'&&c.phrase==='points away'));
  assert.match(t,/## ⚠ learn vs pedagogy\/assess\n- dropped from assess\.errorPatterns\[0\]\.nextMove: "the Earth's shadow points AWAY into space;"/);
  assert.match(t,/check assess\.responseLevels\.full: it uses '~28-day cycle'/,'a caution is flagged, not dropped');
  assert.ok(R.briefCompact(MOON).conflicts.length>=2);
  // the rule is narrow: text that only warns against a phrase is left alone
  const ph=[{phrase:'points away',constraint:0,strong:true}];
  assert.equal(R.applyLearn("Never say the shadow 'points away'.",ph).hits.length,0);
  assert.equal(R.applyLearn('It is wrong that the shadow points away.',ph).hits.length,0);
  assert.deepEqual(R.forbiddenPhrases(["Introduce 'amplitude' only informally; do not demand measurement.","Use 'fewer' with identical objects."]),[],'quoted vocabulary is not a prohibition');});

test('no conflict false positives across the whole research file (spot-reviewed list)',()=>{
  const recs=J(path.join(ROOT,'data/marble/teaching-research.json')).records;const drops=[];
  for(const r of recs)for(const c of R.briefData(r.topicId).conflicts)if(c.strong)drops.push(`${r.topicId}:${c.phrase}`);
  // reviewed by hand: both are the Moon "points away" conflict. A new one needs a look before it is added here.
  assert.deepEqual(drops.sort(),['mt_4V-vYhFUcm:points away','mt_4V-vYhFUcm:points away']);});

test('size cap: every brief fits, and a small cap trims best practices first and never the constraints',()=>{
  const recs=J(path.join(ROOT,'data/marble/teaching-research.json')).records;
  for(const r of recs){assert.ok(R.briefText(r.topicId,{all:true}).length<=R.BRIEF_MAX,r.topicId);assert.ok(JSON.stringify(R.briefCompact(r.topicId)).length<=R.COMPACT_MAX,r.topicId);}
  const full=R.briefText(TRIANGLE,{max:1e6}),small=R.briefText(TRIANGLE,{max:2500});
  assert.ok(full.length>R.BRIEF_MAX,'the uncut triangle brief is over the default cap');assert.ok(small.length<=2500);
  assert.match(small,/## Constraints/);assert.doesNotMatch(small,/## Best practices/);
  assert.ok(R.briefText(TRIANGLE,{max:300}).length<=300);assert.ok(JSON.stringify(R.briefCompact(TRIANGLE,{max:1200})).length<=1200);});

test('topics without research say "no research": English, and anything when the research file is absent',()=>{
  assert.ok(R.researchAvailable());
  const t=R.briefText(ENGLISH);assert.match(t,/^no research: .*Science and Mathematics only; this is English$/m);assert.equal(R.briefData(ENGLISH).research,false);
  const e=upstream.filter(t=>t.subject==='English');assert.ok(e.length>50);for(const x of e)assert.equal(R.briefData(x.id).research,false,x.id);
  assert.equal(R.briefCompact(ENGLISH).research,false);
  withEnv({RESEARCH_FILE:'/nonexistent/teaching-research.json'},()=>{assert.equal(R.researchAvailable(),false);
    assert.match(R.briefText(TRIANGLE),/no research: research file not available here/);
    const s=R.nightlyResearch([['frontier',[TRIANGLE]]]);assert.equal(s.available,false);assert.deepEqual(s.briefs,{});});
  const u=spawnSync(process.execPath,['research.mjs','mt_notAtopic'],{cwd:ROOT,encoding:'utf8'});assert.equal(u.status,1);assert.match(u.stdout,/not a Marble topic id/);
  assert.equal(spawnSync(process.execPath,['research.mjs'],{cwd:ROOT,encoding:'utf8'}).status,2);});

test('pending and hidden-region topics get a notice instead of a brief, and the output names the filters',()=>{
  const p=pendingIds[0];const t=R.briefText(p);assert.match(t,/status: PENDING \(not playable yet: .+\)\. Do not put it in a pack\./);assert.match(t,/brief not shown/);
  assert.match(R.briefText(p,{all:true}),/Do not put it in a pack/);
  withEnv({HIDE_REGIONS:'AU'},()=>{const au=fs.readFileSync(path.join(ROOT,'data/regions/AU.txt'),'utf8').split('\n').map(l=>l.replace(/#.*/,'').trim()).filter(Boolean).find(id=>!pendingIds.includes(id));
    const h=R.briefText(au);assert.match(h,/HIDDEN in this household \(HIDE_REGIONS=AU\)/);assert.match(h,/hidden regions \(HIDE_REGIONS=AU\) are respected/);assert.match(h,/brief not shown/);
    assert.equal(R.briefCompact(au).status,'hidden');
    const s=R.nightlyResearch([['needsSupport',[au,p,TRIANGLE]]]);assert.deepEqual(Object.keys(s.briefs),[TRIANGLE],'only playable topics get briefs');});});

test('nightly section: priority order, reasons merged, bounded size, overflow kept as pointers',()=>{
  const recs=J(path.join(ROOT,'data/marble/teaching-research.json')).records.map(r=>r.topicId).filter(id=>R.briefData(id).status==='playable');
  const s=R.nightlyResearch([['needsSupport',[MOON]],['questRefresh',[MOON,TRIANGLE]],['frontier',recs.slice(0,60)]]);
  assert.deepEqual(s.briefs[MOON].for,['needsSupport','questRefresh']);assert.equal(Object.keys(s.briefs)[0],MOON);
  assert.ok(Object.keys(s.briefs).length<=R.NIGHTLY_MAX_BRIEFS);assert.ok(JSON.stringify(s.briefs).length<=R.NIGHTLY_MAX_CHARS+200);
  assert.ok(s.pointers.length>0&&s.pointers.every(x=>x.id&&x.title&&x.for));assert.match(s.tool,/npm run research -- <topicId>/);
  assert.match(J(path.join(ROOT,'package.json')).scripts.research,/^node research\.mjs$/);});

test('export-progress attaches briefs for needsSupport and frontier topics, and still exports without research',()=>{
  const d=tmpDir('jane-research-');try{
    const tax=J(path.join(ROOT,'public/tax.json'));const id=tax.topics.find(t=>t.id===TRIANGLE)?TRIANGLE:EIGHTHS;
    // synthetic learner: nothing mastered, got stuck twice on one maths topic
    fs.writeFileSync(path.join(d,'progress.json'),JSON.stringify({v:2,ts:{},support:{[id]:{stuck:2,skipped:0,at:Date.parse('2026-03-02T18:00:00Z')}}}));
    const run=env=>{const out=path.join(d,'x.json');const r=spawnSync(process.execPath,['export-progress.mjs','--local','--out',out,'--date','2026-03-02'],{cwd:ROOT,encoding:'utf8',env:{...process.env,DATA_DIR:d,LEARNER_AGE:'10',...env}});
      assert.equal(r.status,0,r.stderr);return{x:J(out),stdout:r.stdout,size:fs.statSync(out).size};};
    const a=run({});assert.equal(a.x.research.available,true);assert.match(a.stdout,/📚 research briefs: \d+ attached/);
    assert.ok(a.x.weakSpots.needsSupport.some(n=>n.topicId===id));assert.deepEqual(a.x.research.briefs[id].for.slice(0,1),['needsSupport']);
    assert.ok(Object.values(a.x.research.briefs).some(b=>b.for.includes('frontier')));
    assert.ok(a.x.frontier.some(t=>t.research===true)&&a.x.frontier.every(t=>t.research===undefined||R.briefData(t.id).research));
    assert.ok(JSON.stringify(a.x.research).length<=R.NIGHTLY_MAX_CHARS+8000,'section stays bounded');
    const b=run({RESEARCH_FILE:'/nonexistent/teaching-research.json'});assert.equal(b.x.research.available,false);assert.deepEqual(b.x.research.briefs,{});
    assert.ok(!b.x.frontier.some(t=>t.research));assert.ok(a.size-b.size<64000,`adds ${a.size-b.size} bytes`);
  }finally{fs.rmSync(d,{recursive:true,force:true});}});

test('the research never reaches public/, the Worker bundle or the Docker image',async()=>{
  const recs=J(path.join(ROOT,'data/marble/teaching-research.json')).records;const moon=recs.find(r=>r.topicId===MOON);
  // distinctive strings that exist only in the research file
  const marks=[moon.learn.constraints[2].slice(0,60),moon.assess.errorPatterns[0].nextMove.slice(0,60),recs[0].learn.summary.slice(0,60),'intendedInsight','whatMakesItDiscriminate','reteachPrerequisiteId'];
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  for(const f of walk(path.join(ROOT,'public'))){assert.ok(!/teaching-research|research\.mjs/.test(f),f);const s=fs.readFileSync(f,'latin1');for(const m of marks)assert.ok(!s.includes(m),`${path.relative(ROOT,f)} contains research: ${m}`);}
  for(const f of [...walk(path.join(ROOT,'src')),...walk(path.join(ROOT,'server'))]){const s=fs.readFileSync(f,'utf8');assert.ok(!/teaching-research|research\.mjs/.test(s),`${path.relative(ROOT,f)} references the research`);}
  const {build}=await import('esbuild');const r=await build({entryPoints:[path.join(ROOT,'src/worker.js')],bundle:true,write:false,format:'esm',platform:'neutral',logLevel:'silent',
    external:['__STATIC_CONTENT_MANIFEST','cloudflare:*','node:*']});const bundle=r.outputFiles.map(f=>f.text).join('');
  assert.ok(bundle.length>10000,'bundled the worker');for(const m of marks)assert.ok(!bundle.includes(m),`worker bundle contains research: ${m}`);
  const df=fs.readFileSync(path.join(ROOT,'Dockerfile'),'utf8');assert.doesNotMatch(df,/teaching-research|research\.mjs/);
  assert.match(fs.readFileSync(path.join(ROOT,'.dockerignore'),'utf8'),/^data\/marble\/teaching-research\.json$/m);});
