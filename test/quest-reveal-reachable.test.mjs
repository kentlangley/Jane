// v0.8.1: the quest reveal (treasure chest or Finale crown) must never trap the learner. In v0.8.0 the Finale reveal was a
// fixed, overflow:hidden, vertically centred overlay about 730px tall with no way to close it: on short screens (phone in
// landscape, small phones, split-screen tablets, zoomed browsers) the "Face the Final Boss!" button sat off-screen and every
// tab behind it (My World island, Quests, ...) was blocked, on every reload, until the quest was started.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {ROOT} from './helpers.mjs';
const js=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8'),css=fs.readFileSync(path.join(ROOT,'public/app.css'),'utf8');
const bare=css.replace(/\/\*[\s\S]*?\*\//g,'');const rule=sel=>[...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].split(',').map(s=>s.trim()).includes(sel)).map(m=>m[2]).join(';');
const last=(decls,prop)=>{const all=[...decls.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`,'g'))];return all.length?all[all.length-1][1].trim():null;};

test('the reveal overlay scrolls instead of clipping its Start button',()=>{const d=rule('.qreveal');
  assert.equal(last(d,'overflow-y'),'auto','tall content must scroll');assert.equal(last(d,'align-items'),'flex-start','scroll from the top, never clip it');
  assert.match(rule('.qreveal .qrbox'),/margin:auto/,'still centred when it fits');
  assert.match(rule('.qreveal .rays'),/position:fixed/);assert.match(rule('.qreveal .rays'),/pointer-events:none/,'the spinning rays never take a tap');});

test('short screens get a compact reveal so the button fits without scrolling',()=>{
  assert.match(css,/@media \(max-height:760px\)\{\.crownrev\{height:72px\}/);
  assert.match(css,/@media \(max-height:620px\)\{\.qreveal \.crownrev,\.qreveal \.chest,\.qreveal \.paper \.qemo\{display:none\}/);
  assert.match(css,/@media \(max-height:450px\)\{\.qreveal \.qpath,\.qreveal \.paper \.small,\.qreveal \.fbsub\{display:none\}\}/);});

test('the reveal has a way out and a failed start can be retried',()=>{
  const fn=js.slice(js.indexOf('function questReveal('),js.indexOf('function qcardHTML('));assert.ok(fn.length>100);
  assert.match(fn,/class="qrclose" id="qrlater" aria-label="Not now"/,'a visible ✕ "Not now" button');
  assert.match(fn,/\$\('qrlater'\)\.onclick=later/);assert.match(fn,/e\.key==='Escape'/);assert.match(fn,/removeEventListener\('keydown',onKey\)/);
  assert.match(fn,/try\{s=await api\('\/api\/quest\/start'/,'a network/JSON error no longer leaves a dead button');
  assert.match(fn,/if\(busy\)return;busy=true/,'no double starts');assert.match(fn,/id="qrerr" role="alert"/);
  assert.match(css,/\.qreveal \.qrclose\{position:fixed;top:10px;right:10px/);});
