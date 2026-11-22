(function(){
"use strict";
const DIMS = {
  compute:{label:'Cloud & data centers'}, chips:{label:'Accelerators'}, memory:{label:'Memory (HBM)'},
  fab:{label:'Fabs & packaging'}, tools:{label:'Lithography & tools'}, materials:{label:'Materials'}, energy:{label:'Power & fuel'}, data:{label:'Training data'}
};
const DIM_ORDER = ['compute','chips','memory','fab','tools','materials','energy','data'];
const KIND = {lab:['lab','AI lab'],cloud:['compute','Cloud provider'],dc:['compute','Data center'],chip:['chips','Accelerator designer'],
  mem:['memory','Memory maker'],fab:['fab','Fab / packaging'],tool:['tools','Lithography & tools'],mat:['materials','Materials'],power:['energy','Power plant'],gen:['energy','Power equipment'],fuel:['energy','Nuclear fuel'],data:['data','Training data']};
const CONF = {c:'Confirmed',r:'Reported',i:'Inferred'};
const FUEL_COLORS = ['#2f8fe0','#a94be0','#e8922a','#6f7780','#8a5a3c','#f0c12c','#3fb495','#d4553a','#9aa7b0'];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width:760px)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const dimColor = d => d === 'lab' ? css('--lab') : css('--' + d);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- graph ----------
const byId = {}; NODES.forEach(n => byId[n.id] = n);
const OUT = {}, IN = {};
NODES.forEach(n => { OUT[n.id] = []; IN[n.id] = []; });
EDGES.forEach(([f,t,d,c,note,src]) => { const e={f,t,d,c,note,src:src||[]}; OUT[f].push(e); IN[t].push(e); });
// longest chain from each node (graph is a DAG apart from rare loops, guarded by the stack)
const LONG = {};
function longest(x, stack){
  if(LONG[x]) return LONG[x];
  let best=[x];
  stack.add(x);
  OUT[x].forEach(e=>{ if(stack.has(e.t)) return; const p=longest(e.t, stack); if(p.length+1>best.length) best=[x].concat(p); });
  stack.delete(x);
  LONG[x]=best; return best;
}
NODES.forEach(n=>longest(n.id,new Set()));
function srcLinks(ids){
  if(!ids||!ids.length) return '';
  return '<span class="srcs">'+ids.map(s=>SRC[s]?'<a href="'+esc(SRC[s].u)+'" target="_blank" rel="noopener noreferrer">'+esc(SRC[s].t)+' ↗</a>':'').join('')+'</span>';
}
const reach = {}; NODES.forEach(n => reach[n.id] = new Set());
LABS.forEach(lab => {
  const seen = new Set([lab]), q=[lab];
  while(q.length){ const x=q.shift(); reach[x].add(lab); OUT[x].forEach(e => { if(!seen.has(e.t)){ seen.add(e.t); q.push(e.t);} }); }
});

// ---------- tours (data/tours.js) ----------
const EDGE = {}; EDGES.forEach(([f,t,d,c,note,src]) => { EDGE[f+'>'+t] = {f,t,d,c,note,src:src||[]}; });
const fillT = s => String(s||'').replace(/\{\{labs\}\}/g, LABS.length).replace(/\{\{reach:([^}]+)\}\}/g, (m,id) => reach[id] ? reach[id].size : '');
const pathEdges = p => p.slice(1).map((id,j) => EDGE[p[j]+'>'+id]).filter(Boolean);
// a tour whose stops or links no longer exist in the graph is skipped rather than shown broken
const tourOK = t => t && Array.isArray(t.stops) && t.stops.length>=3 && t.stops.every(s => byId[s.at] && Array.isArray(s.path) && s.path.length && s.path.every((id,j) => byId[id] && (!j || EDGE[s.path[j-1]+'>'+id])));
const WRITTEN = (typeof TOURS!=='undefined' && Array.isArray(TOURS) ? TOURS : []).filter(tourOK);
function getTour(id){ return id ? WRITTEN.find(t => t.id===id) || null : null; }
let lastTour = null; try{ lastTour = localStorage.getItem('sl-last-tour'); }catch(e){}
function pickTour(){
  const pool = WRITTEN.map(t => t.id).filter(id => id!==lastTour);
  return pool.length ? pool[Math.floor(Math.random()*pool.length)] : null;
}

// ---------- geometry ----------
function unwrap(lon, ref){ return lon + 360*Math.round((ref-lon)/360); }
function gc(a, b, n){
  n = n || 64; const R=Math.PI/180;
  const v=(p)=>[Math.cos(p[1]*R)*Math.cos(p[0]*R),Math.cos(p[1]*R)*Math.sin(p[0]*R),Math.sin(p[1]*R)];
  const A=v(a),B=v(b); const dot=Math.min(1,Math.max(-1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2])); const d=Math.acos(dot);
  if(d<1e-6) return [a,b];
  const pts=[]; let prev=a[0];
  for(let i=0;i<=n;i++){ const t=i/n, s1=Math.sin((1-t)*d)/Math.sin(d), s2=Math.sin(t*d)/Math.sin(d);
    const x=s1*A[0]+s2*B[0], y=s1*A[1]+s2*B[1], z=s1*A[2]+s2*B[2];
    let lon=Math.atan2(y,x)/R; const lat=Math.atan2(z,Math.sqrt(x*x+y*y))/R;
    lon=unwrap(lon,prev); prev=lon; pts.push([lon,lat]); }
  return pts;
}

// ---------- state ----------
let trail = [];          // node ids
let dimFilter = null;
let map = null, lib = null, mapReady = false;
let markers = [];
let plantsOn = true;
let activeFuels = new Set(PLANTS.fuels.map((_,i)=>i));
let globe = false;
let tour = null;          // {t: tour, i}: i = -1 title card, 0..N-1 stops, N closing card
let playing = false;      // documentary autoplay
let capTimer = null, capSeq = 0;

const panel = document.getElementById('panel');
const head = document.getElementById('head');
const body = document.getElementById('body');

// ---------- navigation ----------
function current(){ return trail.length ? trail[trail.length-1] : null; }
function go(id){ if(tour){ leaveTour(); trail=[]; } if(current()!==id){ const i=trail.indexOf(id); if(i>=0) trail=trail.slice(0,i+1); else trail.push(id);} dimFilter=null; expand(); render(true); }
function jump(i){ trail=trail.slice(0,i+1); dimFilter=null; render(true); }
function home(){ trail=[]; dimFilter=null; render(true); }
function setDim(d){ dimFilter = dimFilter===d ? null : d; render(true); }
function leaveTour(){ clearTimeout(capTimer); capSeq++; playing=false; tour=null; }
function startTour(id){
  const t = getTour(id || pickTour()); if(!t) return;
  clearTimeout(capTimer); tour = {t, i:-1}; trail=[]; dimFilter=null; lastTour = t.id; playing = !reduceMotion;
  try{ localStorage.setItem('sl-last-tour', t.id); }catch(e){}
  render(true);
}
function tourTo(i){ if(!tour) return; const N=tour.t.stops.length; i=Math.max(-1, Math.min(N, i)); if(i===tour.i) return; tour.i=i; if(i>=N) playing=false; render(true); }
function exitTour(explore){
  const t = tour; leaveTour(); dimFilter=null;
  if(explore && t && t.i>=0){ const s=t.t.stops[Math.min(t.i, t.t.stops.length-1)], k=s.path.indexOf(s.at);
    trail = byId[s.path[0]].k==='lab' && k>=0 ? s.path.slice(0, k+1) : [s.at]; }
  else trail=[];
  render(true);
}
function toggleAuto(){
  if(!tour) return;
  playing = !playing;
  if(tour.i>=tour.t.stops.length && playing){ tourTo(-1); return; }
  clearTimeout(capTimer); refreshCtl(); if(playing) schedule();
}
window.__nav = {go, jump, home, setDim, startTour, tourTo, exitTour};

