# RodeMap2U — Agent Onboarding

Context file for AI agents (Codex, Claude, Cursor, etc.) and new contributors. Read this before changing anything. The README covers *what* the app is; this covers *why it is the way it is* and *what will break if you ignore it*.

## What this is

A local-first Angular PWA for **neurodivergent users** where goals grow as a tree. Missed deadlines are never failures — they become **branch points** that sprout alternative paths. Live at `https://toydrum.github.io/RodeMap2U/`, deployed from `main` via GitHub Actions → GitHub Pages.

## Product rules (NON-NEGOTIABLE — these override any technical preference)

1. **Compass language, never action-demands.** Every question in the UI must: (1) locate — "estás aquí"; (2) soothe — "respira, partamos de aquí"; (3) frame the place as fertile; only then show paths, phrased as first-person statements ("Sigo aquí, a mi ritmo"), never commands. "¿Qué quieres hacer?" is banned.
2. **No shame mechanics.** No streaks, no "overdue/atrasado", no red alarm colors, no counters of ignored prompts. A passed date opens a gentle conversation with dignified exits. There is NO "failed" state — the `branched` status is earned through transformation and cannot be hand-picked in the UI.
3. **Nothing is deleted by accident.** User-facing "delete" = archive (`archivedAt`, recoverable). Permanent deletion exists ONLY inside Settings→Archive, requires confirmation, and **auto-downloads a full backup before executing** (`BackupService.download`), then writes sync tombstones (`deletedAt`) — records are never physically removed.
4. **Predictability.** All decorative randomness is **deterministic** from stable ids via `hash()` (`tree-layout.ts`). A user's tree/forest must NEVER reshuffle between sessions. If you add visual variety, derive it from ids, not `Math.random()`.
5. **Motion is opt-out-able, always.** Every animation must respect `MotionService.reduced()` (combines `prefers-reduced-motion` with the user setting; global `.reduce-motion` CSS class is the backstop). Lightning/rain are photosensitivity-sensitive: flashes are small, slow (≥4s apart), low-contrast, and fully removed under reduced motion.
6. **Everything bilingual.** All copy lives in `core/i18n/es.ts` (source of truth) and `en.ts` (`const EN: Dict` — the compiler enforces parity). Never hardcode user-facing strings in templates; never index dictionaries with dynamic string keys (kills the type guarantee).
7. **Privacy: local-first, zero backend.** No accounts, no cloud, no analytics, no notifications. Do not add network calls.

## Stack & architecture

Angular 22 (standalone components, signals, **zoneless** — no zone.js), SCSS design tokens, **zero UI/animation libraries** (hand-rolled by design: it's also the owner's portfolio evidence). TypeScript 6. Vitest scaffolding exists but the verification strategy is interactive (see Tooling).

```
src/app/
  core/
    db/       schema.ts (model+versions) · idb.ts (~100-line promise wrapper) · broadcast.ts (cross-tab)
    repos/    records.repo.ts (base: signal Map, write-through) · trees/nodes/checkins/sessions repos
              settings.service.ts (meta store) · backup.service.ts (export/import envelope)
    i18n/     es.ts (Dict source) · en.ts · i18n.service.ts (signal lang, fill() templating)
    theme/    theme.service.ts (data-theme attr; ?theme= session override)
    motion.service.ts · time.ts (date-only helpers) · boot.service.ts (init + demo seed) · update.service.ts (SW toast)
  features/
    check-in/   check-in.ts (ritual: weather → where → note → [date-review] → CIRCLE of trees) · date-review.ts
    forest/     forest.ts (meadow scene) · mini-tree.ts (real data miniatures) · tree-view.ts · tree-canvas.ts
                tree-layout.ts (PURE: layout, ribbons, hash) · scene-backdrop.ts (sky/mountains/mood weather)
                flora.ts (accent→flower species) · flower.ts (g[appFlower] SVG component)
    node-detail/ node-detail.ts (sheet) · branch-flow.ts (transformation + suggestion chips)
    timer/ · settings/ · guide/ (in-app manual) · trail/ ("Tus huellas": check-ins + branch notes, deep-links via /tree/:id?node=)
  shared/ui/  toast.service.ts
```

### Data model semantics (`core/db/schema.ts`)

