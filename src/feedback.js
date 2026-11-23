// "Help shape Jane" check-in (v0.8.3): every few quests Jane asks the learner 1-2 open questions and saves the answers.
// v0.8.4: every 8 finished quests (was 3 in v0.8.3).
// v0.9.2: interest questions are casual and indirect (not "design a quest"); both the interest pool and the
// app/fix pool rotate per learner so the same wording is not repeated until that pool is mostly used, and
// back-to-back prompts avoid the same angle when another unused angle is available.
// Storage: its own per-learner KV key "feedback" (sandbox + learner prefix like progress), never the progress record,
// so a check-in can never touch medals, mastery or points. Pure functions here; the Worker/Node server do the KV I/O.
//
// Record: {v:1, asks:n, baseline:<quests done when last answered/closed>, skipDay:"YYYY-MM-DD"|null, skips:n,
//          askedInterest:[id...], askedShape:[id...],
//          entries:[{at, day, questions:[...], questionIds:[...], answers:[...], quests:<done count>, quest:{date,title}|null}]}
// A due check-in shows right after a quest's high-five in the same session (and on the next app open if they
// left before answering). After answering it comes back once EVERY quests more are finished. "Not now" hides it
// for the rest of that Pacific day; after SNOOZES "not now"s in a row it counts as asked, so it waits for the
// next EVERY quests instead of nagging.
export const EVERY=8,SNOOZES=2,MAX_ANSWER=500,MAX_ENTRIES=200;

// Casual, open-ended interest prompts (ages ~10-17). Different angles, never a menu, never "design a quest."
export const INTEREST=[
  {id:'int_wonder',angle:'wonder',text:"What's something you've been wondering about lately?"},
  {id:'int_seen',angle:'media',text:"Seen or read anything cool this week? What was it?"},
  {id:'int_expert',angle:'expert',text:"If you could ask an expert one question about anything, what would you ask?"},
  {id:'int_free_day',angle:'free_day',text:"If you had a whole free day to look into anything, what would you pick?"},
  {id:'int_surprise',angle:'surprise',text:"What's something that surprised you recently?"},
  {id:'int_job',angle:'job',text:"Seen a job or kind of work that looks pretty cool? What is it?"},
  {id:'int_place',angle:'place',text:"If you could go explore any place, where would you go and what would you want to see?"},
  {id:'int_watched',angle:'media',text:"Watched anything lately that you can't stop thinking about?"},
  {id:'int_made',angle:'make',text:"Made or built anything lately just because you wanted to? What was it?"},
  {id:'int_everyday',angle:'how_it_works',text:"What's something you see every day and still don't really know how it works?"},
  {id:'int_past',angle:'past',text:"Any time or event in the past you wish you could have seen for yourself?"},
  {id:'int_future',angle:'future',text:"What's something about the future you keep thinking about?"},
  {id:'int_rabbit',angle:'rabbit',text:"What's the last thing you couldn't stop looking up, even for a few minutes?"},
  {id:'int_tell',angle:'share',text:"If you told a friend about something interesting you noticed lately, what would it be?"},
  {id:'int_world',angle:'story',text:"Been into a game, a story, or a world lately? What stuck with you?"},
  {id:'int_invent',angle:'invent',text:"If you could invent a new tool or gadget, what would it do?"},
  {id:'int_nature',angle:'nature',text:"Any animal, place in nature, or science fact you've been curious about?"},
  {id:'int_art',angle:'art',text:"Heard a song, seen a drawing, or spotted a building that made you stop and wonder? What was it?"},
  {id:'int_problem',angle:'problem',text:"Seen a problem in the real world you wish someone would solve? What is it?"},
  {id:'int_question',angle:'wonder',text:"What's a question that popped into your head and wouldn't leave?"},
  {id:'int_wait_really',angle:'media',text:"Came across a video, article, or post that made you think, wait, really? What was it about?"},
  {id:'int_try',angle:'try',text:"What's something you wouldn't mind trying, even if you'd be bad at it at first?"},
];

// App questions: varied "what's confusing or annoying" phrasings, plus the other shape-Jane prompts.
export const SHAPE=[
  {id:'fun_part',angle:'fun',text:"What was the most fun part of Jane lately, and why?"},
  {id:'fix_original',angle:'fix',text:"Is anything in Jane confusing or annoying? What should we fix?"},
  {id:'change_one',angle:'change',text:"If you could add or change one thing in Jane, what would it be?"},
  {id:'fix_way',angle:'fix',text:"Did anything in Jane feel confusing or get in your way lately?"},
  {id:'difficulty',angle:'difficulty',text:"Was anything in your last few quests too easy or too hard? Which part?"},
  {id:'fix_figure',angle:'fix',text:"Was any part of Jane annoying or hard to figure out? What was it?"},
  {id:'coolest',angle:'coolest',text:"What is the coolest thing you learned in Jane lately?"},
  {id:'fix_one',angle:'fix',text:"If we could fix one thing in Jane that bugged you, what would it be?"},
  {id:'more_play',angle:'more',text:"What would make you want to play Jane even more?"},
  {id:'fix_screen',angle:'fix',text:"Did a button, a question, or a screen in Jane feel weird or unclear?"},
  {id:'fix_easier',angle:'fix',text:"Anything in Jane you'd change so it's easier or less annoying?"},
  {id:'fix_last',angle:'fix',text:"What, if anything, made Jane feel confusing the last time you played?"},
  {id:'fix_stuck',angle:'fix',text:"Stuck or annoyed by anything in Jane recently? What happened?"},
];
export const FIX=SHAPE.filter(q=>q.angle==='fix');

