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

const panel = document.getElementById('panel');
const head = document.getElementById('head');
const body = document.getElementById('body');

// ---------- navigation ----------
function current(){ return trail.length ? trail[trail.length-1] : null; }
function go(id){ if(current()!==id){ const i=trail.indexOf(id); if(i>=0) trail=trail.slice(0,i+1); else trail.push(id);} dimFilter=null; expand(); render(true); }
function jump(i){ trail=trail.slice(0,i+1); dimFilter=null; render(true); }
function home(){ trail=[]; dimFilter=null; render(true); }
function setDim(d){ dimFilter = dimFilter===d ? null : d; render(true); }
window.__nav = {go, jump, home, setDim};

function expand(){ panel.classList.remove('collapsed'); }
document.getElementById('handle').addEventListener('click',()=>{ panel.classList.toggle('collapsed'); setTimeout(()=>fitView(), 50); });

// ---------- panel rendering ----------
function labDots(id){
  const r = reach[id];
  return '<span class="dots" aria-hidden="true">'+LABS.map(l=>'<span class="'+(r.has(l)?'on':'')+'" title="'+esc(byId[l].n)+'"></span>').join('')+'</span>';
}
function kindColor(n){ return dimColor(KIND[n.k][0]); }

function renderHead(){
  let h = '<div class="brand"><b>Supply Lines <span>· AI labs, traced</span></b>'+
    (trail.length?'<button class="iconbtn" data-home>Start over</button>':'')+'</div>';
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
  const us=['anthropic','openai','deepmind'], cn=['deepseek','qwen','moonshot','zhipu','bytedance','minimax'];
  const lb = ids => '<div class="labs">'+ids.map(id=>'<button class="labbtn" data-go="'+id+'"><b>'+esc(byId[id].n)+'</b><span>'+esc(byId[id].p)+'</span><span class="deep">Deepest chain: '+(LONG[id].length-1)+' steps</span></button>').join('')+'</div>';
  const choke = NODES.filter(n=>n.k!=='lab').map(n=>[n,reach[n.id].size]).sort((a,b)=>b[1]-a[1]||a[0].n.localeCompare(b[0].n)).slice(0,8);
  body.innerHTML =
    '<h1>Where frontier AI comes from</h1>'+
    '<p class="lede">Pick a lab or search above, then follow its supply lines out across the map: compute, chips, memory, fabs, lithography, materials, power and data. Every stop opens its own suppliers, down to the power plants and uranium mines.</p>'+
    '<h2>United States & UK</h2>'+lb(us)+
    '<h2>China</h2>'+lb(cn)+
    '<h2>Chokepoints every lab runs through</h2>'+
    '<div class="rows">'+choke.map(([n,c])=>'<button class="row" data-go="'+n.id+'" style="--c:'+kindColor(n)+'"><span class="bar"></span><span class="rn">'+esc(n.n)+'</span><span class="conf" style="border:0;padding:0;font-weight:500;color:var(--muted)">'+c+' of 9</span><span class="rp">'+esc(n.p)+' · '+labDots(n.id)+'</span></button>').join('')+'</div>'+
    '<div class="fine"><h2 style="margin-top:4px">How to read the links</h2>'+
    '<div class="legend-conf"><span class="conf c">Confirmed</span><span class="conf r">Reported</span><span class="conf i">Inferred</span></div>'+
    '<p style="margin-top:10px">Every link carries its source. Confirmed links come from company announcements; reported links from press reporting; inferred links are reasoned from the evidence cited and are drawn dashed on the map.</p>'+
    '<p>Power links from data centers, fabs and memory plants to nearby plants are inferred from proximity: the largest plants within 120 km on WRI’s Global Power Plant Database. They show what the local grid looks like, not a signed contract, unless marked confirmed.</p>'+
    '<p>Pins marked “location approximate” stand in for sites that aren’t public. Deals current as of mid-November 2026.</p></div>';
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
    '<p class="desc">'+esc(n.d)+'</p>';
  const chain=LONG[id];
  if(chain.length>2) h += '<button class="chainbtn" data-chain="'+id+'">Follow the deepest chain from here <em>'+(chain.length-1)+' steps</em></button>';
  if(n.k!=='lab') h += '<div class="shared">'+labDots(id)+'<span>'+(r.size? 'In the supply chain of '+r.size+' of 9 labs' : 'Not reached by any lab in this dataset')+'</span></div>';
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
  body.innerHTML = h;
}

