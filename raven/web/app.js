'use strict';
const $ = (s) => document.querySelector(s);
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
  carrier:'#FFB020', region:'#A3E635', registrant_org:'#2DD4BF'
};

/* ---------------- particles on login ---------------- */
function particles() {
  const c = $('#particles'); if (!c) return;
  const ctx = c.getContext('2d');
  const resize = () => { c.width = innerWidth; c.height = innerHeight; };
  resize(); addEventListener('resize', resize);
  const pts = Array.from({ length: 110 }, () => ({
    x: Math.random()*c.width, y: Math.random()*c.height,
    vx:(Math.random()-.5)*.3, vy:(Math.random()-.5)*.3 }));
  (function loop(){
    if ($('#login').classList.contains('hidden')) return;
    ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle='rgba(255,106,0,.5)';
    for(const p of pts){p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>c.width)p.vx*=-1;if(p.y<0||p.y>c.height)p.vy*=-1;
      ctx.fillRect(p.x,p.y,1.4,1.4);}
    requestAnimationFrame(loop);
  })();
}

/* ---------------- auth ---------------- */
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const d = await api('/api/login', { method:'POST',
      body: JSON.stringify({ username:f.get('username'), password:f.get('password') }) });
    localStorage.setItem('raven_token', d.token);
    localStorage.setItem('raven_user', JSON.stringify(d));
    enterApp(d);
  } catch (err) { $('#login-error').textContent = err.message; }
});

$('#logout').addEventListener('click', () => {
  localStorage.removeItem('raven_token'); localStorage.removeItem('raven_user');
  location.reload();
});

function enterApp(user) {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#who').textContent = `${user.display_name} · ${user.role.toUpperCase()}`;
  if (user.role === 'admin') $('#audit-btn').classList.remove('hidden');
  if (user.quota != null) $('#quota').textContent = `Tier quota: ${user.quota} scans/day`;
  clock();
}

/* ---------------- scan ---------------- */
$('#scan-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#scan-error').textContent = '';
  const f = new FormData(e.target);
  const body = {};
  for (const k of ['case_id','legal_basis','phone','email','username','domain','region'])
    if (f.get(k)) body[k] = f.get(k).trim();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = '◌ COLLECTING…';
  try {
    const d = await api('/api/scan', { method:'POST', body: JSON.stringify(body) });
    render(d);
  } catch (err) { $('#scan-error').textContent = err.message; }
  finally { btn.disabled = false; btn.textContent = '▷ RUN COLLECTION'; }
});

function render(d) {
  $('#empty').classList.add('hidden');
  $('#output').classList.remove('hidden');
  if (d.quota_remaining != null) $('#quota').textContent = `Scans remaining today: ${d.quota_remaining}`;
  $('#summary').innerHTML = `
    <div><b>${d.summary.identifiers.length}</b><span>IDENTIFIERS</span></div>
    <div><b>${d.summary.findings}</b><span>FINDINGS</span></div>
    <div><b>${d.summary.links}</b><span>LINKS</span></div>`;
  $('#cards').innerHTML = d.targets.map(card).join('');
  drawGraph(d.graph);
}

function card(t) {
  const findings = t.findings.map(f => {
    let v = Array.isArray(f.value) ? f.value.join(', ') : f.value;
    return `<div class="finding">
      <div class="finding-top"><span class="fkey">${esc(f.key)}</span>
        <span class="fval">${esc(String(v))}</span></div>
      <div class="fmeta"><span class="conf"><span style="width:${f.confidence}%"></span></span>
        conf ${f.confidence} · <span class="src">${esc(f.source)}</span></div>
      ${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}
    </div>`;
  }).join('');
  const errs = (t.errors||[]).map(e=>`<div class="terr">! ${esc(e)}</div>`).join('');
  return `<div class="tcard">
    <div class="tcard-head"><span class="tcard-kind">${esc(t.kind)}</span>
      <span class="tcard-val">${esc(t.value)}</span></div>
    ${findings || '<div class="finding"><span class="note">no findings</span></div>'}
    ${errs}</div>`;
}

