// Slice 1 (#37): kid prompts are keyed by topic id (`mt_id|question|right|wrong1|wrong2`), never by array position,
// so a reordered or extended topics.json keeps every question on its own topic.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {ROOT,tmpDir} from './helpers.mjs';
const DIR=path.join(ROOT,'data/kid-prompts'),files=fs.readdirSync(DIR).filter(f=>/^b\d+\.txt$/.test(f));
const lines=files.flatMap(f=>fs.readFileSync(path.join(DIR,f),'utf8').split('\n').filter(l=>l.trim()).map(l=>({f,l,p:l.split('|')})));
const topics=JSON.parse(fs.readFileSync(path.join(ROOT,'data/marble/topics.json'),'utf8')).topics,ids=new Set(topics.map(t=>t.id));
const tax=JSON.parse(fs.readFileSync(path.join(ROOT,'public/tax.json'),'utf8'));
// a scratch copy of the build inputs (node_modules linked) so build.mjs can run on modified data without touching the repo
function scratch(){const d=tmpDir('jane-kid-');for(const p of['build.mjs','migrate-kid-prompts.mjs','prototype/server.js','vendor/entry.mjs','data'])fs.cpSync(path.join(ROOT,p),path.join(d,p),{recursive:true});
  for(const p of['src','public'])fs.mkdirSync(path.join(d,p),{recursive:true});fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(d,'node_modules'));return d;}
const run=(d,f,args=[])=>spawnSync(process.execPath,[f,...args],{cwd:d,encoding:'utf8'});

test('every kid prompt line is mt_id|question|right|wrong1|wrong2 for a known topic, one per topic',()=>{
  assert.ok(lines.length>=1344);const seen=new Set();
  for(const {f,l,p} of lines){assert.equal(p.length,5,`${f}: ${l}`);assert.match(p[0],/^mt_[\w-]+$/,`${f}: not id-keyed: ${l}`);
    assert.ok(ids.has(p[0]),`${f}: unknown topic ${p[0]}`);assert.ok(!seen.has(p[0]),`${f}: duplicate ${p[0]}`);seen.add(p[0]);}});
test('the built tax.json carries each prompt on the topic it names',()=>{const by=new Map(tax.topics.map(t=>[t.id,t]));
  for(const {p} of lines){const t=by.get(p[0]);assert.deepEqual([t.kq,t.ka,...t.kw],p.slice(1).map(x=>x.trim()),p[0]);}});
test('a reordered topics.json gives every topic the same prompt (position-independent)',()=>{const d=scratch();
  try{const f=path.join(d,'data/marble/topics.json'),j=JSON.parse(fs.readFileSync(f,'utf8'));j.topics.reverse();fs.writeFileSync(f,JSON.stringify(j));
    const r=run(d,'build.mjs');assert.equal(r.status,0,r.stderr);const out=JSON.parse(fs.readFileSync(path.join(d,'public/tax.json'),'utf8'));
    assert.equal(out.topics[0].id,tax.topics.at(-1).id,'order really changed');const by=new Map(out.topics.map(t=>[t.id,t]));
    for(const t of tax.topics){const o=by.get(t.id);assert.deepEqual([o.kq,o.ka,o.kw,o.tier,o.self],[t.kq,t.ka,t.kw,t.tier,t.self],t.id);}}
  finally{fs.rmSync(d,{recursive:true,force:true});}});
test('the build rejects index-keyed, unknown and duplicate prompt lines',()=>{
  for(const [bad,re] of [['0|Q?|a|b|c',/must start with a topic id/],['mt_doesNotExist|Q?|a|b|c',/unknown topic/],[lines[0].l,/duplicate kid prompt/]]){const d=scratch();
    try{fs.appendFileSync(path.join(d,'data/kid-prompts/b01.txt'),'\n'+bad+'\n');const r=run(d,'build.mjs');assert.notEqual(r.status,0,bad);assert.match(r.stderr,re);}
    finally{fs.rmSync(d,{recursive:true,force:true});}}});
test('migrate-kid-prompts.mjs is a no-op on converted files and refuses a topics.json it was not written for',()=>{const d=scratch();
  try{let r=run(d,'migrate-kid-prompts.mjs');assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/already keyed/);
    fs.writeFileSync(path.join(d,'data/kid-prompts/b99.txt'),'0|Q?|a|b|c\n');const f=path.join(d,'data/marble/topics.json'),j=JSON.parse(fs.readFileSync(f,'utf8'));j.topics.reverse();fs.writeFileSync(f,JSON.stringify(j));
    r=run(d,'migrate-kid-prompts.mjs');assert.equal(r.status,1);assert.match(r.stderr,/not the release the indexes refer to/);
    assert.equal(fs.readFileSync(path.join(d,'data/kid-prompts/b99.txt'),'utf8'),'0|Q?|a|b|c\n','nothing written');}
  finally{fs.rmSync(d,{recursive:true,force:true});}});
