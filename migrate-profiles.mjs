#!/usr/bin/env node
// Learner profiles migration (plans/archive/learner-profiles.md, Slice 1). Idempotent and reversible.
//   node migrate-profiles.mjs [--local] [--dry-run]   snapshot every KV key, then add the "profiles" registry
//   node migrate-profiles.mjs --rollback [--local]     delete the "profiles" registry (nothing else is touched)
// The primary learner keeps its original unprefixed keys, so the migration ONLY adds one key ("profiles"): it never
// rewrites, copies or moves the learner's progress, logs or packs. The snapshot (backups/<PT date>/pre-profiles-<HHMMSS>/,
// one file per key + MANIFEST.json with sha256s) is kept for rollback/audit; --local writes it inside DATA_DIR.
// Rollback: `node migrate-profiles.mjs --rollback` (the app falls back to the one-learner registry from [vars]).
// Restoring a key from the snapshot (only if a record was ever damaged): `node migrate-profiles.mjs --restore <dir> <key>`.
import fs from 'fs';import path from 'path';import crypto from 'crypto';import {kvGet,kvPut,kvDel,kvList,ptDate,outDir,LOCAL,learnerConfig} from './lib-cli.mjs';
import * as PF from './src/profiles.js';
const args=process.argv.slice(2),dry=args.includes('--dry-run');const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
if(args.includes('--restore')){const i=args.indexOf('--restore'),dir=args[i+1],key=args[i+2];if(!dir||!key){console.error('usage: --restore <snapshot dir> <key>');process.exit(2);}
  const f=path.join(dir,encodeURIComponent(key)+'.json');const body=fs.readFileSync(f,'utf8');const man=JSON.parse(fs.readFileSync(path.join(dir,'MANIFEST.json'),'utf8'));
  if(man.keys[key]!==sha(body)){console.error('⛔ snapshot file does not match its manifest sha; not restoring');process.exit(1);}
  if(dry){console.log(`would restore ${key} (${sha(body)})`);process.exit(0);}kvPut(key,JSON.parse(body));console.log(`restored ${key} from ${f} (sha256 ${sha(body)})`);process.exit(0);}
if(args.includes('--rollback')){const cur=kvGet('profiles');if(!cur){console.log('rollback: no "profiles" key, nothing to do');process.exit(0);}
  const extra=(cur.learners||[]).filter(l=>l.id!==cur.primary);
  if(extra.length&&!args.includes('--force')){console.error(`⛔ the registry has ${extra.length} other learner(s); their records (prefix L:<id>:) stay but become unreachable. Re-run with --force to roll back anyway.`);process.exit(1);}
  if(dry){console.log('rollback (dry run): would delete "profiles"');process.exit(0);}
  const d=path.join(outDir('backups'),ptDate());fs.mkdirSync(d,{recursive:true});const f=path.join(d,`profiles-before-rollback-${Date.now()}.json`);fs.writeFileSync(f,JSON.stringify(cur));
  kvDel('profiles');console.log(`rollback: deleted "profiles" (copy saved to ${f}). The app is back to one learner from [vars].`);process.exit(0);}
// 1. snapshot every key
const t=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Los_Angeles',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/:/g,'');
const dir=path.join(outDir('backups'),ptDate(),`pre-profiles-${t}`);fs.mkdirSync(dir,{recursive:true});
const keys=kvList('');const man={at:new Date().toISOString(),local:LOCAL,keys:{}};
for(const k of keys){const v=kvGet(k);const body=JSON.stringify(v);fs.writeFileSync(path.join(dir,encodeURIComponent(k)+'.json'),body);man.keys[k]=sha(body);}
fs.writeFileSync(path.join(dir,'MANIFEST.json'),JSON.stringify(man,null,1));
console.log(`snapshot: ${keys.length} keys → ${dir}${man.keys.progress?` (progress sha256 ${man.keys.progress})`:''}`);
// 2. registry (idempotent)
const cfg=learnerConfig(),existing=kvGet('profiles');
if(existing&&PF.registry(existing,cfg).learners.some(l=>l.id===existing.primary&&l.prefix==='')){console.log(`already migrated: "profiles" has primary "${existing.primary}" (${existing.learners.length} learner(s)); nothing written`);process.exit(0);}
const base=PF.synth(cfg).learners[0];const S=kvGet('progress');
const reg={v:1,primary:base.id,learners:[{id:base.id,name:base.name,grade:base.grade,interests:[],avatar:PF.DEFAULT_AVATAR,pin:null,prefix:'',created:Date.now()}]};
if(dry){console.log('dry run: would write "profiles" =',JSON.stringify({...reg,learners:reg.learners.map(l=>({...l,name:'…'}))}));process.exit(0);}
kvPut('profiles',reg);
// 3. verify: the learner's records were not touched
const after=JSON.stringify(kvGet('progress'));const same=!S||sha(after)===man.keys.progress;
console.log(`registry written: primary "${reg.primary}" (prefix ""). progress ${same?'unchanged ✅':'CHANGED since the snapshot (live play?) — compare with the snapshot'} sha256 ${sha(after)}`);
if(!same)process.exit(5);
