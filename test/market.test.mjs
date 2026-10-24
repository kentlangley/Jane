// Points Market (plans/points-market.md, #74; idea credit: Christopher). Points buy fun, choice and peeks:
// never mastery, medals or permanent fog clear. balance = earned − spent; purchases are server-side and idempotent.
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import {ROOT,tmpDir,loadEngine} from './helpers.mjs';
const {E,g}=await loadEngine();const DAY=864e5,NOW=Date.parse('2026-10-23T19:00:00Z');
const rich=(pts=1000)=>{const S=E.blank();S.points=pts;S.firstDone=true;return S;};
const pid=(n=0)=>'test-pid-'+n;
const m0=S=>JSON.stringify([S.medals,S.questMedals||[],S.ts,S.fog?.finds||[]]);

// ---------- slice 1: wallet + ledger ----------
test('balance = earned − spent; S.points (earned) never decreases',()=>{
  const S=rich(100);assert.equal(E.walletState(S,g,NOW).balance,100);
  const x=E.buy(S,g,{pid:pid(1),item:'test-sticker'},NOW);assert.ok(x.ok,x.error);
  const w=E.walletState(S,g,NOW);assert.equal(S.points,100,'earned untouched');assert.equal(w.earned,100);assert.equal(w.spent,25);assert.equal(w.balance,75);
  assert.equal(S.wallet.ledger.length,1);assert.deepEqual(S.wallet.ledger[0],{id:pid(1),item:'test-sticker',kind:'sticker',price:25,at:NOW});});
test('insufficient balance is refused and charges nothing',()=>{
  const S=rich(10);const x=E.buy(S,g,{pid:pid(2),item:'test-sticker'},NOW);assert.match(x.error,/Not enough points/);assert.equal(x.need,15);
  assert.equal(S.wallet?.spent||0,0);assert.equal((S.wallet?.ledger||[]).length,0);});
test('same pid twice charges once; a one-time item twice → already',()=>{
  const S=rich(100);const a=E.buy(S,g,{pid:pid(3),item:'test-sticker'},NOW),b=E.buy(S,g,{pid:pid(3),item:'test-sticker'},NOW+1);
  assert.ok(a.ok&&!a.already);assert.ok(b.ok&&b.already);assert.equal(b.row.at,NOW,'original row returned');assert.equal(S.wallet.spent,25);
  const c=E.buy(S,g,{pid:pid(4),item:'test-sticker'},NOW+2);assert.ok(c.ok&&c.already&&c.owned);assert.equal(S.wallet.spent,25);assert.equal(S.wallet.ledger.length,1);});
test('bad pid, unknown item and client-sent prices are ignored or refused',()=>{
  const S=rich(100);assert.match(E.buy(S,g,{pid:'x',item:'test-sticker'},NOW).error,/purchase id/);
  assert.match(E.buy(S,g,{pid:pid(5),item:'medal-gold'},NOW).error,/unknown/);
  const x=E.buy(S,g,{pid:pid(6),item:'test-sticker',price:0},NOW);assert.equal(x.row.price,25);});
test('medals, mastery and fog finds are unchanged after any buy',()=>{
  const S=rich(5000);const t=g.topics[0];S.ts[t.id]={st:'mastered',how:'direct',conf:.9,box:1,due:NOW+DAY,c:3,ft:3};S.medals=[{id:t.id,tier:'bronze',at:1}];
  const before=m0(S);for(const [i,d] of E.MARKET.entries()){const meta=d.kind==='flare'?{region:'Mathematics'}:{};try{E.buy(S,g,{pid:pid(100+i),item:d.id,meta},NOW);}catch(e){assert.fail(e.message);}}
  assert.equal(m0(S),before);assert.equal(S.points,5000);});
test('day snapshots: one per PT day, capped; export has a market block with earned7d/spent7d',()=>{
  const S=rich(0);for(let i=0;i<70;i++){S.points=i*10;E.snapDay(S,new Date(Date.UTC(2026,0,1)+i*DAY).toISOString().slice(0,10));}
  assert.equal(Object.keys(S.wallet.days).length,E.WALLET_DAYS);
  const S2=rich(500);S2.wallet={spent:0,ledger:[],owned:{},equipped:{},active:{},choices:{},days:{'2026-10-15':200,'2026-10-16':300,'2026-10-23':500}};
  E.buy(S2,g,{pid:pid(7),item:'test-sticker'},NOW);const X=E.marketExport(S2,g,NOW);
  assert.equal(X.balance,475);assert.equal(X.earned,500);assert.equal(X.spent,25);assert.equal(X.spent7d,25);assert.equal(X.earned7d,200);assert.equal(X.earnedSince,'2026-10-16');
  assert.equal(X.ledger.length,1);assert.ok(X.prices['test-sticker']);});

// ---------- server: routes, purchase log, export ----------
const DATA=tmpDir('jane-market-');let srv,B;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const call=async(p,body)=>{const r=await fetch(B+p,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return{status:r.status,j:await r.json()};};
before(async()=>{const S=rich(1000);S.placement.done=true;fs.writeFileSync(path.join(DATA,'progress.json'),JSON.stringify(S));
  const port=await freePort();B=`http://127.0.0.1:${port}`;
  srv=spawn(process.execPath,['server/index.mjs'],{cwd:ROOT,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:DATA,LEARNER_NAME:'Sam'},stdio:['ignore','pipe','inherit']});
  for(let i=0;i<100;i++){try{if((await fetch(B+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('server did not start');});
after(()=>{srv?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
test('server: /api/state wallet, GET /api/market, idempotent POST /api/market/buy, purchase log, export market',async()=>{
  const s=(await call('/api/state')).j;assert.deepEqual([s.wallet.balance,s.wallet.earned,s.wallet.spent],[1000,1000,0]);
  const m=(await call('/api/market')).j;assert.ok(m.items.some(i=>i.id==='test-sticker'&&i.affordable&&!i.owned));
  const a=await call('/api/market/buy',{pid:'srv-pid-1',item:'test-sticker'});assert.equal(a.status,200);assert.equal(a.j.state.wallet.balance,975);assert.equal(a.j.state.points,1000);
  const b=await call('/api/market/buy',{pid:'srv-pid-1',item:'test-sticker'});assert.equal(b.j.already,true);assert.equal(b.j.wallet.spent,25);
  assert.equal((await call('/api/market/buy',{pid:'srv-pid-2',item:'nope'})).status,400);
  const log=JSON.parse(fs.readFileSync(path.join(DATA,`log%3A${today}.json`),'utf8')).filter(l=>l.event==='purchase');assert.equal(log.length,1);assert.equal(log[0].price,25);
  const ex=execFileSync(process.execPath,['export-progress.mjs','--local'],{cwd:ROOT,env:{...process.env,DATA_DIR:DATA},encoding:'utf8'});
  const X=JSON.parse(fs.readFileSync(ex.match(/wrote (\S+\.json)/)[1],'utf8'));assert.equal(X.market.spent,25);assert.equal(X.market.balance,975);assert.equal(X.market.ledger.length,1);
  assert.equal(typeof X.market.earned7d,'number');});
