// Parent report data (read-only). Rendered client-side by public/parent.js.
import * as E from './engine.js';import {coverage as areaCoverage} from './coverage.js';
const DAY=864e5;
export const ptDate=(ms)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const CAP=120; // seconds counted per answer (longer = idle)
export function parentData({S,g,now,today,logs,packs,tomorrowPack,boosts}){
  const sm=E.summary(S,g,now);const st=id=>E.stateOf(S,g,id,now);
  const days=Object.keys(logs).sort();const all=days.flatMap(d=>(logs[d]||[]).map(l=>({...l,day:d})));
  const answers=all.filter(l=>!l.event&&l.regraded!=='neutral');
  const secs=l=>Math.min(CAP,Math.max(0,l.elapsedSec||0));
  // per-day activity
  const perDay=days.map(d=>{const A=answers.filter(l=>l.day===d),F=A.filter(l=>l.try===1);const ev=(logs[d]||[]).filter(l=>l.event);
    return{date:d,answers:A.length,first:F.length,firstRight:F.filter(l=>l.correct).length,minutes:Math.round(A.reduce((a,l)=>a+secs(l),0)/60),
      mastered:ev.filter(l=>l.event==='mastered').length,inferred:ev.filter(l=>l.event==='inferred').reduce((a,l)=>a+(l.count||0),0),lookups:ev.filter(l=>l.event==='term').length};});
  // mastery growth: cumulative mastered/inferred by PT day (from record timestamps)
  const recs=Object.entries(S.ts).filter(([id,r])=>r.st==='mastered'&&g.byId[id]);
  const growth=days.map(d=>({date:d,direct:recs.filter(([,r])=>r.how!=='inferred'&&r.at&&ptDate(r.at)<=d).length,all:recs.filter(([,r])=>r.at&&ptDate(r.at)<=d).length}));
  const week=perDay.slice(-7);
  const head={pct:sm.pct,done:sm.done,total:sm.total,tot:sm.tot,direct:recs.filter(([,r])=>r.how!=='inferred').length,verified:recs.filter(([,r])=>r.verified).length,unverifiedInferred:recs.filter(([id])=>E.unverified(S,id)).length,points:S.points,wallet:{balance:E.balanceOf(S),earned:S.points||0,spent:S.wallet?.spent||0,items:(S.wallet?.ledger||[]).length},stars:S.stars,streak:S.streak,bestStreak:S.bestStreak,solved:S.solved,
    medals:E.trophies(S,g).medals.length,today:perDay.find(p=>p.date===today)||{answers:0,minutes:0,first:0,firstRight:0},
    week:{minutes:week.reduce((a,p)=>a+p.minutes,0),answers:week.reduce((a,p)=>a+p.answers,0),first:week.reduce((a,p)=>a+p.first,0),firstRight:week.reduce((a,p)=>a+p.firstRight,0),days:week.filter(p=>p.answers).length}};
  // subjects → domains → topics
  const subjects={};for(const t of g.topics){const s=st(t.id),r=S.ts[t.id];const sub=subjects[t.subject]??={name:t.subject,total:0,c:{mastered:0,review:0,ready:0,learning:0,locked:0},domains:{}};sub.total++;sub.c[s]++;
    const d=sub.domains[t.domain]??={name:t.domain,ic:t.ic,total:0,c:{mastered:0,review:0,ready:0,learning:0,locked:0},topics:[]};d.total++;d.c[s]++;
    if(s!=='locked')d.topics.push({n:t.name,s,how:r?.how||null,age:t.ageRangeStart,c:r?.c||0,w:r?.w||0});}
  for(const sub of Object.values(subjects)){sub.domains=Object.values(sub.domains).sort((a,b)=>(b.c.mastered+b.c.review)/b.total-(a.c.mastered+a.c.review)/a.total);
    for(const d of sub.domains)d.topics.sort((a,b)=>({learning:0,review:1,mastered:2,ready:3}[a.s]-{learning:0,review:1,mastered:2,ready:3}[b.s])||a.age-b.age);}
  // weak spots & wins (last 7 days)
  const last7=new Set(days.slice(-7));const W={};
  for(const l of all){if(!last7.has(l.day)||!g.byId[l.topicId]||l.regraded==='neutral')continue;const w=W[l.topicId]??={id:l.topicId,name:g.byId[l.topicId].name,subject:g.byId[l.topicId].subject,hints:0,lm:0,slow:0,unsure:0,failed:0,right:0};
    if(l.event==='demoted'||l.event==='reviewMiss'){w.failed++;continue;}if(l.event==='skipped'||(l.event==='stuck'&&l.step===1)){w[l.event]=(w[l.event]||0)+1;continue;}if(l.event)continue;
    if(l.expected==='(self-check)'){if(l.given!=='yes')w.unsure++;continue;}if(l.try===1&&!l.correct)w.hints++;if(l.try>=2&&!l.correct)w.lm++;if(l.try===1&&l.correct)w.right++;if(l.elapsedSec>30&&l.elapsedSec<600)w.slow++;}
  const score=w=>w.lm*3+w.hints*2+w.slow+w.failed*3+w.unsure*2+(w.stuck||0)*2+(w.skipped||0)*3;
  const struggles=Object.values(W).map(w=>({...w,score:score(w),state:st(w.id)})).filter(w=>w.score>=2&&w.state!=='mastered'||w.score>=4).sort((a,b)=>b.score-a.score).slice(0,6);
  const wins=all.filter(l=>last7.has(l.day)&&l.event==='mastered').map(l=>({name:l.topic,how:l.how,day:l.day,subject:g.byId[l.topicId]?.subject}));
  const terms={};for(const l of all)if(l.event==='term'&&l.term){const k=l.term.toLowerCase();(terms[k]??={term:l.term,count:0,last:l.ts}).count++;terms[k].last=l.ts;}
  // quests
  const LQ=E.questLineup(S,packs,today);
  const quests=Object.values(packs).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{const pp=boosts[p.date]?E.applyBoost(p,boosts[p.date]):p;const qi=E.questInfo(S,g,pp);
    const A=answers.filter(l=>l.pack===p.date);
    return{...qi,stages:qi.stages.map((s,i)=>{const id=s.topicId,a=A.filter(l=>l.topicId===id),f=a.filter(l=>l.try===1);return{...s,topic:g.byId[id]?.name,first:f.length,firstRight:f.filter(l=>l.correct).length,lm:a.filter(l=>l.learningMoment||(l.try>=2&&!l.correct)).length};}),
      boost:pp.boost||null,queued:LQ.queued.includes(p.date)||undefined,questMedal:(S.questMedals||[]).find(m=>m.date===p.date)||null};});
  const tonight=tomorrowPack?{date:tomorrowPack.date,title:tomorrowPack.quest?.title||tomorrowPack.title,hook:tomorrowPack.quest?.hook||'',stages:tomorrowPack.topics.map(t=>({name:t.stage?.name||g.byId[t.topicId]?.name,deep:!!t.deepDive,review:!!t.review,boss:t.format==='boss'}))}:null;
  // upcoming reviews
  const reviews=recs.filter(([,r])=>r.how!=='inferred').map(([id,r])=>({n:g.byId[id].name,subject:g.byId[id].subject,due:r.due,box:r.box||0,overdue:r.due<=now})).sort((a,b)=>a.due-b.due).slice(0,40);
  const inferredDue=recs.filter(([,r])=>r.how==='inferred'&&r.due<=now+7*DAY).length;
  // log + medals
  const log=answers.map(l=>({ts:l.ts,day:l.day,subject:l.subject,topic:l.topic,mode:l.mode,qtype:l.qtype||'',q:l.question,exp:l.expected,given:l.given,ok:!!l.correct,try:l.try,secs:l.elapsedSec,lm:!!l.learningMoment,regraded:l.regraded||null,creative:!!l.creative,stage:l.stage}));
  const medals=E.trophies(S,g).medals;
  // coverage by area (Marble domains) from records + the 14-day logs (LESSONS.md "Coverage")
  const cv=areaCoverage(S,g,all,{age:E.learner().age,now});
  const coverage={seen:cv.seen,total:cv.total,subjects:cv.subjects.map(s=>({name:s.name,total:s.total,seen:s.seen,domains:s.domains.map(d=>({name:d.name,seen:d.seen,answered:d.answered,mastered:d.mastered,topics:d.topics}))}))};
  return{coverage,name:E.learner().name,grade:E.learner().grade,today,generated:now,head,perDay,growth,subjects:Object.values(subjects),struggles,wins,terms:Object.values(terms).sort((a,b)=>b.count-a.count),quests,tonight,reviews,inferredDue,log,medals,placement:S.placement};}
export function parentShell(data){const json=E.withName(JSON.stringify(data),JSON.stringify(data.name).slice(1,-1)).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parent report: ${String(data.name).replace(/[&<>"]/g,'')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/parent.css"><script src="/vendor/ui.js" defer></script><script src="/fx.js" defer></script></head><body data-fx="calm"><div id="app"><div class="wrap skel" aria-busy="true" aria-label="Loading report"><div class="sk" style="height:64px;margin:16px 0"></div><div class="sk" style="height:220px"></div><div class="sk" style="height:180px;margin-top:16px"></div></div></div>
<script id="data" type="application/json">${json}</script><script src="/parent.js" defer></script></body></html>`;}
