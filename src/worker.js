import * as E from './engine.js';import * as PR from './parent.js';import {VERSION} from './version.js';
let G=null;
async function graph(env){if(!G){const r=await env.ASSETS.fetch(new Request('https://assets.local/tax.json'));G=E.graph(await r.json());}return G;}
export const ptDate=(ms=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
// Every JSON response goes through J, which fills in the learner's name ({name} placeholder, see engine.configure).
const J=(o,s=200)=>new Response(E.withName(JSON.stringify(o),JSON.stringify(E.learner().name).slice(1,-1)),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
// Sandbox (for testing/screenshots without touching the learner's real progress): open /api/sandbox?on=1 (cookie sbx=1, 24 h),
// POST /api/sandbox/reset {offsetDays} copies the real progress into sandbox:* keys. /api/sandbox?on=0 leaves it.
export default{async fetch(req,env){E.configure(env);const u=new URL(req.url),P=u.pathname,KV=env.JANE_KV;
 const sbxQ=u.searchParams.get('sandbox'),sbx=sbxQ!=null?sbxQ==='1':/(?:^|;\s*)sbx=1/.test(req.headers.get('cookie')||'');const K=k=>sbx?'sandbox:'+k:k;
 if(P==='/healthz')return new Response(JSON.stringify({ok:true,version:VERSION}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(!P.startsWith('/api/')&&P!=='/parent'){const r=await env.ASSETS.fetch(req);if(sbxQ==null)return r;const h=new Headers(r.headers);h.append('set-cookie',`sbx=${sbxQ==='1'?1:0}; Path=/; SameSite=Lax${sbxQ==='1'?'':'; Max-Age=0'}`);return new Response(r.body,{status:r.status,headers:h});}
 const g=await graph(env);
 if(P==='/api/sandbox'){const on=u.searchParams.get('on')!=='0';return new Response(null,{status:302,headers:{location:'/','set-cookie':`sbx=${on?1:0}; Path=/; SameSite=Lax${on?'; Max-Age=86400':'; Max-Age=0'}`}});}
 if(sbx&&P==='/api/sandbox/reset'&&req.method==='POST'){const b=await req.json().catch(()=>({}));await KV.put('sandbox:progress',(await KV.get('progress'))||'null');await KV.put('sandbox:debug:clockOffsetDays',String(+b.offsetDays||0));return J({ok:true,sandbox:true,offsetDays:+b.offsetDays||0});}
 const off=+(await KV.get(K('debug:clockOffsetDays')))||0;const now=Date.now()+off*864e5,today=ptDate(now);
 const raw=await KV.get(K('progress'),'json');let S=E.migrate(raw,g);const migrated=raw&&raw.v!==2;
 const S0=JSON.stringify(S);
 // ---- quests (v0.5): ONE current quest (E.questLineup). A newer quest pack waits hidden until the current one is finished.
 const todayPack=await KV.get('lessons:'+today,'json');const PC={[today]:todayPack};
 const ld=[];{let cur;do{const l=await KV.list({prefix:'lessons:',cursor:cur});ld.push(...l.keys.map(k=>k.name.slice(8)));cur=l.list_complete?null:l.cursor;}while(cur);}
 const recent=ld.filter(d=>d<=today).sort().slice(-30);await Promise.all(recent.filter(d=>!(d in PC)).map(async d=>PC[d]=await KV.get('lessons:'+d,'json')));
 const qrec=d=>S.quests?.[d]||{};const LU=()=>E.questLineup(S,Object.fromEntries(recent.map(d=>[d,PC[d]])),today);
 const withBoost=async p=>{if(!p?.quest)return p;const b=await KV.get('boost:'+p.date,'json');return b?E.applyBoost(p,b):p;};
 const choosePack=async()=>{const d=LU().current;return d?withBoost(PC[d]):todayPack;};
 let pack=await choosePack();E.refresh(S,g,pack,now);
 const body=req.method==='POST'?await req.json().catch(()=>({})):{};let out,ev=[];
 let finaleJust=false;
 const pub=()=>{const fin=E.syncFinale(S,g,now);if(fin.justUnlocked){finaleJust=true;ev.push({event:'finaleUnlocked',at:fin.revealedAt});}
   const sm=E.summary(S,g,now);delete sm.codes;return{name:E.learner().name,learner:E.learner(),points:S.points,stars:S.stars,streak:S.streak,bestStreak:S.bestStreak,solved:S.solved,medals:(S.medals||[]).slice(-4).reverse().map(m=>E.medalInfo(m,g)).filter(Boolean),medalCount:E.trophies(S,g).medals.filter(m=>m.tier!=='quest').length,
   placement:{done:S.placement.done,asked:S.placement.asked},progress:sm,pack:pack?{date:pack.date,title:pack.title}:null,item:E.publicItem(S.current,g,S,now),clockOffsetDays:off||undefined,sandbox:sbx||undefined,
   quest:pack?.quest?E.questInfo(S,g,pack):null,newQuest:(()=>{const L=LU();return L.newQuest&&pack?.date===L.current;})(),
   quests:(()=>{const L=LU();return{current:L.current,nextUp:L.queued.length>0,boost:pack?.boost||null};})(),
   terms:pack?.terms||null,mini:S.mini?{topicId:S.mini.topicId,subject:S.mini.ret}:null,
   campaign:E.campaignState(S,g),fog:E.fogState(S,g,now),wallet:E.walletState(S,g,now),finaleReveal:finaleJust||undefined};};
 const questCheck=r=>{const m=E.completeQuest(S,g,pack,now);if(m){r.questDone=m;ev.push({event:'questDone',date:pack.date,quest:m.title});}};
 if(P==='/parent'){ // read-only: returns before any KV write
   const ds=[...Array(14)].map((_,i)=>ptDate(now-(13-i)*864e5));const logs={};await Promise.all(ds.map(async d=>logs[d]=(await KV.get(K('log:'+d),'json'))||[]));
   const qp={};for(const d of recent)if(PC[d]?.quest)qp[d]=PC[d];const boosts={};await Promise.all(Object.keys(qp).map(async d=>boosts[d]=await KV.get('boost:'+d,'json')));
   const tomorrowPack=await KV.get('lessons:'+ptDate(now+864e5),'json');
   const data=PR.parentData({S,g,now,today,logs,packs:qp,tomorrowPack,boosts});data.sandbox=sbx||undefined;
   return new Response(PR.parentShell(data),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});}
 if(P==='/api/state'){if(!S.current)E.next(S,g,pack,now);out=pub();}
 else if(P==='/api/trophies'){out=E.trophies(S,g);}
 else if(P==='/api/map'){const sm=E.summary(S,g,now);out={codes:sm.codes,focus:S.focus,current:S.current?.topicId,progress:{...sm,codes:undefined},fog:E.fogState(S,g,now)};}
 else if(P==='/api/answer'&&req.method==='POST'){if(!S.current)E.next(S,g,pack,now);const x=E.submit(S,g,body.answer??'',now);ev=x.ev;if(x.r.medal)x.r.medal=E.medalInfo(x.r.medal,g);
   if(x.r.done){const md=E.miniAfter(S,g,pack,now,x.r);if(md){x.r.miniDone=md;x.r.askChoice=false;}questCheck(x.r);if(!S.current&&!x.r.askChoice)E.next(S,g,pack,now);}out={...x.r,state:pub()};}
 else if(P==='/api/stuck'&&req.method==='POST'){if(!S.current)E.next(S,g,pack,now);const x=E.stuck(S,g,now);if(x.error)return J(x,400);ev=x.ev;out={...x.r,state:pub()};}
 else if(P==='/api/skip'&&req.method==='POST'){if(!S.current)E.next(S,g,pack,now);const x=E.skip(S,g,pack,now);if(x.error)return J(x,400);ev=x.ev;
   const md=E.miniAfter(S,g,pack,now,x.r);if(md)x.r.miniDone=md;questCheck(x.r);if(!S.current)E.next(S,g,pack,now);out={...x.r,state:pub()};}
 else if(P==='/api/explore'&&req.method==='POST'){if(!g.byId[body.topicId])return J({error:'unknown topic'},400);const it=E.startMini(S,g,body.topicId,pack,now);if(it.error)return J(it,400);out=pub();}
 else if(P==='/api/mini/quit'&&req.method==='POST'){if(S.mini){S.mini=null;S.current=S.miniHold||null;S.miniHold=null;}if(!S.current)E.next(S,g,pack,now);out=pub();}
 else if(P==='/api/quest/start'&&req.method==='POST'){const d=body.date||LU().current||today;const qp=PC[d];
   if(qp?.quest&&!qrec(d).done){if(d!==LU().current)return J({error:'Finish your quest to unlock the next one! 🗝️',queued:true},409);
     S.quests??={};const q=S.quests[d]??={};q.started??=now;S.questFocus=d;pack=await withBoost(qp);if(!S.mini&&S.current&&!String(S.current.packKey||'').startsWith(d+':'))S.current=null;}
   if(!S.current)E.next(S,g,pack,now);out=pub();}
 else if(P==='/api/term'&&req.method==='POST'){const t=String(body.term||'').slice(0,60);if(t)ev.push({event:'term',term:t,topicId:S.current?.topicId,topic:g.byId[S.current?.topicId]?.name});out={ok:true};}
 else if(P==='/api/quests'){
   const L=LU(),fin=await Promise.all(L.finished.map(d=>withBoost(PC[d])));
   // the queued quests stay a secret ("Next up: ???"): only whether one is waiting goes out
   out={today,current:pack?{...E.questInfo(S,g,pack),today:pack.date===today,boost:pack.boost||null}:null,nextUp:L.queued.length>0,finished:fin.filter(Boolean).map(p=>E.questInfo(S,g,p))};}
 else if(P==='/api/next'&&req.method==='POST'){if(!S.current)E.next(S,g,pack,now);out=pub();}
 else if(P==='/api/skipbonus'&&req.method==='POST'){S.current=null;E.next(S,g,pack,now);out=pub();}
 else if(P==='/api/choice'&&req.method==='POST'){const r=E.choose(S,g,body.choice,pack,now);E.next(S,g,pack,now);out={...r,state:pub()};}
 else if(P==='/api/fog/claim'&&req.method==='POST'){const x=E.claimFind(S,g,String(body.id||''),now);if(x.error)return J(x,400);ev.push({event:'fogFind',id:x.find?.id,kind:x.find?.kind,already:!!x.already});out={...x,state:pub(),fog:E.fogState(S,g,now)};}
 // Points Market (plans/points-market.md): balance = earned − spent, server-side; idempotent by purchase id
 else if(P==='/api/market'){out={wallet:E.walletState(S,g,now),items:E.marketItems(S,g,now)};}
 else if(P==='/api/market/buy'&&req.method==='POST'){const x=E.buy(S,g,{pid:body.pid,item:String(body.item||''),meta:body.meta},now);if(x.error)return J(x,400);
   if(!x.already)ev.push({event:'purchase',pid:x.row.id,item:x.row.item,kind:x.row.kind,price:x.row.price,meta:x.row.meta});out={...x,wallet:E.walletState(S,g,now),items:E.marketItems(S,g,now),state:pub()};}
 else if(P==='/api/market/equip'&&req.method==='POST'){const x=E.equip(S,g,String(body.slot||''),body.item?String(body.item):null);if(x.error)return J(x,400);out={...x,wallet:E.walletState(S,g,now),items:E.marketItems(S,g,now),state:pub()};}
 else return J({error:'not found'},404);
 E.snapDay(S,today);
 if(migrated&&raw?.topics&&!sbx){/* keep a copy of the pre-v2 record */await KV.put('progress:v1-backup',JSON.stringify(raw));}
 if(JSON.stringify(S)!==S0)await KV.put(K('progress'),JSON.stringify(S));
 if(ev.length){const k=K('log:'+today);const log=(await KV.get(k,'json'))||[];const ts=new Date(now).toISOString();log.push(...ev.map(e=>({ts,...e})));await KV.put(k,JSON.stringify(log));}
 return J(out);}};