// ---------- mobile bottom sheet: collapsed / half / full, draggable ----------
const handleEl=document.getElementById('handle');
let sheet='half';
function setSheet(s, refit){
  sheet=s;
  panel.classList.toggle('full', s==='full');
  panel.classList.toggle('collapsed', s==='collapsed');
  document.body.classList.toggle('sheet-full', s==='full');
  panel.style.height='';
  handleEl.setAttribute('aria-label', s==='full' ? 'Shrink panel' : 'Expand panel');
  if(refit!==false && s!=='full') setTimeout(()=>fitView(), 320);
}
function expand(){ if(sheet==='collapsed') setSheet('half', false); }
(function(){
  let drag=null;
  const H=()=>window.innerHeight;
  const sizes=()=>{ const head=panel.querySelector('.panel-head').getBoundingClientRect().height+22; return {collapsed:head, half:Math.round(H()*0.48), full:H()-8}; };
  function start(e){
    if(!isMobile() || e.button>0) return;
    const t=e.target;
    if(!(t===handleEl || (t.closest('.brand') && !t.closest('button,a,input')))) return;
    drag={y:e.clientY, t:performance.now(), h:panel.getBoundingClientRect().height, moved:false, id:e.pointerId};
    try{ t.setPointerCapture(e.pointerId); }catch(_){}
  }
  function move(e){
    if(!drag || e.pointerId!==drag.id) return;
    const dy=e.clientY-drag.y;
    if(!drag.moved){ if(Math.abs(dy)<6) return; drag.moved=true; panel.classList.add('dragging'); panel.classList.remove('collapsed'); document.body.classList.remove('sheet-full'); }
    const s=sizes();
    panel.style.height=Math.max(s.collapsed, Math.min(s.full, drag.h-dy))+'px';
    e.preventDefault();
  }
  function end(e){
    if(!drag || e.pointerId!==drag.id) return;
    const d=drag; drag=null; panel.classList.remove('dragging');
    if(!d.moved){ // tap: step the sheet up, or back down from full
      if(e.target===handleEl) setSheet(sheet==='half' ? 'full' : 'half');
      return;
    }
    const s=sizes(), h=panel.getBoundingClientRect().height, v=(e.clientY-d.y)/Math.max(1,performance.now()-d.t);
    const order=['collapsed','half','full'];
    let target;
    if(v<-0.5) target=order[Math.min(2,order.indexOf(sheet)+1)];
    else if(v>0.5) target=order[Math.max(0,order.indexOf(sheet)-1)];
    else target=order.reduce((b,k)=>Math.abs(s[k]-h)<Math.abs(s[b]-h)?k:b,'half');
    // let the height animate from where the finger left it to the snap point
    panel.style.height=h+'px'; void panel.offsetHeight;
    sheet=target;
    panel.style.height=(target==='collapsed' ? s.collapsed : s[target])+'px';
    setTimeout(()=>setSheet(target), 280);
  }
  panel.addEventListener('pointerdown',start);
  panel.addEventListener('pointermove',move,{passive:false});
  panel.addEventListener('pointerup',end);
  panel.addEventListener('pointercancel',end);
  handleEl.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setSheet(sheet==='full'?'half':'full'); } });
  window.addEventListener('resize',()=>{ if(!isMobile() && sheet!=='half') setSheet('half', false); });
})();

// ---------- panel rendering ----------
function labDots(id){
  const r = reach[id];
  return '<span class="dots" aria-hidden="true">'+LABS.map(l=>'<span class="'+(r.has(l)?'on':'')+'" title="'+esc(byId[l].n)+'"></span>').join('')+'</span>';
}
function kindColor(n){ return dimColor(KIND[n.k][0]); }

function renderHead(){
  let h = '<div class="brand"><b>Supply Lines <span>· AI labs, traced</span></b>'+
    (trail.length?'<span><button class="iconbtn" data-share>Share</button><button class="iconbtn" data-home>Start over</button></span>':'<span><button class="iconbtn" data-about>About</button><a class="iconbtn" href="'+esc(feedbackURL(null))+'" target="_blank" rel="noopener noreferrer">Feedback</a></span>')+'</div>';
  if(trail.length){
    h += '<nav class="trail" aria-label="Journey">';
    trail.forEach((id,i)=>{ const n=byId[id];
      if(i) h+='<span class="sep" aria-hidden="true">›</span>';
      h+='<button class="step'+(i===trail.length-1?' cur':'')+'" data-jump="'+i+'" '+(i===trail.length-1?'aria-current="step"':'')+'><i style="background:'+kindColor(n)+'">'+(i+1)+'</i>'+esc(n.n)+'</button>'; });
    h += '</nav>';
  }
  head.innerHTML = h;
  const tr = head.querySelector('.trail'); if(tr) tr.scrollLeft = tr.scrollWidth;
}

function renderHome(){
  const us=['anthropic','openai','deepmind','xai','meta'], cn=['deepseek','qwen','moonshot','zhipu','bytedance','minimax'];
  const lb = ids => '<div class="labs">'+ids.map(id=>'<button class="labbtn" data-go="'+id+'"><b>'+esc(byId[id].n)+'</b><span>'+esc(byId[id].p)+'</span><span class="deep">Deepest chain: '+(LONG[id].length-1)+' steps</span></button>').join('')+'</div>';
  const choke = NODES.filter(n=>n.k!=='lab').map(n=>[n,reach[n.id].size]).sort((a,b)=>b[1]-a[1]||a[0].n.localeCompare(b[0].n)).slice(0,8);
  body.innerHTML =
    '<h1>Where frontier AI comes from</h1>'+
    '<p class="lede">Pick a lab or search above, then follow its supply lines out across the map: compute, chips, memory, fabs, lithography, materials, power and data. Every stop opens its own suppliers, down to the power plants and uranium mines.</p>'+
    '<div class="tourcta"><button class="tourbtn" data-tour="">▶ Start a tour</button><span>A short, sourced story from the map. A different one each time.</span></div>'+
    (WRITTEN.length ? '<div class="chips tourpick" aria-label="Choose a tour">'+WRITTEN.map(t=>'<button class="chip" data-tour="'+esc(t.id)+'">'+esc(fillT(t.title))+'</button>').join('')+'</div>' : '')+
    '<h2>United States & UK</h2>'+lb(us)+
    '<h2>China</h2>'+lb(cn)+
    '<h2>Chokepoints every lab runs through</h2>'+
    '<div class="rows">'+choke.map(([n,c])=>'<button class="row" data-go="'+n.id+'" style="--c:'+kindColor(n)+'"><span class="bar"></span><span class="rn">'+esc(n.n)+'</span><span class="conf" style="border:0;padding:0;font-weight:500;color:var(--muted)">'+c+' of '+LABS.length+'</span><span class="rp">'+esc(n.p)+' · '+labDots(n.id)+'</span></button>').join('')+'</div>'+
    '<div class="fine"><h2 style="margin-top:4px">How to read the links</h2>'+
    '<div class="legend-conf"><span class="conf c">Confirmed</span><span class="conf r">Reported</span><span class="conf i">Inferred</span></div>'+
    '<p style="margin-top:10px">Every link carries its source. Confirmed links come from company announcements; reported links from press reporting; inferred links are reasoned from the evidence cited and are drawn dashed on the map.</p>'+
    '<p>Power links from data centers, fabs and memory plants to nearby plants are inferred from proximity: the largest plants within 120 km on WRI’s Global Power Plant Database. They show what the local grid looks like, not a signed contract, unless marked confirmed.</p>'+
    '<p>Pins marked “location approximate” stand in for sites that aren’t public. Deals current as of mid-November 2026.</p></div>'+aboutHTML();
}
function aboutHTML(){
  return '<section class="about" id="about" aria-labelledby="about-h"><h2 id="about-h">About</h2>'+
    '<p>Supply Lines traces where frontier AI comes from: the clouds, chips, memory, fabs, lithography, materials, power and data behind each major lab, with a source on every link. The data is refreshed weekly from public reporting.</p>'+
    '<p>Stock listings are shown for reference, linking to Google Finance. They aren’t investment advice.</p>'+
    '<p class="byline">Made by Arun at intuslabs · <a href="mailto:arun@intuslabs.com">arun@intuslabs.com</a></p>'+
    '<p><a class="fbbtn" href="'+esc(feedbackURL(null))+'" target="_blank" rel="noopener noreferrer">Send feedback</a><span class="fbnote">Opens a GitHub issue. Corrections with a source link are especially welcome.</span></p>'+
    '<p class="credits">Basemap from Natural Earth; power plants from WRI’s Global Power Plant Database; map by MapLibre.</p></section>';
}

