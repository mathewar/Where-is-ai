// Checks data/graph.js and data/tours.js. Run: node scripts/check-data.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const load = (f, names) => new Function(fs.readFileSync(path.join(root, f), 'utf8') + ';return {' + names + '};')();
const { SRC, NODES, EDGES, LABS } = load('data/graph.js', 'SRC,NODES,EDGES,LABS');
const { TOURS } = load('data/tours.js', 'TOURS');
const errs = [];
const byId = {};
for (const n of NODES) { if (byId[n.id]) errs.push('duplicate node ' + n.id); byId[n.id] = n; }
const KINDS = new Set('lab cloud dc chip mem fab tool mat power gen fuel data'.split(' '));
const DIMS = new Set('compute chips memory fab tools materials energy data'.split(' '));
for (const n of NODES) if (!KINDS.has(n.k)) errs.push('bad kind on ' + n.id);
const edge = {}, out = {};
for (const e of EDGES) {
  const [f, t, d, c, , s] = e;
  if (!byId[f] || !byId[t]) errs.push('edge with missing endpoint ' + f + ' → ' + t);
  if (!DIMS.has(d) || !['c', 'r', 'i'].includes(c)) errs.push('bad dimension/confidence on ' + f + ' → ' + t);
  if (!Array.isArray(s) || !s.length) errs.push('edge without source ' + f + ' → ' + t);
  else for (const id of s) if (!SRC[id]) errs.push('missing source ' + id + ' on ' + f + ' → ' + t);
  edge[f + '>' + t] = e; (out[f] = out[f] || []).push(t);
}
function depth(n, seen, lim) {
  if (!lim) return 0; let b = 0;
  for (const m of out[n] || []) if (!seen.has(m)) { seen.add(m); b = Math.max(b, 1 + depth(m, seen, lim - 1)); seen.delete(m); if (b >= lim) break; }
  return b;
}
for (const l of LABS) { if (!byId[l]) errs.push('lab missing ' + l); else if (depth(l, new Set([l]), 7) < 7) errs.push('lab chain shorter than 7 steps: ' + l); }

// tours
const ids = new Set();
for (const t of TOURS) {
  const where = 'tour ' + t.id;
  if (ids.has(t.id)) errs.push('duplicate ' + where); ids.add(t.id);
  if (!t.title || !t.lede || !Array.isArray(t.stops) || t.stops.length < 3) errs.push(where + ': needs title, lede and 3+ stops');
  (t.stops || []).forEach((s, i) => {
    const w = where + ' stop ' + (i + 1);
    if (!byId[s.at]) errs.push(w + ': unknown node ' + s.at);
    if (!Array.isArray(s.path) || !s.path.length || !s.path.includes(s.at)) errs.push(w + ': path must include its stop');
    const ctx = [];
    (s.path || []).forEach((id, j) => {
      const n = byId[id]; if (!n) { errs.push(w + ': unknown node ' + id); return; }
      ctx.push(n.n, n.p, n.d);
      if (j) { const e = edge[s.path[j - 1] + '>' + id]; if (!e) errs.push(w + ': no link ' + s.path[j - 1] + ' → ' + id); else { ctx.push(e[4]); e[5].forEach(x => SRC[x] && ctx.push(SRC[x].t)); } }
    });
    const hay = ctx.join(' ');
    for (const num of (s.text || '').replace(/\{\{[^}]*\}\}/g, '').match(/\d+(?:[.,]\d+)*/g) || [])
      if (!hay.includes(num)) errs.push(w + ': "' + num + '" isn’t in the notes, descriptions or sources along its path');
  });
  for (const m of ((t.lede || '') + (t.close || '') + (t.stops || []).map(s => s.text).join('')).matchAll(/\{\{reach:([^}]+)\}\}/g))
    if (!byId[m[1]]) errs.push(where + ': {{reach:' + m[1] + '}} names an unknown node');
  const loose = ((t.lede || '') + ' ' + (t.close || '')).replace(/\{\{[^}]*\}\}/g, '').match(/\d+(?:[.,]\d+)*/g);
  if (loose) errs.push(where + ': lede/close contain literal numbers (' + loose.join(', ') + '); use {{labs}} / {{reach:id}} or move them into a stop');
}
if (errs.length) { console.error(errs.map(e => '✗ ' + e).join('\n')); console.error(errs.length + ' problem(s)'); process.exit(1); }
console.log('✓ ' + NODES.length + ' nodes, ' + EDGES.length + ' edges, ' + Object.keys(SRC).length + ' sources, ' + TOURS.length + ' tours: all checks pass');
