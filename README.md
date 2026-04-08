# Vuily

Vuily is a vibrant San Francisco events website focused on adults-only fun:
cultural, arts, music, and outdoor activities.

## Features

- Swipe cards left to skip and right to reserve
- Filter by category and cost
- Add reserved events to calendar (`.ics`)
- Thumbs up/down reviews
- Gamified points, streaks, levels, and badges

## Local run

```bash
node dev-server.mjs
```

Then open `http://localhost:8000`.

Note: The dev server includes a small RSS proxy so the live feed works in the browser.
If you use `python3 -m http.server`, the live feed may be blocked by CORS.

## Keep `vuily.pen` in sync with code

Run once:

```bash
node scripts/sync-pen.mjs --once
```

Watch for changes and auto-refresh `vuily.pen` whenever `index.html`, `script.js`, or `styles.css` changes:

```bash
node scripts/sync-pen.mjs
```

## Live sources

The app now pulls live event data from:

- SF Funcheap: `https://sf.funcheap.com/feed/`

Fetched in-browser directly from the RSS feed and parsed client-side.
