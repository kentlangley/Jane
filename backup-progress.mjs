// --learner <id>: that learner's record (default: the primary learner) into backups/<PT date>/<id>/.
// Save the progress record to backups/<PT date>/progress-<HHMMSS>.json (gitignored). Read-only on storage.
// --local / STORAGE=file: back up the standalone server's record into DATA_DIR/backups/ instead.
import fs from 'fs';import path from 'path';import crypto from 'crypto';import {kvGet,DIR,ptDate,LOCAL,lk,learnerBackupDir} from './lib-cli.mjs';
const S=kvGet(lk('progress'));
if(!S){console.log('backup: no progress record yet, nothing to save');process.exit(0);}
const t=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Los_Angeles',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/:/g,'');
const dir=learnerBackupDir(ptDate());fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,`progress-${t}.json`);
const body=JSON.stringify(S);fs.writeFileSync(f,body);console.log(`backup${LOCAL?' (local)':''}:`,LOCAL?f:path.relative(DIR,f),`(${S.points??0} points, sha256 ${crypto.createHash('sha256').update(body).digest('hex')})`);
