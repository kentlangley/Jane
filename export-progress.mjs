#!/usr/bin/env node
// Dump the learner's progress for nightly lesson planning (read-only).
// Usage: node export-progress.mjs [--out file.json] [--date YYYY-MM-DD] [--days 7] [--local]   (default out: exports/progress-<date>.json;
//        with --local or STORAGE=file it reads the standalone server's DATA_DIR and writes DATA_DIR/exports/)
// Adds weakSpots (per topic + per domain: misses, hints, slow answers, failed reviews, unsure self-checks), strengths and goDeeper suggestions.
import fs from 'fs';import path from 'path';import {kvGet,loadTax,ptDate,DIR,activeQuests,questReached,learnerConfig,outDir} from './lib-cli.mjs';import * as E from './src/engine.js';import {coverage as areaCoverage} from './src/coverage.js';import {checkRegionFilter} from './lib-regions.mjs';
E.configure(learnerConfig());const L=E.learner();
const args=process.argv.slice(2),opt=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const date=opt('--date')||ptDate(),out=opt('--out')||path.join(outDir('exports'),`progress-${date}.json`);
const TAX=loadTax(),hiddenRegions=checkRegionFilter(TAX,DIR),g=E.graph(TAX),now=Date.now();
const S=E.migrate(kvGet('progress'),g),log=kvGet('log:'+date)||[],pack=kvGet('lessons:'+date);
const days=+(opt('--days')||7),dayList=[...Array(days)].map((_,i)=>ptDate(Date.parse(date+'T12:00:00Z')-i*864e5));
const logs=[log,...dayList.slice(1).map(d=>kvGet('log:'+d)||[])].flat();
const full=(t,extra={})=>({...t,state:E.stateOf(S,g,t.id,now),record:S.ts[t.id]||null,
  prerequisites:g.pre[t.id].map(e=>({id:e.id,name:g.byId[e.id].name,strength:e.h?'hard':'soft',state:E.stateOf(S,g,e.id,now)})),
  unlocks:g.post[t.id].map(e=>({id:e.id,name:g.byId[e.id].name,strength:e.h?'hard':'soft'})),...extra});
const sm=E.summary(S,g,now);delete sm.codes;
// review health: due/overdue Leitner reviews and how much review the gates actually served (last --days days)
const DAY=864e5,dueRecs=reviewDueIds(),oldest=dueRecs.length?Math.min(...dueRecs.map(id=>S.ts[id].due)):now;
function reviewDueIds(){return g.topics.filter(t=>E.stateOf(S,g,t.id,now)==='review').map(t=>t.id);}
const reviewHealth={due:dueRecs.length,overdue:dueRecs.filter(id=>S.ts[id].due<=now-DAY).length,oldestOverdueDays:Math.max(0,Math.floor((now-oldest)/DAY)),
  gateItems7d:logs.filter(l=>!l.event&&l.format==='gate'&&l.try===1).length,spotChecks7d:logs.filter(l=>l.event==='verified'||l.event==='spotMiss').length,
  unverifiedInferred:Object.keys(S.ts).filter(id=>g.byId[id]&&E.unverified(S,id)).length};
// v0.5: tell "not reached yet" (no play) from "broken" (play, reviews due, none served)
{const ans=logs.filter(l=>!l.event&&l.try===1),lastTs=Math.max(0,...ans.map(l=>Date.parse(l.ts)||0),...(ans.length?[]:Object.values(S.ts).map(r=>r.last||0)));
  Object.assign(reviewHealth,{reviewsServed7d:ans.filter(l=>l.mode==='review').length,
    gatesOpened7d:new Set(logs.filter(l=>!l.event&&l.format==='gate').map(l=>l.pack+':'+(l.gate??'?'))).size, // gates (incl. warm-ups) that served review items
    gatesAhead:0,lastPlayed:lastTs?new Date(lastTs).toISOString():null,daysSinceLastPlay:lastTs?Math.floor((now-lastTs)/DAY):null});
  reviewHealth.note=!ans.length?`not played since ${lastTs?ptDate(lastTs):'ever'}: gates not reached yet`:!reviewHealth.reviewsServed7d&&reviewHealth.due?'played but no reviews served: check the gates':'ok';}
