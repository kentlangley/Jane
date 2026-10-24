#!/usr/bin/env node
// One-time: re-score existing medals and mastery under the honest rules (LESSONS.md "Mastery and medals").
// Usage: node migrate-medals.mjs --dry-run [--local]                  show before/after counts, write nothing
//        node migrate-medals.mjs --backup <file> [--local]            write (needs a backup of the CURRENT record)
// Make the backup first with `node backup-progress.mjs [--local]`; it prints the sha256 this script checks.
// Topics that lose mastery become unverified and due now, so review gates re-check them. Never touches sandbox:* keys.
// Policy: legendary medals already awarded are kept as legendary and their topics keep mastery (default, Kent's
// decision for this repo); --no-keep-legendary re-scores legendary medals strictly too (3 first-try boss answers in a day).
// Exit codes: 0 ok, 2 usage, 5 no matching backup (nothing written).
import fs from 'fs';import crypto from 'crypto';import {kvGet,kvPut,kvList,loadTax,LOCAL,lk} from './lib-cli.mjs';import * as E from './src/engine.js';
const args=process.argv.slice(2),dry=args.includes('--dry-run'),bi=args.indexOf('--backup'),backup=bi>=0?args[bi+1]:null;
if(!dry&&bi>=0&&!backup){console.error('Usage: node migrate-medals.mjs --dry-run | --backup <file> [--local]');process.exit(2);}
const g=E.graph(loadTax()),raw=kvGet(lk('progress'));if(!raw){console.log('no progress record yet: nothing to re-score');process.exit(0);}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),cur=sha(JSON.stringify(raw));
const logs=kvList(lk('log:')).flatMap(k=>(kvGet(k)||[]));
const keepLegendary=!args.includes('--no-keep-legendary');
const res=E.rescore(raw.v===2?raw:E.migrate(raw,g),g,logs,Date.now(),{keepLegendary});
const B=res.before,A=res.after,row=(k,b,a)=>`  ${k.padEnd(24)} ${String(b).padStart(5)} → ${String(a).padStart(5)}`;
const tiers=[...new Set([...Object.keys(B.tiers),...Object.keys(A.tiers)])].sort();
console.log(`medal re-score${LOCAL?' (local)':''}${dry?' — DRY RUN, nothing written':''}${res.already?' — already re-scored (rules v2), nothing to do':''}`);
console.log(`  ${''.padEnd(24)} before → after\n`+[row('mastered (direct)',B.direct,A.direct),row('mastered (self-check)',B.self,A.self),row('inferred / unverified',B.inferred,A.inferred),
  row('topic medals',B.medals,A.medals),...tiers.map(t=>row('  '+t,B.tiers[t]||0,A.tiers[t]||0)),row('quest medals',B.questMedals,A.questMedals)].join('\n'));
const c=k=>res.changes.filter(x=>x.change===k).length;
console.log(`  mastery removed: ${c('lost mastery')} (these ${res.requeued||0} topics go back to review, due now) · self→direct (earned by graded answers): ${c('self→direct')}`);
console.log(`  medals removed: ${c('medal removed')} · legendary downgraded: ${res.changes.filter(x=>/^legendary→/.test(x.change)).length} · duplicates removed: ${res.duplicates||0} · no log history (fallback to counts): ${(res.fallback||[]).length}`);
console.log(`  legendary policy: ${keepLegendary?`keep already-awarded legendary medals and their mastery (${res.keptLegendary||0} kept)`:'strict re-score (--no-keep-legendary)'}`);
console.log(`  answer-log entries read: ${logs.length} over ${kvList(lk('log:')).length} day(s)`);
if(dry||res.already)process.exit(0);
if(!backup||!fs.existsSync(backup)){console.error('⛔ no backup: run `node backup-progress.mjs'+(LOCAL?' --local':'')+'` first and pass --backup <file>. Nothing written.');process.exit(5);}
if(sha(fs.readFileSync(backup,'utf8'))!==cur){console.error(`⛔ the backup does not match the current progress record (sha256 ${cur.slice(0,12)}…). Make a fresh backup. Nothing written.`);process.exit(5);}
kvPut(lk('progress'),res.S2);console.log(`✅ re-scored and saved progress${LOCAL?' (local)':''} (backup ${backup})`);
