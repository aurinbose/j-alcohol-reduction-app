# j-alcohol-reduction-app

A lightweight web app for tracking alcohol consumption and supporting reduction goals.

## Features

- Log alcohol entries for **today or any previous date**.
- Edit or delete existing entries, including retroactive updates.
- Grouped daily history with per-day and overall totals.
- Data persistence via `localStorage`.

## Files

- `index.html` - app structure and UI
- `styles.css` - styles for layout and components
- `app.js` - logging, editing, grouping, and persistence logic

## Run locally

You can open `index.html` directly in a browser, or run a static server:

```bash
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.
