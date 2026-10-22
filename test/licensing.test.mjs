// Slice 7 (#43): credits and licensing for the vendored taxonomy and its teaching research.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {ROOT} from './helpers.mjs';
const R=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const ATTR='Marble Skill Taxonomy (v1) · © Generative Spark, Inc. (Marble)';
test('NOTICE and about.html carry the required attribution and the teaching-research credit',()=>{
  for(const f of['NOTICE','public/about.html','LICENSING.md']){assert.ok(R(f).includes(ATTR),f);assert.match(R(f),/ODbL 1\.0/);assert.match(R(f),/CC BY-SA 4\.0/);}
  assert.match(R('NOTICE'),/teaching research/i);assert.match(R('public/about.html'),/Teaching research/);assert.match(R('NOTICE'),/NGSS is a registered trademark of WestEd/);});
test('the upstream commit in NOTICE matches data/marble/UPSTREAM',()=>{const c=R('data/marble/UPSTREAM').match(/^commit: ([0-9a-f]{40})$/m)[1];assert.ok(R('NOTICE').includes(c));assert.match(R('LICENSING.md'),new RegExp(c.slice(0,7)));});
test('third-party curriculum text and the teaching research are not served by the app',()=>{
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  for(const f of walk(path.join(ROOT,'public')))assert.ok(!/curriculum-standards|teaching-research/.test(f),f);
  assert.ok(!fs.existsSync(path.join(ROOT,'data/marble/curriculum-standards.json')));
  assert.match(R('.dockerignore'),/^data\/marble\/teaching-research\.json$/m);});