const EXCH={NASDAQ:'Nasdaq',NYSE:'NYSE',HKG:'Hong Kong',TPE:'Taiwan',KRX:'Korea',TYO:'Tokyo',SHA:'Shanghai',AMS:'Amsterdam',CPH:'Copenhagen',LON:'London',OSL:'Oslo'};
const REL={own:'',parent:'Owned by ',operator:'Operated by ',part:'Part-owned by '};
const TK=(typeof TICKERS==='object'&&TICKERS)||{};
function tickerHTML(id){
  const t=TK[id]; if(!t) return '';
  const who=(REL[t.rel]||'')+(t.rel==='own'?'':t.co);
  if(t.st==='proposed'){
    return '<div class="tick"><span class="tk-lbl">Stock</span><span class="tk-sym pending">'+esc(t.l[0][0])+'</span><span class="tk-x">'+esc(EXCH[t.l[0][1]]||t.l[0][1])+' · not yet trading</span>'+
      (t.note?'<span class="tk-note">'+esc(t.note)+(t.src?' · <a href="'+esc(t.src)+'" target="_blank" rel="noopener noreferrer">source ↗</a>':'')+'</span>':'')+'</div>';
  }
  return '<div class="tick"><span class="tk-lbl">Stock</span>'+t.l.map(([s,x])=>
      '<a class="tk-sym" href="https://www.google.com/finance/quote/'+encodeURIComponent(s)+':'+x+'" target="_blank" rel="noopener noreferrer" title="Look up '+esc(s)+' on Google Finance">'+esc(s)+' <span>'+esc(EXCH[x]||x)+'</span> ↗</a>').join('')+
    (who?'<span class="tk-note">'+esc(who)+'</span>':'')+'</div>';
}
function feedbackURL(id){
  const n=id&&byId[id];
  const title = n ? 'Feedback: '+n.n : 'Feedback';
  const body = '**Page:** '+location.href+'\n'+(n?'**Stop:** '+n.n+' (`'+n.id+'`)\n':'')+'\n**What’s wrong, missing or confusing?**\n\n\n**A source link, if you have one:**\n';
  return 'https://github.com/mathewar/Where-is-ai/issues/new?title='+encodeURIComponent(title)+'&body='+encodeURIComponent(body);
}

function renderNode(id){
  const n = byId[id]; const kc = kindColor(n);
  const out = OUT[id];
  const counts = {}; out.forEach(e=>counts[e.d]=(counts[e.d]||0)+1);
  const shown = out.filter(e=>!dimFilter||e.d===dimFilter)
    .sort((a,b)=>DIM_ORDER.indexOf(a.d)-DIM_ORDER.indexOf(b.d) || 'cri'.indexOf(a.c)-'cri'.indexOf(b.c));
  const r = reach[id];
  let h = '<div class="kind" style="--c:'+kc+'">'+esc(KIND[n.k][1])+'</div>'+
    '<div class="title">'+esc(n.n)+'</div>'+
    '<div class="place">'+esc(n.p)+(n.a?'<span class="approx">location approximate</span>':'')+'</div>'+
    '<p class="desc">'+esc(n.d)+'</p>'+tickerHTML(id);
  const chain=LONG[id];
  if(chain.length>2) h += '<button class="chainbtn" data-chain="'+id+'">Follow the deepest chain from here <em>'+(chain.length-1)+' steps</em></button>';
  if(n.k!=='lab') h += '<div class="shared">'+labDots(id)+'<span>'+(r.size? 'In the supply chain of '+r.size+' of '+LABS.length+' labs' : 'Not reached by any lab in this dataset')+'</span></div>';
  if(out.length){
    h += '<h2>Supply lines from here</h2><div class="spokes" role="group" aria-label="Filter by dimension">'+
      '<button class="spoke" data-dim="" aria-pressed="'+(!dimFilter)+'" style="--c:var(--ink)">All <em>'+out.length+'</em></button>'+
      DIM_ORDER.filter(d=>counts[d]).map(d=>'<button class="spoke" data-dim="'+d+'" aria-pressed="'+(dimFilter===d)+'" style="--c:'+dimColor(d)+'"><span class="sw"></span>'+DIMS[d].label+' <em>'+counts[d]+'</em></button>').join('')+
      '</div><div class="rows">'+
      shown.map(e=>{ const t=byId[e.t]; return '<div class="row" style="--c:'+dimColor(e.d)+'"><span class="bar"></span><button class="rmain" data-go="'+t.id+'"><span class="rn">'+esc(t.n)+'</span><span class="rp">'+esc(t.p)+(t.a?' (approx.)':'')+'</span>'+(e.note?'<span class="note">'+esc(e.note)+'</span>':'')+'</button><span class="conf '+e.c+'">'+CONF[e.c]+'</span>'+srcLinks(e.src)+'</div>'; }).join('')+
      '</div>';
  } else {
    h += '<div class="end">End of the line in this dataset. Try another branch from the journey above, or jump to something that depends on it below.</div>';
  }
  const inc = IN[id].filter(e=>e.f!==trail[trail.length-2]);
  if(inc.length){
    h += '<h2>Also supplies</h2><div class="chips">'+[...new Map(inc.map(e=>[e.f,e])).values()].map(e=>'<button class="chip" data-go="'+e.f+'">'+esc(byId[e.f].n)+'</button>').join('')+'</div>';
  }
  h += '<p class="fb">Something wrong or missing here? <a href="'+esc(feedbackURL(id))+'" target="_blank" rel="noopener noreferrer">Send feedback ↗</a></p>';
  body.innerHTML = h;
}

// ---------- tour: documentary captions over the map ----------
const appEl = document.getElementById('app');
const cap = document.createElement('div'); cap.id='cap'; cap.className='cap'; appEl.appendChild(cap);
// Viewer-attention model (same constants as scripts/attention-sim.js, which tunes them). A stop is held for
// as long as the viewer needs to re-orient, find the focus, take in its links and read the caption.
const ATTN = { wps:3.3, strap:0.4, orient0:0.4, orientZ:0.35, offscreen:0.5, find0:0.25, findK:0.035,
  link:0.6, shortLink:0.5, offLink:0.3, src:0.3, beat:0.8, minHold:4.5, cardBeat:1.2 };
