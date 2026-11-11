// "Help shape Jane" check-in (v0.8.3): every few quests Jane asks the learner 1-2 open questions and saves the answers.
// v0.8.4: every 8 finished quests (was 3 in v0.8.3).
// Storage: its own per-learner KV key "feedback" (sandbox + learner prefix like progress), never the progress record,
// so a check-in can never touch medals, mastery or points. Pure functions here; the Worker/Node server do the KV I/O.
//
// Record: {v:1, asks:n, baseline:<quests done when last answered/closed>, skipDay:"YYYY-MM-DD"|null, skips:n,
//          entries:[{at, day, questions:[...], answers:[...], quests:<done count>, quest:{date,title}|null}]}
// A learner with no record yet gets the check-in on the next app open. After answering it comes back once
// EVERY quests more are finished. "Not now" hides it for the rest of that Pacific day; after SNOOZES "not now"s
// in a row it counts as asked, so it waits for the next EVERY quests instead of nagging.
export const EVERY=8,SNOOZES=2,MAX_ANSWER=500,MAX_ENTRIES=200;
// question pairs, asked in turn (the first pair is the default first check-in)
export const POOL=[
  ['What was the most fun part of Jane lately, and why?','If you could add or change one thing in Jane, what would it be?'],
  ['Was anything in your last few quests too easy or too hard? Which part?','What would you love to learn about next?'],
  ['If you could design your own quest, what would it be about?','Is anything in Jane confusing or annoying? What should we fix?'],
  ['What is the coolest thing you learned in Jane lately?','What would make you want to play Jane even more?'],
];
export const questsDone=S=>Object.values(S?.quests||{}).filter(q=>q&&q.done).length;
const lastQuest=S=>{const e=Object.entries(S?.quests||{}).filter(([,q])=>q&&q.done).sort((a,b)=>b[1].done-a[1].done)[0];return e?e[0]:null;};
export function questionsFor(F){return POOL[((F?.asks)|0)%POOL.length];}
// is a check-in due right now? (pure; F = stored record or null)
export function feedbackState(F,S,today){const done=questsDone(S);
  // the first check-in stays due until it is answered (or "not now" twice), whatever the quest count (a single "not now" must not push it back)
  const due=!F||!((F.asks)|0)||done-((F.baseline)|0)>=EVERY;const snoozed=!!F&&F.skipDay===today;
  return{pending:due&&!snoozed,due,snoozed,questsDone:done,nextAt:F?((F.baseline)|0)+EVERY:done,questions:questionsFor(F),count:F?.entries?.length||0};}
const clean=s=>String(s??'').replace(/[<>]/g,'').replace(/\s+\n/g,'\n').trim().slice(0,MAX_ANSWER);
// apply a POST {answers:[...]} or {skip:true}; returns {F (new record), entry?, error?}. Never reads or writes progress.
export function feedbackApply(F,S,body,{now,today,questTitle}={}){
  const R={v:1,asks:0,baseline:0,skipDay:null,skips:0,entries:[],...(F||{})};R.entries=[...(R.entries||[])];
  const done=questsDone(S),qs=questionsFor(F);
  if(body?.skip){R.skipDay=today;R.skips=(R.skips|0)+1;
    if(R.skips>=SNOOZES){R.baseline=done;R.asks=(R.asks|0)+1;R.skips=0;R.skipDay=today;}
    return{F:R,skipped:true};}
  const ans=(Array.isArray(body?.answers)?body.answers:[]).slice(0,qs.length).map(clean);
  if(!ans.some(Boolean))return{F:F||null,error:'Type an answer, or tap "Not now"!'};
  const qd=lastQuest(S);
  const entry={at:now,day:today,questions:qs,answers:qs.map((_,i)=>ans[i]||''),quests:done,quest:qd?{date:qd,title:questTitle?.(qd)||null}:null};
  R.entries.push(entry);if(R.entries.length>MAX_ENTRIES)R.entries=R.entries.slice(-MAX_ENTRIES);
  R.baseline=done;R.asks=(R.asks|0)+1;R.skips=0;R.skipDay=null;
  return{F:R,entry};}
// newest first, for the parent view and the export
export const feedbackList=F=>[...(F?.entries||[])].sort((a,b)=>(b.at||0)-(a.at||0));
