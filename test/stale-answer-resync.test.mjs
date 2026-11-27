// #135: itemId binding + rev guard so a stale KV snapshot cannot grade the previous
// item or roll back packSeen; the client must resync the card and clear Jane's speech.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {loadEngine,ROOT} from './helpers.mjs';
import * as Sync from '../src/sync.js';

const {E,g}=await loadEngine();
const now=Date.parse('2026-11-27T18:06:15Z');
const js=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8');
const worker=fs.readFileSync(path.join(ROOT,'src/worker.js'),'utf8');

function item(id,q,answer,extra={}){
  return {kind:'pack',type:'input',numeric:true,form:'fraction',id,q,answer,hint:'h',explain:'e',
    topicId:'mt_SBkTGjiZjZ',mode:'learn',format:'story',tries:0,stage:'main',issued:now,packKey:'2026-11-27:mt_SBkTGjiZjZ:0',...extra};
}

test('writeGuard: matching itemId and equal-or-newer snapshot are allowed',()=>{
  const S={rev:5,current:{id:'item-b'}};
  assert.equal(Sync.writeGuard(S,{itemId:'item-b',rev:5}),null);
  assert.equal(Sync.writeGuard(S,{itemId:'item-b',rev:4}),null,'client rev behind a fresh read is ok');
  assert.equal(Sync.writeGuard(S,{}),null,'missing itemId/rev stays compatible');
  assert.equal(Sync.writeGuard(S,{itemId:'item-b'}),null);
});

test('writeGuard: S.rev < req.rev is stale and must not persist',()=>{
  const S={rev:4,current:{id:'item-a'},packSeen:{}};
  const g=Sync.writeGuard(S,{itemId:'item-b',rev:5});
  assert.equal(g.stale,true);assert.equal(g.mismatch,undefined);
  assert.match(g.jane,/moment behind/);
  assert.equal(Sync.mustNotPersist(g),true);
});

test('writeGuard: itemId mismatch on a fresh snapshot (no grade, no write)',()=>{
  const S={rev:5,current:{id:'item-a'}};
  const g=Sync.writeGuard(S,{itemId:'item-b',rev:5});
  assert.equal(g.mismatch,true);assert.equal(g.stale,undefined);
  assert.match(g.jane,/already moved on/);
  assert.equal(Sync.mustNotPersist(g),true);
});

test('writeGuard: itemId is ignored when the current item has no id yet',()=>{
  const S={rev:1,current:{q:'old item without id'}};
  assert.equal(Sync.writeGuard(S,{itemId:'item-b',rev:1}),null);
});

test('stale guard would have blocked the in-quest rollback: packSeen stays on the fresh record',()=>{
  const fresh={rev:5,packSeen:{'2026-11-27:mt_SBkTGjiZjZ:0':1},current:{id:'item-b'}};
  const stale={rev:4,packSeen:{},current:item('item-a','You have 3/4 of a bar and give away 1/8. What fraction is left?','5/8')};
  const g=Sync.writeGuard(stale,{itemId:'item-b',rev:5});
  assert.equal(g.stale,true);
  assert.equal(Sync.mustNotPersist(g),true);
  // Caller does not KV.put(stale). The fresh packSeen mark is preserved.
  assert.equal(fresh.packSeen['2026-11-27:mt_SBkTGjiZjZ:0'],1);
  assert.equal(Object.keys(stale.packSeen).length,0);
});

test('submitting the next item\'s answer against a stale previous item would be a miss, so the guard must fire first',()=>{
  const S=E.blank();S.firstDone=true;S.placement.done=true;S.rev=4;
  S.current=item('item-a','You have 3/4 of a bar and give away 1/8. What fraction is left?','5/8');
  const unguarded=E.submit(S,g,'5/12',now+33e3);
  assert.equal(unguarded.r.retry,true);assert.equal(unguarded.r.correct,false);
  assert.match(unguarded.r.jane,/Here's a hint/);
  const guarded=Sync.writeGuard({rev:4,current:{id:'item-a'}},{itemId:'item-b',rev:5});
  assert.equal(guarded.stale,true);
});

test('grade still accepts the right fraction when the current item is the one on screen',()=>{
  const S=E.blank();S.firstDone=true;S.placement.done=true;
  S.current=item('item-b','What is 2/3 − 1/4?','5/12',{packKey:'2026-11-27:mt_SBkTGjiZjZ:1'});
  const x=E.submit(S,g,'5/12',now);
  assert.equal(x.r.correct,true);assert.equal(x.error,undefined);
});

test('migrate / upgrade fills rev 0 on existing v2 records and blank starts at 0',()=>{
  assert.equal(E.blank().rev,0);
  const old={v:2,points:1,stars:0,streak:0,bestStreak:0,solved:1,badges:[],ts:{},current:null,placement:{done:true,asked:0,per:{},queue:[]},packSeen:{}};
  const S=E.migrate(old,g);
  assert.equal(S.rev,0);
});

test('worker publishes rev, rejects stale or mismatched writes, and bumps rev only on persist',()=>{
  assert.match(worker,/import \* as Sync from '\.\/sync\.js'/);
  assert.match(worker,/rev:S\.rev\|\|0/);
  assert.match(worker,/rejectWrite\(true\)/);
  assert.match(worker,/S\.rev=\(S\.rev\|\|0\)\+1/);
  assert.match(worker,/\/api\/answer[\s\S]*rejectWrite\(true\)/);
  assert.match(worker,/\/api\/stuck[\s\S]*rejectWrite\(true\)/);
  assert.match(worker,/\/api\/skip'[\s\S]*rejectWrite\(true\)/);
});

test('client sends itemId and rev, retries stale writes, and reconciles the card',()=>{
  assert.match(js,/function writeBody\(/);
  assert.match(js,/function postWrite\(/);
  assert.match(js,/function syncCard\(/);
  assert.match(js,/function clearJane\(/);
  assert.match(js,/itemId:st\?\.item\?\.id/);
  assert.match(js,/rev:st\?\.rev/);
  assert.match(js,/writeBody\(\{answer:v\}\)/);
  assert.match(js,/postWrite\('\/api\/answer'/);
  assert.match(js,/postWrite\('\/api\/stuck'/);
  assert.match(js,/postWrite\('\/api\/skip'/);
  assert.match(js,/if\(r\.mismatch\)\{syncCard\(r\)/);
  assert.match(js,/if\(r\.retry\)\{const how=syncCard\(r\);say\(r\.jane\)/);
  assert.match(js,/if\(id&&id!==shownItemId\)\{render\(r\.state\)/);
});

test('render clears Jane\'s speech bubble only when the item id changes',()=>{
  assert.match(js,/const nextId=s\?\.item\?\.id;if\(shownItemId!==undefined&&nextId!==shownItemId\)clearJane\(\);shownItemId=nextId/);
  assert.match(js,/function clearJane\(\)\{const b=\$\('jane'\);if\(!b\)return;b\.innerHTML='';b\.classList\.remove\('pop'\);\}/);
});
