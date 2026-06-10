'use strict';
const $ = (s) => document.querySelector(s);
let CURRENT_CASE = null;

const api = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const tok = localStorage.getItem('raven_token');
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const r = await fetch(path, { ...opts, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
};

const KIND_COLOR = {
  phone:'#FFB020', email:'#FB7185', username:'#E879F9', domain:'#38BDF8',
  service:'#2DD4BF', profile:'#A78BFA', breach:'#FF3B30', host:'#7DD3FC',
  ip:'#818CF8', organization:'#2DD4BF'
};

/* ---------------- particles ---------------- */
function particles(){
  const c=$('#particles'); if(!c) return; const ctx=c.getContext('2d');
  const resize=()=>{c.width=innerWidth;c.height=innerHeight;}; resize(); addEventListener('resize',resize);
  const pts=Array.from({length:110},()=>({x:Math.random()*c.width,y:Math.random()*c.height,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3}));
  (function loop(){ if($('#login').classList.contains('hidden'))return;
    ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle='rgba(255,106,0,.5)';
    for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>c.width)p.vx*=-1;if(p.y<0||p.y>c.height)p.vy*=-1;ctx.fillRect(p.x,p.y,1.4,1.4);}
    requestAnimationFrame(loop);})();
}

/* ---------------- auth ---------------- */
$('#login-form').addEventListener('submit', async (e)=>{
  e.preventDefault(); const f=new FormData(e.target);
  try{
    const d=await api('/api/login',{method:'POST',body:JSON.stringify({username:f.get('username'),password:f.get('password')})});
    localStorage.setItem('raven_token',d.token); localStorage.setItem('raven_user',JSON.stringify(d));
    enterApp(d);
  }catch(err){ $('#login-error').textContent=err.message; }
});
$('#logout').addEventListener('click',()=>{ localStorage.clear(); location.reload(); });

function enterApp(user){
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#who').textContent=`${user.display_name} · ${user.role.toUpperCase()}`;
  if(user.role==='admin') $('#audit-btn').classList.remove('hidden');
  if(user.quota!=null) $('#quota').textContent=`Tier quota: ${user.quota} scans/day`;
  clock(); showCases();
}

/* ---------------- cases view ---------------- */
async function showCases(){
  CURRENT_CASE=null;
  $('#case-view').classList.add('hidden'); $('#cases-view').classList.remove('hidden');
  $('#back-cases').classList.add('hidden'); $('#case-form').classList.add('hidden');
  try{
    const d=await api('/api/cases');
    $('#cases-list').innerHTML = d.cases.length ? d.cases.map(caseCard).join('')
      : '<div class="empty-cases">No cases yet. Create one to begin an investigation.</div>';
    document.querySelectorAll('.case-card').forEach(el=>
      el.addEventListener('click',()=>openCase(el.dataset.id)));
  }catch(err){ $('#cases-list').innerHTML=`<div class="error">${esc(err.message)}</div>`; }
}
function caseCard(c){
  return `<div class="case-card" data-id="${esc(c.id)}">
    <div class="code">${esc(c.code)} <span class="pill ${esc(c.priority)}">${esc(c.priority)}</span></div>
    <div class="title">${esc(c.title)}</div>
    <div class="meta"><span>◉ ${c.entity_count} entities</span><span>▷ ${c.scan_count} scans</span></div>
    <div class="basis">⚖ ${esc(c.legal_basis)}</div></div>`;
}
$('#new-case-btn').addEventListener('click',()=>$('#case-form').classList.toggle('hidden'));
$('#case-cancel').addEventListener('click',()=>$('#case-form').classList.add('hidden'));
$('#case-form').addEventListener('submit', async (e)=>{
  e.preventDefault(); $('#case-error').textContent='';
  const f=new FormData(e.target);
  try{
    const c=await api('/api/cases',{method:'POST',body:JSON.stringify({
      code:f.get('code'),title:f.get('title'),priority:f.get('priority'),legal_basis:f.get('legal_basis')})});
    e.target.reset(); openCase(c.id);
  }catch(err){ $('#case-error').textContent=err.message; }
});

