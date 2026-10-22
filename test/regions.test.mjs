// Household region filter: data/regions/<CODE>.txt tags region-specific topics; HIDE_REGIONS (env, or [vars] in
// wrangler.toml) leaves them out of public/tax.json like pending topics. Default: every topic plays. Progress and
// medals on a hidden topic are kept; the app, the export's frontier and publish-lessons never offer the topic.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {ROOT,tmpDir} from './helpers.mjs';import {regionTags,hideRegionsSetting,checkRegionFilter} from '../lib-regions.mjs';
const J=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const upstream=J(path.join(ROOT,'data/marble/topics.json')).topics,byUp=Object.fromEntries(upstream.map(t=>[t.id,t]));
const AU=regionTags(ROOT).AU,auIds=[...AU.keys()];
const pending=new Set(fs.readFileSync(path.join(ROOT,'data/kid-prompts/PENDING.txt'),'utf8').split('\n').map(l=>l.replace(/#.*/,'').trim()).filter(Boolean));
function scratch(){const d=tmpDir('jane-reg-');for(const p of['build.mjs','lib-regions.mjs','lib-cli.mjs','export-progress.mjs','publish-lessons.mjs','prototype/server.js','vendor/entry.mjs','data','src','server','packs/examples'])fs.cpSync(path.join(ROOT,p),path.join(d,p),{recursive:true});
  fs.mkdirSync(path.join(d,'public'),{recursive:true});fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(d,'node_modules'));return d;}
const clean=env=>{const e={...process.env,...env};for(const k of Object.keys(e))if(e[k]===undefined)delete e[k];return e;};
const run=(d,args,env={})=>spawnSync(process.execPath,args,{cwd:d,encoding:'utf8',env:clean({HIDE_REGIONS:undefined,...env})});
// two builds shared by the tests below: default (nothing hidden) and HIDE_REGIONS=AU
const D=scratch(),DEF=(()=>{const r=run(D,['build.mjs'],{HIDE_REGIONS:''});assert.equal(r.status,0,r.stderr);return J(path.join(D,'public/tax.json'));})();
const D2=scratch(),HID=(()=>{const r=run(D2,['build.mjs'],{HIDE_REGIONS:'au'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/regions: hiding AU/);return J(path.join(D2,'public/tax.json'));})();
process.on('exit',()=>{for(const d of [D,D2])fs.rmSync(d,{recursive:true,force:true});});

test('the AU tag list names real, Australian-Curriculum-only topics, each with a reason',()=>{
  assert.ok(auIds.length>=20,'tagged '+auIds.length);
  for(const id of auIds){const t=byUp[id];assert.ok(t,'exists upstream: '+id);assert.match(AU.get(id),/ — \S/,'reason for '+id);
    assert.ok((t.standards||[]).length&&t.standards.every(s=>s.startsWith('acara-v9:')),`${id} is aligned only to the Australian Curriculum`);}});
test('default: no region is hidden and every tagged, non-pending topic plays',()=>{
  assert.deepEqual(DEF.hidden,{regions:[],topics:[]});const ids=new Set(DEF.topics.map(t=>t.id));
  for(const id of auIds)if(!pending.has(id))assert.ok(ids.has(id),id);});
test('HIDE_REGIONS=AU: tagged topics are out of the topics and the prerequisite graph, and listed as hidden',()=>{
  const ids=new Set(HID.topics.map(t=>t.id)),au=new Set(auIds);assert.deepEqual(HID.hidden.regions,['AU']);
  for(const id of auIds)assert.ok(!ids.has(id),id);for(const [a,b] of HID.deps)assert.ok(!au.has(a)&&!au.has(b),`${a}→${b}`);
  assert.deepEqual(HID.hidden.topics.map(t=>t.id).sort(),auIds.filter(id=>!pending.has(id)).sort());
  assert.equal(HID.topics.length+HID.hidden.topics.length,DEF.topics.length);
  for(const h of HID.hidden.topics){assert.deepEqual(h.regions,['AU']);assert.ok(h.sn&&h.ic&&h.tier,'medal display fields');assert.equal(h.kq,undefined,'not playable');}});
test('HIDE_REGIONS=AU: the graph is reconnected around hidden topics (every path kept, acyclic) and tiers do not move',()=>{
  const pre=T=>{const p={};for(const [a,b] of T.deps)(p[a]??=[]).push(b);return p;};const P0=pre(DEF),P1=pre(HID),au=new Set(auIds);
  const reach=(P,id)=>{const s=new Set(),st=[...(P[id]||[])];while(st.length){const x=st.pop();if(s.has(x))continue;s.add(x);st.push(...(P[x]||[]));}return s;};
  for(const t of HID.topics){const r1=reach(P1,t.id);assert.ok(!r1.has(t.id),'cycle at '+t.id);for(const p of reach(P0,t.id))if(!au.has(p))assert.ok(r1.has(p),`${t.id} lost prerequisite ${p}`);}
  const tier=Object.fromEntries(DEF.topics.map(t=>[t.id,t.tier]));for(const t of HID.topics)assert.equal(t.tier,tier[t.id],t.id);});
test('the setting comes from HIDE_REGIONS or [vars] in wrangler.toml; an unknown region fails the build',()=>{const d=scratch();
  try{fs.writeFileSync(path.join(d,'wrangler.toml'),'name = "x"\n[vars]\nLEARNER_AGE = "10"\nHIDE_REGIONS = "AU"\n\n[assets]\ndirectory = "./public"\n');
    const s=(env)=>{const was=process.env.HIDE_REGIONS;delete process.env.HIDE_REGIONS;Object.assign(process.env,env);try{return hideRegionsSetting(d);}finally{delete process.env.HIDE_REGIONS;if(was!==undefined)process.env.HIDE_REGIONS=was;}};
    assert.deepEqual(s({}).codes,['AU']);assert.match(s({}).source,/wrangler\.toml/);assert.deepEqual(s({HIDE_REGIONS:''}).codes,[],'env overrides');
    let r=run(d,['build.mjs']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/hiding AU \(\[vars\] HIDE_REGIONS in wrangler.toml\)/);
    r=run(d,['build.mjs'],{HIDE_REGIONS:'ZZ'});assert.notEqual(r.status,0);assert.match(r.stderr,/no data\/regions\/ZZ\.txt/);}
  finally{fs.rmSync(d,{recursive:true,force:true});}});
test('nightly tools refuse a tax.json built with a different setting',()=>{
  const was=process.env.HIDE_REGIONS;delete process.env.HIDE_REGIONS;
  try{assert.deepEqual(checkRegionFilter(HID,'/nonexistent'),['AU'],'nothing configured: trust the build');
    process.env.HIDE_REGIONS='';assert.throws(()=>checkRegionFilter(HID,'/nonexistent'),/built with HIDE_REGIONS="AU".*Run: npm run build/);}
  finally{delete process.env.HIDE_REGIONS;if(was!==undefined)process.env.HIDE_REGIONS=was;}
  const r=run(D2,['export-progress.mjs','--local','--out',path.join(D2,'x.json')],{HIDE_REGIONS:'',DATA_DIR:path.join(D2,'data-empty')});
  assert.notEqual(r.status,0);assert.match(r.stderr,/built with HIDE_REGIONS="AU"/);});
test('publish-lessons rejects a hidden topic with a clear reason',()=>{const id=auIds.find(i=>!pending.has(i));
  const pack=J(path.join(ROOT,'packs/examples/example-quest.json'));pack.topics[0].topicId=id;const f=path.join(D2,'p.json');fs.writeFileSync(f,JSON.stringify(pack));
  const r=run(D2,['publish-lessons.mjs',f,'--dry-run','--offline'],{HIDE_REGIONS:'AU'});assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/is hidden in this household \(HIDE_REGIONS=AU\)/);});
test('a learner with progress on a hidden topic keeps it and its medal, and is never offered the topic',async()=>{
  const E=await import(path.join(D2,'src/engine.js'));E.configure({LEARNER_AGE:'10'});const g=E.graph(HID),now=Date.parse('2026-03-02T18:00:00Z');
  const h=HID.hidden.topics.find(t=>t.subject==='History'),S=E.blank();S.firstDone=true;
  S.ts[h.id]={st:'mastered',how:'direct',c:3,conf:.9,box:0,due:now-864e5,at:now-9e8};S.medals=[{id:h.id,tier:h.tier,at:now-9e8}];
  const M=E.migrate(JSON.parse(JSON.stringify(S)),g);assert.equal(M.ts[h.id].st,'mastered','progress kept');assert.equal(M.medals.length,1,'medal kept');
  const tr=E.trophies(M,g);assert.ok(JSON.stringify(tr).includes(h.id),'medal still listed');
  assert.equal(E.summary(M,g,now).total,HID.topics.length,'left out of the total');
  for(let i=0;i<300;i++){const f=E.pickFocus(M,g,null,now);assert.ok(g.byId[f]&&f!==h.id);}
  assert.notEqual(E.spotPick(M,g),h.id);
  let X=JSON.parse(JSON.stringify(M));for(let i=0;i<40;i++){const it=E.next(X,g,null,now+i*6e4);const id=it?.topicId||X.current?.topicId;assert.notEqual(id,h.id,'never served');if(X.current)E.skip?.(X,g,null,now+i*6e4);}});