const near=t=>Math.abs(t.ageRangeStart-L.age);
const frontier=g.topics.filter(t=>['ready','learning'].includes(E.stateOf(S,g,t.id,now))).sort((a,b)=>near(a)-near(b)).map(t=>full(t));
const reviewDue=g.topics.filter(t=>E.stateOf(S,g,t.id,now)==='review').sort((a,b)=>S.ts[a.id].due-S.ts[b.id].due).map(t=>full(t,{dueAt:new Date(S.ts[t.id].due).toISOString(),box:S.ts[t.id].box}));
// ---------- weak spots ----------
const SLOW=30,IDLE=600;const W={};const T=id=>W[id]??={topicId:id,name:g.byId[id]?.name,subject:g.byId[id]?.subject,domain:g.byId[id]?.domain,answers:0,correct:0,misses:0,hints:0,slow:0,failedReviews:0,unsure:0,stuck:0,skipped:0,secs:[],qtypes:{},examples:[]};
for(const l of logs){if(!g.byId[l.topicId])continue;
  if(l.event==='demoted'||l.event==='reviewMiss'){T(l.topicId).failedReviews++;continue;}
  // "I'm stuck" (counted once per question, at the first tap) and "Skip for now": this topic needs support
  if(l.event==='stuck'||l.event==='skipped'){if(l.event==='stuck'&&l.step!==1)continue;const w=T(l.topicId);w[l.event]++;w.examples.push(`${l.event==='stuck'?'tapped I\'m stuck':'skipped'}${l.format==='boss'?' in a BOSS':''}: "${l.question}"${l.level?` (Lv ${l.level})`:''}`);continue;}
  if(l.event)continue;if(l.regraded==='neutral')continue;const w=T(l.topicId);
  if(l.try===1)w.answers++;if(l.correct&&l.try===1)w.correct++;if(l.qtype)w.qtypes[l.qtype]=(w.qtypes[l.qtype]||0)+1;
  if(l.expected==='(self-check)'){if(l.given!=='yes'){w.unsure++;w.examples.push(`self-check "${l.question}" → ${l.given}`);}continue;}
  if(!l.correct&&l.try===1){w.hints++;w.examples.push(`missed first try: "${l.question}" (said "${l.given}", wanted "${l.expected}")`);}
  if(!l.correct&&l.try>=2)w.misses++;
  if(l.elapsedSec>SLOW&&l.elapsedSec<IDLE){w.slow++;w.examples.push(`slow (${l.elapsedSec}s): "${l.question}"`);}if(l.elapsedSec<IDLE)w.secs.push(l.elapsedSec);}
const score=w=>w.misses*3+w.hints*2+w.slow+w.failedReviews*3+w.unsure*2+w.stuck*2+w.skipped*3;
const per=Object.values(W).map(w=>({...w,avgSec:w.secs.length?Math.round(w.secs.reduce((a,b)=>a+b,0)/w.secs.length):null,secs:undefined,state:E.stateOf(S,g,w.topicId,now),weakScore:score(w)}));
const weakTopics=per.filter(w=>w.weakScore>0).sort((a,b)=>b.weakScore-a.weakScore);
const dom={};for(const w of per){const d=dom[w.subject+' › '+w.domain]??={domain:w.domain,subject:w.subject,topics:0,answers:0,correct:0,misses:0,hints:0,slow:0,failedReviews:0,unsure:0,stuck:0,skipped:0,weakScore:0};d.topics++;for(const k of['answers','correct','misses','hints','slow','failedReviews','unsure','stuck','skipped','weakScore'])d[k]+=w[k];}
const domains=Object.values(dom).map(d=>({...d,firstTryRate:d.answers?Math.round(100*d.correct/d.answers):null})).sort((a,b)=>b.weakScore-a.weakScore);
const stepDown=id=>g.pre[id].filter(e=>e.h).map(e=>({id:e.id,name:g.byId[e.id].name,state:E.stateOf(S,g,e.id,now)}));
const goDeeper=weakTopics.filter(w=>w.weakScore>=2).map(w=>({topicId:w.topicId,name:w.name,domain:w.domain,why:[w.misses&&`${w.misses} miss`,w.hints&&`${w.hints} needed a hint`,w.slow&&`${w.slow} slow`,w.failedReviews&&`${w.failedReviews} failed review`,w.unsure&&`${w.unsure} unsure self-check`,w.stuck&&`tapped I'm stuck ${w.stuck}×`,w.skipped&&`skipped ${w.skipped}×`].filter(Boolean).join(', '),
  needsSupport:!!(w.stuck||w.skipped)||undefined,
  suggest:w.stuck||w.skipped?`GENTLE deep dive (the kid got stuck): scaffold DOWN a level first (e.g. sixteenths via eighths, halving or money), learn card + 2 guided items with steps, then 3 graded that climb back up. No boss on this skill tomorrow.`:`deep dive: learn/why card + guided practice + 4-5 graded steps, start one notch easier, mix formats (avoid only ${Object.keys(w.qtypes).join('/')||'mc'})`,easierSteps:stepDown(w.topicId).slice(0,4)}));
const strengths=domains.filter(d=>d.weakScore===0&&d.correct>=2).map(d=>({domain:d.domain,subject:d.subject,correct:d.correct,
  stretchTo:frontierStretch(d.domain)}));
