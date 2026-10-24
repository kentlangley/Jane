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

// ---------- slice 2: skins ----------
test('skins: 4 slots priced 300–1,500, bought once, equip owned-only and free, unequip; looks go out with the wallet',()=>{
  const skins=E.MARKET.filter(d=>d.kind==='skin');assert.deepEqual([...new Set(skins.map(d=>d.slot))].sort(),['avatar','boss','ship','theme']);
  assert.ok(skins.every(d=>d.once&&d.price>=300&&d.price<=1500&&d.look),'skin prices 300–1,500');
  const S=rich(2000);assert.match(E.equip(S,g,'ship','ship-pirate').error,/Buy it first/);
  assert.ok(E.buy(S,g,{pid:pid(20),item:'ship-pirate'},NOW).ok);const spent=S.wallet.spent;
  assert.match(E.equip(S,g,'avatar','ship-pirate').error,/does not go there/);assert.match(E.equip(S,g,'hat','ship-pirate').error,/unknown slot/);
  const before=m0(S);assert.ok(E.equip(S,g,'ship','ship-pirate').ok);assert.equal(S.wallet.spent,spent,'equip is free');assert.equal(m0(S),before);
  let w=E.walletState(S,g,NOW);assert.equal(w.equipped.ship,'ship-pirate');assert.equal(w.looks.ship.sail,'#263238');
  assert.ok(E.marketItems(S,g,NOW).find(i=>i.id==='ship-pirate').equipped);
  assert.ok(E.equip(S,g,'ship',null).ok);w=E.walletState(S,g,NOW);assert.equal(w.equipped.ship,undefined);assert.ok(w.owned['ship-pirate'],'still owned after taking it off');
  assert.ok(E.buy(S,g,{pid:pid(21),item:'ship-pirate'},NOW).already,'owned skins are not sold twice');});

// ---------- slice 3: scout flare ----------
test('scout flare: active < 24 h, gone after; mask, clear and available identical; claimFind still refuses uncleared finds',()=>{
  const S=rich(1000);const before=E.fogState(S,g,NOW);
  assert.match(E.buy(S,g,{pid:pid(30),item:'scout-flare',meta:{region:'Atlantis'}},NOW).error,/Pick an island/);
  const x=E.buy(S,g,{pid:pid(31),item:'scout-flare',meta:{region:'Science'}},NOW);assert.ok(x.ok,x.error);assert.equal(x.row.price,200);assert.equal(x.flare.region,'Science');
  assert.match(E.buy(S,g,{pid:pid(32),item:'scout-flare',meta:{region:'Science'}},NOW+1).error,/still burning/);
  const lit=E.fogState(S,g,NOW+23*3600e3);assert.equal(lit.flares.length,1);assert.equal(lit.flares[0].region,'Science');assert.equal(lit.flares[0].secrets,1,'one Science find still hidden');
  for(const k of ['mask','clear','total','pct','bySubject','available','finds'])assert.deepEqual(lit[k],before[k],k);
  assert.match(E.claimFind(S,g,'secret-sci-30',NOW).error,/not yet uncovered/);
  const after=E.fogState(S,g,NOW+24*3600e3+1);assert.deepEqual(after.flares,[],'fog returns after 24 h');assert.equal(after.mask,before.mask);
  assert.ok(E.buy(S,g,{pid:pid(33),item:'scout-flare',meta:{region:'Science'}},NOW+25*3600e3).ok,'a new flare after the old one burns out');
  assert.equal(S.wallet.active.flares.length,1,'expired flares are dropped');});
test('scout flare: a fully cleared island cannot be flared',()=>{
  const S=rich(1000);for(const t of g.topics.filter(t=>t.subject==='Geography'))S.ts[t.id]={st:'mastered',how:'direct',conf:.9,box:1,due:NOW+DAY};
  assert.match(E.buy(S,g,{pid:pid(34),item:'scout-flare',meta:{region:'Geography'}},NOW).error,/no fog left/);});

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
test('server: buy a ship skin, equip it, /api/state carries the look; equip without owning is refused',async()=>{
  assert.equal((await call('/api/market/equip',{slot:'avatar',item:'avatar-fox'})).status,400);
  const a=await call('/api/market/buy',{pid:'srv-pid-3',item:'ship-candy'});assert.equal(a.status,200);
  const e=await call('/api/market/equip',{slot:'ship',item:'ship-candy'});assert.equal(e.status,200);assert.equal(e.j.state.wallet.looks.ship.id,'ship-candy');
  const s=(await call('/api/state')).j;assert.equal(s.wallet.equipped.ship,'ship-candy');assert.equal(s.wallet.balance,s.wallet.earned-s.wallet.spent);assert.equal(s.points,1000);
  const f=await call('/api/market/buy',{pid:'srv-pid-4',item:'scout-flare',meta:{region:'Mathematics'}});assert.equal(f.status,200);assert.equal(f.j.state.fog.flares[0].region,'Mathematics');
  const m1=(await call('/api/map')).j;assert.equal(m1.fog.flares.length,1);
  fs.writeFileSync(path.join(DATA,'debug%3AclockOffsetDays.json'),'2');const m2=(await call('/api/map')).j;fs.rmSync(path.join(DATA,'debug%3AclockOffsetDays.json'));
  assert.deepEqual(m2.fog.flares,[],'two days later the fog is back');assert.equal(m2.fog.mask,m1.fog.mask);
  const h=await (await fetch(B+'/parent')).text();assert.match(h,/"wallet":\{"balance":475,"earned":1000,"spent":525/,"parent data carries both earned and spendable");});
