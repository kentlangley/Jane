// "Who's playing?" (plans/archive/learner-profiles.md Slice 2). Runs before app.js: with 2+ profiles and no remembered player on
// this device it shows the picker (and a PIN pad for profiles with a PIN), remembers the pick, then reloads into the app.
// window.janeWho resolves to the /api/profiles answer; app.js waits for it and does not load state while the picker shows.
(()=>{const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const post=(p,b)=>fetch(p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b||{})}).then(async r=>({status:r.status,...await r.json().catch(()=>({}))}));
 function switchLink(d){if(d.learners.length<2)return;const f=document.querySelector('p.foot');if(!f||f.querySelector('.switchp'))return;
   const a=document.createElement('a');a.href='#';a.className='switchp';a.textContent='🔄 Switch player';a.onclick=async e=>{e.preventDefault();await post('/api/profiles/forget');location.reload();};
   f.prepend(a,document.createTextNode(' · '));}
 function show(d){const o=document.createElement('div');o.className='who';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-labelledby','whoh');
   o.innerHTML=`<div class="whobox"><div class="whojane">👩‍🏫</div><h2 id="whoh">Who's playing?</h2><div class="whogrid">${d.learners.map(l=>`<button type="button" class="whob" data-id="${esc(l.id)}" aria-label="${esc(l.name)}${l.hasPin?' (PIN)':''}"><span class="whoav">${esc(l.avatar)}</span><span class="whon">${esc(l.name)}</span>${l.hasPin?'<span class="whol" aria-hidden="true">🔒</span>':''}</button>`).join('')}</div>
   <form class="whopin" hidden><label for="whopin"><span class="whopn"></span>, type your PIN</label><input id="whopin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" type="password" aria-describedby="whoerr"><button>Go ▶</button><button type="button" class="ghost whoback">Back</button><div id="whoerr" class="whoerr" aria-live="polite"></div></form></div>`;
   document.body.appendChild(o);document.body.classList.add('picking');const pinF=o.querySelector('.whopin'),grid=o.querySelector('.whogrid');let pick=null;
   const go=async(id,pin)=>{const r=await post('/api/profiles/select',{id,pin});if(r.ok){location.reload();return;}o.querySelector('#whoerr').textContent=r.error||'Hmm, try again!';const i=o.querySelector('#whopin');i.value='';i.focus();};
   grid.onclick=e=>{const b=e.target.closest('.whob');if(!b)return;const l=d.learners.find(x=>x.id===b.dataset.id);if(!l)return;
     if(!l.hasPin){go(l.id);return;}pick=l;grid.hidden=true;pinF.hidden=false;o.querySelector('.whopn').textContent=l.name;o.querySelector('#whoerr').textContent='';setTimeout(()=>o.querySelector('#whopin').focus(),30);};
   pinF.onsubmit=e=>{e.preventDefault();const v=o.querySelector('#whopin').value.trim();if(!/^\d{4}$/.test(v)){o.querySelector('#whoerr').textContent='4 numbers, please!';return;}go(pick.id,v);};
   o.querySelector('.whoback').onclick=()=>{pinF.hidden=true;grid.hidden=false;grid.querySelector('.whob')?.focus();};
   setTimeout(()=>grid.querySelector('.whob')?.focus(),30);}
 window.janeWho=fetch('/api/profiles').then(r=>r.json()).then(d=>{const ready=()=>{switchLink(d);if(d.picker)show(d);};
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();return d;}).catch(()=>null);})();