window.__tourModel = ATTN;
const words = s => String(s).trim().split(/\s+/).length;
let curHold = 6000, prevView = null;
window.__tourHoldMs = () => curHold;
function safeBox(){ const p=padding(); return [[p.left, p.top],[innerWidth-p.right, innerHeight-p.bottom]]; }
function attentionNeed(){
  const t=tour.t, i=tour.i, N=t.stops.length;
  if(i<0) return ATTN.strap + words(fillT(t.title+' '+t.lede))/ATTN.wps + ATTN.cardBeat;
  if(i>=N) return ATTN.strap + words(fillT(t.close))/ATTN.wps + ATTN.cardBeat;
  const s=t.stops[i], R=ATTN.strap + words(fillT(s.text))/ATTN.wps;
  if(!mapReady) return R + 1.5;
  const [[l,tp],[r,b]] = safeBox(), inSafe = p => p.x>=l && p.x<=r && p.y>=tp && p.y<=b;
  const w = window.__clutterWeights || {plants:1,nodes:1};
  const plants = map.queryRenderedFeatures([[l,tp],[r,b]],{layers:['plants']}).length;
  const pins = new Set(map.queryRenderedFeatures([[l,tp],[r,b]],{layers:['nodes']}).map(f=>f.properties.id)).size;
  const labels = document.querySelectorAll('.mk .l:not(.hide)').length;
  const clutter = plants*w.plants + 3*pins*w.nodes + 4*labels;
  const dz = prevView ? Math.abs(map.getZoom()-prevView.z) : 0;
  const c = byId[s.at].c, pb = prevView && prevView.b;
  const off = pb ? !(c[0]>=pb[0][0] && c[0]<=pb[1][0] && c[1]>=pb[0][1] && c[1]<=pb[1][1]) : false;
  const O = ATTN.orient0 + ATTN.orientZ*dz + (off?ATTN.offscreen:0);
  const F = ATTN.find0 + ATTN.findK*Math.sqrt(clutter);
  const L = pathEdges(s.path).reduce((sum,e)=>{ const a=map.project(byId[e.f].c), bb=map.project(byId[e.t].c);
    return sum + ATTN.link + (Math.hypot(a.x-bb.x,a.y-bb.y)<40?ATTN.shortLink:0) + (!inSafe(a)||!inSafe(bb)?ATTN.offLink:0); }, 0);
  return O + F + L + R + ATTN.src;
}
function capHTML(){
  const t=tour.t, i=tour.i, N=t.stops.length;
  let h = '<button class="cap-x" data-tourexit aria-label="Close tour">✕</button><div class="cap-in">';
  if(i<0){
    h += '<div class="cap-card"><div class="cap-kicker">'+esc(t.kicker||'Tour')+'</div><h2 class="cap-h">'+esc(fillT(t.title))+'</h2><p class="cap-lede">'+esc(fillT(t.lede))+'</p></div>';
  } else if(i>=N){
    h += '<div class="cap-card"><div class="cap-kicker">'+esc(t.kicker||'Tour')+'</div><p class="cap-close">'+esc(fillT(t.close))+'</p>'+
      '<div class="cap-endb"><button class="cap-btn primary" data-tour="">Another tour</button><button class="cap-btn" data-tourexit="explore">Explore the map</button><button class="cap-btn" data-tourauto>Watch again</button></div></div>';
  } else {
    const s=t.stops[i], n=byId[s.at], es=pathEdges(s.path);
    h += '<div class="cap-low"><div class="cap-strap" style="--c:'+kindColor(n)+'"><b>'+esc(n.n)+'</b><span>'+esc(n.p)+(n.a?' · location approximate':'')+'</span></div>'+
      '<p class="cap-text">'+esc(fillT(s.text))+'</p>'+
      (es.length ? '<div class="cap-src">'+es.map(e=>'<span class="cap-conf '+e.c+'">'+CONF[e.c]+'</span>'+(SRC[e.src[0]] ? '<a href="'+esc(SRC[e.src[0]].u)+'" target="_blank" rel="noopener noreferrer">'+esc(SRC[e.src[0]].t)+' ↗</a>' : '')+(e.src.length>1?'<span class="cap-more">+'+(e.src.length-1)+'</span>':'')).join('<span class="cap-dot">·</span>')+'</div>' : '')+
      '</div>';
  }
  return h + ctlHTML() + '</div>';
}
function ctlHTML(){
  const t=tour.t, i=tour.i, N=t.stops.length;
  return '<div class="cap-ctl"><div class="cap-bar" role="group" aria-label="Tour stops">'+t.stops.map((s,k)=>'<button class="'+(k<i?'done':(k===i?'cur':''))+'" data-tourgo="'+k+'" aria-label="Stop '+(k+1)+': '+esc(byId[s.at].n)+'"><b></b></button>').join('')+'</div>'+
    '<div class="cap-btns"><button class="cap-ic" data-tourstep="-1" aria-label="Previous"'+(i<0?' disabled':'')+'>‹</button>'+
    '<button class="cap-ic play" data-tourauto aria-label="'+(playing?'Pause':'Play')+'">'+(playing?'❚❚':'▶')+'</button>'+
    '<button class="cap-ic" data-tourstep="1" aria-label="Next"'+(i>=N?' disabled':'')+'>›</button>'+
    '<span class="cap-count">'+esc(fillT(t.title))+(i>=0&&i<N?' · '+(i+1)+' of '+N:'')+'</span>'+
    '<button class="cap-link" data-share>Share</button>'+(i>=0&&i<N?'<button class="cap-link" data-tourexit="explore">Explore from here</button>':'')+'</div></div>';
}
function refreshCtl(){ const c=cap.querySelector('.cap-ctl'); if(c){ c.outerHTML=ctlHTML(); } if(playing) runBar(); }
function runBar(){
  const b=cap.querySelector('.cap-bar .cur b'); if(!b || !tour) return;
  b.style.transition='none'; b.style.width='0%'; void b.offsetWidth;
  b.style.transition='width '+curHold+'ms linear'; b.style.width='100%';
}
function schedule(){
  clearTimeout(capTimer); if(!playing || !tour) return;
  const i=tour.i, N=tour.t.stops.length; if(i>=N){ playing=false; refreshCtl(); return; }
  runBar(); capTimer=setTimeout(()=>tourTo(i+1), curHold);
}
const PLANT_OP = ['interpolate',['linear'],['zoom'],1,0.35,5,0.7,9,0.85], PLANT_OP_DIM = ['interpolate',['linear'],['zoom'],1,0.1,5,0.2,9,0.26];
function setDimmed(on){
  if(!mapReady) return;
  map.setPaintProperty('plants','circle-opacity', on ? PLANT_OP_DIM : PLANT_OP);
  map.setPaintProperty('nodes','circle-opacity', on ? 0.18 : 0.55);
  window.__clutterWeights = on ? {plants:0.3, nodes:0.33} : {plants:1, nodes:1};
}
// where the camera should go for this stop: as close as the links allow, zoomed in further where the focus
// sits among other pins, but never so close the viewer loses the region, nor a big jump in one go
const KM = (a,b) => { const R=Math.PI/180, x=Math.sin((b[1]-a[1])*R/2)**2+Math.cos(a[1]*R)*Math.cos(b[1]*R)*Math.sin((b[0]-a[0])*R/2)**2; return 12742*Math.asin(Math.sqrt(x)); };
const merc = c => { const lat=Math.max(-85,Math.min(85,c[1]))*Math.PI/180; return [ (c[0]+180)/360*512, (1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*512 ]; };
const unmerc = (x,y) => [x/512*360-180, Math.atan(Math.sinh(Math.PI*(1-2*y/512)))*180/Math.PI];
// camera that fits lon/lat bounds inside the padded area. Done by hand: MapLibre's cameraForBounds/fitBounds add
// their padding on top of the padding a previous flyTo left on the map, which doubled the margins.
function frameBounds(b, pad){
  const a=merc(b[0]), c=merc(b[1]); const dx=Math.abs(c[0]-a[0]), dy=Math.abs(c[1]-a[1]);
  const sw=Math.max(40, innerWidth-pad.left-pad.right), sh=Math.max(40, innerHeight-pad.top-pad.bottom);
  const zoom=Math.log2(Math.min(sw/Math.max(dx,1e-6), sh/Math.max(dy,1e-6)));
  const ll=unmerc((a[0]+c[0])/2, (a[1]+c[1])/2);
  return {center:{lng:ll[0], lat:ll[1]}, zoom};
}
function tourCamera(){
  const t=tour.t, i=tour.i, N=t.stops.length, s=(i>=0 && i<N) ? t.stops[i] : null;
  const ids = s ? s.path : [...new Set(t.stops.flatMap(x=>x.path))];
  const pad = padding(), W = innerWidth, mob = isMobile();
  const ref = byId[s ? s.at : ids[0]].c[0];
  const pts = ids.map(id => [unwrap(byId[id].c[0], ref), byId[id].c[1]]);
  let zFit = Infinity, center = s ? {lng:byId[s.at].c[0], lat:byId[s.at].c[1]} : null;
  if(pts.length>1){
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    const cam=frameBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]], pad);
    zFit=cam.zoom; center=cam.center;
  }
  const lat = center ? (center.lat!==undefined ? center.lat : center[1]) : 20;
  const zCtx = Math.log2(W*40075*Math.cos(lat*Math.PI/180)/(512*(mob?350:700)));   // keep ≥ 700 km (350 on phones) of map in view
  let zSep = 0;
  if(s){ const f=byId[s.at].c, fp=merc(f); let d=Infinity;
    NODES.forEach(n=>{ if(ids.includes(n.id)) return; const km=KM(f,n.c); if(km<2 || km>400) return; const p=merc(n.c); d=Math.min(d, Math.hypot(p[0]-fp[0], p[1]-fp[1])); });
    if(d<Infinity) zSep = Math.log2(36/d); }                                            // pull nearby pins ≥ 36 px apart
  const zComfort = mob ? 3.4 : 4.2;                                                       // a regional view by default
  let z = s ? Math.min(zFit, zCtx, Math.max(zSep, zComfort)) : Math.min(zFit, 4);
  const zPrev = map.getZoom();
  if(z - zPrev > 3.2) z = zPrev + 3.2;                                                     // no plunges
  z = Math.max(0.4, z);
  if(!center){ center = {lng:pts[0][0], lat:pts[0][1]}; }
  const cc = map.getCenter(), km = KM([cc.lng,cc.lat],[center.lng!==undefined?center.lng:center[0], lat]);
  const duration = reduceMotion ? 0 : Math.round(Math.min(2000, Math.max(800, 600 + 330*Math.abs(z-zPrev) + 220*Math.log2(1+km/300))));
  return {center, zoom:z, padding:pad, duration};
}
function setLineOpacity(o, ms){
  if(!mapReady) return;
  ['spider-solid','spider-dash'].forEach(l=>{ map.setPaintProperty(l,'line-opacity-transition',{duration:ms,delay:0}); map.setPaintProperty(l,'line-opacity',o); });
}
// caption fades out as the camera leaves; the next one fades in over the last part of the flight, and the
// stop's links fade in as the camera lands. The hold is set by the attention model once we've landed.
function playStep(move){
  const seq=++capSeq; clearTimeout(capTimer);
  document.body.classList.add('touring'); setDimmed(true);
  const i=tour.i, N=tour.t.stops.length, card = i<0 || i>=N, had = !!cap.innerHTML;
  if(mapReady) prevView = {z:map.getZoom(), b:map.getBounds().toArray()};
  cap.classList.add('out');
  const show=()=>{ if(seq!==capSeq || !tour) return; cap.classList.toggle('is-card', card); cap.innerHTML=capHTML(); void cap.offsetWidth; cap.classList.remove('out'); };
  const land=()=>{ if(seq!==capSeq || !tour) return; setLineOpacity(0.95, 450);
    setTimeout(()=>{ if(seq!==capSeq || !tour) return; curHold = Math.round(1000*Math.max(ATTN.minHold, attentionNeed() + ATTN.beat)); schedule(); }, 250); };
  if(!mapReady){ setTimeout(()=>{ show(); land(); }, 150); return; }
  setLineOpacity(0, 0); drawMap();
  if(!move){ setTimeout(()=>{ show(); land(); }, had ? 260 : 0); return; }
  const cam = tourCamera();
  map.flyTo({center:cam.center, zoom:cam.zoom, padding:cam.padding, duration:cam.duration, essential:true});
  setTimeout(show, Math.max(had ? 260 : 0, cam.duration - 650));   // narration starts as the camera settles
  let done=false; const fin=()=>{ if(done) return; done=true; land(); };
  setTimeout(()=>{ if(map.isMoving()) map.once('moveend', fin); else fin(); }, 30);
  setTimeout(fin, cam.duration + 300);
}

