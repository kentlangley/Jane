// Slice 3 (#39): the kid prompts written for the new Marble topics (data/kid-prompts/b11.txt) meet the same bar as the
// rest: three distinct choices, the right answer is not also a wrong one, no duplicated question, sane lengths, and the
// right answer is not given away by being far longer than both wrong ones. Topics still held back say why.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {ROOT} from './helpers.mjs';
const DIR=path.join(ROOT,'data/kid-prompts');
const read=f=>fs.readFileSync(path.join(DIR,f),'utf8').split('\n').filter(l=>l.trim()&&!l.startsWith('#'));
const all=fs.readdirSync(DIR).filter(f=>/^b\d+\.txt$/.test(f)).flatMap(f=>read(f).map(l=>({f,p:l.split('|')})));
const s3=read('b11.txt').map(l=>l.split('|'));
test('b11 prompts: distinct choices, answer not among the wrong ones, no stray whitespace, sane lengths',()=>{
  assert.ok(s3.length>=300,'slice 3 prompts present');
  for(const p of s3){assert.equal(p.length,5,p.join('|'));const [id,q,r,w1,w2]=p;
    assert.ok(p.every(x=>x===x.trim()&&x.length>0),`${id}: empty field or stray whitespace`);
    assert.ok(r!==w1&&r!==w2&&w1!==w2,`${id}: repeated choice`);
    assert.ok(q.length<=90,`${id}: question ${q.length} chars`);assert.ok(Math.max(r.length,w1.length,w2.length)<=47,`${id}: choice too long`);
    const lw=Math.max(w1.length,w2.length);assert.ok(!(r.length>lw*1.8&&r.length-lw>12),`${id}: right answer much longer than the wrong ones`);}});
test('no b11 question repeats another question in any prompt file',()=>{const n=new Map();
  for(const {p} of all){const k=p[1].trim().toLowerCase();n.set(k,(n.get(k)||0)+1);}
  for(const p of s3)assert.equal(n.get(p[1].toLowerCase()),1,`${p[0]}: question used more than once`);});
test('every topic still in PENDING.txt carries a reason',()=>{const L=read('PENDING.txt');
  for(const l of L)assert.match(l,/^mt_[\w-]+\s+#.+—\s*held:\s*\S/,l);});
