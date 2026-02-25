# j-alcohol-reduction-app

A lightweight web app for tracking alcohol consumption and supporting reduction goals.

## Focus

This version is optimized around **reducing alcohol consumption** by making sober-day logging the default primary flow.

## Features

- Log each day as either:
  - **Alcohol-free day** (default, no drink details required), or
  - **Had a drink** (then provide drink type + units).
- Retroactively log or edit previous days.
- One check-in per date (saving a new entry for an already-logged date updates that day).
- Sober-focused stats:
  - Current sober streak
  - Best sober streak
  - Total sober days
- Trophies/milestones awarded based on sober-day progress and sober streaks.
- Data persistence via `localStorage`.

## Files

- `index.html` - app structure and sober-first UI
- `styles.css` - styles for status toggle, stats, milestones, and history
- `app.js` - sober-day logging logic, drink-detail gating, streak calculations, milestones, and persistence
- `assets/trophy.svg` and `assets/confetti.svg` - decorative app images

## Run locally

```bash
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.
