// Learner profiles (plans/learner-profiles.md): per-learner records, registry migration, isolation between kids.
// Runs the Worker in-process with file storage in a temp dir (no network, no live data).
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT,tmpDir} from './helpers.mjs';import {fileStore} from '../server/file-kv.mjs';import {assets} from '../server/assets.mjs';
import worker from '../src/worker.js';import * as PF from '../src/profiles.js';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const mk=()=>{const dir=tmpDir('jane-prof-');return{dir,env:{ASSETS:assets(path.join(ROOT,'public')),JANE_KV:fileStore(dir),LEARNER_NAME:'Sam',LEARNER_AGE:'10.5',LEARNER_GRADE:'5th grade'}};};
const call=async(env,p,body,cookie='')=>{const r=await worker.fetch(new Request('http://x'+p,body===undefined?{headers:{cookie}}:{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)}),env);return{status:r.status,json:await r.json().catch(()=>null),headers:r.headers};};
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const strip=s=>{const o=JSON.parse(JSON.stringify(s));delete o.profile;return o;};
const addKid=(env,extra={})=>{const kv=env.JANE_KV;const R=kv.getSync('profiles','json')||PF.synth(env);R.learners.push({id:'kid',name:'Robin',grade:'7th grade',interests:['chess'],avatar:'🦉',pin:null,prefix:'L:kid:',...extra});kv.putSync('profiles',JSON.stringify(R));};
const runMig=(dir,...a)=>execFileSync(process.execPath,['migrate-profiles.mjs','--local',...a],{cwd:ROOT,env:{...process.env,DATA_DIR:dir,LEARNER_NAME:'Sam',LEARNER_AGE:'10.5',LEARNER_GRADE:'5th grade'},encoding:'utf8'});

test('profiles helpers: slug, age from grade, synthesised registry, selection',()=>{
  assert.equal(PF.slug('Landon'),'landon');assert.equal(PF.slug('Zoë Ann'),'zoe-ann');assert.equal(PF.ageFor({grade:'5th grade'}),10.5);assert.equal(PF.ageFor({grade:'8'}),13.5);assert.equal(PF.ageFor({grade:'K'}),5.5);
  const R=PF.synth({LEARNER_NAME:'Sam'});assert.equal(R.primary,'sam');assert.equal(R.learners[0].prefix,'');
  const R2=PF.registry({v:1,primary:'sam',learners:[{id:'sam',name:'Sam'},{id:'kid',name:'Robin'}]});assert.equal(R2.learners[1].prefix,'L:kid:');assert.equal(R2.learners[0].prefix,'');
  assert.equal(PF.select(R2,{}).l.id,'sam');assert.equal(PF.select(R2,{cookie:'kid'}).l.id,'kid');assert.equal(PF.select(R2,{query:'kid',cookie:'sam'}).l.id,'kid');assert.equal(PF.select(R2,{cookie:'nobody'}).l.id,'sam');});

test('PIN: hashed with a salt, token derived from the hash, never public',async()=>{const pin=await PF.makePin('4821');assert.notEqual(pin.hash,'4821');assert.equal(pin.hash.length,64);
  const l={id:'kid',pin};assert.equal(await PF.checkPin(l,'4821'),true);assert.equal(await PF.checkPin(l,'1111'),false);assert.equal(await PF.checkPin(l,'48a1'),false);
  assert.equal((await PF.pinToken(l)).length,32);assert.deepEqual(Object.keys(PF.publicProfile({id:'kid',name:'R',pin})).sort(),['avatar','hasPin','id','name']);});

test('no registry: the one learner uses the original keys (unchanged behaviour)',async()=>{const {dir,env}=mk();
  const s=(await call(env,'/api/state')).json;assert.equal(s.name,'Sam');assert.equal(s.profile.id,'sam');assert.equal(s.profile.count,1);
  await call(env,'/api/answer',{answer:'3/8'});assert.ok(fs.existsSync(path.join(dir,'progress.json')));assert.ok(fs.existsSync(path.join(dir,`log%3A${today}.json`)));
  assert.ok(!fs.readdirSync(dir).some(f=>f.startsWith('L%3A')),'no prefixed keys');});