// ---------- shareable URL: #/lab/stop/stop?dim=chips, or #/tour/<id>/<stop> ----------
let fromURL=false;
function stateHash(){ if(tour) return '#/tour/'+encodeURIComponent(tour.t.id)+(tour.i>=0?'/'+(tour.i+1):''); return trail.length ? '#/'+trail.map(encodeURIComponent).join('/')+(dimFilter?'?dim='+dimFilter:'') : ''; }
function writeURL(){
  const h=stateHash();
  document.title = tour ? fillT(tour.t.title)+' · Supply Lines' : trail.length ? byId[current()].n+' · Supply Lines' : 'Supply Lines · where frontier AI comes from';
  if(fromURL || location.hash===h || (!h && !location.hash)) return;
  try{ history.pushState(null,'',h || location.pathname+location.search); }catch(e){}
}
function readURL(){
  const m=(location.hash||'').match(/^#\/([^?]*)(?:\?(.*))?$/);
  const was = tour; clearTimeout(capTimer); tour=null;
  const tm = m && m[1].match(/^tour\/([^/]+)(?:\/(\d+))?$/);
  if(tm){ const t=getTour(decodeURIComponent(tm[1])); if(t){ tour={t, i:tm[2] ? Math.max(0, Math.min(t.stops.length, parseInt(tm[2],10)-1)) : -1}; if(!was) playing=false; trail=[]; dimFilter=null; return; } }
  playing=false;
  trail = m ? m[1].split('/').map(decodeURIComponent).filter(id=>byId[id]) : [];
  const d = m && m[2] ? new URLSearchParams(m[2]).get('dim') : null;
  dimFilter = d && DIMS[d] ? d : null;
}
window.addEventListener('popstate',()=>{ readURL(); fromURL=true; render(true); fromURL=false; });
window.addEventListener('hashchange',()=>{ if(location.hash!==stateHash()){ readURL(); fromURL=true; render(true); fromURL=false; } });
async function share(){
  const url=location.href, title=document.title;
  try{ if(navigator.share){ await navigator.share({title,url}); return; } }catch(e){ if(e&&e.name==='AbortError') return; }
  let ok=false; try{ await navigator.clipboard.writeText(url); ok=true; }catch(e){}
  const b=head.querySelector('[data-share]'); if(b){ b.textContent= ok?'Link copied':'Copy the address bar'; setTimeout(()=>{ if(b.isConnected) b.textContent='Share'; },1800); }
}

function render(move){
  writeURL();
  if(tour){ playStep(move); return; }
  if(document.body.classList.contains('touring')){ document.body.classList.remove('touring'); cap.innerHTML=''; cap.className='cap'; capSeq++; clearTimeout(capTimer); setLineOpacity(0.9, 0); setDimmed(false); }
  renderHead(); const id = current(); if(id) renderNode(id); else renderHome();
  body.scrollTop = 0;
  if(mapReady){ drawMap(); if(move) fitView(); }
}

// ---------- search ----------
const qIn=document.getElementById('q'), qRes=document.getElementById('qres');
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const STATES={AL:'Alabama USA',AK:'Alaska USA',AZ:'Arizona USA',AR:'Arkansas USA',CA:'California USA',CO:'Colorado USA',CT:'Connecticut USA',DE:'Delaware USA',FL:'Florida USA',GA:'Georgia USA',HI:'Hawaii USA',ID:'Idaho USA',IL:'Illinois USA',IN:'Indiana USA',IA:'Iowa USA',KS:'Kansas USA',KY:'Kentucky USA',LA:'Louisiana USA',ME:'Maine USA',MD:'Maryland USA',MA:'Massachusetts USA',MI:'Michigan USA',MN:'Minnesota USA',MS:'Mississippi USA',MO:'Missouri USA',MT:'Montana USA',NE:'Nebraska USA',NV:'Nevada USA',NH:'New Hampshire USA',NJ:'New Jersey USA',NM:'New Mexico USA',NY:'New York USA',NC:'North Carolina USA',ND:'North Dakota USA',OH:'Ohio USA',OK:'Oklahoma USA',OR:'Oregon USA',PA:'Pennsylvania USA',RI:'Rhode Island USA',SC:'South Carolina USA',SD:'South Dakota USA',TN:'Tennessee USA',TX:'Texas USA',UT:'Utah USA',VT:'Vermont USA',VA:'Virginia USA',WA:'Washington USA',WV:'West Virginia USA',WI:'Wisconsin USA',WY:'Wyoming USA',SK:'Saskatchewan Canada'};
const DOCS=NODES.map(n=>{
  const notes=OUT[n.id].concat(IN[n.id]).map(e=>e.note).join(' ');
  const place=n.p.replace(/\b([A-Z]{2})\b/g,(m,c)=>STATES[c]?m+' '+STATES[c]:m);
  const t=TK[n.id];
  return {n, name:norm(n.n), place:norm(place), kind:norm(KIND[n.k][1]+' '+n.k), desc:norm(n.d), notes:norm(notes),
    tick: t ? t.l.map(x=>norm(x[0])) : [], co: t ? norm(t.co) : '', own: !!(t && t.rel==='own')};
});
let qHits=[], qSel=0;
function score(d, terms){
  let s=0;
  for(const t of terms){
    let best=0;
    if(d.tick.includes(t)) best=d.own?98:90;
    else if(d.name===t) best=100;
    else if(d.name.startsWith(t)) best=60;
    else if(new RegExp('\\b'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(d.name)) best=45;
    else if(d.name.includes(t)) best=30;
    else if(d.co.includes(t)) best=26;
    else if(d.place.includes(t)) best=18;
    else if(d.kind.includes(t)) best=14;
    else if(d.desc.includes(t)) best=8;
    else if(d.notes.includes(t)) best=5;
    if(!best) return 0;
    s+=best;
  }
  if(d.n.k==='lab') s+=10;
  if(d.n.id.startsWith('pp_')) s-=4;
  return s + Math.min(reach[d.n.id].size,9)*0.5;
}
function hl(text, terms){
  let out=esc(text);
  terms.forEach(t=>{ if(t.length<2) return; const re=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'); out=out.replace(re,'<mark>$1</mark>'); });
  return out;
}
function runSearch(){
  const raw=qIn.value.trim();
  if(!raw){ qRes.hidden=true; qHits=[]; return; }
  const terms=norm(raw).split(/\s+/).filter(Boolean);
  qHits=DOCS.map(d=>[d,score(d,terms)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,30).map(x=>x[0].n);
  qSel=0;
  qRes.innerHTML = qHits.length ? qHits.map((n,i)=>'<button class="qr" role="option" data-q="'+n.id+'" aria-selected="'+(i===0)+'" style="--c:'+kindColor(n)+'"><i class="sw"></i><b>'+hl(n.n,terms)+'</b><span class="sub">'+esc(KIND[n.k][1])+' · '+hl(n.p,terms)+(TK[n.id]&&TK[n.id].st!=='proposed'?' · '+hl(TK[n.id].l[0][0],terms):'')+'</span></button>').join('')
    : '<div class="qnone">No matches. Try a company, a place (“Texas”, “Taiwan”) or a type (“nuclear”, “HBM”).</div>';
  qRes.hidden=false;
}
function pick(id){ qIn.value=''; qRes.hidden=true; qIn.blur(); if(sheet==='full') setSheet('half', false); go(id); }
function moveSel(d){
  if(!qHits.length) return;
  qSel=(qSel+d+qHits.length)%qHits.length;
  qRes.querySelectorAll('.qr').forEach((b,i)=>b.setAttribute('aria-selected',String(i===qSel)));
  const el=qRes.children[qSel]; if(el) el.scrollIntoView({block:'nearest'});
}
qIn.addEventListener('input',runSearch);
qIn.addEventListener('focus',()=>{ expand(); if(qIn.value.trim()) runSearch(); });
qIn.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){ e.preventDefault(); moveSel(1); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); moveSel(-1); }
  else if(e.key==='Enter'){ e.preventDefault(); if(qHits[qSel]) pick(qHits[qSel].id); }
  else if(e.key==='Escape'){ qIn.value=''; qRes.hidden=true; qIn.blur(); }
});
qRes.addEventListener('mousedown',e=>e.preventDefault());
qRes.addEventListener('click',e=>{ const b=e.target.closest('[data-q]'); if(b) pick(b.dataset.q); });
document.addEventListener('click',e=>{ if(!e.target.closest('.search')) qRes.hidden=true; });
document.addEventListener('keydown',e=>{
  if(!tour || /input|textarea|select/i.test(document.activeElement.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if(e.key==='ArrowRight'){ e.preventDefault(); tourTo(tour.i+1); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); tourTo(tour.i-1); }
  else if(e.key===' ' && !/button|a/i.test(document.activeElement.tagName)){ e.preventDefault(); toggleAuto(); }
  else if(e.key==='Escape'){ e.preventDefault(); exitTour(false); }
});
document.addEventListener('keydown',e=>{ if(e.key==='/' && document.activeElement!==qIn && !/input|textarea/i.test(document.activeElement.tagName)){ e.preventDefault(); qIn.focus(); } });

document.addEventListener('click', ev => {
  if(ev.target.closest('a')) return;
  if(ev.target.closest('[data-share]')){ share(); return; }
  if(ev.target.closest('[data-about]')){ expand(); const el=document.getElementById('about'); if(el) el.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'}); return; }
  const tb = ev.target.closest('[data-tour],[data-tourstep],[data-tourgo],[data-tourexit],[data-tourauto]');
  if(tb){
    if(tb.disabled) return;
    if(tb.hasAttribute('data-tour')) startTour(tb.getAttribute('data-tour')||null);
    else if(tb.hasAttribute('data-tourauto')) toggleAuto();
    else if(tb.hasAttribute('data-tourexit')) exitTour(tb.getAttribute('data-tourexit')==='explore');
    else if(tour){ tourTo(tb.hasAttribute('data-tourstep') ? tour.i + (+tb.getAttribute('data-tourstep')) : +tb.getAttribute('data-tourgo')); }
    return;
  }
  const t = ev.target.closest('[data-go],[data-jump],[data-home],[data-dim],[data-chain]');
  if(!t) return;
  if(t.hasAttribute('data-chain')){ const c=LONG[t.getAttribute('data-chain')]; trail=trail.slice(0,trail.indexOf(c[0])+1||undefined); if(!trail.length||trail[trail.length-1]!==c[0]) trail.push(c[0]); c.slice(1).forEach(x=>trail.push(x)); dimFilter=null; render(true); return; }
  if(t.hasAttribute('data-go')) go(t.getAttribute('data-go'));
  else if(t.hasAttribute('data-jump')) jump(+t.getAttribute('data-jump'));
  else if(t.hasAttribute('data-home')) home();
  else if(t.hasAttribute('data-dim')) setDim(t.getAttribute('data-dim')||null);
});

// ---------- map ----------
function fc(features){ return {type:'FeatureCollection',features}; }
function spiderData(){
  const id=current(); if(!id) return fc([]);
  const a=byId[id].c;
  return fc(OUT[id].filter(e=>!dimFilter||e.d===dimFilter).map(e=>({type:'Feature',properties:{col:dimColor(e.d),conf:e.c},geometry:{type:'LineString',coordinates:gc(a,byId[e.t].c)}})));
}
function trailData(){
  const f=[]; for(let i=1;i<trail.length;i++) f.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:gc(byId[trail[i-1]].c,byId[trail[i]].c)}});
  return fc(f);
}
function allNodesData(){
  return fc(NODES.map(n=>({type:'Feature',properties:{id:n.id,col:kindColor(n)},geometry:{type:'Point',coordinates:n.c}})));
}
function plantsData(){
  return fc(PLANTS.p.map(p=>({type:'Feature',properties:{mw:p[2],f:p[3],n:p[4],cc:p[5],id:p[6]},geometry:{type:'Point',coordinates:[p[0],p[1]]}})));
}

