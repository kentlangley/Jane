#!/usr/bin/env node
// One-time conversion: data/kid-prompts/b*.txt lines `index|question|right|wrong1|wrong2` → `mt_id|question|right|wrong1|wrong2`.
// The old index is the topic's position in data/marble/topics.json. That position is only meaningful for the file the
// prompts were written against (Marble Skill Taxonomy release 1.0.0), so the script refuses to run on any other
// topics.json. Idempotent: lines that are already ID-keyed are left alone. Usage: node migrate-kid-prompts.mjs [--dry-run]
import fs from 'fs';import path from 'path';import crypto from 'crypto';import {fileURLToPath} from 'url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const V1_TOPICS_SHA256='2d99fc3b5e57d9ddb86b6c179b58a1b0390f048d9798585fe03b13cbc183719b'; // data/marble/manifest.json, release 1.0.0
const dry=process.argv.includes('--dry-run');
const buf=fs.readFileSync('data/marble/topics.json'),sha=crypto.createHash('sha256').update(buf).digest('hex');
const DIR='data/kid-prompts',files=fs.readdirSync(DIR).filter(f=>/^b\d+\.txt$/.test(f)).sort();
const pending=files.some(f=>fs.readFileSync(path.join(DIR,f),'utf8').split('\n').some(l=>/^\d+\|/.test(l)));
if(!pending){console.log('kid prompts are already keyed by topic id; nothing to do');process.exit(0);}
if(sha!==V1_TOPICS_SHA256){console.error(`data/marble/topics.json is not the release the indexes refer to (sha256 ${sha}).\nCheck out the 1.0.0 topics.json, run this script, then update the taxonomy.`);process.exit(1);}
const topics=JSON.parse(buf).topics,seen=new Set();let n=0;
for(const f of files){const p=path.join(DIR,f),src=fs.readFileSync(p,'utf8');
  const out=src.split('\n').map((l,i)=>{const m=l.match(/^(\d+)\|/);if(!m)return l;const t=topics[+m[1]];
    if(!t)throw Error(`${f}:${i+1}: index ${m[1]} is out of range`);if(seen.has(t.id))throw Error(`${f}:${i+1}: duplicate prompt for ${t.id}`);
    seen.add(t.id);n++;return t.id+l.slice(m[1].length);}).join('\n');
  if(!dry&&out!==src)fs.writeFileSync(p,out);}
console.log(`${dry?'would convert':'converted'} ${n} lines in ${files.length} files`);
