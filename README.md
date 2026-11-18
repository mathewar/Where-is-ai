# Supply Lines

Map explorer tracing the supply chains of frontier AI labs.

## Deploy
Static site, no build step. Drag this folder into Vercel (or Netlify Drop), or run:

    npx vercel deploy

Local preview: `npx serve .` (open via a server, not file://, so everything loads cleanly).

## Files
- `index.html` – page shell
- `styles.css` – app styles (`vendor/maplibre-gl.css` is the map library's own CSS)
- `app.js` – map, navigation, rendering
- `config.js` – basemap switch (see below)
- `data/graph.js` – labs, sites, supply links and their sources (`SRC`, `NODES`, `EDGES`, `LABS`).
  - Nodes: `{id, n: name, p: place, c: [lon, lat], k: kind, d: description, a: approximate}`
  - Edges: `[from, to, dimension, confidence, note, [sourceIds]]`, confidence `c` confirmed / `r` reported / `i` inferred
  - Every edge cites at least one entry in `SRC`. Power links from facilities to nearby plants (ids starting `pp_`) are inferred from proximity (largest plants within 120 km in WRI's database) and cite each plant's record.
- `data/plants.js` – power plants ≥50 MW (WRI Global Power Plant Database)
- `data/topo.js`, `rivers.js`, `lakes.js`, `admin.js` – basemap geometry (Natural Earth / world-atlas)
- `vendor/` – MapLibre GL 5.6.0 and topojson-client, bundled so nothing depends on a CDN

## Mapbox tiles
In `config.js`, set `mapboxToken` to a public token (restrict it to your Vercel domain in the Mapbox dashboard).
The app then loads Mapbox GL and the `mapboxStyle` you choose (satellite-streets by default) and draws the same overlays on top.

## Shareable links
The address bar tracks the journey, so any view can be shared or bookmarked:
`https://where-is-ai.vercel.app/#/qwen/alicloud/litong/megaspeed?dim=chips`
— the path is the breadcrumb trail of node ids, and `dim` is the optional filter. Back/forward buttons step through the journey.

## Stock tickers
`data/tickers.js` maps node ids to stock listings (`co` company, `rel` own/parent/operator/part, `l` = [symbol, exchange] in Google Finance codes, optional `st: 'proposed'` for an announced IPO that isn't trading yet). Tickers show in each stop's details, link to Google Finance, and are searchable. Ids not yet in the map are ignored, so listings for upcoming nodes can be added early.

## Feedback
The site's Feedback links open a pre-filled GitHub issue on this repo, including the page link and the stop the reader was looking at.
