// Viewer-attention simulation for the guided tours.
//
// Plays every stop of every tour in a real browser, measures what the viewer is shown (caption timing,
// camera motion, zoom, what else is on screen) and runs it through a simple single-channel attention
// model: at any moment the viewer attends to one thing — the moving camera, the map, or the caption.
//
//   node scripts/attention-sim.js [baseUrl] [--mobile] [--json out.json]
//   (serve the site first, e.g. `npx serve .` or `python3 -m http.server 8765`)
//
// Model (seconds). Constants are deliberately simple and documented so they can be argued with.
//   Read      R = 0.4 (strap glance) + words / 3.3            ~200 wpm for on-screen narration
//   Orient    O = 0.4 + 0.35·|Δzoom| + 0.5 if the new focus was off-screen in the previous frame
//   Find      F = 0.25 + 0.035·√clutter                       clutter = plants + 3·graph pins + 4·labels in view, weighted by how dimmed they are
//   Links     L = Σ 0.6 per link, +0.5 if it is shorter than 40 px, +0.3 if an end is off-screen
//   Sources   S = 0.6, counted at half weight (an optional glance)
//   Need      = O + F + L + R + 0.3 (+ a 0.6 s beat in the app's hold)
//   Available = time the caption is readable before the next stop (motion time counts half: you can't
//               read and track a moving camera at once)
//   Dead air  = time with no readable caption, minus up to 1.5 s of camera motion (motion holds attention
//               for about that long; beyond it the viewer is just waiting)
// Flags per stop: OVERLOAD (Need > Available), DRAG (> 3.5 s of slack), DISORIENT (|Δzoom| > 3.5, zoom > 7
// or < 250 km of map in view), UNDERZOOM (the path would still fit with ≥ 1.2 more zoom levels and we're
// below zoom 6), CROWDED (an unrelated pin within 24 px of the focus).
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const base = (args.find(a => /^https?:/.test(a)) || 'http://localhost:8765/index.html');
const mobile = args.includes('--mobile');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const VIEW = mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1366, height: 820 };

const M = { wps: 3.3, strap: 0.4, orient0: 0.4, orientZ: 0.35, offscreen: 0.5, find0: 0.25, findK: 0.035,
  link: 0.6, shortLink: 0.5, offLink: 0.3, src: 0.3, motionGrace: 1.5, drag: 3.5 };

