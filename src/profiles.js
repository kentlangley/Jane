// Learner profiles (plans/archive/learner-profiles.md): one household, several kids in one app.
// Registry (KV key "profiles"): {v:1, primary, learners:[{id, name, grade, age?, interests[], avatar, pin:{salt,hash}|null, prefix, created}]}.
// The primary learner keeps the original unprefixed keys (prefix ""); every other learner's keys start with "L:<id>:".
// No registry (fresh install / before migrate-profiles.mjs): a one-learner registry is synthesised from [vars].
export const ID_RE=/^[a-z][a-z0-9-]{0,23}$/;
export const AVATARS=['⭐','🦊','🐉','🚀','🦉','🐢','🦁','🐼','🤖','🐙','🦄','⚡','🏀','🎮','🚲','🎧','🛹','🎸'];
export const DEFAULT_AVATAR='⭐';
export const slug=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^[^a-z]+/,'').replace(/-+$/,'').slice(0,24).replace(/-+$/,'');
export const prefixFor=id=>`L:${id}:`;
export const gradeNum=g=>{const s=String(g??'').toLowerCase().trim();if(/^(k|kindergarten)\b/.test(s))return 0;const m=s.match(/(\d{1,2})/);return m?+m[1]:null;};
// learner age for the engine: explicit age, else grade + 5.5 (5th grade -> 10.5), else 10
export const ageFor=p=>{const a=parseFloat(p?.age);if(a>=4&&a<=18)return a;const n=gradeNum(p?.grade);return n!=null&&n<=12?n+5.5:10;};
export function synth(env={}){const name=String(env.LEARNER_NAME||'Explorer').trim()||'Explorer',id=slug(name)||'learner';
  return{v:1,primary:id,learners:[{id,name,grade:String(env.LEARNER_GRADE||''),interests:[],avatar:DEFAULT_AVATAR,pin:null,prefix:''}],synthetic:true};}
export function registry(raw,env={}){if(!raw||typeof raw!=='object'||!Array.isArray(raw.learners)||!raw.learners.length)return synth(env);
  const L=raw.learners.filter(l=>l&&ID_RE.test(l.id));if(!L.length)return synth(env);const primary=L.some(l=>l.id===raw.primary)?raw.primary:L[0].id;
  return{...raw,primary,learners:L.map(l=>({...l,prefix:l.id===primary?'':(typeof l.prefix==='string'&&l.prefix?l.prefix:prefixFor(l.id))}))};}
export const byId=(R,id)=>R.learners.find(l=>l.id===id)||null;
export const primaryOf=R=>byId(R,R.primary)||R.learners[0];
export const isPrimary=(R,l)=>l.id===R.primary;
// engine settings (E.configure): the primary learner keeps [vars] (unchanged behaviour); others use their profile
export function settings(R,l,env={}){if(isPrimary(R,l))return{LEARNER_NAME:env.LEARNER_NAME,LEARNER_AGE:env.LEARNER_AGE,LEARNER_GRADE:env.LEARNER_GRADE};
  return{LEARNER_NAME:l.name,LEARNER_AGE:String(ageFor(l)),LEARNER_GRADE:l.grade||''};}
// which learner a request is for: ?learner=, else the remembered-device cookie, else the only one, else the primary
export function select(R,{query,cookie}={}){const q=query&&byId(R,query);if(q)return{l:q,how:'query'};const c=cookie&&byId(R,cookie);if(c)return{l:c,how:'cookie'};
  if(R.learners.length===1)return{l:R.learners[0],how:'only'};return{l:primaryOf(R),how:'default'};}
export const cookieOf=(req,name)=>{const m=(req.headers.get('cookie')||'').match(new RegExp('(?:^|;\\s*)'+name.replace(/[^\w-]/g,'')+'=([^;]*)'));try{return m?decodeURIComponent(m[1]):null;}catch{return null;}};
// PIN: a kid-level guard, not real security. Salted SHA-256; the cookie token is derived from the stored hash.
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
export const sha256=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
export const PIN_RE=/^\d{4}$/;
export async function makePin(pin){const salt=hex(crypto.getRandomValues(new Uint8Array(8)));return{salt,hash:await sha256(salt+':'+pin)};}
export async function checkPin(l,pin){return !!l?.pin&&PIN_RE.test(String(pin??''))&&await sha256(l.pin.salt+':'+pin)===l.pin.hash;}
export async function pinToken(l){return l?.pin?(await sha256('jane-pin:'+l.id+':'+l.pin.hash)).slice(0,32):null;}
export async function unlocked(req,l){if(!l?.pin)return true;return cookieOf(req,'jlp_'+l.id)===await pinToken(l);}
// public view of a profile (never the PIN hash)
export const publicProfile=l=>({id:l.id,name:l.name,avatar:l.avatar||DEFAULT_AVATAR,hasPin:!!l.pin});
