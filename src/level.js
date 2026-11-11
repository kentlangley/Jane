// Working level (parent report): a rough, per-subject estimate of the level a learner is working at, read from what
// they have shown (direct mastery) against each Marble topic's target age (ageRangeStart), and where they start to slip
// (recent first-try misses, learning moments, failed reviews). Read-only: it never changes S, medals, mastery or points.
// The result is a RANGE with a confidence note, not a test score. US grade is approximated as age minus 5.
import {subjectCeiling} from './engine.js';
const SLIP_ACC=0.7,SLIP_MIN=3; // a topic is "slipping" at < 70% right first try over >= 3 first tries in the logs...
const SLIP_LM=2;               // ...or >= 2 learning moments (missed twice), or a failed review / demotion
export const gradeOf=a=>{const n=Math.round(a)-5;if(n<=0)return'K';const s=n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');return n+s;};
const range=(lo,hi,f)=>lo===hi?f(lo):`${f(lo)}-${f(hi)}`;
// grade words: "kindergarten" (not "K grade"), "5th grade", "kindergarten-1st grade", "5th-6th grade"
const KG='kindergarten',gw=(lo,hi)=>{const a=gradeOf(lo),b=gradeOf(hi);if(a===b)return a==='K'?KG:a+' grade';return `${a==='K'?KG:a}-${b==='K'?KG:b}${b==='K'?'':' grade'}`;};
export const ageLabel=(lo,hi)=>`about age ${range(lo,hi,String)}, roughly ${gw(lo,hi)}`;
// per-topic slip signals from log entries (each {topicId, try, correct, event, expected, regraded})
export function slipSignals(logs=[]){const W={};
  for(const l of logs){if(!l?.topicId||l.regraded==='neutral')continue;const w=W[l.topicId]??={first:0,firstRight:0,lm:0,failed:0};
    if(l.event){if(l.event==='demoted'||l.event==='reviewMiss')w.failed++;continue;}
    if(l.expected==='(self-check)')continue;if(l.try===1){w.first++;if(l.correct)w.firstRight++;}if(l.try>=2&&!l.correct)w.lm++;}
  return W;}
export const isSlip=w=>!!w&&(w.failed>0||w.lm>=SLIP_LM||(w.first>=SLIP_MIN&&w.firstRight/w.first<SLIP_ACC));
// actual: {grade?: "5th grade", age?: 10.5} as stored for the learner (profile / config). Either may be missing.
export function workingLevel(S,g,logs=[],{actual={},now=Date.now()}={}){
  const ts=S?.ts||{},sig=slipSignals(logs);
  const gn=(()=>{const s=String(actual.grade??'').toLowerCase().trim();if(/^(k|kindergarten)\b/.test(s))return 0;const m=s.match(/(\d{1,2})/);return m&&+m[1]<=12?+m[1]:null;})();
  const ageN=parseFloat(actual.age),age=ageN>=4&&ageN<=18?ageN:null;
  const cmpAge=age??(gn!=null?gn+5.5:null); // the age compared against: stored age, else grade + 5.5
  const subs={};
  for(const t of g.topics){const r=ts[t.id],w=sig[t.id],a=t.ageRangeStart;if(typeof a!=='number')continue;
    const s=subs[t.subject]??={name:t.subject,shown:[],slips:[],working:[]};const nm=t.sn||t.name;
    if(isSlip(w)){s.slips.push({n:nm,age:a,domain:t.domain,first:w.first,firstRight:w.firstRight,lm:w.lm,failed:w.failed});continue;}
    if(r?.st==='mastered'&&r.how==='direct')s.shown.push({n:nm,age:a,domain:t.domain});
    else if(r?.st==='learning'&&r.how==='direct')s.working.push({n:nm,age:a});}
  const out=[];
  for(const s of Object.values(subs)){if(!s.shown.length&&!s.slips.length&&!s.working.length)continue;const ceil=subjectCeiling(g,s.name);
    const A=s.shown.map(x=>x.age).sort((a,b)=>b-a);const row={name:s.name,shown:A.length,slipping:s.slips.length,working:s.working.length,ceiling:ceil,lo:null,hi:null,label:null,notes:[],ahead:[],behind:[],vs:null};
    if(!A.length){row.label='not enough shown yet';row.confidence='none';
      row.notes.push(s.slips.length?`only slips so far (${s.slips.length} topic${s.slips.length===1?'':'s'}), nothing shown directly yet`:'nothing shown directly yet');out.push(row);continue;}
    let hi=A[0],lo=A.length>1?A[1]:hi;
    // a slip at or just below the top pulls the bottom of the range down a year; lower slips are "behind" spots
    const near=s.slips.filter(x=>x.age>=hi-1);if(near.length)lo=Math.min(lo,hi-1);
    lo=Math.max(lo,hi-2);row.lo=lo;row.hi=hi;row.label=ageLabel(lo,hi);
    const atTop=hi>=ceil,noCeil=!near.length;
    row.confidence=A.length<3?'low':noCeil?'medium':'good';
    if(A.length<3)row.notes.push(`few data points: ${A.length} topic${A.length===1?'':'s'} shown directly`);
    if(atTop)row.notes.push(`at the top of Jane's ${s.name} topics (they stop at age ${ceil}), so it can't measure higher`);
    else if(noCeil)row.notes.push('no ceiling yet: no slips near the top so far, so the real level may be higher');
    const wk=s.working.filter(x=>x.age>hi).sort((a,b)=>b.age-a.age);if(wk.length)row.notes.push(`now working on ${wk.slice(0,2).map(x=>`${x.n} (age ${x.age}+)`).join(', ')}`);
    // spots: slips below the working range (behind); topics shown well above the learner's age (ahead)
    row.behind=s.slips.filter(x=>x.age<=hi).sort((a,b)=>a.age-b.age).slice(0,3).map(x=>({n:x.n,age:x.age,why:x.failed?'missed a review':x.lm>=SLIP_LM?`${x.lm} learning moments`:`${x.firstRight}/${x.first} right first try`}));
    if(cmpAge!=null){const ca=Math.floor(cmpAge),cmp=Math.min(ca,ceil);
      row.vs=A.length<3?'too few to compare':lo>cmp?'ahead':hi<cmp-1?'behind':ca>ceil&&hi>=ceil?'at the top of the scale':'on level';
      row.ahead=s.shown.filter(x=>x.age>=ca+2).sort((a,b)=>b.age-a.age).slice(0,3).map(x=>({n:x.n,age:x.age}));}
    out.push(row);}
  out.sort((a,b)=>b.shown-a.shown||a.name.localeCompare(b.name));
  return{actual:{grade:actual.grade||null,age,compareAge:cmpAge,fromGrade:age==null&&cmpAge!=null},subjects:out,
    method:'Each topic has a target age. The range runs from the top topics shown directly (mastered, not inferred) down a year where recent answers start to slip. Grade ≈ age minus 5.'};}
