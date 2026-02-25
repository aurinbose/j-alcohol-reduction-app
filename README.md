# j-alcohol-reduction-app

A lightweight web app for tracking alcohol consumption and supporting reduction goals.

## Features

- Log alcohol entries for **today or any previous date**.
- Edit or delete existing entries, including retroactive updates.
- Quick-add preset buttons for common drinks.
- Milestone cards and achievement pop-up notifications.
- Grouped daily history with per-day and overall totals.
- Data persistence via `localStorage`.

## Files

- `index.html` - app structure and UI
- `styles.css` - styles for layout, milestone cards, and achievement toast
- `app.js` - logging, editing, milestones, grouping, and persistence logic
- `assets/trophy.svg` and `assets/confetti.svg` - decorative app images

## Run locally

```bash
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.
