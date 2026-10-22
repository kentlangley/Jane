// Household region filter. data/regions/<CODE>.txt tags topics whose content is specific to one country or region
// (one line per topic: `mt_id  # subject > domain > name — why`). Every topic plays by default; a household that
// sets HIDE_REGIONS (e.g. "AU") gets a public/tax.json without those topics: build.mjs leaves them out like pending
// topics and reconnects the prerequisite graph around them, so Play, quests, gates, spot-checks, the export's frontier
// and publish-lessons never see them. Progress and medals on a hidden topic are kept (medals still list).
// The setting is read from the HIDE_REGIONS environment variable, else from [vars] HIDE_REGIONS in wrangler.toml.
import fs from 'fs';import path from 'path';
export const REGION_DIR='data/regions';
const codes=s=>[...new Set(String(s).split(/[\s,]+/).map(x=>x.trim().toUpperCase()).filter(Boolean))].sort();
// {CODE: Map(id → comment)} for every tag file
export function regionTags(root='.'){const dir=path.join(root,REGION_DIR),out={};
  if(!fs.existsSync(dir))return out;
  for(const f of fs.readdirSync(dir).filter(f=>/^[A-Z]{2,8}\.txt$/.test(f)).sort()){const m=new Map();
    for(const l of fs.readFileSync(path.join(dir,f),'utf8').split('\n')){if(!l.trim()||l.startsWith('#'))continue;const id=l.replace(/#.*/,'').trim();
      if(!/^mt_[\w-]+$/.test(id))throw Error(`${REGION_DIR}/${f}: bad line "${l}"`);if(m.has(id))throw Error(`${REGION_DIR}/${f}: duplicate ${id}`);m.set(id,(l.split('#')[1]||'').trim());}
    out[f.replace(/\.txt$/,'')]=m;}
  return out;}
// {codes:[…]|null, source}: codes is null when nothing is configured (then every topic plays)
export function hideRegionsSetting(root='.'){
  if(process.env.HIDE_REGIONS!==undefined)return{codes:codes(process.env.HIDE_REGIONS),source:'HIDE_REGIONS environment variable'};
  try{const t=fs.readFileSync(path.join(root,'wrangler.toml'),'utf8');const m=t.match(/^\[vars\]([\s\S]*?)(?=^\[|$(?![\s\S]))/m);
    const x=m&&m[1].match(/^\s*HIDE_REGIONS\s*=\s*"([^"]*)"/m);if(x)return{codes:codes(x[1]),source:'[vars] HIDE_REGIONS in wrangler.toml'};}catch{}
  return{codes:null,source:null};}
// For the nightly tools: the regions public/tax.json was built with must match the configured setting, so the
// lesson author never sees a topic the app hides (or misses one it shows). Returns the built regions.
export function checkRegionFilter(tax,root='.'){const built=codes((tax.hidden?.regions||[]).join(',')),s=hideRegionsSetting(root);
  if(s.codes&&s.codes.join(',')!==built.join(','))throw Error(`public/tax.json was built with HIDE_REGIONS="${built.join(',')}" but the ${s.source} says "${s.codes.join(',')}". Run: npm run build`);
  return built;}
