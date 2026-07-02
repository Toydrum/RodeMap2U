# RodeMap2U 🌱

**A goal map that grows like a tree — built for neurodivergent minds.**

Goals are branches. Achieved ones bloom. Missed deadlines are never failures: they become **branch points** where new alternative paths grow. Every session opens with one gentle question: **"¿Dónde sientes que estás?"** (*Where do you feel you are?*) — and the journey continues from wherever you actually are.

**Live:** https://toydrum.github.io/RodeMap2U/

## Principles

- **No shame mechanics.** No streaks, no "overdue", no red alarms. A passed date offers three kind exits: keep going, move the date, or open a new branch.
- **Local-first & private.** Everything lives in your device (IndexedDB). Nothing leaves without you. JSON export/import for backups. The data model is sync-ready for an optional cloud future.
- **Low cognitive load.** One question per screen, everything skippable, predictable layout (the tree never reshuffles).
- **Accessible by design.** Full keyboard navigation on the tree (roving tabindex + arrow keys), adjustable text size, optional dyslexia-friendly font (Atkinson Hyperlegible), `prefers-reduced-motion` respected everywhere, ≥44px touch targets.
- **Two personalities.** Calm "garden" theme by default; opt-in retro **terminal** theme (the original 2024 pip-boy idea lives!).

## Tech

Angular 22 PWA — standalone components, signals, zoneless change detection. Zero UI libraries; the tree is hand-rolled SVG (pure layout function with deterministic organic jitter, bezier tapered edges, pointer pan/zoom + pinch). Hand-rolled ~100-line IndexedDB wrapper with signal-based repositories, atomic branch transactions, cross-tab sync via BroadcastChannel, and a two-layer migration system. Installable + offline via `@angular/service-worker`.

```bash
npm install
npm start          # dev server (SW disabled in dev)
npm run build      # production build into dist/

# Test the real PWA (service worker needs the subpath):
mkdir -p /tmp/pwa/RodeMap2U && cp -r dist/rodemap2u/browser/* /tmp/pwa/RodeMap2U/
npx http-server /tmp/pwa -p 8080   # → http://localhost:8080/RodeMap2U/
```

## Structure

- `src/app/core/db/` — schema (sync-ready records with rev/tombstones), IDB wrapper, cross-tab broadcast
- `src/app/core/repos/` — signal repositories (write-through), backup/export
- `src/app/core/i18n/` — ES (source of truth) + EN dictionaries, typed parity
- `src/app/features/` — check-in ritual, forest, tree canvas, node detail, branch flow, timer, settings
- `plan/` — the original 2024 design notes this project grew from 🌳

Deploys automatically to GitHub Pages on every push to `main`.