test('migration: snapshot + registry only; progress byte-identical; state unchanged; idempotent; rollback',async()=>{const {dir,env}=mk();
  await call(env,'/api/state');await call(env,'/api/answer',{answer:'5/8'});await call(env,'/api/answer',{answer:'3/8'});
  const before=strip((await call(env,'/api/state')).json);const pf=path.join(dir,'progress.json'),h0=sha(pf);
  const files0=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort();
  const out=runMig(dir);assert.match(out,/snapshot: \d+ keys/);assert.match(out,/progress unchanged ✅/);
  assert.equal(sha(pf),h0,'progress byte-identical');const R=env.JANE_KV.getSync('profiles','json');assert.equal(R.primary,'sam');assert.equal(R.learners[0].prefix,'');
  for(const f of files0)assert.equal(fs.existsSync(path.join(dir,f)),true,f);
  const snap=fs.readdirSync(path.join(dir,'backups',today)).find(d=>d.startsWith('pre-profiles-'));const man=JSON.parse(fs.readFileSync(path.join(dir,'backups',today,snap,'MANIFEST.json'),'utf8'));
  assert.equal(man.keys.progress,crypto.createHash('sha256').update(fs.readFileSync(pf,'utf8')).digest('hex'));
  const after=(await call(env,'/api/state')).json;assert.deepEqual(strip(after),before,'state identical apart from profile');assert.equal(after.profile.id,'sam');
  assert.match(runMig(dir),/already migrated/);assert.equal(sha(pf),h0);
  addKid(env);assert.throws(()=>runMig(dir,'--rollback'),/other learner/);
  const R1=env.JANE_KV.getSync('profiles','json');R1.learners=R1.learners.filter(l=>l.id!=='kid');env.JANE_KV.putSync('profiles',JSON.stringify(R1));
  assert.match(runMig(dir,'--rollback'),/deleted "profiles"/);assert.equal(env.JANE_KV.getSync('profiles'),null);assert.equal(sha(pf),h0);
  assert.deepEqual(strip((await call(env,'/api/state')).json),before);});

test('a second learner has a separate record, logs, quests and wallet',async()=>{const {dir,env}=mk();runMig(dir);addKid(env);
  await call(env,'/api/state');await call(env,'/api/answer',{answer:'3/8'});const sam=(await call(env,'/api/state')).json;const pf=path.join(dir,'progress.json'),h=sha(pf);
  const k=(await call(env,'/api/state?learner=kid')).json;assert.equal(k.name,'Robin');assert.equal(k.profile.id,'kid');assert.equal(k.points,0);assert.equal(k.profile.count,2);
  assert.equal(k.learner.grade,'7th grade');assert.equal(k.learner.age,12.5);
  await call(env,'/api/answer?learner=kid',{answer:'3/8'});assert.ok(fs.existsSync(path.join(dir,'L%3Akid%3Aprogress.json')));assert.ok(fs.existsSync(path.join(dir,`L%3Akid%3Alog%3A${today}.json`)));
  assert.equal(sha(pf),h,'the primary record is untouched by the other learner');
  // a quest published for the kid only shows for the kid
  const ex=JSON.parse(fs.readFileSync(path.join(ROOT,'packs/examples/example-quest.json'),'utf8'));ex.date=today;env.JANE_KV.putSync('L:kid:lessons:'+today,JSON.stringify(ex));
  assert.equal((await call(env,'/api/state?learner=kid')).json.newQuest,true);assert.ok(!(await call(env,'/api/state')).json.quest,'primary sees no quest');
  // the cookie selects the learner too (remembered device)
  assert.equal((await call(env,'/api/state',undefined,'jl=kid')).json.profile.id,'kid');
  const w=(await call(env,'/api/market?learner=kid')).json.wallet;assert.equal(typeof w.balance,'number');
  assert.equal((await call(env,'/api/state')).json.points,sam.points);});

test('concurrent requests for two learners never mix names or ages',async()=>{const {dir,env}=mk();runMig(dir);addKid(env);
  const rs=await Promise.all([...Array(8)].map((_,i)=>call(env,i%2?'/api/state?learner=kid':'/api/state')));
  rs.forEach((r,i)=>{assert.equal(r.json.name,i%2?'Robin':'Sam');assert.equal(r.json.learner.age,i%2?12.5:10.5);});});

test('sandbox stays per learner',async()=>{const {dir,env}=mk();runMig(dir);addKid(env);await call(env,'/api/state?learner=kid');
  await call(env,'/api/sandbox/reset?learner=kid',{offsetDays:0},'sbx=1');assert.ok(fs.existsSync(path.join(dir,'sandbox%3AL%3Akid%3Aprogress.json')));
  assert.ok(!fs.existsSync(path.join(dir,'sandbox%3Aprogress.json')));});

// ---- Slice 2: picker, PIN, remembered device ----
const cookies=r=>r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
test('/api/profiles: one learner → no picker; two → picker until a player is remembered',async()=>{const {dir,env}=mk();
  let p=(await call(env,'/api/profiles')).json;assert.equal(p.picker,false);assert.equal(p.learners.length,1);
  runMig(dir);addKid(env);p=(await call(env,'/api/profiles')).json;assert.equal(p.picker,true);assert.deepEqual(p.learners.map(l=>l.id),['sam','kid']);
  assert.ok(p.learners.every(l=>!('pin' in l)),'no PIN data in the public list');
  const s=await call(env,'/api/profiles/select',{id:'kid'});assert.equal(s.status,200);const c=cookies(s);assert.match(c,/jl=kid/);
  assert.match(s.headers.getSetCookie()[0],/HttpOnly/);assert.match(s.headers.getSetCookie()[0],/Max-Age=31536000/);
  p=(await call(env,'/api/profiles',undefined,c)).json;assert.equal(p.picker,false);assert.equal(p.current,'kid');
  assert.equal((await call(env,'/api/state',undefined,c)).json.name,'Robin');
  const f=await call(env,'/api/profiles/forget',{},c);assert.match(f.headers.getSetCookie()[0],/jl=; .*Max-Age=0/);
  assert.equal((await call(env,'/api/profiles/select',{id:'nobody'})).status,404);});

