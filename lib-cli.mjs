// Shared helpers for the nightly CLI scripts. Two storage modes:
//   remote (default): run wrangler (Node 22) against the JANE_KV namespace on Cloudflare.
//   local: pass --local or set STORAGE=file to use the standalone server's files in DATA_DIR (default ./local-data).
import {execFileSync} from 'child_process';import fs from 'fs';import path from 'path';import os from 'os';import {fileURLToPath} from 'url';
import {fileStore} from './server/file-kv.mjs';
export const DIR=path.dirname(fileURLToPath(import.meta.url));
export const LOCAL=process.argv.includes('--local')||/^(file|local)$/i.test(process.env.STORAGE||'');
export const DATA_DIR=path.resolve(process.env.DATA_DIR||path.join(DIR,'local-data'));
const FS=LOCAL?fileStore(DATA_DIR):null;
// Where backups/ and exports/ go: next to the repo (remote mode) or inside DATA_DIR (local mode, e.g. the Docker volume).
export const outDir=sub=>LOCAL?path.join(DATA_DIR,sub):path.join(DIR,sub);
// Optional portable Node 22: set NODE22_BIN, or drop one in ~/.local/node-v22.20.0-linux-x64.
const NODE22=process.env.NODE22_BIN||path.join(os.homedir(),'.local/node-v22.20.0-linux-x64/bin');
// account_id and the KV namespace id come from wrangler.toml (copy wrangler.toml.example) or CLOUDFLARE_ACCOUNT_ID.
const env={...process.env,PATH:fs.existsSync(NODE22)?`${NODE22}:${process.env.PATH}`:process.env.PATH};
const wr=args=>execFileSync('npx',['--no-install','wrangler',...args],{cwd:DIR,env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64<<20});
export function kvGet(key){if(FS)return FS.getSync(key,'json');try{const out=wr(['kv','key','get','--binding','JANE_KV','--remote',key]);return out.trim()?JSON.parse(out):null;}catch(e){if(/not found|404/i.test(String(e.stderr||e.message)))return null;throw e;}}
export function kvPut(key,obj){if(FS)return FS.putSync(key,JSON.stringify(obj));const f=path.join(DIR,`.kvput-${process.pid}.json`);fs.writeFileSync(f,JSON.stringify(obj));try{wr(['kv','key','put','--binding','JANE_KV','--remote',key,'--path',f]);}finally{fs.unlinkSync(f);}}
export function kvDel(key){if(FS)return FS.deleteSync(key);wr(['kv','key','delete','--binding','JANE_KV','--remote',key]);}
export const loadTax=()=>JSON.parse(fs.readFileSync(path.join(DIR,'public/tax.json'),'utf8'));
export const ptDate=(ms=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export function kvList(prefix){if(FS)return FS.listSync(prefix);const out=wr(['kv','key','list','--binding','JANE_KV','--remote',...(prefix?['--prefix',prefix]:[])]);return JSON.parse(out).map(k=>k.name);}
// active quests = started, not finished (v0.5: one at a time; older states may still hold several)
// v0.5 refresh: how many leading stages of a quest the learner has reached. A stage is reached when any of its
// questions (or its boss power-up card) was seen, or it holds the item on screen; every earlier stage counts too.
// Reached stages are immutable: publish-lessons --refresh only changes the stages after them.
export function questReached(S,pack){const d=pack.date,live=[S?.current,S?.miniHold].map(x=>String(x?.packKey||'')).filter(Boolean);let r=0;
  (pack.topics||[]).forEach((t,i)=>{const pre=`${d}:${t.topicId}:`;if((t.questions||[]).some((q,j)=>S?.packSeen?.[pre+j])||S?.packSeen?.[pre+'powerup']||live.some(k=>k.startsWith(pre)))r=i+1;});return r;}
export function activeQuests(S,except){const Q=S?.quests||{};return Object.entries(Q).filter(([d,q])=>q.started&&!q.done&&d!==except).map(([d])=>d).sort();}
// Learner settings: [vars] LEARNER_NAME / LEARNER_AGE / LEARNER_GRADE in wrangler.toml (env vars override; local mode uses env only, like the server). Defaults: Explorer, 10, upper elementary.
export function learnerConfig(){const v={};if(!LOCAL)try{const t=fs.readFileSync(path.join(DIR,'wrangler.toml'),'utf8');const m=t.match(/^\[vars\]([\s\S]*?)(?=^\[|$(?![\s\S]))/m);
  if(m)for(const l of m[1].split('\n')){const x=l.match(/^\s*(LEARNER_[A-Z]+)\s*=\s*"([^"]*)"/);if(x)v[x[1]]=x[2];}}catch{}
  for(const k of ['LEARNER_NAME','LEARNER_AGE','LEARNER_GRADE'])if(process.env[k])v[k]=process.env[k];return v;}
