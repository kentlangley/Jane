#!/usr/bin/env node
// Validate a lesson pack / quest JSON file and write it to KV as lessons:<date>.
// Usage: node publish-lessons.mjs <pack.json> [--date YYYY-MM-DD] [--dry-run] [--force] [--local] [--offline]
//        node publish-lessons.mjs <pack.json> --refresh --date <quest date> [--dry-run] [--local]
// Exit codes: 1 invalid pack, 2 usage, 3 a quest is in progress (refresh it instead), 4 the quest is finished and locked
//   (never overwritten, even with --force), 6 a refresh changed a stage the learner already reached (or the quest block).
//        --local (or STORAGE=file) publishes into the standalone server's DATA_DIR instead of Cloudflare KV.
// v0.5: ONE quest at a time. While a quest is started and unfinished, don't publish a new one (exit 3, --force overrides;
// it would only wait queued): --refresh it instead. A refresh keeps every reached stage and the quest block byte-identical
// and may change, add or drop the stages after them; the size budget applies to those remaining stages.
// Catch-up boosts are retired (exit 1); the app still honours a boost:<date> key published before v0.5.
import fs from 'fs';import {kvPut,kvGet,kvList,loadTax,activeQuests,questReached,learnerConfig,LOCAL,DIR,lk,learner,optValues} from './lib-cli.mjs';import {checkRegionFilter} from './lib-regions.mjs';import * as EN from './src/engine.js';import {coverage,seenAreas} from './src/coverage.js';
// Learner settings from wrangler.toml [vars]. Packs may write {name}; the app fills it in. Prompts must talk to the learner as "you".
EN.configure(learnerConfig());const LRN=EN.learner();
const NAMES=[LRN.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'\\{name\\}','the learner'].join('|');
const THIRD=new RegExp(`(?:^|[^\\w{])(?:${NAMES}) (?:can|is|has|does|should|wants|gets|saves)\\b|\\bCan (?:${NAMES})|\\bhe\\b|\\bhis\\b`,'i');
const YOU='talk to the learner as "you"';
const args=process.argv.slice(2);const file=args.find(a=>!a.startsWith('--')&&!optValues.has(a));
const dateArg=args.includes('--date')?args[args.indexOf('--date')+1]:null,dry=args.includes('--dry-run'),force=args.includes('--force'),refreshArg=args.includes('--refresh');
if(!file){console.error('Usage: node publish-lessons.mjs <pack.json> [--date YYYY-MM-DD] [--dry-run]');process.exit(2);}
const pack=JSON.parse(fs.readFileSync(file,'utf8'));if(dateArg)pack.date=dateArg;
// Finished quests are locked (LESSONS.md "Finished quests are locked"): never overwrite or boost one, even with --force.
// Reads the learner's progress read-only; --offline skips the lookup.
let PROG=null;if(!args.includes('--offline'))try{PROG=kvGet(lk('progress'));}catch{}
const LOCKED=4,lockedQuest=d=>!!PROG?.quests?.[d]?.done;
const refuseLocked=d=>{console.error(`⛔ quest ${d} is finished and locked. Nothing was written: put new material in the next quest.`);process.exit(LOCKED);};
const wcount=x=>String(x||'').trim().split(/\s+/).filter(Boolean).length;
function checkTerms(terms,P,E,W){if(terms==null)return;if(typeof terms!=='object'||Array.isArray(terms)){E(P,'object {"word": "definition"} or {"word": {"d": "...", "e": "🎣"}}');return;}
  for(const [k,v] of Object.entries(terms)){const d=typeof v==='string'?v:v?.d;if(!k.trim()||typeof d!=='string'||!d.trim()){E(`${P}.${k}`,'needs a definition string');continue;}
    if(wcount(d)>15)W(`${P}.${k}`,`${wcount(d)} words (definitions ≤ 15)`);if(THIRD.test(d)||new RegExp(`(?:^|[^\\w{])(?:${NAMES})(?![\\w}])`,'i').test(d))W(`${P}.${k}`,YOU);if(v?.e!=null&&typeof v.e!=='string')E(`${P}.${k}.e`,'emoji string');}}
