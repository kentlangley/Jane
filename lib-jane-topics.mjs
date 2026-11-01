// Jane's own topics (data/jane/topics.json + dependencies.json): topics this project adds on top of the Marble
// taxonomy, kept outside data/marble/ so a Marble refresh never touches them. Same schema as Marble's files.
// Used by build.mjs (validates them and appends them to public/tax.json), research.mjs and the tests.
// Rules (checked here, the build fails otherwise):
//   - ids match jane_[\w-]+ and never collide with a Marble id (Marble ids start with mt_)
//   - the subject is an existing Marble subject (each subject is an island on the map); the domain is its path
//   - every Marble topic field is present: type, subject, domain, name, description, ageRangeStart/End,
//     centrality, evidence[], assessmentPrompt, standards[] (real codes only, or empty)
//   - edges: topicId is a jane_ topic, prerequisiteId a jane_ or Marble topic, strength hard|soft, no cycles.
//     Marble topics never get a jane_ prerequisite, so adding Jane topics never locks or re-scores a Marble topic.
import fs from 'fs';import path from 'path';
export const JANE_DIR='data/jane';
export const JANE_ID=/^jane_[\w-]+$/;
const TYPES=new Set(['CONCEPTUAL','PROCEDURAL','META','LANGUAGE','REPRESENTATIONAL']);
export function loadJaneTopics(root='.',marble=null){
  const dir=path.join(root,JANE_DIR),tf=path.join(dir,'topics.json'),df=path.join(dir,'dependencies.json');
  if(!fs.existsSync(tf))return{janeTopics:[],janeDeps:[]};
  if(!marble)marble=JSON.parse(fs.readFileSync(path.join(root,'data/marble/topics.json'),'utf8')).topics;
  const T=JSON.parse(fs.readFileSync(tf,'utf8')),D=fs.existsSync(df)?JSON.parse(fs.readFileSync(df,'utf8')):{dependencies:[]};
  const mIds=new Set(marble.map(t=>t.id)),subjects=new Set(marble.map(t=>t.subject)),ids=new Set();
  const topics=T.topics||[];if(T.topicCount!=null&&T.topicCount!==topics.length)throw Error(`${JANE_DIR}/topics.json: topicCount ${T.topicCount} but ${topics.length} topics`);
  for(const t of topics){const bad=m=>{throw Error(`${JANE_DIR}/topics.json: ${t.id||'(no id)'}: ${m}`);};
    if(!JANE_ID.test(t.id||''))bad('id must start with jane_ (letters, digits, _ or -)');
    if(mIds.has(t.id))bad('id collides with a Marble topic');if(ids.has(t.id))bad('duplicate id');ids.add(t.id);
    if(!TYPES.has(t.type))bad(`type must be one of ${[...TYPES].join(', ')}`);
    if(!subjects.has(t.subject))bad(`subject "${t.subject}" is not a Marble subject (islands: ${[...subjects].sort().join(', ')})`);
    for(const k of['domain','name','description','assessmentPrompt'])if(typeof t[k]!=='string'||!t[k].trim())bad(k+' must be a non-empty string');
    if(!(Number.isInteger(t.ageRangeStart)&&Number.isInteger(t.ageRangeEnd)&&t.ageRangeStart>=3&&t.ageRangeStart<=t.ageRangeEnd&&t.ageRangeEnd<=18))bad('ageRangeStart/End must be whole ages, start <= end');
    if(typeof t.centrality!=='number'||t.centrality<0||t.centrality>1)bad('centrality must be a number 0..1');
    if(!Array.isArray(t.evidence)||!t.evidence.length||t.evidence.some(e=>typeof e!=='string'||!e.trim()))bad('evidence must be a non-empty list of strings');
    if(!Array.isArray(t.standards)||t.standards.some(s=>typeof s!=='string'||!/^[a-z0-9-]+:\S+$/.test(s)))bad('standards must be a list of "source:code" strings (or empty)');}
  const deps=D.dependencies||[];if(D.edgeCount!=null&&D.edgeCount!==deps.length)throw Error(`${JANE_DIR}/dependencies.json: edgeCount ${D.edgeCount} but ${deps.length} edges`);
  const seen=new Set(),pre={};
  for(const d of deps){const bad=m=>{throw Error(`${JANE_DIR}/dependencies.json: ${d.topicId} → ${d.prerequisiteId}: ${m}`);};
    if(!ids.has(d.topicId))bad(mIds.has(d.topicId)?'a Marble topic may not depend on a Jane topic':'topicId is not a Jane topic');
    if(!ids.has(d.prerequisiteId)&&!mIds.has(d.prerequisiteId))bad('unknown prerequisite');
    if(d.topicId===d.prerequisiteId)bad('self edge');if(!['hard','soft'].includes(d.strength))bad('strength must be hard or soft');
    if(typeof d.reason!=='string'||!d.reason.trim())bad('reason must be a non-empty string');
    const k=d.topicId+'|'+d.prerequisiteId;if(seen.has(k))bad('duplicate edge');seen.add(k);(pre[d.topicId]??=[]).push(d.prerequisiteId);}
  const state={},visit=(id,trail)=>{if(state[id]===2)return;if(state[id]===1)throw Error(`${JANE_DIR}/dependencies.json: cycle ${[...trail,id].join(' → ')}`);
    state[id]=1;for(const p of pre[id]||[])if(ids.has(p))visit(p,[...trail,id]);state[id]=2;};
  for(const id of ids)visit(id,[]);
  return{janeTopics:topics,janeDeps:deps};}