- Every record extends `SyncBase { id (uuid), createdAt, updatedAt, rev, deletedAt }`. `rev`+`updatedAt` pre-commit to last-writer-wins sync (v2 Supabase would plug into `RecordsRepo.applyExternal()` — the same hook BroadcastChannel uses today).
- `archivedAt` (user-facing, recoverable) ≠ `deletedAt` (sync tombstone, permanent). Queries filter tombstones in exactly one place (`RecordsRepo.all`).
- **Gentle dates are date-only strings** `'YYYY-MM-DD'`, compared lexicographically against local `today()` (`core/time.ts`). **NEVER** `new Date('YYYY-MM-DD')` — it parses UTC and shifts a day.
- Branch-on-miss is **structural and atomic** (`NodesRepo.branch` → one `putMany` transaction): parent → status `branched` (keeps its original `targetDate` as history), children born with `origin: 'branch'` (rendered with golden tint + knot). The tree shape IS the history; there is no event log.
- Passed-date predicate: `targetDate < today() && status not in (achieved, branched)`. All three review exits (keep-going clears the date / move / branch) end the predicate. Archived trees' dates are excluded from check-in review.
- `Settings.lastCheckInAt` drives a 30-min cooldown on the check-in gate (route guard in `app.routes.ts`).
- Migrations: `DB_VERSION` (IndexedDB structure, `onupgradeneeded`) is separate from `SCHEMA_VERSION` (data shape, pipeline after open; import reuses it).
- Storage resilience: `openDb()` rejects after 3s and every repo degrades to **memory-only session** — a broken IndexedDB must never blank the app.

### Rendering system

- `tree-layout.ts` is **pure and unit-testable**: leaf-slot layered layout (root bottom, growth up), deterministic jitter, `taperedRibbon()` (sampled bezier + perpendicular offsets = filled tapered timber; NOT stroked paths), `edgeGeometry(parent, child, bowScale)` — miniatures pass `bowScale≈scale` or absolute bows read as seaweed.
- Wood color: bark→moss mix by depth; `origin:'branch'` limbs lean golden (`--status-branched`).
- **Flora species**: `flora.ts` maps the tree's accent → flower shape (petal5/daisy/bell/star) + palette. Rendered by `g[appFlower]` everywhere (canvas glyphs, branch blossoms, minis, trunk-base flowers, meadow flowers). One tree = one species, botanically consistent.
- `SceneBackdrop` mood input mirrors the latest check-in feeling: sunny/foggy/heavy/stormy (storm = dark clouds + soft lightning + rain layers). Shared by forest and tree view; `?mood=` query override for demos.
- Tree view ground is **pinned to the meadow band** (both computed from the same `.canvas-wrap` box) — do not reintroduce independent anchors; that caused "floating tree" bugs three times.

## Dev workflow

```bash
npm ci && npm start        # Node ≥ 24.15 (26.x recommended)
npm run build              # prod build → dist/rodemap2u/browser
```

- **Demo data**: `?seed=demo` on an EMPTY store loads a showcase forest with FIXED ids (`demo-guitar`, `demo-health` — has a yesterday-dated branch for the review flow, `demo-work`, `demo-seedling`). Routes like `/tree/demo-guitar?seed=demo` are stable. Never touches real data.
- **Overrides**: `?theme=organic|terminal`, `?mood=sunny|calm|foggy|heavy|stormy` (session-only).
- **Verification is interactive, via playwright-core + system Edge** (`channel: 'msedge'`, no browser download): `tools/shoot.mjs` (viewport-true screenshots), `tools/inspect-forest.mjs` (computed-layout probe), `tools/verify-circle.mjs`, `tools/verify-archive.mjs`, `tools/verify-forest-archive.mjs` (drive full flows). `tools/gen-icons.mjs` regenerates PWA icons from `public/icons/logo.svg`.
- Known environment traps: **IndexedDB is dead in some sandboxed headless browsers** (app falls back to memory — persistence must be verified in a real browser); **`msedge --headless --window-size` screenshots lie about mobile layout** — use the playwright tools instead.

## Deploy (GitHub Pages)

- Push to `main` → `.github/workflows/deploy.yml` (build with `--base-href /RodeMap2U/` — **exact casing**, copy `index.html→404.html`, `.nojekyll`, upload, deploy with an in-run 90s retry).
- SW registration MUST stay relative (`'ngsw-worker.js'`); a leading slash breaks under the subpath. Manifest `start_url`/`scope` are `./`.
- **Pages flake playbook** (encountered repeatedly): `deploy-pages` fails with "Deployment failed, try again later" while status is operational. Reruns reuse the deployment id (= commit SHA) and keep failing — **push a fresh (empty) commit instead**. If no run appears after a push at all (dropped webhook), `workflow_dispatch` the workflow. Deep links returning HTTP 404 with the app body is expected Pages SPA behavior, not a bug.

## Deliberately NOT built (do not "fix" these)

- No event-log store, no merge-import, no dirty/sync flags (v2 sync concerns).
- No priority fields (executive-function tax for this audience).
- No push notifications, streaks, or usage nudges.
- Stale-branch nudge for dateless quiet branches was **deferred on purpose** (shame-risk tradeoff — owner decides).

## Docs to keep in sync when features change

`docs/manual-usuario.md` (source of the Word handout — regenerate with `pandoc docs/manual-usuario.md -o Manual_RodeMap2U.docx --toc --toc-depth=2`) and the in-app guide dictionaries (`guide` section in `es.ts`/`en.ts`).