export const questsDone=S=>Object.values(S?.quests||{}).filter(q=>q&&q.done).length;
const lastQuest=S=>{const e=Object.entries(S?.quests||{}).filter(([,q])=>q&&q.done).sort((a,b)=>b[1].done-a[1].done)[0];return e?e[0]:null;};
const lastOf=(pool,ids)=>{if(!ids?.length)return null;return pool.find(q=>q.id===ids[ids.length-1])||null;};
// Pick the next prompt: unused ids first, skip the last angle when another unused angle exists,
// and start a new cycle (everything except the last id) once the pool is used up.
export function pickFrom(pool,askedIds,last){
  const asked=new Set(askedIds||[]);
  let avail=pool.filter(q=>!asked.has(q.id));
  if(!avail.length)avail=pool.filter(q=>q.id!==last?.id);
  const angled=last?avail.filter(q=>q.angle!==last.angle):avail;
  return(angled.length?angled:avail)[0];
}
const pushAsked=(askedIds,id)=>{const a=[...(askedIds||[])];return a.includes(id)?[id]:a.concat(id);};
export function picksFor(F){
  return[
    pickFrom(INTEREST,F?.askedInterest,lastOf(INTEREST,F?.askedInterest)),
    pickFrom(SHAPE,F?.askedShape,lastOf(SHAPE,F?.askedShape)),
  ];
}
export function questionsFor(F){return picksFor(F).map(q=>q.text);}
// is a check-in due right now? (pure; F = stored record or null)
export function feedbackState(F,S,today){const done=questsDone(S);
  // the first check-in stays due until it is answered (or "not now" twice), whatever the quest count (a single "not now" must not push it back)
  const due=!F||!((F.asks)|0)||done-((F.baseline)|0)>=EVERY;const snoozed=!!F&&F.skipDay===today;
  return{pending:due&&!snoozed,due,snoozed,questsDone:done,nextAt:F?((F.baseline)|0)+EVERY:done,questions:questionsFor(F),count:F?.entries?.length||0};}
const clean=s=>String(s??'').replace(/[<>]/g,'').replace(/\s+\n/g,'\n').trim().slice(0,MAX_ANSWER);
const remember=(R,ps)=>{R.askedInterest=pushAsked(R.askedInterest,ps[0].id);R.askedShape=pushAsked(R.askedShape,ps[1].id);};
// apply a POST {answers:[...]} or {skip:true}; returns {F (new record), entry?, error?}. Never reads or writes progress.
export function feedbackApply(F,S,body,{now,today,questTitle}={}){
  const R={v:1,asks:0,baseline:0,skipDay:null,skips:0,askedInterest:[],askedShape:[],entries:[],...(F||{})};R.entries=[...(R.entries||[])];
  R.askedInterest=[...(R.askedInterest||[])];R.askedShape=[...(R.askedShape||[])];
  const done=questsDone(S),ps=picksFor(F),qs=ps.map(q=>q.text);
  if(body?.skip){R.skipDay=today;R.skips=(R.skips|0)+1;
    if(R.skips>=SNOOZES){remember(R,ps);R.baseline=done;R.asks=(R.asks|0)+1;R.skips=0;R.skipDay=today;}
    return{F:R,skipped:true};}
  const ans=(Array.isArray(body?.answers)?body.answers:[]).slice(0,qs.length).map(clean);
  if(!ans.some(Boolean))return{F:F||null,error:'Type an answer, or tap "Not now"!'};
  const qd=lastQuest(S);
  const entry={at:now,day:today,questions:qs,questionIds:ps.map(q=>q.id),answers:qs.map((_,i)=>ans[i]||''),quests:done,quest:qd?{date:qd,title:questTitle?.(qd)||null}:null};
  R.entries.push(entry);if(R.entries.length>MAX_ENTRIES)R.entries=R.entries.slice(-MAX_ENTRIES);
  remember(R,ps);R.baseline=done;R.asks=(R.asks|0)+1;R.skips=0;R.skipDay=null;
  return{F:R,entry};}
// newest first, for the parent view and the export
export const feedbackList=F=>[...(F?.entries||[])].sort((a,b)=>(b.at||0)-(a.at||0));