function need(st) {
  const R = M.strap + st.words / M.wps;
  const O = M.orient0 + M.orientZ * Math.abs(st.dz) + (st.wasOffscreen ? M.offscreen : 0);
  const F = M.find0 + M.findK * Math.sqrt(st.clutter);
  const L = st.links.reduce((s, l) => s + M.link + (l.px < 40 ? M.shortLink : 0) + (l.off ? M.offLink : 0), 0);
  return { R, O, F, L, total: O + F + L + R + M.src };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: VIEW.width, height: VIEW.height }, isMobile: !!VIEW.isMobile, hasTouch: !!VIEW.hasTouch });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base); await page.waitForTimeout(2000);
  const live = await page.evaluate(() => window.__tourModel || null);
  if (live) Object.keys(M).forEach(k => { if (live[k] !== undefined) M[k] = live[k]; });   // stay in sync with app.js
  const tours = await page.evaluate(() => TOURS.map(t => ({ id: t.id, stops: t.stops.map(s => ({ at: s.at, path: s.path, text: s.text })) })));
  const rows = [];
  for (const t of tours) {
    await page.goto(base + '#/tour/' + t.id); await page.waitForTimeout(3500);   // title card, paused
    let prev = await page.evaluate(() => ({ z: __map.getZoom(), b: __map.getBounds().toArray() }));
    for (let i = 0; i < t.stops.length; i++) {
      // sample the transition frame by frame
      const tl = await page.evaluate(i => new Promise(res => {
        const cap = document.getElementById('cap'), S = []; const t0 = performance.now();
        const op = () => { const el = cap.querySelector('.cap-low,.cap-card'); return el ? +getComputedStyle(el).opacity : 0; };
        let sawHidden = false;
        (function tick() {
          const t = performance.now() - t0, o = op(), mv = __map.isMoving();
          S.push([t, o, mv ? 1 : 0]); if (o < 0.5) sawHidden = true;
          if ((t > 500 && sawHidden && o > 0.98 && !mv) || t > 12000) return res(S);
          requestAnimationFrame(tick);
        })();
        window.__nav.tourTo(i);
      }), i);
      await page.waitForTimeout(450);   // the app sets its hold 250 ms after landing
      let hold = await page.evaluate(() => (window.__tourHoldMs ? window.__tourHoldMs() : null));
      // builds before the attention-based timing used a flat reading-speed hold; reproduce it for comparison
      if (hold == null) hold = Math.max(6000, t.stops[i].text.split(/\s+/).length / 3.2 * 1000 + 2000);
      const scene = await page.evaluate(({ path, at, prevB, vw, vh, mobile }) => {
        const map = __map, byId = {}; NODES.forEach(n => byId[n.id] = n);
        const W = innerWidth, H = innerHeight;
        const safe = mobile ? { l: 0, t: 60, r: W, b: H * 0.5 } : { l: 0, t: 60, r: W, b: H * 0.62 };
        const inSafe = p => p.x >= safe.l && p.x <= safe.r && p.y >= safe.t && p.y <= safe.b;
        const plants = map.queryRenderedFeatures([[safe.l, safe.t], [safe.r, safe.b]], { layers: ['plants'] }).length;
        const pins = new Set(map.queryRenderedFeatures([[safe.l, safe.t], [safe.r, safe.b]], { layers: ['nodes'] }).map(f => f.properties.id)).size;
        const labels = document.querySelectorAll('.mk .l:not(.hide)').length;
        const cw = window.__clutterWeights || { plants: 1, nodes: 1 };
        const R = Math.PI / 180, km = (a, b) => 12742 * Math.asin(Math.sqrt(Math.sin((b[1] - a[1]) * R / 2) ** 2 + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.sin((b[0] - a[0]) * R / 2) ** 2));
        const fp = map.project(byId[at].c);
        let near = Infinity;
        NODES.forEach(n => { if (path.includes(n.id) || km(n.c, byId[at].c) < 2) return; const p = map.project(n.c); if (!inSafe(p)) return; near = Math.min(near, Math.hypot(p.x - fp.x, p.y - fp.y)); });
        const links = path.slice(1).map((id, j) => { const a = map.project(byId[path[j]].c), b = map.project(byId[id].c); return { px: Math.hypot(a.x - b.x, a.y - b.y), off: !inSafe(a) || !inSafe(b) }; });
        const pts = path.map(id => map.project(byId[id].c));
        const bw = Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x)), bh = Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y));
        const sw = safe.r - safe.l - 120, sh = safe.b - safe.t - 60;
        const headroom = pts.length > 1 ? Math.log2(Math.min(0.7 * sw / Math.max(bw, 1), 0.7 * sh / Math.max(bh, 1))) : (map.getZoom() < 3 ? 9 : 0);   // single pin: a near-global view is underzoomed
        const b = map.getBounds(); const lat = map.getCenter().lat;
        const spanKm = Math.abs(b.getEast() - b.getWest()) * 111.32 * Math.cos(lat * Math.PI / 180);
        const [[w, s], [e, n]] = prevB; const c = byId[at].c;
        const wasOffscreen = !(c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n);
        return { z: map.getZoom(), plants: plants * cw.plants, pins: pins * cw.nodes, labels, near, links, headroom, spanKm, wasOffscreen, b: map.getBounds().toArray() };
      }, { path: t.stops[i].path, at: t.stops[i].at, prevB: prev.b, vw: VIEW.width, vh: VIEW.height, mobile });
      // timeline → gap, motion, dead air
      let gap = 0, motion = 0, motionNoCap = 0, dead = 0, firstShow = null, landed = null;
      for (let k = 1; k < tl.length; k++) {
        const [tt, o, mv] = tl[k], dt = (tt - tl[k - 1][0]) / 1000;
        if (mv) motion += dt;
        if (o < 0.5) { gap += dt; if (mv) { motionNoCap += dt; if (motionNoCap > M.motionGrace) dead += dt; } else dead += dt; }
        else if (firstShow === null && k > 2) firstShow = tt / 1000;
        if (!mv && tl[k - 1][2] && landed === null) landed = tt / 1000;
      }
      const words = t.stops[i].text.split(/\s+/).length;
      const st = { words, dz: scene.z - prev.z, wasOffscreen: scene.wasOffscreen, clutter: Math.round(scene.plants + 3 * scene.pins + 4 * scene.labels), links: scene.links };
      const nd = need(st);
      const holdS = hold != null ? hold / 1000 : null;
      const overlapMotion = firstShow !== null && landed !== null ? Math.max(0, landed - firstShow) : 0;
      const avail = holdS != null ? holdS + 0.5 * overlapMotion : null;
      const flags = [];
      if (avail != null && avail < nd.total) flags.push('OVERLOAD');
      if (avail != null && avail - nd.total > M.drag) flags.push('DRAG');
      if (Math.abs(st.dz) > 3.5 || scene.z > 7 || scene.spanKm < 250) flags.push('DISORIENT');
      if (scene.headroom >= 1.2 && scene.z < 6) flags.push('UNDERZOOM');
      if (scene.near < 24) flags.push('CROWDED');
      rows.push({ tour: t.id, stop: i + 1, at: t.stops[i].at, z: +scene.z.toFixed(2), dz: +st.dz.toFixed(2), spanKm: Math.round(scene.spanKm),
        clutter: st.clutter, nearPx: scene.near === Infinity ? null : Math.round(scene.near), gap: +gap.toFixed(2), motion: +motion.toFixed(2), dead: +dead.toFixed(2),
        need: +nd.total.toFixed(1), hold: holdS != null ? +holdS.toFixed(1) : null, slack: avail != null ? +(avail - nd.total).toFixed(1) : null, flags });
      prev = { z: scene.z, b: scene.b };
    }
  }
  await browser.close();
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('tour', 15) + pad('#', 3) + pad('focus', 15) + pad('zoom', 6) + pad('Δz', 6) + pad('km', 7) + pad('clutter', 8) + pad('near', 6) + pad('gap', 6) + pad('dead', 6) + pad('need', 6) + pad('hold', 6) + pad('slack', 7) + 'flags');
  rows.forEach(r => console.log(pad(r.tour, 15) + pad(r.stop, 3) + pad(r.at.slice(0, 14), 15) + pad(r.z, 6) + pad(r.dz, 6) + pad(r.spanKm, 7) + pad(r.clutter, 8) + pad(r.nearPx ?? '-', 6) + pad(r.gap, 6) + pad(r.dead, 6) + pad(r.need, 6) + pad(r.hold ?? '-', 6) + pad(r.slack ?? '-', 7) + r.flags.join(' ')));
  const n = rows.length, avg = k => (rows.reduce((s, r) => s + (r[k] || 0), 0) / n);
  const count = f => rows.filter(r => r.flags.includes(f)).length;
  const summary = { view: mobile ? 'mobile 390×844' : 'desktop 1366×820', stops: n, meanGap: +avg('gap').toFixed(2), meanDead: +avg('dead').toFixed(2), totalDead: +rows.reduce((s, r) => s + r.dead, 0).toFixed(1),
    meanZoom: +avg('z').toFixed(2), globalViews: rows.filter(r => r.z < 2.5).length, overload: count('OVERLOAD'), drag: count('DRAG'), disorient: count('DISORIENT'), underzoom: count('UNDERZOOM'), crowded: count('CROWDED'),
    meanSlack: rows[0].slack != null ? +avg('slack').toFixed(2) : null, errors };
  console.log('\nSUMMARY ' + JSON.stringify(summary, null, 1));
  if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify({ summary, rows }, null, 1));
})();
