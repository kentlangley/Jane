// Slice 2 (#38): the vendored Marble taxonomy (os-taxonomy a871973) is pinned, checksummed and kept out of public/,
// pending topics are left out of the app with the prerequisite graph bridged across them, and progress keyed by topic
// id survives: removed ids fold into their replacement (data/topic-aliases.json) without losing mastery or medals.
// Optional local-only checks (never committed data): JANE_UPGRADE_EXPORT=<progress export json> and
// JANE_PACKS_DIR=<dir with pack json files> (default: packs/ and packs/examples/).
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {ROOT,loadEngine} from './helpers.mjs';
const {E,g}=await loadEngine();const M=path.join(ROOT,'data/marble');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');const J=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const PIN='a8719737ff86ef7940ba5feca11940de1204103e';
const upstream=J(path.join(M,'topics.json')).topics,manifest=J(path.join(M,'manifest.json'));
const aliases=J(path.join(ROOT,'data/topic-aliases.json')).aliases;
const pending=new Set(fs.readFileSync(path.join(ROOT,'data/kid-prompts/PENDING.txt'),'utf8').split('\n').map(l=>l.replace(/#.*/,'').trim()).filter(Boolean));
const resolve=id=>g.byId[id]?id:g.byId[aliases[id]]?aliases[id]:null;
const mastered=S=>Object.values(S.ts).filter(r=>r.st==='mastered').length;
const copy=o=>JSON.parse(JSON.stringify(o));

test('data/marble is the pinned upstream commit and its manifest checksums pass',()=>{
  assert.match(fs.readFileSync(path.join(M,'UPSTREAM'),'utf8'),new RegExp('^commit: '+PIN+'$','m'));
  const skip=new Set(['curriculum-standards.json','clusters.json']);// not vendored (listed in UPSTREAM); curriculum standards carry third-party terms
  let n=0;for(const [f,{bytes,sha256}] of Object.entries(manifest.files)){const p=path.join(M,f);
    if(skip.has(f)){assert.ok(!fs.existsSync(p),f+' stays out');assert.match(fs.readFileSync(path.join(M,'UPSTREAM'),'utf8'),new RegExp('not vendored:.*'+f.replace('.','\\.')));continue;}
    assert.ok(fs.existsSync(p),f);assert.equal(fs.statSync(p).size,bytes,f+' bytes');assert.equal(sha(p),sha256,f+' sha256');n++;}
  assert.equal(n,4,'topics, dependencies, teaching research, archive');
  assert.equal(upstream.length,manifest.counts.topics);assert.equal(J(path.join(M,'dependencies.json')).dependencies.length,manifest.counts.dependencies);
  assert.equal(J(path.join(M,'teaching-research.json')).topicFileSha256,sha(path.join(M,'topics.json')),'research is bound to this topics.json');});

test('teaching research stays offline: nothing of it under public/ or in tax.json',()=>{
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[e.name]);
  assert.ok(!walk(path.join(ROOT,'public')).some(f=>/teaching-research|curriculum-standards/.test(f)));
  const tax=fs.readFileSync(path.join(ROOT,'public/tax.json'),'utf8');for(const k of['"pedagogy"','"commonMisconceptions"','"errorPatterns"','"learn":{'])assert.ok(!tax.includes(k),k);
  assert.ok(tax.length<3e6,'tax.json stays small');});

test('every upstream topic is either playable or explicitly pending; pending topics are not in the app',()=>{
  const ids=new Set(upstream.map(t=>t.id));for(const id of pending)assert.ok(ids.has(id),'pending id exists upstream: '+id);
  assert.equal(g.topics.length+pending.size,upstream.length);for(const t of g.topics){assert.ok(!pending.has(t.id));assert.ok(t.kq||t.self,t.id);}
  for(const id of pending)assert.equal(g.byId[id],undefined);});

test('the app graph only names playable topics, stays acyclic, and keeps every upstream prerequisite path',()=>{
  const deps=J(path.join(M,'dependencies.json')).dependencies;
  for(const t of g.topics)for(const e of g.pre[t.id])assert.ok(g.byId[e.id]);
  const anc=new Map();const up=id=>{if(anc.has(id))return anc.get(id);anc.set(id,null);const s=new Set();for(const e of g.pre[id]){assert.notEqual(anc.get(e.id),null,'cycle at '+e.id);s.add(e.id);for(const x of up(e.id))s.add(x);}anc.set(id,s);return s;};
  // upstream paths between two playable topics (possibly through pending ones) are still paths in the app graph
  const upPre={};for(const d of deps)(upPre[d.topicId]??=[]).push(d.prerequisiteId);
  for(const t of g.topics){const seen=new Set(),st=[...(upPre[t.id]||[])];while(st.length){const p=st.pop();if(seen.has(p))continue;seen.add(p);if(pending.has(p))st.push(...(upPre[p]||[]));else assert.ok(up(t.id).has(p),`${t.id} lost prerequisite ${p}`);}}});

test('aliases point from removed ids to playable topics',()=>{const ids=new Set(upstream.map(t=>t.id));
  assert.deepEqual(aliases,{'mt_3XJkeIn6J6':'mt_UNzojLkNdm'});for(const [a,b] of Object.entries(aliases)){assert.ok(!ids.has(a));assert.ok(g.byId[b]);}
  assert.deepEqual(g.aliases,aliases,'bundled in tax.json');});

test('synthetic progress: the merged topic folds forward, mastery and medals are kept, every id resolves, idempotent',()=>{
  const raw=J(path.join(ROOT,'test/fixtures/taxonomy-upgrade-progress.json')).progress;
  for(const id of Object.keys(raw.ts))assert.ok(resolve(id),'resolves: '+id);
  const S=E.migrate(copy(raw),g);
  assert.equal(S.ts.mt_3XJkeIn6J6,undefined);assert.equal(S.ts.mt_UNzojLkNdm.how,'direct','the stronger (direct) record wins');assert.equal(S.ts.mt_UNzojLkNdm.c,4);
  assert.equal(mastered(S),mastered(raw)-1,'two mastered records became one');
  assert.equal(S.medals.length,raw.medals.length,'medal kept');assert.deepEqual(S.medals.find(m=>m.id==='mt_UNzojLkNdm')?.tier,'silver');
  for(const id of [...Object.keys(S.ts),...S.medals.map(m=>m.id),...S.recent,S.focus,S.current.topicId,...S.requeue.map(x=>x.item.topicId),...Object.keys(S.support),...Object.keys(S.teach)])assert.ok(g.byId[id],'resolves directly: '+id);
  assert.equal(S.ts.mt_bESTSBB0wK.st,'mastered','scope-narrowed topic keeps its record');assert.equal(S.ts['mt_NSC3LT_-ch'].st,'learning','refocused topic keeps its record');
  assert.equal(S.ts.mt_HlNSurPVDp,undefined,'no credit invented for the split-off line-graph topic');
  const tro=E.trophies(S,g);assert.equal(tro.medals.length,raw.medals.length);
  assert.equal(JSON.stringify(E.migrate(copy(S),g)),JSON.stringify(S),'idempotent');});

test('an alias target that is already the stronger record is kept, and a lone old record just moves',()=>{
  const S=E.foldAliases({ts:{mt_3XJkeIn6J6:{st:'learning',how:'direct',c:1},mt_UNzojLkNdm:{st:'mastered',how:'direct',c:3}},medals:[]},aliases);
  assert.deepEqual(Object.keys(S.ts),['mt_UNzojLkNdm']);assert.equal(S.ts.mt_UNzojLkNdm.st,'mastered');
  const T=E.foldAliases({ts:{mt_3XJkeIn6J6:{st:'learning',how:'direct',c:1}},medals:[{id:'mt_3XJkeIn6J6',tier:'bronze',at:1}]},aliases);
  assert.deepEqual(T.ts,{mt_UNzojLkNdm:{st:'learning',how:'direct',c:1}});assert.equal(T.medals[0].id,'mt_UNzojLkNdm');});

const packDirs=(process.env.JANE_PACKS_DIR?[process.env.JANE_PACKS_DIR]:[path.join(ROOT,'packs'),path.join(ROOT,'packs/examples')]).filter(d=>fs.existsSync(d));
test(`every topic id in pack files resolves (${packDirs.length} dir(s))`,()=>{let n=0;
  for(const d of packDirs)for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.json'))){const p=J(path.join(d,f));if(!Array.isArray(p.topics))continue;
    for(const t of p.topics){for(const id of [t.topicId,...(t.teaches||[]),...(t.questions||[]).map(q=>q.skill).filter(Boolean)]){assert.ok(resolve(id),`${f}: ${id}`);n++;}}}
  assert.ok(n>0);});

test('local only: a copy of a real export migrates with no lost mastery (beyond alias folds) and no lost medals',{skip:!process.env.JANE_UPGRADE_EXPORT&&'set JANE_UPGRADE_EXPORT to run'},()=>{
  const ex=J(process.env.JANE_UPGRADE_EXPORT),raw=copy(ex.progress);
  const ids=new Set([...Object.keys(raw.ts),...raw.medals.map(m=>m.id),...(raw.recent||[]),raw.current?.topicId,raw.focus,raw.packFocus].filter(Boolean));
  for(const id of ids)assert.ok(resolve(id),'resolves: '+id);
  const folds=Object.entries(aliases).filter(([a,b])=>raw.ts[a]?.st==='mastered'&&raw.ts[b]?.st==='mastered').length;
  const S=E.migrate(copy(raw),g);assert.equal(mastered(S),mastered(raw)-folds);assert.equal(S.medals.length,raw.medals.length);
  assert.equal(E.trophies(S,g).medals.length,E.trophies(raw,g).medals.length);
  for(const id of Object.keys(S.ts))assert.ok(g.byId[id]);
  console.log(`# real export: mastered ${mastered(raw)} → ${mastered(S)} (alias folds ${folds}), medals ${raw.medals.length} → ${S.medals.length}, ids checked ${ids.size}`);});