test('PIN profile: kid APIs need the PIN cookie; wrong PIN refused; right PIN remembered',async()=>{const {dir,env}=mk();runMig(dir);addKid(env,{pin:await PF.makePin('2468')});
  assert.equal((await call(env,'/api/profiles')).json.learners[1].hasPin,true);
  const locked=await call(env,'/api/state?learner=kid');assert.equal(locked.status,401);assert.equal(locked.json.needPin,true);
  assert.ok(!fs.existsSync(path.join(dir,'L%3Akid%3Aprogress.json')),'nothing written while locked');
  const bad=await call(env,'/api/profiles/select',{id:'kid',pin:'1111'});assert.equal(bad.status,403);assert.equal(bad.headers.getSetCookie().length,0);
  const ok=await call(env,'/api/profiles/select',{id:'kid',pin:'2468'});assert.equal(ok.status,200);const c=cookies(ok);assert.match(c,/jlp_kid=/);
  assert.equal((await call(env,'/api/state',undefined,c)).json.name,'Robin');assert.equal((await call(env,'/api/profiles',undefined,c)).json.current,'kid');
  // a remembered player whose PIN cookie is missing gets the picker again; the other kid is unaffected
  assert.equal((await call(env,'/api/profiles',undefined,'jl=kid')).json.picker,true);assert.equal((await call(env,'/api/state')).json.name,'Sam');});

test('the kid app loads picker.js before app.js and app.js waits for it',()=>{const h=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
  assert.ok(h.indexOf('/picker.js')>0&&h.indexOf('/picker.js')<h.indexOf('/app.js'));assert.match(fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8'),/window\.janeWho/);});

// ---- Slice 3: parent view per kid + add a learner ----
const parentData=async(env,q='')=>{const r=await worker.fetch(new Request('http://x/parent'+q),env);const h=await r.text();return JSON.parse(h.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g,'<'));};
test('parent adds a learner (generic onboarding), sees each kid, sets and clears a PIN',async()=>{const {dir,env}=mk();
  await call(env,'/api/state');await call(env,'/api/answer',{answer:'3/8'});const h=sha(path.join(dir,'progress.json'));
  const bad=await call(env,'/api/parent/profiles',{name:'',grade:''});assert.equal(bad.status,400);
  const c=await call(env,'/api/parent/profiles',{name:'Test Kid',grade:'8th grade',interests:'chess, music',avatar:'🦉'});assert.equal(c.status,200);assert.equal(c.json.profile.id,'test-kid');
  const R=env.JANE_KV.getSync('profiles','json');assert.equal(R.primary,'sam');assert.equal(R.learners[0].prefix,'');assert.equal(R.learners[1].prefix,'L:test-kid:');assert.deepEqual(R.learners[1].interests,['chess','music']);
  assert.equal(sha(path.join(dir,'progress.json')),h,'adding a learner never touches the primary record');
  assert.equal((await call(env,'/api/parent/profiles',{name:'Test Kid',grade:'3'})).json.profile.id,'test-kid-2','ids stay unique');
  const D=await parentData(env);assert.equal(D.profiles.current,'sam');assert.equal(D.profiles.learners.length,3);assert.equal(D.profiles.learners[0].points>0,true);assert.equal(D.profiles.learners[1].points,0);
  const D2=await parentData(env,'?learner=test-kid');assert.equal(D2.name,'Test Kid');assert.equal(D2.grade,'8th grade');assert.equal(D2.profiles.current,'test-kid');
  assert.equal((await call(env,'/api/parent/profiles/update',{id:'test-kid',pin:'12a4'})).status,400);
  assert.equal((await call(env,'/api/parent/profiles/update',{id:'test-kid',pin:'1357'})).status,200);assert.equal((await call(env,'/api/state?learner=test-kid')).status,401);
  assert.equal((await call(env,'/api/parent/profiles/update',{id:'test-kid',pin:null})).status,200);assert.equal((await call(env,'/api/state?learner=test-kid')).status,200);
  assert.equal((await call(env,'/api/parent/profiles/update',{id:'sam',name:'Changed'})).status,200);assert.equal((await call(env,'/api/state')).json.name,'Sam','primary name stays from [vars]');
  assert.ok(!JSON.stringify(D).includes('"hash"'),'no PIN hashes in the parent page');});
test('PARENT_PIN (optional) guards the parent writes',async()=>{const {env}=mk();env.PARENT_PIN='9090';
  assert.equal((await call(env,'/api/parent/profiles',{name:'A',grade:'2'})).status,403);assert.equal((await call(env,'/api/parent/profiles',{name:'A',grade:'2',parentPin:'9090'})).status,200);});