/* ---------------- case workspace ---------------- */
async function openCase(id){
  try{
    const d=await api('/api/cases/'+id);
    CURRENT_CASE=d.case;
    $('#cases-view').classList.add('hidden'); $('#case-view').classList.remove('hidden');
    $('#back-cases').classList.remove('hidden');
    $('#case-header').innerHTML=`<div class="code">${esc(d.case.code)}
      <span class="pill ${esc(d.case.priority)}">${esc(d.case.priority)}</span></div>
      <div>${esc(d.case.title)}</div><div class="basis">⚖ ${esc(d.case.legal_basis)}</div>`;
    renderResults({graph:d.graph, entities:d.entities});
  }catch(err){ alert(err.message); }
}
$('#back-cases').addEventListener('click',showCases);

/* ---------------- scan ---------------- */
$('#scan-form').addEventListener('submit', async (e)=>{
  e.preventDefault(); $('#scan-error').textContent='';
  if(!CURRENT_CASE){ $('#scan-error').textContent='no case selected'; return; }
  const f=new FormData(e.target);
  const body={case_id:CURRENT_CASE.id, max_depth:parseInt(f.get('max_depth'),10)};
  for(const k of ['phone','email','username','domain','region']) if(f.get(k)) body[k]=f.get(k).trim();
  const btn=e.target.querySelector('button[type=submit]');
  btn.disabled=true; btn.textContent='◌ COLLECTING + PIVOTING…';
  try{
    const d=await api('/api/scan',{method:'POST',body:JSON.stringify(body)});
    if(d.quota_remaining!=null) $('#quota').textContent=`Scans remaining today: ${d.quota_remaining}`;
    renderResults(d);
  }catch(err){ $('#scan-error').textContent=err.message; }
  finally{ btn.disabled=false; btn.textContent='▷ RUN COLLECTION'; }
});

function renderResults(d){
  const g=d.graph||{nodes:[],edges:[]};
  const s=d.summary;
  $('#summary').innerHTML = s
    ? `<div><b>${s.collections}</b><span>COLLECTIONS</span></div>
       <div><b>${s.pivots}</b><span>AUTO-PIVOTS</span></div>
       <div><b>${s.case_entities}</b><span>CASE ENTITIES</span></div>
       <div><b>${s.case_links}</b><span>LINKS</span></div>`
    : `<div><b>${g.nodes.length}</b><span>CASE ENTITIES</span></div>
       <div><b>${g.edges.length}</b><span>LINKS</span></div>`;
  $('#graph-count').textContent=`(${g.nodes.length} nodes · ${g.edges.length} edges)`;
  $('#cards').innerHTML=(d.entities||[]).map(card).join('') || '<div class="empty-cases">Run a collection to populate this case.</div>';
  drawGraph(g);
}

function card(e){
  const findings=(e.findings||[]).map(f=>{
    let v=Array.isArray(f.value)?f.value.join(', '):f.value;
    return `<div class="finding"><div class="finding-top">
        <span class="fkey">${esc(f.key)}</span><span class="fval">${esc(String(v))}</span></div>
      <div class="fmeta"><span class="conf"><span style="width:${f.confidence}%"></span></span>
        conf ${f.confidence} · <span class="src">${esc(f.source)}</span></div>
      ${f.note?`<div class="note">${esc(f.note)}</div>`:''}</div>`;
  }).join('');
  return `<div class="tcard"><div class="tcard-head">
      <span class="tcard-kind">${esc(e.kind)}</span>
      <span class="tcard-val">${esc(e.value)}</span>
      <span class="origin ${esc(e.origin)}">${esc(e.origin)}</span></div>
    ${findings||'<div class="finding"><span class="note">no attributes</span></div>'}</div>`;
}