function frontierStretch(dm){return g.topics.filter(t=>t.domain===dm&&['ready','learning'].includes(E.stateOf(S,g,t.id,now))&&t.ageRangeStart>=L.age-1.5).sort((a,b)=>Math.abs(a.ageRangeStart-L.age)-Math.abs(b.ageRangeStart-L.age)).slice(0,3).map(t=>({id:t.id,name:t.name,age:t.ageRangeStart}));}
// topics the engine flagged (stuck / skipped) and skipped items waiting to come back (guided, a day later)
const needsSupport=Object.entries(S.support||{}).filter(([id,v])=>g.byId[id]&&(v.stuck||v.skipped)).map(([id,v])=>({topicId:id,name:g.byId[id].name,domain:g.byId[id].domain,stuck:v.stuck,skipped:v.skipped,lastAt:v.at?new Date(v.at).toISOString():null,
  bossPausedUntil:v.bossOff>now?new Date(v.bossOff).toISOString():undefined,easierSteps:stepDown(id).slice(0,4)}));
const requeued=(S.requeue||[]).map(x=>({topicId:x.item.topicId,name:g.byId[x.item.topicId]?.name,question:x.item.q,answer:x.item.answer,comesBackAfter:new Date(x.notBefore).toISOString(),times:x.n}));
const weakSpots={window:`${dayList[dayList.length-1]}..${date}`,rules:{slowSec:SLOW,idleIgnoredSec:IDLE,score:'misses×3 + hints×2 + slow + failedReviews×3 + unsure×2 + stuck×2 + skipped×3'},topics:weakTopics,domains,goDeeper,strengths,needsSupport,requeued};
// ---------- quests (v0.5: ONE current quest; newer packs wait queued) + glossary lookups ----------
const A=activeQuests(S);const qinfo=d=>{const p=kvGet('lessons:'+d);if(!p?.quest)return null;const b=kvGet('boost:'+d);const pp=b?E.applyBoost(p,b):p;const qi=E.questInfo(S,g,pp);
  const rr=S.quests?.[d]?.started?questReached(S,p):0;
  return{date:d,title:qi.title,startedAt:S.quests?.[d]?.started?new Date(S.quests[d].started).toISOString():null,done:qi.done,total:qi.total,pct:qi.pct,
    reachedStages:rr,lockedStages:qi.stages.slice(0,rr).map((s,i)=>({i,topicId:s.topicId,name:s.name})),refreshableStages:qi.stages.slice(rr).map((s,i)=>({i:i+rr,topicId:s.topicId,name:s.name,boss:s.boss})),
    remainingStages:qi.stages.map((s,i)=>({i,topicId:s.topicId,name:s.name,left:s.n-s.done,boss:s.boss})).filter(s=>s.left>0)};};
const qDates=[...new Set([...A,...dayList,ptDate(Date.parse(date+'T12:00:00Z')+864e5)])].filter(d=>d<=date).sort();
const LQ=E.questLineup(S,Object.fromEntries(qDates.map(d=>[d,kvGet('lessons:'+d)])),date);
const activeList=A.map(qinfo).filter(Boolean),cur=LQ.current&&!LQ.newQuest?qinfo(LQ.current):null;
// REFRESH starts from a copy of the stored pack (LESSONS.md "Refreshing the current quest"): exports/quest-<date>.json
if(cur){cur.packFile=path.join(path.dirname(out),`quest-${cur.date}.json`);fs.mkdirSync(path.dirname(cur.packFile),{recursive:true});fs.writeFileSync(cur.packFile,JSON.stringify(kvGet('lessons:'+cur.date),null,1));}
reviewHealth.gatesAhead=A.reduce((a,d)=>{const p=kvGet('lessons:'+d);return a+(p?.quest?E.questInfo(S,g,p).gates.filter(x=>x.state==='locked').length:0);},0); // stage gates not reached yet in active quests
// ---------- teaching research (offline authoring input; research.mjs, LESSONS.md "Research briefs") ----------
// Compact briefs for the topics tonight's pack is most likely to touch; frontier entries with research get research:true.
// research.mjs and the research file are not in the Docker image: then the section says so and the export goes on.
let research={tool:'npm run research -- <topicId>',available:false,note:'research.mjs not available here'};
try{const R=await import('./research.mjs');
  research=R.nightlyResearch([['needsSupport',needsSupport.map(x=>x.topicId)],['goDeeper',goDeeper.map(x=>x.topicId)],
    ['questRefresh',(cur?.refreshableStages||[]).map(s=>s.topicId)],['stretch',strengths.flatMap(s=>s.stretchTo.map(t=>t.id))],
    ['frontier',frontier.filter(t=>R.briefData(t.id).research).slice(0,12).map(t=>t.id)]]);
  if(research.available)for(const t of frontier)if(R.briefData(t.id).research)t.research=true;
}catch(e){research.note=`research briefs skipped: ${e.message}`;}
const quests={current:cur,queued:LQ.queued,active:activeList.length,list:activeList,completed:Object.entries(S.quests||{}).filter(([,q])=>q.done).map(([d])=>d),
  nextStep:cur?`REFRESH: quest ${cur.date} ("${cur.title}", ${cur.pct}% done) is in progress. Do not publish a new quest. Copy ${cur.packFile} to packs/quest-${cur.date}.json, keep "date", "quest" and stages 1-${cur.reachedStages} unchanged, rewrite stages ${cur.reachedStages+1}+ (${cur.refreshableStages.length} now) from tonight's export, then: node publish-lessons.mjs packs/quest-${cur.date}.json --refresh --date ${cur.date} --dry-run (and again without --dry-run)`
    :'NEW QUEST: no quest in progress. Write tomorrow\'s quest and publish it normally.'};