/* ---------------- link graph (canvas force layout) ---------------- */
function drawGraph(g) {
  const c = $('#graph'); const ctx = c.getContext('2d');
  const W = c.width = c.clientWidth, H = c.height = c.clientHeight;
  const nodes = g.nodes.map(n => ({ ...n,
    x: W/2 + (Math.random()-.5)*W*0.6, y: H/2 + (Math.random()-.5)*H*0.6, vx:0, vy:0 }));
  const idx = Object.fromEntries(nodes.map((n,i)=>[n.id,i]));
  const edges = g.edges.filter(e => idx[e.source]!=null && idx[e.target]!=null);

  const kinds = [...new Set(nodes.map(n=>n.kind))];
  $('#graph-legend').innerHTML = kinds.map(k =>
    `<span><i style="background:${KIND_COLOR[k]||'#FF6A00'}"></i>${k}</span>`).join('') ||
    '<span>no entities</span>';

  let frames = 0;
  (function sim(){
    frames++;
    for (let i=0;i<nodes.length;i++){
      for (let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j];let dx=a.x-b.x,dy=a.y-b.y;
        let d=Math.hypot(dx,dy)||.01;const rep=2400/(d*d);
        dx/=d;dy/=d;a.vx+=dx*rep;a.vy+=dy*rep;b.vx-=dx*rep;b.vy-=dy*rep;
      }
    }
    for (const e of edges){
      const a=nodes[idx[e.source]],b=nodes[idx[e.target]];
      let dx=b.x-a.x,dy=b.y-a.y;let d=Math.hypot(dx,dy)||.01;
      const f=(d-90)*.01;dx/=d;dy/=d;a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;
    }
    for (const n of nodes){
      n.vx+=(W/2-n.x)*.001;n.vy+=(H/2-n.y)*.001;
      n.x+=Math.max(-6,Math.min(6,n.vx*=.85));n.y+=Math.max(-6,Math.min(6,n.vy*=.85));
      n.x=Math.max(16,Math.min(W-16,n.x));n.y=Math.max(16,Math.min(H-16,n.y));
    }
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,106,0,.25)';ctx.lineWidth=1;
    ctx.font='10px JetBrains Mono, monospace';
    for (const e of edges){
      const a=nodes[idx[e.source]],b=nodes[idx[e.target]];
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    for (const n of nodes){
      const col=KIND_COLOR[n.kind]||'#FF6A00';
      ctx.beginPath();ctx.arc(n.x,n.y,6,0,7);ctx.fillStyle=col;ctx.fill();
      ctx.fillStyle='rgba(245,245,245,.85)';
      const lab=n.label.length>20?n.label.slice(0,19)+'…':n.label;
      ctx.fillText(lab,n.x+9,n.y+3);
    }
    if (frames<260) requestAnimationFrame(sim);
  })();
}

/* ---------------- audit ---------------- */
$('#audit-btn').addEventListener('click', async () => {
  try {
    const d = await api('/api/audit');
    $('#chain-state').innerHTML = d.chain_intact
      ? '<span style="color:var(--success)">● chain intact</span>'
      : '<span style="color:var(--danger)">● CHAIN BROKEN</span>';
    $('#audit-body').innerHTML = d.entries.map(r => `<div class="audit-row">
      <b>${esc(r.ts)}</b> · ${esc(r.actor)} · <b>${esc(r.action)}</b> · case ${esc(r.case_id)}
      · basis: ${esc(r.legal_basis)}<br/>inputs: ${esc(JSON.stringify(r.inputs))}
      · ${esc(JSON.stringify(r.summary))}</div>`).join('') || 'no entries';
    $('#audit-modal').classList.remove('hidden');
  } catch (err) { alert(err.message); }
});
$('#audit-close').addEventListener('click', () => $('#audit-modal').classList.add('hidden'));

/* ---------------- misc ---------------- */
function clock(){
  const t = () => { const n=new Date();
    $('#clock').textContent = n.toISOString().slice(11,19)+'Z'; };
  t(); setInterval(t,1000);
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

/* boot */
particles();
const saved = localStorage.getItem('raven_user');
if (saved && localStorage.getItem('raven_token')) {
  try { enterApp(JSON.parse(saved)); } catch { /* show login */ }
}