/* ---------------- link graph ---------------- */
function drawGraph(g){
  const c=$('#graph'); const ctx=c.getContext('2d');
  const W=c.width=c.clientWidth, H=c.height=c.clientHeight;
  const nodes=g.nodes.map(n=>({...n,x:W/2+(Math.random()-.5)*W*.6,y:H/2+(Math.random()-.5)*H*.6,vx:0,vy:0}));
  const idx=Object.fromEntries(nodes.map((n,i)=>[n.id,i]));
  const edges=g.edges.filter(e=>idx[e.source]!=null&&idx[e.target]!=null);
  const kinds=[...new Set(nodes.map(n=>n.kind))];
  $('#graph-legend').innerHTML=kinds.map(k=>`<span><i style="background:${KIND_COLOR[k]||'#FF6A00'}"></i>${k}</span>`).join('')||'<span>no entities</span>';
  let frames=0;
  (function sim(){
    frames++;
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j];let dx=a.x-b.x,dy=a.y-b.y;let d=Math.hypot(dx,dy)||.01;
      const rep=2600/(d*d);dx/=d;dy/=d;a.vx+=dx*rep;a.vy+=dy*rep;b.vx-=dx*rep;b.vy-=dy*rep;}
    for(const e of edges){const a=nodes[idx[e.source]],b=nodes[idx[e.target]];
      let dx=b.x-a.x,dy=b.y-a.y;let d=Math.hypot(dx,dy)||.01;const f=(d-80)*.01;
      dx/=d;dy/=d;a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;}
    for(const n of nodes){n.vx+=(W/2-n.x)*.001;n.vy+=(H/2-n.y)*.001;
      n.x+=Math.max(-6,Math.min(6,n.vx*=.85));n.y+=Math.max(-6,Math.min(6,n.vy*=.85));
      n.x=Math.max(18,Math.min(W-18,n.x));n.y=Math.max(18,Math.min(H-18,n.y));}
    ctx.clearRect(0,0,W,H); ctx.strokeStyle='rgba(255,106,0,.22)'; ctx.lineWidth=1;
    ctx.font='10px JetBrains Mono, monospace';
    for(const e of edges){const a=nodes[idx[e.source]],b=nodes[idx[e.target]];
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const n of nodes){const col=KIND_COLOR[n.kind]||'#FF6A00';
      const r=n.origin==='seed'?8:n.origin==='pivot'?6:4.5;
      ctx.beginPath();ctx.arc(n.x,n.y,r,0,7);ctx.fillStyle=col;ctx.fill();
      if(n.origin==='seed'){ctx.lineWidth=1.5;ctx.strokeStyle='#FF6A00';ctx.stroke();}
      ctx.fillStyle='rgba(245,245,245,.85)';
      const lab=n.label.length>18?n.label.slice(0,17)+'…':n.label;
      ctx.fillText(lab,n.x+r+3,n.y+3);}
    if(frames<280)requestAnimationFrame(sim);
  })();
}

/* ---------------- audit ---------------- */
$('#audit-btn').addEventListener('click', async ()=>{
  try{
    const d=await api('/api/audit');
    $('#chain-state').innerHTML=d.chain_intact?'<span style="color:var(--success)">● chain intact</span>':'<span style="color:var(--danger)">● CHAIN BROKEN</span>';
    $('#audit-body').innerHTML=d.entries.map(r=>`<div class="audit-row">
      <b>${esc(r.ts)}</b> · ${esc(r.actor)} · <b>${esc(r.action)}</b> · case ${esc(r.case_id)}
      · ⚖ ${esc(r.legal_basis)}<br/>inputs: ${esc(JSON.stringify(r.inputs))} · ${esc(JSON.stringify(r.summary))}</div>`).join('')||'no entries';
    $('#audit-modal').classList.remove('hidden');
  }catch(err){ alert(err.message); }
});
$('#audit-close').addEventListener('click',()=>$('#audit-modal').classList.add('hidden'));

/* ---------------- misc ---------------- */
function clock(){const t=()=>{$('#clock').textContent=new Date().toISOString().slice(11,19)+'Z';};t();setInterval(t,1000);}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

/* boot */
particles();
const saved=localStorage.getItem('raven_user');
if(saved&&localStorage.getItem('raven_token')){ try{enterApp(JSON.parse(saved));}catch{} }