function render(move){
  renderHead();
  const id = current();
  if(id) renderNode(id); else renderHome();
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
  return {n, name:norm(n.n), place:norm(place), kind:norm(KIND[n.k][1]+' '+n.k), desc:norm(n.d), notes:norm(notes)};
});
let qHits=[], qSel=0;
function score(d, terms){
  let s=0;
  for(const t of terms){
    let best=0;
    if(d.name===t) best=100;
    else if(d.name.startsWith(t)) best=60;
    else if(new RegExp('\\b'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(d.name)) best=45;
    else if(d.name.includes(t)) best=30;
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
  qRes.innerHTML = qHits.length ? qHits.map((n,i)=>'<button class="qr" role="option" data-q="'+n.id+'" aria-selected="'+(i===0)+'" style="--c:'+kindColor(n)+'"><i class="sw"></i><b>'+hl(n.n,terms)+'</b><span class="sub">'+esc(KIND[n.k][1])+' · '+hl(n.p,terms)+'</span></button>').join('')
    : '<div class="qnone">No matches. Try a company, a place (“Texas”, “Taiwan”) or a type (“nuclear”, “HBM”).</div>';
  qRes.hidden=false;
}
function pick(id){ qIn.value=''; qRes.hidden=true; qIn.blur(); go(id); }
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
document.addEventListener('keydown',e=>{ if(e.key==='/' && document.activeElement!==qIn && !/input|textarea/i.test(document.activeElement.tagName)){ e.preventDefault(); qIn.focus(); } });

document.addEventListener('click', ev => {
  if(ev.target.closest('a')) return;
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

function drawMap(){
  markers.forEach(m=>m.remove()); markers=[];
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
  if(isMobile()){ const h=Math.min(panel.getBoundingClientRect().height,H*0.5); return {top:60,bottom:Math.min(h+16,H-200),left:24,right:24}; }
  return {top:80,bottom:50,left:Math.min(392+16+50,W-300),right:current()?110:170};
}
function fitView(){
  if(!map) return;
  const id=current(); const pad=padding(); const opt={padding:pad,duration:reduceMotion?0:1600,essential:true};
  let pts, ref;
  if(!id){ pts=LABS.map(l=>byId[l].c); ref=170; }
  else { ref=byId[id].c[0]; pts=[byId[id].c].concat(OUT[id].filter(e=>!dimFilter||e.d===dimFilter).map(e=>byId[e.t].c)); }
  if(pts.length===1){ map.flyTo(Object.assign({},opt,{center:pts[0],zoom:6.5})); return; }
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  pts.forEach(p=>{ const x=unwrap(p[0],ref); minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]); });
  if(globe && maxX-minX>110){ map.flyTo(Object.assign({},opt,{center:id?byId[id].c:[150,35],zoom:isMobile()?0.6:1.3})); return; }
  let cam=null; try{ cam=map.cameraForBounds([[minX,minY],[maxX,maxY]],{padding:pad,maxZoom:7.5}); }catch(e){}
  if(cam && cam.zoom>=0.35){ map.fitBounds([[minX,minY],[maxX,maxY]],Object.assign({},opt,{maxZoom:7.5})); }
  else { // too spread out for this screen: keep the current stop in view, lines lead off toward the rest
    const c = id?byId[id].c:[150,30];
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

render(false);
initMap();
})();