const tl={};for(const l of logs)if(l.event==='term'){const k=l.term.toLowerCase();const x=tl[k]??={term:l.term,count:0,topics:new Set()};x.count++;if(l.topic)x.topics.add(l.topic);}
const termsLookedUp=Object.values(tl).map(x=>({...x,topics:[...x.topics]})).sort((a,b)=>b.count-a.count);
const res={exportedAt:new Date(now).toISOString(),date,timezone:'America/Los_Angeles',learner:S.name,summary:sm,
  stats:{points:S.points,stars:S.stars,streak:S.streak,bestStreak:S.bestStreak,solved:S.solved,badges:S.badges,placement:S.placement},
  unverifiedInferred:reviewHealth.unverifiedInferred, // inferred skills a gate spot-check has not confirmed yet
  coverage:areaCoverage(S,g,logs,{age:L.age,now}), // areas (Marble domains) seen per subject + starters for untouched ones (LESSONS.md "Coverage")
  reviewHealth, // spaced review runs through quest gates now: watch for starvation here (LESSONS.md "Review gates")
  todaysPack:pack?{date:pack.date,title:pack.title,topicIds:pack.topics.map(t=>t.topicId)}:null,
  quests,termsLookedUp,weakSpots,todayLog:log,learnedToday:log.filter(l=>l.event==='mastered'),
  // household region filter (HIDE_REGIONS): these topics are not in the app, the frontier or the totals; progress on them is kept
  hiddenRegions:{regions:hiddenRegions,topics:Object.keys(g.hidden).length,mastered:Object.keys(g.hidden).filter(id=>S.ts[id]?.st==='mastered').length,medals:(S.medals||[]).filter(m=>g.hidden[m.id]).length},
  research,frontier,reviewDue,fog:E.fogState(S,g),campaign:E.campaignState(S,g),
  market:E.marketExport(S,g,now), // Points Market: spend vs earn for price tuning (target 50–70% of earned points spent), choices to honor
  progress:S};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,E.withName(JSON.stringify({learner:L,...res},null,1),JSON.stringify(L.name).slice(1,-1)));
console.log(`  📚 research briefs: ${research.available?`${Object.keys(research.briefs).length} attached, ${research.pointers.length} more as pointers (npm run research -- <topicId>)`:research.note}`);
const fog=res.fog;if(fog)console.log(`  🌫️ fog: ${fog.clear}/${fog.total} clear (${fog.pct}%), ${fog.finds.length} finds claimed, ${(fog.available||[]).length} waiting`);
if(hiddenRegions.length)console.log(`  🌏 hidden regions: ${hiddenRegions.join(',')} (${res.hiddenRegions.topics} topics left out of the app and this export; never put them in a pack)`);
{const m=res.market;console.log(`  🛒 market: balance ${m.balance}, spent ${m.spent} (7d: spent ${m.spent7d} / earned ${m.earned7d??'?'})`);}
console.log(`  🗺️ quests: ${quests.nextStep}`);if(termsLookedUp.length)console.log(`  📘 looked up: ${termsLookedUp.slice(0,10).map(t=>t.term+'×'+t.count).join(', ')}`);
for(const x of goDeeper)console.log(`  🔎 go deeper${x.needsSupport?' (GENTLE, the kid got stuck)':''}: ${x.name} (${x.domain}): ${x.why}`);for(const x of strengths)console.log(`  💪 strength: ${x.domain} → stretch to ${x.stretchTo.map(t=>t.name).join(', ')||'(nothing ready)'}`);
console.log(`✅ wrote ${out}: ${sm.done}/${sm.total} mastered (${sm.pct}%), ${frontier.length} frontier, ${reviewDue.length} review due, ${log.filter(l=>!l.event).length} answers today`);