function baseStyle(){
  // Antarctica dropped: no supply sites there, and its pole-spanning ring misrenders on the globe
  const obj = {type:'GeometryCollection',geometries:TOPO.objects.countries.geometries.filter(g=>g.id!=='010')};
  const countries = topojson.feature(TOPO, obj);
  const borders = topojson.mesh(TOPO, obj, (a,b)=>a!==b);
  const coast = topojson.mesh(TOPO, obj, (a,b)=>a===b);
  // world-atlas rings jump across the antimeridian (179 → -179); make them continuous so fills don't smear
  const fixRing = r => { let prev=r[0][0]; return r.map(([x,y])=>{ x=unwrap(x,prev); prev=x; return [x,y]; }); };
  const fixGeom = g => {
    if(!g) return g;
    if(g.type==='Polygon') g.coordinates=g.coordinates.map(fixRing);
    else if(g.type==='MultiPolygon') g.coordinates=g.coordinates.map(p=>p.map(fixRing));
    else if(g.type==='LineString') g.coordinates=fixRing(g.coordinates);
    else if(g.type==='MultiLineString') g.coordinates=g.coordinates.map(fixRing);
    return g;
  };
  countries.features.forEach(f=>fixGeom(f.geometry)); fixGeom(borders); fixGeom(coast);
  return {
    version:8,
    projection:{type:'mercator'},
    sources:{
      countries:{type:'geojson',data:countries}, borders:{type:'geojson',data:borders}, coast:{type:'geojson',data:coast},
      lakes:{type:'geojson',data:LAKES}, rivers:{type:'geojson',data:RIVERS}, admin:{type:'geojson',data:ADMIN}
    },
    layers:[
      {id:'bg',type:'background',paint:{'background-color':css('--sea')}},
      {id:'land',type:'fill',source:'countries',paint:{'fill-color':css('--land')}},
      {id:'lakes',type:'fill',source:'lakes',paint:{'fill-color':css('--sea')}},
      {id:'admin',type:'line',source:'admin',minzoom:2.5,paint:{'line-color':css('--admin'),'line-width':0.7}},
      {id:'rivers',type:'line',source:'rivers',paint:{'line-color':css('--river'),'line-width':['interpolate',['linear'],['zoom'],1,0.4,5,1,9,2.2],'line-opacity':0.85}},
      {id:'coast',type:'line',source:'coast',paint:{'line-color':css('--line'),'line-width':0.6}},
      {id:'borders',type:'line',source:'borders',paint:{'line-color':css('--line'),'line-width':['interpolate',['linear'],['zoom'],1,0.5,6,1.2]}}
    ]
  };
}