// ---------- catch-up boost (retired in v0.5: refresh the current quest instead) ----------
if(pack.boostFor){if(lockedQuest(pack.boostFor))refuseLocked(pack.boostFor);
  console.error(`❌ catch-up boosts are retired (one quest at a time since v0.5). Refresh the quest's unreached stages instead:\n   node publish-lessons.mjs <pack.json> --refresh --date ${pack.boostFor}   (see LESSONS.md "Refreshing the current quest")`);process.exit(1);const errs=[],warns=[];const E=(p,m)=>errs.push(`${p}: ${m}`),W=(p,m)=>warns.push(`${p}: ${m}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(pack.boostFor))E('boostFor','quest date YYYY-MM-DD');if(!pack.message)E('message','a short, fun encouragement is required');else if(wcount(pack.message)>25)W('message','≤ 25 words');
  const q=dry&&args.includes('--offline')?null:kvGet(lk('lessons:')+pack.boostFor);if(!dry&&!q?.quest)E('boostFor',`no quest published at lessons:${pack.boostFor}`);
  const ids=new Set((q?.topics||[]).map(t=>t.topicId));
  for(const [id,n] of Object.entries(pack.trim||{})){if(q&&!ids.has(id))E(`trim.${id}`,'not a stage of that quest');if(!Number.isInteger(n)||n<1)E(`trim.${id}`,'integer ≥ 1 (max graded questions left in that stage)');}
  for(const [id,h] of Object.entries(pack.hints||{})){if(q&&!ids.has(id))E(`hints.${id}`,'not a stage of that quest');if(typeof h!=='string'||!h.trim())E(`hints.${id}`,'string');else if(wcount(h)>15)W(`hints.${id}`,'≤ 15 words');}
  checkTerms(pack.terms,'terms',E,W);
  if(warns.length)console.warn('⚠️  '+warns.join('\n  '));if(errs.length){console.error(`❌ ${errs.length} problem(s):\n  `+errs.join('\n  '));process.exit(1);}
  if(dry){console.log(`✅ valid boost for quest ${pack.boostFor} (dry run)`);process.exit(0);}
  kvPut(lk('boost:')+pack.boostFor,pack);console.log(`✅ published${LOCAL?' (local)':''} ${lk('boost:')}${pack.boostFor} — ${Object.keys(pack.trim||{}).length} trimmed stages, ${Object.keys(pack.hints||{}).length} extra hints`);process.exit(0);}
if(pack.quest&&lockedQuest(pack.date))refuseLocked(pack.date);
// ---------- refresh (v0.5): the started, unfinished quest at this date; reached stages are immutable ----------
const SIX=6,startedHere=!!(pack.quest&&PROG?.quests?.[pack.date]?.started),REFRESH=refreshArg||startedHere;let RR=0,PREV=null;
if(refreshArg&&!dateArg){console.error('❌ --refresh needs --date <quest date> (the date of the quest in progress)');process.exit(2);}
if(refreshArg&&(!PROG||!pack.quest)){console.error(`❌ --refresh needs ${!pack.quest?'a quest pack':'the learner\'s progress (drop --offline)'}`);process.exit(2);}
if(refreshArg&&!startedHere){console.error(`❌ quest ${pack.date} isn't in progress, so there is nothing to refresh. Publish it normally${PROG?.quests?.[pack.date]?'':' (or check the date)'}.`);process.exit(1);}
if(REFRESH){try{PREV=kvGet(lk('lessons:')+pack.date);}catch{}if(!PREV?.quest){console.error(`❌ no quest published at lessons:${pack.date} to refresh`);process.exit(1);}
  RR=questReached(PROG,PREV);const bad=[];
  if(JSON.stringify(pack.quest)!==JSON.stringify(PREV.quest))bad.push('the quest block (title, hook, medal) changed');
  for(let i=0;i<RR;i++){const a=PREV.topics[i],b=(pack.topics||[])[i];if(JSON.stringify(a)!==JSON.stringify(b))bad.push(`stage ${i+1} "${a.stage?.name||a.topicId}" ${b?'changed':'is missing'}`);}
  if(bad.length){console.error(`⛔ refresh of ${pack.date} touches what the learner already reached (stages 1-${RR} and the quest block are locked). Nothing was written:\n  `+bad.join('\n  ')+`\n   Copy stages 1-${RR} unchanged from the stored pack and change only stages ${RR+1}+.`);process.exit(SIX);}
  if(!refreshArg)console.warn(`ℹ️  ${pack.date} is the quest in progress: treating this as --refresh (stages 1-${RR} locked).`);}
// Researched Math/Science stages (LESSONS.md "Researched stages"): warnings only. research.mjs and the research file are
// offline-only (not in the Docker image); without them these checks are skipped.
let RS=null;try{const R=await import('./research.mjs');if(R.researchAvailable())RS=R;}catch{}
const tax=loadTax(),byId=Object.fromEntries(tax.topics.map(t=>[t.id,t])),errs=[],warns=[];checkRegionFilter(tax,DIR);const hiddenIds=new Set((tax.hidden?.topics||[]).map(t=>t.id));
const unknownTopic=id=>hiddenIds.has(id)?`topic "${id}" is hidden in this household (HIDE_REGIONS=${tax.hidden.regions.join(',')}); pick another topic`:`unknown Marble topic id "${id}"`;const E=(p,m)=>errs.push(`${p}: ${m}`),W=(p,m)=>warns.push(`${p}: ${m}`);
const str=(v,p,req=true)=>{if(v==null||v===''){if(req)E(p,'required string');return false;}if(typeof v!=='string'){E(p,'must be a string');return false;}return true;};
const strs=(a,p,min,max)=>{if(!Array.isArray(a)||a.length<min||a.length>max||!a.every(x=>typeof x==='string'&&x.trim())){E(p,`${min}-${max} non-empty strings`);return false;}if(new Set(a).size!==a.length)E(p,'items must be unique');return true;};
const num=v=>typeof v==='number'&&isFinite(v);const wc=x=>String(x||'').trim().split(/\s+/).filter(Boolean).length;
const FORMATS=['quest','story','mystery','minigame','timed','boss','explore','guided'];
const TYPES=['mc','numeric','text','creative','picture','blank','order','match','truefalse','numberline','fracbar','why','fact','learn'];const CARDS=['why','fact','learn'];
const TPL={pizza:['slices'],fracbar:['parts'],numberline:['min','max'],timeline:['events'],foodweb:['chain'],orbit:['planets']};
const unsafe=s=>/<script|<foreignObject|\son\w+\s*=|javascript:|<iframe|<image[^>]+href\s*=\s*["']?https?:/i.test(s);
const parseNum=s=>{s=String(s).trim();const m=s.match(/^(-?\d+)\s*\/\s*(\d+)$/);return m?+m[1]/+m[2]:+s;};
const third=p=>THIRD.test(p||'');
function scene(v,P){if(v==null)return;if(!str(v,P))return;if(v.trim().startsWith('<')){if(!/^<svg[\s>]/.test(v.trim()))E(P,'SVG scenes must start with <svg');if(unsafe(v))E(P,'no scripts, event handlers, external images or foreignObject in SVG');if(v.length>12000)W(P,`${v.length} chars of SVG (keep scenes under ~12k)`);}
  else if(v.length>40)W(P,'emoji scene: keep it to a few emoji');}
function tpl(t,P){if(t==null)return;if(typeof t!=='object'||!TPL[t.type]){E(P+'.type','one of '+Object.keys(TPL).join('|'));return;}for(const k of TPL[t.type])if(t[k]==null)E(P+'.'+k,`required for ${t.type}`);
  if(t.type==='numberline'&&!(t.max>t.min))E(P,'max must be > min');if(['timeline','foodweb','orbit'].includes(t.type)){const a=t.events||t.chain||t.planets;if(!Array.isArray(a)||a.length<2||!a.every(Array.isArray))E(P,'needs an array of [..] rows (2+)');}}
if(!/^\d{4}-\d{2}-\d{2}$/.test(pack.date||''))E('date','must be YYYY-MM-DD (or pass --date)');
str(pack.title,'title',false);if(!Array.isArray(pack.topics)||!pack.topics.length)E('topics','must be a non-empty array');
const Q=pack.quest;
// Points Market picks (LESSONS.md "Market choices"): "honors": {"path": topicId|"declined", "theme": themeId|"declined", "note"}
if(pack.honors!=null){const H=pack.honors;if(typeof H!=='object'||Array.isArray(H))E('honors','an object like {"path": "<topicId>", "theme": "pirates"}');
  else{for(const k of Object.keys(H))if(!['path','theme','note'].includes(k))E('honors.'+k,'only "path", "theme" and "note"');if(!pack.quest)E('honors','only a quest pack can honor a Market pick');
    if(H.path!=null&&H.path!=='declined'){if(!byId[H.path])E('honors.path',unknownTopic(H.path));else if(!(pack.topics||[]).some(t=>t.topicId===H.path))E('honors.path','the picked topic must be a stage of this quest');}
    if(H.theme!=null&&H.theme!=='declined'&&!EN.QUEST_THEMES.some(t=>t.id===H.theme))E('honors.theme','one of '+EN.QUEST_THEMES.map(t=>t.id).join('|')+' or "declined"');
    if(H.note!=null)str(H.note,'honors.note');}}
if(Q){str(Q.title,'quest.title');str(Q.hook,'quest.hook');str(Q.emoji,'quest.emoji',false);if(!Q.medal||!str(Q.medal.name,'quest.medal.name')||!str(Q.medal.emoji,'quest.medal.emoji'))E('quest.medal','{name, emoji} required');
  if(wc(Q.hook)>30)W('quest.hook',`${wc(Q.hook)} words (aim ≤ 30)`);if(third(Q.hook))W('quest.hook',YOU);
  const last=pack.topics?.[pack.topics.length-1];if(last&&last.format!=='boss'&&!pack.placement)E('topics[last]','a quest ends with a boss finale: set "format":"boss" on the last stage');
  if((pack.topics||[]).filter(t=>t.format==='boss').length>1)W('topics','more than one boss stage; only the last is the finale');
  (pack.topics||[]).forEach((t,i)=>{if(!t.stage?.name)E(`topics[${i}].stage.name`,'every quest stage needs a name');if(!t.stage?.emoji)W(`topics[${i}].stage.emoji`,'add an emoji for the quest path');});}
else W('quest','no "quest" block: this pack will show as a plain adventure (see LESSONS.md "Quests")');
checkTerms(pack.terms,'terms',E,W);
// fill-ins: acceptedAnswers (fuzzy: plural/singular, a/an/the, small typos) and open-ended warnings
function acc(q,Qp){for(const k of['accept','acceptedAnswers'])if(q[k]!=null&&!(Array.isArray(q[k])&&q[k].every(x=>typeof x==='string'&&x.trim())))E(Qp+'.'+k,'array of strings');}
const OPEN=/\b(finish|complete) (the|this|it|a)\b|\bas \w+ as an? _{3,}|\blike an? _{3,}|describ|example|\bname (a|an|one|some|something)\b|\bany\b|think of|your own|a word (that|for)|adjective|favorite|why do you|what would you/i;
function openEnded(q,Qp){const n=1+(q.accept?.length||0)+(q.acceptedAnswers?.length||0);if(OPEN.test(q.prompt||''))W(Qp,`looks open-ended (${n} accepted answer${n>1?'s':''}, many could make sense): use "creative", 3-choice mc, or add a clear clue (LESSONS.md "Fill-ins")`);
  else if(n===1&&String(q.answer||'').split(' ').length<=2&&!/\d/.test(q.answer))W(Qp,'one-answer fill-in: is that the ONLY sensible word? If not, use mc/creative or add acceptedAnswers');}
// Teach before test (LESSONS.md "Teach → practice → graded → boss"). Uses the learner's progress (read-only) when it can:
// mastered topics and stages the learner already finished are exempt. --offline skips the lookup (nothing counts as mastered).
if(!PROG)console.warn('ℹ️  no learner progress available: treating every topic as new for the teach-before-test rules');
const mastered=id=>PROG?.ts?.[id]?.st==='mastered';
const stageDone=t=>!!PROG&&(t.questions||[]).every((q,j)=>CARDS.includes(q.type)||PROG.packSeen?.[`${pack.date}:${t.topicId}:${j}`]);
const tooHard=a=>/\.\d{4,}/.test(String(a))||/\d\.\d+\s*%/.test(String(a)); // past thousandths, or a decimal percent: too hard for a boss
function steps(v,P,req){if(v==null){if(req)E(P,'guided practice needs "steps": 1-4 short strings shown before answering');return;}if(!Array.isArray(v)||!v.length||v.length>6||!v.every(x=>typeof x==='string'&&x.trim()))E(P,'1-6 non-empty strings');else v.forEach((x,k)=>{if(wc(x)>18)W(`${P}[${k}]`,`${wc(x)} words (steps ≤ 18)`);});}
// Optional on choice questions: "misconception": the wrong choice that comes from a listed research misconception, and
// "feedback": {"<wrong choice>": "short reply the app shows when that choice is picked"} (in place of the generic hint).
const choiceQs={}; // stage index → [{misconception}] for the researched-stage check below
function choiceExtras(q,Qp,ch){const wrong=ch.filter(c=>c!==String(q.answer));(choiceQs[Qp.replace(/\.questions.*/,'')]??=[]).push(q);
  if(q.misconception!=null&&!(typeof q.misconception==='string'&&wrong.includes(q.misconception)))E(Qp+'.misconception','must be one of the wrong choices (the one that comes from a misconception)');
  if(q.feedback!=null){if(typeof q.feedback!=='object'||Array.isArray(q.feedback)){E(Qp+'.feedback','object {"<wrong choice>": "short reply"}');return;}
    for(const [k,v] of Object.entries(q.feedback)){const P=`${Qp}.feedback[${JSON.stringify(k)}]`;if(!wrong.includes(k))E(P,'keys must be wrong choices of this question');
      if(typeof v!=='string'||!v.trim())E(P,'needs a short reply string');else{if(wc(v)>20)W(P,`${wc(v)} words (feedback ≤ 20)`);if(third(v))W(P,YOU);}}}}
const taught=new Set();
const seen=new Set();let nq=0,nGraded=0,nReview=0,nDeep=0,nCards=0;const typesUsed=new Set();
(pack.topics||[]).forEach((t,i)=>{const P=`topics[${i}]`,tp=byId[t.topicId];if(!tp)E(P+'.topicId',unknownTopic(t.topicId));if(seen.has(t.topicId))E(P+'.topicId','duplicate');seen.add(t.topicId);
  if(t.format&&!FORMATS.includes(t.format))E(P+'.format','one of '+FORMATS.join('|'));
  if(t.intro){str(t.intro.title,P+'.intro.title');str(t.intro.story,P+'.intro.story');str(t.intro.emoji,P+'.intro.emoji',false);if(wc(t.intro.story)>25)W(P+'.intro.story',`${wc(t.intro.story)} words (aim ≤ 25)`);}
  if(t.teaches!=null&&!(Array.isArray(t.teaches)&&t.teaches.every(x=>byId[x])))E(P+'.teaches','array of Marble topic ids this stage teaches or practises (for a later boss)');
  if(t.powerup!=null&&(typeof t.powerup!=='string'||wc(t.powerup)>30))E(P+'.powerup','string, ≤ 30 words (the "Boss ahead! Here\'s your power-up" recap)');
  if(t.review!=null&&typeof t.review!=='boolean')E(P+'.review','true|false');if(t.deepDive!=null&&typeof t.deepDive!=='boolean')E(P+'.deepDive','true|false');
  if(!Array.isArray(t.questions)||!t.questions.length)E(P+'.questions','non-empty array required');const qs=t.questions||[];
  const graded=qs.filter(q=>!CARDS.includes(q.type)).length;if(!graded)E(P+'.questions','needs at least one graded question (not only cards)');
  if(Q&&t.format==='boss'&&graded&&graded<3)E(P,`boss stage needs ≥ 3 graded questions (has ${graded}): a legendary medal means a real boss fight`);
  if(i>=RR){if(t.review)nReview+=graded;nGraded+=graded;nq+=qs.length;nCards+=qs.length-graded;} // refresh: the budget counts the remaining stages
  // two-tier "answer + why" finale (LESSONS.md "Check-understanding items"): a boss may END with an mc answer and an mc
  // reason ("twoTier": "answer" then "why"), e.g. from data/checks (npm run research -- <id> --check). Fair-boss rules still apply.
  {const tt=qs.map((q,j)=>[q.twoTier,j]).filter(([v])=>v!=null);
   for(const [v,j] of tt){const Qp=`${P}.questions[${j}]`;if(!['answer','why'].includes(v))E(Qp+'.twoTier','"answer" or "why"');else if(qs[j].type!=='mc')E(Qp+'.twoTier','two-tier items are mc questions');}
   if(tt.length){const last=qs.length-1;
     if(t.format!=='boss')E(P,'"twoTier" items are for the boss finale (use a guided or graded stage for other checks)');
     else if(tt.length!==2||qs[last]?.twoTier!=='why'||qs[last-1]?.twoTier!=='answer')E(P,'a two-tier finale is exactly two questions at the end of the boss: "twoTier": "answer", then "twoTier": "why"');}}
  if(t.deepDive){nDeep++;if(graded<3)E(P,`deep dive needs ≥ 3 graded questions (has ${graded})`);if(graded>4)W(P,`deep dive has ${graded} graded questions (aim 3-4 to keep quests short)`);if(!qs.some(q=>q.type==='why'||q.type==='learn'))E(P,'deep dive needs a "why" or "learn" card');
    if(new Set(qs.map(q=>q.type).filter(x=>!CARDS.includes(x))).size<3)W(P,'deep dive: mix at least 3 question types');}
  if(tp&&tp.ageRangeStart<LRN.age-2&&!pack.placement)W(P,`"${tp.name}" starts at age ${tp.ageRangeStart}: below the target level (${LRN.grade}, ~age ${LRN.age})`);
  // teach → guided practice → graded, for every new (not mastered) skill; boss stages only test what was taught, practised or mastered
  if(Q&&tp&&!stageDone(t)&&!pack.placement){const done=stageDone(t),isNew=!mastered(t.topicId)&&!t.review;
    if(t.format==='boss'){for(const id of new Set([t.topicId,...qs.map(q=>q.skill).filter(Boolean)]))if(!mastered(id)&&!taught.has(id))E(P,`boss tests "${byId[id]?.name||id}" but no earlier stage taught or practised it (add "teaches": ["${id}"] to an earlier stage with a learn card and guided practice) and it isn't mastered yet`);
      if(!t.powerup)W(P+'.powerup','add a short "Boss ahead! Here\'s your power-up" recap (the app builds one from the earlier learn card otherwise)');
      qs.forEach((q,j)=>{if(!CARDS.includes(q.type)&&tooHard(q.answer))E(`${P}.questions[${j}]`,`"${q.answer}" is too hard for a boss (more than 3 decimal places or a decimal percent). Teach it in a guided stage instead`);});}
    else if(isNew&&!done){const fg=qs.findIndex(q=>!CARDS.includes(q.type));
      if(!['learn','why'].includes(qs[0]?.type))E(P,`new skill: start with a "learn" card (idea + worked example) or a "why" card before any question`);
      if(fg>=0&&!qs[fg].guided)E(`${P}.questions[${fg}]`,'new skill: the first graded question must be guided practice ("guided": true with "steps")');}}
  if(!t.review&&qs.some(q=>q.type==='learn'||q.type==='why')&&qs.some(q=>q.guided)){taught.add(t.topicId);for(const x of t.teaches||[])taught.add(x);}
  qs.forEach((q,j)=>{const Qp=`${P}.questions[${j}]`;typesUsed.add(q.type);
    if(q.skill!=null&&!byId[q.skill])E(Qp+'.skill',unknownTopic(q.skill));if(q.guided!=null&&typeof q.guided!=='boolean')E(Qp+'.guided','true|false');
    if(!CARDS.includes(q.type))steps(q.steps,Qp+'.steps',!!q.guided);
    if(q.example!=null&&(typeof q.example!=='object'||!q.example.prompt))E(Qp+'.example','{prompt, steps: [...]} (a similar solved problem for the stuck help)');else if(q.example)steps(q.example.steps,Qp+'.example.steps',true);
    if(q.type==='learn'){str(q.title,Qp+'.title');str(q.body,Qp+'.body');if(wc(q.body)>30)W(Qp+'.body',`${wc(q.body)} words (cards: ≤ 30)`);if(!q.example)W(Qp+'.example','learn card: add one worked example {prompt, steps}');return;}if(!TYPES.includes(q.type)){E(Qp+'.type',TYPES.join('|'));return;}
    if(q.format&&!FORMATS.includes(q.format))E(Qp+'.format','one of '+FORMATS.join('|'));scene(q.scene,Qp+'.scene');tpl(q.template,Qp+'.template');
    if(CARDS.includes(q.type)){str(q.title,Qp+'.title');str(q.body,Qp+'.body');str(q.emoji,Qp+'.emoji',false);if(wc(q.body)>30)W(Qp+'.body',`${wc(q.body)} words (cards: ≤ 30)`);if(third(q.body))W(Qp+'.body',YOU);return;}
    str(q.prompt,Qp+'.prompt');str(q.hint,Qp+'.hint');str(q.explanation,Qp+'.explanation');
    if(wc(q.prompt)>15)W(Qp+'.prompt',`${wc(q.prompt)} words (max 15)`);if(third(q.prompt))W(Qp+'.prompt',YOU);
    if((q.feedback!=null||q.misconception!=null)&&!['mc','picture','blank'].includes(q.type))E(Qp,'"feedback" and "misconception" are for mc, picture and blank-with-choices questions');
        const ans=q.answer;const need=()=>{if(ans==null||ans===''){E(Qp+'.answer','required');return false;}return true;};
    switch(q.type){
     case 'mc':if(need()&&strs(q.choices,Qp+'.choices',2,6)&&!q.choices.includes(String(ans)))E(Qp+'.answer','must exactly match one of choices');if(q.choices?.length>3)W(Qp+'.choices','use 3 options');choiceExtras(q,Qp,q.choices);break;
     case 'blank':if(!/_{3,}/.test(q.prompt||''))E(Qp+'.prompt','fill-in-the-blank prompt needs ___');if(!q.choices){acc(q,Qp);if(!q.creative)openEnded(q,Qp);}if(need()&&q.choices&&strs(q.choices,Qp+'.choices',2,4)&&!q.choices.includes(String(ans)))E(Qp+'.answer','must exactly match one of choices');if(q.choices)choiceExtras(q,Qp,q.choices);break;
     case 'picture':if(!Array.isArray(q.choices)||q.choices.length<2||q.choices.length>4||!q.choices.every(c=>c&&typeof c.label==='string'&&typeof c.pic==='string'))E(Qp+'.choices','2-4 {label, pic} (pic = emoji or <svg>)');
       else{q.choices.forEach((c,k)=>scene(c.pic,`${Qp}.choices[${k}].pic`));if(need()&&!q.choices.some(c=>c.label===ans))E(Qp+'.answer','must equal one choice label');choiceExtras(q,Qp,q.choices.map(c=>c.label));}break;
     case 'numeric':if(need()&&!/^-?\d*\.?\d+(\s*\/\s*\d+)?\s*%?$/.test(String(ans).trim()))E(Qp+'.answer','numeric answer like 12, 0.75, 3/8 or 27%');if(q.tolerance!=null&&!(q.tolerance>=0))E(Qp+'.tolerance','non-negative number');
       // answer form (LESSONS.md "Answer form"): the prompt, the optional "form" and the answer must agree
       if(q.form!=null&&!EN.FORMS.includes(q.form))E(Qp+'.form',EN.FORMS.join('|'));
       else if(ans!=null&&ans!==''){const asked=q.form||EN.formOf({q:q.prompt,answer:'x'});if(asked&&!EN.formOk(String(ans),asked))E(Qp+'.answer',`answer form: the question asks for ${asked==='whole'?'a whole number':'a '+asked} but the answer is "${ans}"${asked==='percent'?' (write it like 27%)':''}`);}
       break;
     case 'text':need();acc(q,Qp);openEnded(q,Qp);break;
     case 'creative':need();acc(q,Qp);for(const k of['notAnswers','block'])if(q[k]!=null&&!(Array.isArray(q[k])&&q[k].every(x=>typeof x==='string')))E(Qp+'.'+k,'array of strings');
       if(q.celebrate!=null&&typeof q.celebrate!=='string')E(Qp+'.celebrate','string ("{given}" = his answer, "{answer}" = your example)');if(q.minLength!=null&&!(Number.isInteger(q.minLength)&&q.minLength>=1))E(Qp+'.minLength','integer ≥ 1');
       if(!/\b(why|because|so )/i.test(q.explanation||'')&&wc(q.explanation)<6)W(Qp+'.explanation','creative: explain WHY the example works, kindly');break;
     case 'order':strs(q.items,Qp+'.items',3,6);if(ans!=null)E(Qp+'.answer','omit: "items" is already the correct order (the app shuffles it)');break;
     case 'match':if(!Array.isArray(q.pairs)||q.pairs.length<3||q.pairs.length>5||!q.pairs.every(p=>Array.isArray(p)&&p.length===2&&p.every(x=>typeof x==='string'&&x.trim())))E(Qp+'.pairs','3-5 [left, right] string pairs');
       else{if(new Set(q.pairs.map(p=>p[0])).size<q.pairs.length||new Set(q.pairs.map(p=>p[1])).size<q.pairs.length)E(Qp+'.pairs','left and right items must be unique');if(q.pairs.some(p=>p.join('').includes('=')||p.join('').includes('|')))E(Qp+'.pairs','no "=" or "|" inside items');}break;
     case 'truefalse':if(!Array.isArray(q.statements)||q.statements.length<3||q.statements.length>8||!q.statements.every(s=>Array.isArray(s)&&typeof s[0]==='string'&&typeof s[1]==='boolean'))E(Qp+'.statements','3-8 [statement, true|false]');
       else{q.statements.forEach((s,k)=>{if(wc(s[0])>12)W(`${Qp}.statements[${k}]`,`${wc(s[0])} words (speed round: ≤ 12)`);});const t=q.statements.filter(s=>s[1]).length;if(!t||t===q.statements.length)W(Qp+'.statements','mix true and false');}
       if(q.seconds!=null&&!(q.seconds>=10))E(Qp+'.seconds','≥ 10');break;
     case 'numberline':if(!num(q.min)||!num(q.max)||!(q.max>q.min))E(Qp,'numeric min < max required');else{if(q.step!=null&&!(q.step>0))E(Qp+'.step','> 0');const a=parseNum(ans);if(!need()||isNaN(a))E(Qp+'.answer','number');else if(a<q.min||a>q.max)E(Qp+'.answer','must be on the line');
       else if(q.step&&Math.abs(Math.round((a-q.min)/q.step)*q.step+q.min-a)>1e-9)E(Qp+'.answer','must land on a step');if((q.max-q.min)/(q.step||1)>40)W(Qp,'more than 40 steps is hard to drag on a phone');}break;
     case 'fracbar':if(!Number.isInteger(q.parts)||q.parts<2||q.parts>12)E(Qp+'.parts','integer 2-12');else if(need()){const a=parseNum(ans);if(isNaN(a)||a<0||a>1)E(Qp+'.answer','fraction 0-1 like 3/4');else if(Math.abs(Math.round(a*q.parts)-a*q.parts)>1e-9)E(Qp+'.answer',`can't be shaded with ${q.parts} parts`);}break;}});});
// Placement quests (LESSONS.md "Placement quests"): a diagnostic for a new learner. Ladders run from the grade-level band
// down to fallbacks; passing a stage skips the rest of its ladder. No teach cards, guided practice or boss required.
if(pack.placement!=null){const T=pack.topics||[];if(pack.placement!==true)E('placement','true (or leave it out)');if(!Q)E('placement','a placement pack is a quest: add the "quest" block');
  if(pack.honors)E('honors','a placement quest cannot honor a Market pick');if(T.length<4||T.length>7)E('placement',`4-7 stages (has ${T.length})`);
  const subs=new Set(T.map(t=>byId[t.topicId]?.subject).filter(Boolean));if(subs.size<3)E('placement',`cover at least 3 subjects (has ${subs.size})`);
  const lastBand={};T.forEach((t,i)=>{const P=`topics[${i}]`,tp=byId[t.topicId];
    if(typeof t.ladder!=='string'||!/^[a-z][a-z0-9-]{0,23}$/.test(t.ladder))E(P+'.ladder','a short lowercase key such as "math" (stages of one subject share it)');
    if(typeof t.band!=='number'||!(t.band>=4&&t.band<=18))E(P+'.band','the level (age band 4-18), normally the topic\'s ageRangeStart');
    else{if(tp&&Math.abs(t.band-tp.ageRangeStart)>1)W(P+'.band',`band ${t.band} but "${tp.name}" starts at age ${tp.ageRangeStart}`);
      if(t.ladder in lastBand&&t.band>lastBand[t.ladder])E(P+'.band',`ladder "${t.ladder}" must run from the highest band down (${t.band} after ${lastBand[t.ladder]})`);lastBand[t.ladder]=t.band;}
    const gq=(t.questions||[]).filter(q=>!CARDS.includes(q.type)).length;if(gq<2||gq>4)E(P,`placement stage: 2-4 graded questions (has ${gq})`);
    if(t.deepDive)E(P+'.deepDive','no deep dives in a placement quest');});}
else if(Q&&(pack.topics||[]).some(t=>t.ladder!=null||t.band!=null))W('topics','"ladder"/"band" only matter in a placement quest ("placement": true)');
// Researched stages (warnings): an mc/picture/blank-choice question needs a wrong choice from a misconception, and a
// stage on a topic the learner got stuck on should scaffold down to a prerequisite the research says to re-teach.
let nResearched=0;
if(RS)(pack.topics||[]).forEach((t,i)=>{if(i<RR||!byId[t.topicId])return;const d=RS.briefData(t.topicId);if(!d.research)return;nResearched++;const P=`topics[${i}]`;
  const cq=choiceQs[P]||[];const hint=`see npm run research -- ${t.topicId}`;
  if(cq.length&&!cq.some(q=>q.misconception))W(P,`researched stage "${byId[t.topicId].name}": no choice question has a wrong choice from a listed misconception. Make one wrong choice the misconception, tag it "misconception": "<that choice>", and use its next move in the explanation (${hint})`);
  const sp=PROG?.support?.[t.topicId];if(sp&&(sp.stuck||sp.skipped)){const re=[...new Set(d.errorPatterns.map(e=>e.reteach).filter(x=>x&&x.status==='playable').map(x=>x.id))];
    const inPack=new Set((pack.topics||[]).flatMap(x=>[x.topicId,...(x.teaches||[]),...(x.questions||[]).map(q=>q.skill)]));
    if(re.length&&!re.some(id=>inPack.has(id)))W(P,`"${byId[t.topicId].name}" needs support (the learner got stuck): scaffold down to a prerequisite to re-teach first, e.g. ${re.slice(0,2).map(id=>`${id} "${byId[id]?.name||id}"`).join(' or ')} (an earlier stage, "teaches" or a question "skill")`);}});
// Quest budget (LESSONS.md "Keep it short"): ≤ 16 graded pack questions + ≤ 4 review-gate items the app adds = ~20 answers, ~8 min; 4-6 stages, max 7.
const MAX_GRADED=16,MAX_STAGES=7,estMin=Math.round((nGraded*25+nCards*10)/6)/10;
if(Q&&nGraded>MAX_GRADED)E('size',`${nGraded} graded questions: too long (max ${MAX_GRADED}; the app adds up to 4 review-gate items, ~20 answers ≈ 8 min). Trim stages`);
if(Q&&nGraded&&nGraded<10)W('size',`${nGraded} graded questions: aim for 12-16`);
if(Q&&(pack.topics||[]).length-RR>MAX_STAGES)E('size',`${pack.topics.length-RR} ${RR?'remaining ':''}stages: too long (max ${MAX_STAGES}, aim 4-6)`);
if(REFRESH&&(pack.topics||[]).length<=RR)E('refresh',`no stages left after the ${RR} reached ones: add the remaining stages (boss last)`);
if(Q&&estMin>8)W('size',`about ${estMin} min (aim ≤ 8): trim cards or questions`);
// spaced review runs through the app's review gates now (LESSONS.md "Review gates"): review stages still publish, but spend quest budget
const revStages=pack.topics.filter(t=>t.review).length;if(revStages)W('review',`${revStages} review stage${revStages>1?'s':''}: review runs through gates now, so spend the budget on new learning`);
// Coverage (LESSONS.md "Coverage"): each quest should bring in at least one untouched area (Marble domain).
// Frozen decision: no new area is a WARNING only, never an error. Uses the read-only progress; --offline skips it.
let newAreas=null;if(Q&&PROG){const CG=EN.graph(tax),SP=EN.migrate(JSON.parse(JSON.stringify(PROG)),CG),seenA=seenAreas(SP,CG,[]),cov=coverage(SP,CG,[],{age:LRN.age});
  const areas=[...new Set(pack.topics.filter(t=>byId[t.topicId]).map(t=>byId[t.topicId].subject+'|'+byId[t.topicId].domain))];newAreas=areas.filter(a=>!seenA.has(a));
  if(!newAreas.length&&cov.untouched.length)W('coverage',`no new area: add one stretch stage from coverage.untouched, math and science first (e.g. ${cov.untouched.slice(0,3).map(u=>u.subject+' / '+u.domain).join(', ')})`);}
const inter=[...typesUsed].filter(x=>!['mc','numeric','text'].includes(x));if(inter.length<3)W('formats',`only ${inter.length} interactive format(s) used; mix in order/match/picture/blank/numberline/fracbar/truefalse/why/fact`);
if(warns.length)console.warn(`⚠️  ${warns.length} warning(s) (see LESSONS.md):\n  `+warns.join('\n  '));
if(errs.length){console.error(`❌ ${errs.length} problem(s) in ${file}:\n  `+errs.join('\n  '));process.exit(1);}
if(Q&&!REFRESH&&!force&&PROG){const A=activeQuests(PROG,pack.date).filter(d=>kvList(lk('lessons:')+d).length);
  if(A.length){console.error(`⛔ quest ${A[0]} is in progress (one quest at a time). Not publishing a new quest: it would only wait hidden.\n   Refresh its unreached stages instead: node publish-lessons.mjs <pack.json> --refresh --date ${A[0]}   (see LESSONS.md "Refreshing the current quest")`);process.exit(3);}}
const sum=`${REFRESH?`refresh: stages 1-${RR} locked, ${pack.topics.length-RR} remaining, `:''}${pack.topics.length} ${Q?'stages':'topics'}, ${nq} items (~${estMin} min, ${nGraded} graded${nReview?`, ${nReview} in review stages`:''}, review via gates, ${nDeep} deep dive${nDeep===1?'':'s'}${RS?`, ${nResearched} researched stage${nResearched===1?'':'s'}`:''}${newAreas?`, new areas: ${newAreas.length}${newAreas.length?` (${newAreas.map(a=>a.replace('|',' / ')).join(', ')})`:''}`:''}), formats: ${[...typesUsed].join(', ')}`;
if(dry){console.log(`✅ valid${Q?` quest "${Q.title}"`:''}: ${sum} for ${pack.date} (dry run, nothing written)`);process.exit(0);}
kvPut(lk('lessons:')+pack.date,pack);console.log(`✅ published${LOCAL?' (local)':''} ${lk('lessons:')}${pack.date}${Q?` quest "${Q.title}"`:''}: ${sum}`);
