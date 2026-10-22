#!/usr/bin/env node
// Offline research brief for the nightly lesson author (slice 4, #40).
//   node research.mjs <topicId> [--json] [--all]     (npm run research -- <topicId>)
// Reads Marble's teaching research (data/marble/teaching-research.json, ~24 MB, Science and Math only) and prints a
// short brief: learn constraints first, the learn summary and best practices, key activities and their intended
// insight, top misconceptions, error patterns (with next moves and re-teach prerequisites), and the diagnostic prompt
// and response levels. Where the newer `learn` guidance and the older `pedagogy`/`assess` fields disagree, `learn` wins:
// a pedagogy/assess passage that repeats something a learn constraint forbids is dropped and flagged.
// The research file is offline authoring input only: it is never copied into public/, the Worker bundle or the Docker
// image (test/research.test.mjs guards this). Topics that are pending or hidden in this household (PENDING.txt; HIDE_REGIONS via public/tax.json or the setting)
// get a one-line notice instead of a brief, unless --all is given.
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';import {regionTags,hideRegionsSetting} from './lib-regions.mjs';
const DIR=path.dirname(fileURLToPath(import.meta.url));
export const BRIEF_MAX=6000;   // characters, text brief
export const COMPACT_MAX=3000; // characters, JSON brief attached to the nightly export
const ITEM=320;                // characters per list item before "…"
const J=f=>JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));
let RES=null,TOPICS=null,TAX=null,PENDING=null,REGIONS=null;
// RESEARCH_FILE overrides the research file's path (tests use it to simulate the Docker image, where it is absent)
const resFile=()=>process.env.RESEARCH_FILE||path.join(DIR,'data/marble/teaching-research.json');
export function researchAvailable(){return fs.existsSync(resFile());}
// forget cached files (tests change HIDE_REGIONS / RESEARCH_FILE between cases)
export function reset(){RES=TOPICS=TAX=PENDING=REGIONS=null;}
function load(){
  if(!RES){RES=new Map();if(researchAvailable())for(const r of JSON.parse(fs.readFileSync(resFile(),'utf8')).records)RES.set(r.topicId,r);}
  if(!TOPICS)TOPICS=new Map(J('data/marble/topics.json').topics.map(t=>[t.id,t]));
  if(!TAX)TAX=fs.existsSync(path.join(DIR,'public/tax.json'))?J('public/tax.json'):{topics:[],hidden:{regions:[],topics:[]},aliases:{}};
  if(!REGIONS)REGIONS=regionTags(DIR);
  if(!PENDING){PENDING=new Map();for(const l of fs.readFileSync(path.join(DIR,'data/kid-prompts/PENDING.txt'),'utf8').split('\n')){const id=l.replace(/#.*/,'').trim();if(id)PENDING.set(id,(l.match(/held:\s*(.*)$/)||[])[1]||'not playable yet');}}
}
const cut=(s,n=ITEM)=>{s=String(s??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).replace(/\s+\S*$/,'')+'…':s;};
// ---------- learn wins: constraints that forbid something, matched against pedagogy/assess text ----------
// A learn constraint forbids a phrase when it says "do not teach/say/use/… … 'X'" or "avoid (the) 'X'"; it cautions
// against one when it calls 'X' legacy or only a rough approximation. Quotes open after a space or "(" and close
// before a space or punctuation, so the apostrophe in "Earth's" is not taken for one.
const Q=`['‘"“]([^'’"”]{4,60}?)['’"”](?=[\\s,.;:)!?]|$)`;
const STRONG=[new RegExp(`\\b(?:do not|don't|never|must not)\\s+(?:teach|say|tell|present|describe|state|claim)\\b(?:[^.;:'‘"“]|(?<=\\w)['’](?=\\w)){0,60}?(?:^|[\\s(])${Q}`,'gi'),
  new RegExp(`\\bavoid\\s+(?:the\\s+|saying\\s+)?${Q}`,'gi')];
// labels the constraint says not to use/call: only flagged, since the same words are often used correctly elsewhere
const WEAK=[new RegExp(`\\b(?:do not|don't|never|must not)\\s+(?:use|call)\\b(?:[^.;:'‘"“]|(?<=\\w)['’](?=\\w)){0,60}?(?:^|[\\s(])${Q}`,'gi'),new RegExp(`\\bavoid\\s+(?:using|calling)\\s+${Q}`,'gi'),
  new RegExp(`(?:^|[\\s(])(?:the\\s+)?legacy\\s+${Q}`,'gi'),new RegExp(`(?:^|[\\s(])${Q}[^.;]{0,30}\\bonly a rough approximation`,'gi')];
const words=p=>p.split(/[\s=/]+/).filter(Boolean).length;
export function forbiddenPhrases(constraints=[]){const out=[];
  constraints.forEach((c,i)=>{for(const [res,strong] of [[STRONG,true],[WEAK,false]])for(const re of res)for(const m of c.matchAll(re)){const p=m[1].trim();if(/[a-z]/i.test(p)&&words(p)>=2&&!out.some(o=>o.phrase===p))out.push({phrase:p,constraint:i,strong});}});
  return out;}
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Instructive text (next moves, best practices, the correct answer, the "full" level) that repeats a forbidden phrase:
// a strong constraint drops the clause holding it, a weak one only flags it. Returns {text, hits}.
export function applyLearn(text,phrases){if(!text||typeof text!=='string')return{text,hits:[]};let t=text;const hits=[];
  for(const p of phrases){const re=new RegExp(esc(p.phrase).replace(/\\? /g,'\\s+'),'i');const m=t.match(re);if(!m)continue;
    // the text only mentions the phrase to warn against it (quoted, or after "not", "avoid", "rather than", …): consistent with learn
    const before=t.slice(Math.max(0,m.index-60),m.index);if(/['‘"“]\s*$/.test(before)||/\b(not|no|never|avoid\w*|ban|don't|rather than|instead of|myth|misconception|wrong|false)\b[^.;:]*$/i.test(before))continue;
    if(!p.strong){hits.push({phrase:p.phrase,constraint:p.constraint,strong:false,dropped:null,text:t});continue;}
    // clause = the smallest span between ; : ( ) or sentence ends that holds the phrase
    const parts=t.split(/(?<=[;:.!?])\s+|\s*(?=\()|(?<=\))/);const i=parts.findIndex(x=>re.test(x));
    const dropped=parts[i];parts.splice(i,1);t=parts.join(' ').replace(/\s+([;:,.)])/g,'$1').replace(/[;:,]\s*$/,'.').replace(/\(\s*\)/g,'').replace(/\s{2,}/g,' ').trim();
    hits.push({phrase:p.phrase,constraint:p.constraint,strong:true,dropped:dropped.trim()});}
  return{text:t,hits};}
// ---------- status in this household ----------
// the regions hidden here: what public/tax.json was built with, plus the configured HIDE_REGIONS setting
export function hideCodes(){load();return[...new Set([...(TAX.hidden?.regions||[]),...(hideRegionsSetting(DIR).codes||[])])].sort();}
export function filterNote(){const h=hideCodes();return`filters: pending topics (data/kid-prompts/PENDING.txt) and ${h.length?`hidden regions (HIDE_REGIONS=${h.join(',')})`:'hidden regions (none set: every region plays)'} are respected`;}
export function topicStatus(id){load();const t=TOPICS.get(id);
  if(!t){const to=TAX.aliases?.[id];return to?{id,known:false,status:'merged',note:`merged upstream into ${to}`}:{id,known:false,status:'unknown',note:'not a Marble topic id'};}
  const hidden=(TAX.hidden?.topics||[]).some(h=>h.id===id)||hideCodes().some(c=>REGIONS[c]?.has(id));
  const status=PENDING.has(id)?'pending':hidden?'hidden':TAX.topics.some(x=>x.id===id)?'playable':TAX.topics.length?'not-in-app':'unbuilt';
  const note={pending:`PENDING (not playable yet: ${PENDING.get(id)}). Do not put it in a pack.`,hidden:`HIDDEN in this household (HIDE_REGIONS=${hideCodes().join(',')}). Do not put it in a pack.`,
    playable:'playable',['not-in-app']:'not in public/tax.json',unbuilt:'public/tax.json not built yet (npm run build): playability unknown'}[status];
  return{id,known:true,status,note,title:t.name,subject:t.subject,domain:t.domain,age:[t.ageRangeStart,t.ageRangeEnd]};}
const ref=id=>{if(!id)return null;const s=topicStatus(id);return{id,title:s.title||null,status:s.status};};
// ---------- the brief as data ----------
export function briefData(id){load();const s=topicStatus(id),r=RES.get(id);
  const base={...s,research:!!r,researchFile:researchAvailable()};
  if(!r)return{...base,reason:!researchAvailable()?'research file not available here (offline authoring input; not in the Docker image)':`Marble has teaching research for Science and Mathematics only${s.subject&&!['Science','Mathematics'].includes(s.subject)?`; this is ${s.subject}`:''}`};
  const L=r.learn||{},P=r.pedagogy||{},A=r.assess||{},phrases=forbiddenPhrases(L.constraints),conflicts=[];
  const fix=(where,x)=>{const o=applyLearn(x,phrases);for(const h of o.hits)conflicts.push({where,...h,constraintText:L.constraints[h.constraint]});return o.text;};
  return{...base,confidence:r.confidence||null,
    constraints:(L.constraints||[]),
    summary:L.summary||P.summary||null,summaryFrom:L.summary?'learn':'pedagogy',
    bestPractices:(P.bestPractices||[]).map((x,i)=>fix(`pedagogy.bestPractices[${i}]`,x)).filter(Boolean),
    activities:(L.activities||[]).map(a=>({title:a.title,intendedInsight:a.intendedInsight})),
    misconceptions:(P.commonMisconceptions||[]).slice(0,3),
    errorPatterns:(A.errorPatterns||[]).map((e,i)=>({kind:e.kind,pattern:e.pattern,revealedBy:e.revealedBy,nextMove:fix(`assess.errorPatterns[${i}].nextMove`,e.nextMove),
      distractor:e.distractor||null,reteach:ref(e.reteachPrerequisiteId)})),
    assessMethod:A.method||null,diagnosticPrompt:A.diagnosticPrompt||null,correctAnswer:fix('assess.correctAnswer',A.correctAnswer||null),
    responseLevels:A.responseLevels?{gap:A.responseLevels.gap,partial:A.responseLevels.partial,full:fix('assess.responseLevels.full',A.responseLevels.full)}:null,
    conflicts};}
// ---------- text brief (≤ BRIEF_MAX) ----------
const reteachLine=x=>x?`${x.id} "${x.title||'?'}"${x.status==='playable'?'':` (${x.status}: not playable here)`}`:null;
export function briefText(id,{all=false,max=BRIEF_MAX}={}){const d=briefData(id);
  const head=[d.known?`# Research brief: ${d.title} (${id})`:`# Research brief: ${id}`,d.known?`${d.subject} > ${d.domain}, age ${d.age.join('-')} · status: ${d.note}`:`status: ${d.note}`,`(${filterNote()})`];
  if(!d.known)return head.join('\n');
  if(!all&&(d.status==='pending'||d.status==='hidden'))return[...head,'(brief not shown: this household cannot play the topic; pass --all to see it anyway)'].join('\n');
  if(!d.research)return[...head,`no research: ${d.reason}`].join('\n');
  const sec=(title,items,pri)=>({title,items:items.filter(Boolean),pri});
  const S=[
    sec('Constraints (learn: follow these; they override pedagogy/assess)',d.constraints.map(x=>'- '+cut(x,240)),0),
    sec('Summary (learn)',[cut(d.summary,520)],0),
    sec('Top misconceptions',d.misconceptions.map(x=>'- '+cut(x)),0),
    sec('Error patterns → next move',d.errorPatterns.map(e=>[`- ${cut(e.pattern,200)}`,`  revealed by: ${cut(e.revealedBy,200)}`,`  next move: ${cut(e.nextMove,260)}`,e.distractor&&`  distractor: ${cut(e.distractor,140)}`,e.reteach&&`  re-teach first: ${reteachLine(e.reteach)}`].filter(Boolean).join('\n')),0),
    sec(`Diagnostic (${d.assessMethod||'?'})`,[d.diagnosticPrompt&&cut(d.diagnosticPrompt,400),d.correctAnswer&&`correct answer: ${cut(d.correctAnswer,300)}`],1),
    sec('Response levels',d.responseLevels?[`gap: ${cut(d.responseLevels.gap,220)}`,`partial: ${cut(d.responseLevels.partial,220)}`,`full: ${cut(d.responseLevels.full,260)}`]:[],1),
    sec('Key activities → intended insight',d.activities.map(a=>`- ${cut(a.title,80)}: ${cut(a.intendedInsight,200)}`),2),
    sec('Best practices (pedagogy)',d.bestPractices.map(x=>'- '+cut(x,180)),3),
  ];
  const flags=d.conflicts.length?['','## ⚠ learn vs pedagogy/assess',...d.conflicts.map(c=>c.strong?`- dropped from ${c.where}: "${cut(c.dropped,160)}" (learn constraint ${c.constraint+1} forbids '${c.phrase}')`:`- check ${c.where}: it uses '${c.phrase}', which learn constraint ${c.constraint+1} cautions against`)]:[];
  const foot=['',`Source: Marble teaching research (${d.confidence||'?'} confidence; agent-authored, not empirically validated). Offline authoring input: adapt, never paste into a pack.`];
  const render=secs=>[...head,...secs.filter(s=>s.items.length).flatMap(s=>['',`## ${s.title}`,...s.items]),...flags,...foot].join('\n');
  let secs=S.map(s=>({...s,items:[...s.items]})),out=render(secs);
  // over the cap: trim the lowest-priority sections item by item, then the rest from the end
  for(let p=3;p>=0&&out.length>max;p--)for(const s of secs.filter(s=>s.pri===p).reverse())while(s.items.length&&out.length>max){s.items.pop();out=render(secs);}
  if(out.length>max)out=out.slice(0,max-12)+'\n…(cut)';
  return out;}
// ---------- compact JSON (≤ COMPACT_MAX) for the nightly export ----------
export function briefCompact(id,{max=COMPACT_MAX}={}){const d=briefData(id);
  if(!d.known||!d.research||d.status==='pending'||d.status==='hidden')return{id,research:d.research,status:d.status,note:(d.status==='pending'||d.status==='hidden'||!d.known)?d.note:d.reason};
  const o={id,title:d.title,cmd:`npm run research -- ${id}`,
    constraints:d.constraints.map(x=>cut(x,200)),misconceptions:d.misconceptions.map(x=>cut(x,160)),
    errorPatterns:d.errorPatterns.map(e=>({pattern:cut(e.pattern,140),nextMove:cut(e.nextMove,180),reteach:e.reteach?`${e.reteach.id} ${e.reteach.title||''}${e.reteach.status==='playable'?'':' ('+e.reteach.status+')'}`.trim():undefined})),
    diagnostic:d.diagnosticPrompt?cut(d.diagnosticPrompt,220):undefined,
    levels:d.responseLevels?{gap:cut(d.responseLevels.gap,140),full:cut(d.responseLevels.full,160)}:undefined,
    conflicts:d.conflicts.length?d.conflicts.map(c=>c.strong?`dropped from ${c.where}: "${cut(c.dropped,80)}" (learn constraint ${c.constraint+1})`:`check ${c.where}: '${c.phrase}' (learn constraint ${c.constraint+1})`):undefined};
  // over the cap: shorten lists from the end (keep at least one of each), then drop the levels
  const size=()=>JSON.stringify(o).length;const lists=['constraints','errorPatterns','misconceptions'];
  while(size()>max&&lists.some(k=>o[k].length>1))for(const k of lists){if(o[k].length>1&&size()>max)o[k].pop();}
  if(size()>max)delete o.levels;if(size()>max)o.constraints=o.constraints.map(x=>cut(x,90));
  if(size()>max){o.errorPatterns=o.errorPatterns.map(e=>({...e,nextMove:cut(e.nextMove,90)}));o.misconceptions=o.misconceptions.map(x=>cut(x,90));}
  return o;}
// ---------- the nightly export's research section ----------
// groups: [[reason, [topicId…]], …] in priority order (needsSupport first). Attaches a compact brief for each
// playable topic with research, up to maxBriefs and maxChars in total; the rest are listed as pointers (run the CLI).
export const NIGHTLY_MAX_BRIEFS=24,NIGHTLY_MAX_CHARS=48000;
export function nightlyResearch(groups,{maxBriefs=NIGHTLY_MAX_BRIEFS,maxChars=NIGHTLY_MAX_CHARS}={}){load();
  const sec={tool:'npm run research -- <topicId>   (full brief; --json for this compact form)',available:researchAvailable(),
    note:'Marble teaching research (Science and Mathematics only), agent-authored and not empirically validated: authoring input to adapt, never paste. Learn constraints override pedagogy/assess. '+filterNote()+'.',
    briefs:{},pointers:[]};
  if(!sec.available){sec.note='research file not available here (data/marble/teaching-research.json is offline-only); briefs skipped';return sec;}
  const why={};for(const [reason,ids] of groups)for(const id of ids||[])if(id)(why[id]??=[]).includes(reason)||why[id].push(reason);
  let used=0;
  for(const id of Object.keys(why)){const d=briefData(id);if(!d.research||d.status==='pending'||d.status==='hidden')continue;
    const b={for:why[id],...briefCompact(id)},n=JSON.stringify(b).length;
    if(Object.keys(sec.briefs).length<maxBriefs&&used+n<=maxChars){sec.briefs[id]=b;used+=n;}else sec.pointers.push({id,title:d.title,for:why[id]});}
  return sec;}
// ---------- check-understanding items (data/checks, slice 6) ----------
// {q,a,w,y?} for a topic, or null; checkPair(id) = the two-tier boss finale as pack questions (answer, then why).
export function checkItem(id){const dir=path.join(DIR,'data/checks');if(!fs.existsSync(dir))return null;
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.txt')))for(const l of fs.readFileSync(path.join(dir,f),'utf8').split('\n')){const p=l.split('|').map(x=>x.trim());
    if(p[0]===id&&!l.startsWith('#'))return{q:p[1],a:p[2],w:[p[3],p[4]],...(p.length===8?{y:{a:p[5],w:[p[6],p[7]]}}:{})};}
  return null;}
export function checkPair(id){const c=checkItem(id);if(!c)return null;
  const a={type:'mc',twoTier:'answer',prompt:c.q,choices:[c.a,...c.w],answer:c.a,misconception:c.w[0],hint:'Think about what really happens.',explanation:c.y?`${c.a}: ${c.y.a}.`:`It's ${c.a}.`};
  if(!c.y)return[a];
  return[a,{type:'mc',twoTier:'why',prompt:'Why is that right?',choices:[c.y.a,...c.y.w],answer:c.y.a,misconception:c.y.w[0],hint:'Which reason explains it?',explanation:`${c.y.a}.`}];}
// ---------- CLI ----------
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const args=process.argv.slice(2),ids=args.filter(a=>!a.startsWith('--'));
  if(!ids.length){console.error('usage: node research.mjs <topicId> [<topicId> …] [--json] [--all] [--check]');process.exit(2);}
  if(args.includes('--check')){for(const id of ids){const p=checkPair(id);console.log(p?JSON.stringify(p,null,1):`${id}: no check item (data/checks)`);}process.exit(0);}
  for(const id of ids){if(args.includes('--json'))console.log(JSON.stringify(briefCompact(id),null,1));else console.log(briefText(id,{all:args.includes('--all')}));if(ids.length>1)console.log('');}
  if(ids.some(id=>!topicStatus(id).known))process.exit(1);}