function addOverlays(){
  map.addSource('plants',{type:'geojson',data:plantsData()});
  map.addSource('nodes',{type:'geojson',data:allNodesData()});
  map.addSource('spider',{type:'geojson',data:fc([])});
  map.addSource('trail',{type:'geojson',data:fc([])});
  const sq=['sqrt',['get','mw']];
  map.addLayer({id:'plants',type:'circle',source:'plants',paint:{
    'circle-color':['match',['get','f'],...FUEL_COLORS.flatMap((c,i)=>[i,c]).slice(0,-2),FUEL_COLORS[8]],
    'circle-radius':['interpolate',['linear'],['zoom'],1,['+',0.5,['*',0.035,sq]],5,['+',1.4,['*',0.1,sq]],10,['+',3,['*',0.24,sq]]],
    'circle-opacity':['interpolate',['linear'],['zoom'],1,0.35,5,0.7,9,0.85],
    'circle-stroke-width':['interpolate',['linear'],['zoom'],4,0,7,1],
    'circle-stroke-color':'rgba(255,255,255,0.6)'
  }});
  map.addLayer({id:'nodes',type:'circle',source:'nodes',paint:{
    'circle-color':['get','col'],'circle-radius':['interpolate',['linear'],['zoom'],1,2.5,6,4.5],
    'circle-opacity':0.55,'circle-stroke-width':1,'circle-stroke-color':css('--panel')}});
  map.addLayer({id:'trail-case',type:'line',source:'trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':css('--panel'),'line-width':6,'line-opacity':0.8}});
  map.addLayer({id:'trail',type:'line',source:'trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':css('--ink'),'line-width':2.6}});
  map.addLayer({id:'spider-solid',type:'line',source:'spider',filter:['==',['get','conf'],'c'],layout:{'line-cap':'round'},paint:{'line-color':['get','col'],'line-width':2.2,'line-opacity':0.9}});
  map.addLayer({id:'spider-dash',type:'line',source:'spider',filter:['!=',['get','conf'],'c'],paint:{'line-color':['get','col'],'line-width':2,'line-opacity':0.9,'line-dasharray':[1.5,1.5]}});
  applyFuelFilter();

  map.on('click','plants',ev=>{
    const p=ev.features[0].properties;
    if(byId['pp_'+p.id]){ go('pp_'+p.id); return; }
    new lib.Popup({closeButton:false,offset:8}).setLngLat(ev.lngLat)
      .setHTML('<div class="pp"><b>'+esc(p.n)+'</b>'+esc(PLANTS.fuels[p.f])+' · '+Number(p.mw).toLocaleString()+' MW<br><span>'+esc(p.cc)+'</span></div>').addTo(map);
  });
  map.on('click','nodes',ev=>{ const f=ev.features[0]; if(f) go(f.properties.id); });
  ['plants','nodes'].forEach(l=>{ map.on('mouseenter',l,()=>map.getCanvas().style.cursor='pointer'); map.on('mouseleave',l,()=>map.getCanvas().style.cursor=''); });
  map.on('moveend',declutter);
}

function applyFuelFilter(){
  if(!map||!map.getLayer('plants')) return;
  map.setLayoutProperty('plants','visibility',plantsOn?'visible':'none');
  map.setFilter('plants',['in',['get','f'],['literal',[...activeFuels]]]);
}

function makeMarker(n, cls, color, label, order){
  const el=document.createElement('button');
  el.className='mk '+cls; el.style.setProperty('--c',color);
  el.setAttribute('aria-label',n.n);
  el.innerHTML='<span class="d"></span><span class="l">'+esc(label)+'</span>';
  el.addEventListener('click',ev=>{ ev.stopPropagation(); if(cls.includes('cur')) { expand(); return; } go(n.id); });
  const m=new lib.Marker({element:el,anchor:'left',offset:[-8,0]}).setLngLat(n.c).addTo(map);
  m._order=order; markers.push(m); return m;
}

function tourLines(pairs){ return fc(pairs.map(e=>({type:'Feature',properties:{col:dimColor(e.d),conf:e.c},geometry:{type:'LineString',coordinates:gc(byId[e.f].c,byId[e.t].c)}}))); }
function drawTourMap(){
  const t=tour.t, N=t.stops.length, i=tour.i, cur=(i>=0 && i<N) ? t.stops[i] : null;
  const before = i<0 ? [] : t.stops.slice(0, cur ? i : N).flatMap(s=>pathEdges(s.path));
  map.getSource('trail').setData(tourLines(before));
  map.getSource('spider').setData(tourLines(cur ? pathEdges(cur.path) : []));
  const shown=new Set();
  if(cur){
    const n=byId[cur.at]; makeMarker(n,'cur',kindColor(n),n.n,0); shown.add(cur.at);
    cur.path.forEach((id,k)=>{ if(shown.has(id)) return; shown.add(id); makeMarker(byId[id],'tgt',kindColor(byId[id]),byId[id].n,10+k); });
  }
  (i<0 ? [] : t.stops.slice(0, cur ? i : N)).forEach((s,k)=>{ if(shown.has(s.at)) return; shown.add(s.at); makeMarker(byId[s.at],'past',css('--ink'),(k+1)+'. '+byId[s.at].n,30+k); });
  setTimeout(declutter,0);
}
function drawMap(){
  markers.forEach(m=>m.remove()); markers=[];
  if(tour){ drawTourMap(); return; }
  map.getSource('spider').setData(spiderData());
  map.getSource('trail').setData(trailData());
  const id=current();
  if(!id){
    LABS.forEach((l,i)=>makeMarker(byId[l],'lab',css('--lab'),byId[l].n,i));
  } else {
    const shown=new Set();
    const cur=byId[id]; makeMarker(cur,'cur',kindColor(cur),cur.n,0); shown.add(id);
    trail.slice(0,-1).forEach((t,i)=>{ if(shown.has(t))return; shown.add(t); makeMarker(byId[t],'past',css('--ink'),(i+1)+'. '+byId[t].n,1+i); });
    OUT[id].filter(e=>!dimFilter||e.d===dimFilter).forEach((e,i)=>{ if(shown.has(e.t))return; shown.add(e.t); makeMarker(byId[e.t],'tgt',dimColor(e.d),byId[e.t].n,50+i); });
  }
  setTimeout(declutter,0);
}

function declutter(){
  if(!map) return;
  const placed=[];
  [...markers].sort((a,b)=>a._order-b._order).forEach(m=>{
    const el=m.getElement(), lab=el.querySelector('.l'); lab.classList.remove('hide');
    const p=map.project(m.getLngLat());
    const w=lab.offsetWidth||lab.textContent.length*7+14, h=20;
    const box={x:p.x+6,y:p.y-h/2,w:w+14,h};
    const hit=placed.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
    if(hit && !el.classList.contains('cur')) lab.classList.add('hide'); else placed.push(box);
  });
}

function padding(){
  const W=innerWidth,H=innerHeight;
  if(tour){ const card = tour.i<0 || tour.i>=tour.t.stops.length; return isMobile() ? {top:70,bottom:card?Math.round(H*0.25):Math.round(H*0.56),left:30,right:120} : {top:80,bottom:card?140:Math.min(300,Math.round(H*0.36)),left:90,right:200}; }
  if(isMobile()){ const h=Math.min(panel.getBoundingClientRect().height,H*0.5); return {top:60,bottom:Math.min(h+16,H-200),left:24,right:24}; }
  return {top:80,bottom:50,left:Math.min(392+16+50,W-300),right:current()?110:170};
}
function fitView(){
  if(!map) return;
  const id=tour ? null : current(); const pad=padding(); const opt={padding:pad,duration:reduceMotion?0:(tour?2200:1600),essential:true};
  let pts, ref;
  if(tour && mapReady){ const cam=tourCamera(); map.flyTo({center:cam.center, zoom:cam.zoom, padding:cam.padding, duration:cam.duration, essential:true}); return; }
  if(tour){
    const t=tour.t, s=tour.i>=0 ? t.stops[tour.i] : null;
    const ids = s ? s.path : [...new Set(t.stops.flatMap(x=>x.path))];
    pts = ids.map(x=>byId[x].c); ref = byId[s ? s.at : ids[0]].c[0];
    if(pts.length===1){ map.flyTo(Object.assign({},opt,{center:pts[0],zoom:5})); return; }
  }
  else if(!id){ pts=LABS.map(l=>byId[l].c); ref=170; }
  else { ref=byId[id].c[0]; pts=[byId[id].c].concat(OUT[id].filter(e=>!dimFilter||e.d===dimFilter).map(e=>byId[e.t].c)); }
  if(pts.length===1){ map.flyTo(Object.assign({},opt,{center:pts[0],zoom:6.5})); return; }
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  pts.forEach(p=>{ const x=unwrap(p[0],ref); minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]); });
  if(globe && maxX-minX>110){ map.flyTo(Object.assign({},opt,{center:tour?pts[0]:id?byId[id].c:[150,35],zoom:isMobile()?0.6:1.3})); return; }
  const cam=frameBounds([[minX,minY],[maxX,maxY]], pad);
  if(cam.zoom>=0.35){ map.flyTo(Object.assign({},opt,{center:cam.center, zoom:Math.min(7.5, cam.zoom)})); }
  else { // too spread out for this screen: keep the current stop in view, lines lead off toward the rest
    const c = tour ? [ref, pts[0][1]] : id?byId[id].c:[150,30];
    map.flyTo(Object.assign({},opt,{center:[c[0],Math.max(-50,Math.min(60,c[1]))],zoom:0.5})); }
}

function refreshTheme(){
  if(!map||!mapReady) return;
  if(!CONFIG.mapboxToken){
    map.setPaintProperty('bg','background-color',css('--sea'));
    map.setPaintProperty('land','fill-color',css('--land'));
    map.setPaintProperty('lakes','fill-color',css('--sea'));
    map.setPaintProperty('admin','line-color',css('--admin'));
    map.setPaintProperty('rivers','line-color',css('--river'));
    map.setPaintProperty('coast','line-color',css('--line'));
    map.setPaintProperty('borders','line-color',css('--line'));
  }
  map.setPaintProperty('trail','line-color',css('--ink'));
  map.setPaintProperty('trail-case','line-color',css('--panel'));
  map.setPaintProperty('nodes','circle-stroke-color',css('--panel'));
  map.getSource('nodes').setData(allNodesData());
  drawMap();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ render(false); refreshTheme(); });

function mapFailed(msg){
  const d=document.createElement('div'); d.className='maperr';
  d.innerHTML='<div><b>The map couldn’t load here.</b><br>'+esc(msg)+' The explorer panel still works: pick a lab to follow its supply lines.</div>';
  document.getElementById('map').appendChild(d);
}

function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }

async function initMap(){
  try{
    if(CONFIG.mapboxToken){
      const v=CONFIG.mapboxVersion; const l=document.createElement('link'); l.rel='stylesheet'; l.href='https://api.mapbox.com/mapbox-gl-js/'+v+'/mapbox-gl.css'; document.head.appendChild(l);
      await loadScript('https://api.mapbox.com/mapbox-gl-js/'+v+'/mapbox-gl.js');
      lib=window.mapboxgl; lib.accessToken=CONFIG.mapboxToken;
      map=new lib.Map({container:'map',style:CONFIG.mapboxStyle,projection:'mercator',center:[175,33],zoom:1.4,attributionControl:true});
      map.on('style.load',onReady);
    } else {
      if(!window.maplibregl||!window.topojson) throw new Error('The map library didn’t load.');
      lib=window.maplibregl;
      map=new lib.Map({container:'map',style:baseStyle(),center:[150,30],zoom:isMobile()?0.4:1.3,attributionControl:{compact:true,customAttribution:'Natural Earth · WRI GPPD'}});
      map.on('load',onReady);
    }
    map.on('error',e=>console.warn(e&&e.error));
    setTimeout(()=>{ if(!mapReady) mapFailed('The map engine didn’t start in this browser.'); },12000);
  }catch(err){ mapFailed(err.message||'Unknown error.'); }
}
function onReady(){
  if(mapReady) return;
  addOverlays(); mapReady=true; window.__map=map; drawMap(); fitView();
  const nav=new lib.NavigationControl({showCompass:false}); map.addControl(nav,'bottom-right');
}

// ---------- tools ----------
const pBtn=document.getElementById('plantsBtn'), pPop=document.getElementById('plantsPop'), fuels=document.getElementById('fuels');
pBtn.addEventListener('click',()=>{ const open=pPop.hidden; pPop.hidden=!open; pBtn.setAttribute('aria-expanded',String(open)); });
document.getElementById('plantsOn').addEventListener('change',e=>{ plantsOn=e.target.checked; pBtn.setAttribute('aria-pressed',String(plantsOn)); applyFuelFilter(); });
fuels.innerHTML=PLANTS.fuels.map((f,i)=>'<button class="fuel" data-fuel="'+i+'" aria-pressed="true" style="--c:'+FUEL_COLORS[i]+'"><i></i>'+f+'</button>').join('');
fuels.addEventListener('click',e=>{ const b=e.target.closest('[data-fuel]'); if(!b)return; const i=+b.dataset.fuel;
  if(activeFuels.has(i)) activeFuels.delete(i); else activeFuels.add(i); b.setAttribute('aria-pressed',String(activeFuels.has(i))); applyFuelFilter(); });
document.getElementById('projBtn').addEventListener('click',e=>{
  if(!map) return; globe=!globe;
  if(CONFIG.mapboxToken) map.setProjection(globe?'globe':'mercator'); else map.setProjection({type:globe?'globe':'mercator'});
  e.currentTarget.textContent = globe?'Flat map':'Globe';
});

readURL();
fromURL=true; render(false); fromURL=false;
if(location.hash==='#about'){ const el=document.getElementById('about'); if(el) setTimeout(()=>el.scrollIntoView({block:'start'}),50); }
initMap();
})();
