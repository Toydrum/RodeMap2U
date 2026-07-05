# RodeMap2U — Agent Onboarding

Context file for AI agents (Codex, Claude, Cursor, etc.) and new contributors. Read this before changing anything. The README covers *what* the app is; this covers *why it is the way it is* and *what will break if you ignore it*.

## What this is

A local-first Angular PWA for **neurodivergent users** where goals grow as a tree. Missed deadlines are never failures — they become **branch points** that sprout alternative paths. Live at `https://toydrum.github.io/RodeMap2U/`, deployed from `main` via GitHub Actions → GitHub Pages.

## Product rules (NON-NEGOTIABLE — these override any technical preference)

1. **Compass language, never action-demands.** Every question in the UI must: (1) locate — "estás aquí"; (2) soothe — "respira, partamos de aquí"; (3) frame the place as fertile; only then show paths, phrased as first-person statements ("Sigo aquí, a mi ritmo"), never commands. "¿Qué quieres hacer?" is banned.
2. **No shame mechanics.** No streaks, no "overdue/atrasado", no red alarm colors, no counters of ignored prompts. A passed date opens a gentle conversation with dignified exits. There is NO "failed" state — the `branched` status is earned through transformation and cannot be hand-picked in the UI.
3. **Nothing is deleted by accident.** User-facing "delete" = archive (`archivedAt`, recoverable). Permanent deletion exists ONLY inside Settings→Archive, requires confirmation, and **auto-downloads a full backup before executing** (`BackupService.download`), then writes sync tombstones (`deletedAt`) — records are never physically removed. **Every archive/dismiss toast offers Undo** (`common.undo`, duration `UNDO_MS` from `toast.service.ts`); action toasts auto-expire unless `sticky: true` (the SW update offer is the only sticky one). Undo actions must **re-read the live record and re-stamp** (`unarchiveMany`/`revive`/`restore` patterns) — never re-save a captured pre-action record; its stale `rev` loses cross-tab LWW.
4. **Predictability.** All decorative randomness is **deterministic** from stable ids via `hash()` (`tree-layout.ts`). A user's tree/forest must NEVER reshuffle between sessions. If you add visual variety, derive it from ids, not `Math.random()`.
5. **Motion is opt-out-able, always.** Every animation must respect `MotionService.reduced()` (combines `prefers-reduced-motion` with the user setting; global `.reduce-motion` CSS class is the backstop). Lightning/rain are photosensitivity-sensitive: flashes are small, slow (≥4s apart), low-contrast, and fully removed under reduced motion.
6. **Everything bilingual.** All copy lives in `core/i18n/es.ts` (source of truth) and `en.ts` (`const EN: Dict` — the compiler enforces parity). Never hardcode user-facing strings in templates; never index dictionaries with dynamic string keys (kills the type guarantee). **Counts pluralize via `i18n.plural(count, dict.section.key)`** where the key is a `{ one, many }` sentence pair — whole-sentence pairs, never word-splicing, so Spanish gender/order works.
7. **Privacy: local-first, zero backend.** No accounts, no cloud, no analytics. Do not add network calls. Notifications exist ONLY as the opt-in **whispers** (`core/accompaniment.service.ts`): orientation QUESTIONS ("¿dónde sientes que estás?") that land on the check-in — **they may ask how you are; they may never tell you what to do**. No task names in the QUESTION, no counts of missed anything, silent (no sound/vibration), waking hours only (9–21), never during a session, never within 3h of a check-in, varying interval (fixed pings go blind; rhythm 'surprise' = deterministic pseudo-random 1.5–6h gaps). **Beat two**: ~45s after the question (answered or let go), ONE tiny low-energy offer — the first LEAF in the ranked pool — with a 2-minute start action; one shot, dismissible, never repeated, dropped silently if a session already exists or 10 min passed. Off by default; the toggle is the permission gesture. Technical floor: they live only while the app is open somewhere (no push backend) — never promise more.
8. **Every modal sheet uses `shared/ui/sheet.directive.ts` (`appSheet`)** — it provides Escape-to-close (topmost of the stack only), initial focus (`[autofocus]` else host), a minimal Tab trap, and focus restoration to the opener. New sheets MUST wire `appSheet (sheetClose)="…same close expr…"` plus the usual backdrop click-close.
9. **The check-in gate diverts once per app-open** (`SessionGate` in `app.routes.ts`) and it guards **`/ahora`** (home), not the forest: the first Ahora visit may redirect to the ritual (cooldown respected); later tab taps never do, and the forest NEVER diverts. **The ritual is TWO screens flat** (`feeling → destination`, plus a one-time `welcome` step when `!onboarded`): the optional notita folds into the feeling screen as an expander (never its own screen again), and the destination screen merges the branch shortcuts (the 4 freshest live branches) with the tree ring and "Solo mirar el bosque". A branch tap records the check-in WITH `nodeId` (the 📍 moves inside `CheckinsRepo.record`); ring/forest taps record without one; skip, back and express record exactly what they always did. **Passed-date reviews never interrupt the ritual** — Ahora's 🍂 banner and the tree-view banner are their only homes. Express/skip exits land on `/ahora`; explicit destinations keep their word. The wind rose is the manual re-entry — don't reintroduce per-navigation gating, and don't rename it: the poetic labels are loved; when a flow confuses, restructure the flow. The ring interleaves two radii past 9 trees (deterministic formula in `check-in.ts`; `--ring-count` feeds pill sizing).
10. **Focus sessions live in `core/focus-session.service.ts`**, not in the timer page: cross-route, adopts the open IndexedDB session row on reload, one-time 🌸 cue at planned time (toast + tab-title suffix), never auto-ends, never alarms. The timer page is a thin view over it.
11. **Ahora is home + the ONE-suggestion doctrine.** `''` and `**` redirect to `/ahora` — the companion surface: the thread ("Ibas aquí", reconstruction done FOR the user) + exactly ONE suggested pasito, never a list. The suggestion is always explainable (kind → reason line), always overridable ("Otra idea" walks a deterministic day-stable cycle — `hash(today())` permutation, offset 0 always the ranked best), pool capped at 12, and NEVER suggests `resting` (paused on purpose), `achieved`, `branched`, or anything in archived trees. It never schedules the user's day and never counts refusals. The ranker is PURE (`features/ahora/suggest.ts`) — keep it free of Angular. Bucket order: **today's intentions** (≤3, `Settings.todayIntentions`, silently empty once the date moves on — no carryover, no history, no done/undone counts) → **when-then twigs** (`TreeNode.trigger`: the user's own if-then plan, free text NEVER parsed or scheduled — re-presenting it in Ahora/check-in IS the mechanism; alarms stay banned) → pasitos-of-thread → thread → 7-day momentum → fresh growing → seeds. `trigger` is an ADDITIVE optional field (SCHEMA_VERSION 2): old records lack it (`undefined ≡ null`), old backups import cleanly, no migration pass exists or is needed for it.
12. **Accompaniment doctrine.** Accompaniment exists at exactly four moments: **returning** (the thread card), **during** (the companion bird + the warm-ring bridge + the traveling perch), **right after** (momentum toasts at session-finish "Un pasito más" and step-bloom "¿Otro pasito?"), and the **whisper rhythm** (rule 7: opt-in orientation questions → check-in; in-app toast when visible, silent notification when backgrounded). Momentum offers ride the single toast slot: dismissible, auto-expiring, never stacked, never re-pushed. The SW is `sw.js` (importScripts-wraps `ngsw-worker.js` + handles whisper `notificationclick`) — registration path must stay relative.
13. **Companion bird constraints** (`features/timer/companion-bird.ts`): CSS-only animation with deterministic phase (`hash(sessionId)`), slow non-harmonic cycles (4s/6s/47s), poses are class swaps, ONE gentle hop max at overtime, fully static-but-present under `.reduce-motion`, renders ONLY while a session runs (no idle surveillance), never displays numbers or judgments, no sounds ever. The approach bridge (last 2 planned minutes) warms the ring toward gold — never red — and turns the bird; visual only. **The traveling perch** (`.session-perch` in `app.html`): during a live session the bird + elapsed time float above the tab bar on EVERY route except `/timer` and `/ahora` (which hold their own bird); tapping it returns to the session. The bird must never appear without a live session — presence means "your session is alive and I'm with you".

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
    ahora/      ahora.ts (HOME: thread card + ONE suggested pasito + session companion card) · suggest.ts (PURE ranker + thread resolver)
    check-in/   check-in.ts (ritual: weather → where → note → [date-review] → CIRCLE of trees) · date-review.ts
    forest/     forest.ts (meadow scene) · mini-tree.ts (real data miniatures) · tree-view.ts · tree-canvas.ts
                tree-layout.ts (PURE: layout, ribbons, hash) · scene-backdrop.ts (sky/mountains/mood weather)
                flora.ts (accent→flower species) · flower.ts (g[appFlower] SVG component)
    node-detail/ node-detail.ts (sheet) · branch-flow.ts (transformation + suggestion chips)
    timer/      timer.ts (thin view over FocusSessionService) · companion-bird.ts (single-player body double)
    settings/ · guide/ (in-app manual) · trail/ ("Tus huellas": check-ins + branch notes + sleeping branches, deep-links via /tree/:id?node=)
  shared/ui/  toast.service.ts
```

### Data model semantics (`core/db/schema.ts`)

- Every record extends `SyncBase { id (uuid), createdAt, updatedAt, rev, deletedAt }`. `rev`+`updatedAt` pre-commit to last-writer-wins sync (v2 Supabase would plug into `RecordsRepo.applyExternal()` — the same hook BroadcastChannel uses today).
- `archivedAt` (user-facing, recoverable) ≠ `deletedAt` (sync tombstone, permanent). Queries filter tombstones in exactly one place (`RecordsRepo.all`).
- **Gentle dates are date-only strings** `'YYYY-MM-DD'`, compared lexicographically against local `today()` (`core/time.ts`). **NEVER** `new Date('YYYY-MM-DD')` — it parses UTC and shifts a day.
- Branch-on-miss is **structural and atomic** (`NodesRepo.branch` → one `putMany` transaction): parent → status `branched` (keeps its original `targetDate` as history), children born with `origin: 'branch'` (rendered with golden tint + knot). The tree shape IS the history; there is no event log.
- **`NodesRepo.revertBranch` is the only exit from `branched`** — undo of an unrooted transformation, atomic: parent lands `growing` + dateless by default (a preserved past `targetDate` must NOT re-arm date-review; the toast-undo in `branch-flow.ts` restores the exact prior record on purpose), untouched `origin:'branch'` children leave as sync tombstones (archived nodes are invisible in every UI — tombstoning is the honest shape). The quiet affordance in node-detail is gated on ALL branch children being untouched (`revertable` computed). `branched` still cannot be hand-picked.
- Passed-date predicate: `targetDate < today() && status not in (achieved, branched)`. All three review exits (keep-going clears the date / move / branch) end the predicate. Reviews live in Ahora's 🍂 banner and the tree-view banner ONLY (the check-in ritual never surfaces them since 0.0.39); archived trees' dates are excluded.
- **`TreeNode.flow` (SCHEMA_VERSION 3, additive like `trigger`)**: `'steps'` marks a branch whose pasitos are an ORDERED path; absent ≡ `'free'`. Never forced — the "¿Van en orden?" toggle lives in the node sheet. Steps are REAL child nodes (order asc = the sequence); `NodesRepo.moveStep` is the app's only node reorder (adjacent order swap, atomic). The ranker needs no restructuring: order-asc `childrenOf` already surfaces the earliest open step; it just carries kind `'step-in-order'` (reason "El siguiente paso de…", first→then footer on the Ahora card).
- `Settings.lastCheckInAt` drives a 30-min cooldown on the check-in gate (route guard in `app.routes.ts`).
- Migrations: `DB_VERSION` (IndexedDB structure, `onupgradeneeded`) is separate from `SCHEMA_VERSION` (data shape, pipeline after open; import reuses it).
- Storage resilience: `openDb()` rejects after 3s and every repo degrades to **memory-only session** — a broken IndexedDB must never blank the app.

### Rendering system

- `tree-layout.ts` is **pure and unit-testable**: leaf-slot layered layout (root bottom, growth up), deterministic jitter, `taperedRibbon()` (sampled bezier + perpendicular offsets = filled tapered timber; NOT stroked paths), `edgeGeometry(parent, child, bowScale)` — miniatures pass `bowScale≈scale` or absolute bows read as seaweed. The bezier bow rides each limb's PERPENDICULAR (damped on shallow limbs) — vertical limbs render exactly as always; never revert to x-only offsets (they S-warped wide fans).
- **Crowded canopies**: ≥4 siblings stagger across two sub-rows with a "vase" lift (outer limbs sweep upward), ≥6 compress leaf slots ×0.85, and parents center on the **leaf-mass centroid** of jitter-free child positions. The demo trees (max 3 siblings) render identical by construction — they are the golden look; tune crowded shapes without touching them.
- **Ordered-steps chains** (`flow: 'steps'`): the siblings render as ONE climbing limb of short `CHAIN_H = 46` segments — `layoutTree` rewrites the traversal (parent shows only step 1; each step carries the next via `LayoutPoint.chainNextId`), so wood/leaves/flowers/nearest-pick all reuse. Achieved segments bloom (the path fills with flowers). Labels: chain links stay quiet except the NEXT open step (+ focused/📍). `LayoutPoint.nominalY` anchors their labels (never assume `-depth·LEVEL_H`). The focused-node "+" bud shifts diagonal on steps parents (straight-up lands exactly on link 1).
- **Canvas taps resolve at the SVG level to the NEAREST node center** (`onCanvasClick` in `tree-canvas.ts`): per-node `.hit` discs are cosmetic hover zones only and must never outgrow the slot spacing. Never reintroduce per-node click handlers — stacked transparent discs used to swallow neighbors' taps. The `plant-bud`/`note-mark` win on direct hit (`stopPropagation` + an explicit target guard).
- **Framing**: `fitTree()` frames the WHOLE tree once per tree id (zoom floor 0.5; when even that overflows, it keeps 0.5, biases to the 📍 and `fitsWhole=false` unlocks mouse-pan). Planting pans the newborn into view; status flips and renames must never move the camera (the fit effect is id-keyed on purpose).
- Wood color: bark→moss mix by depth; `origin:'branch'` limbs lean golden (`--status-branched`).
- **Flora species**: `flora.ts` maps the tree's accent → flower shape (petal5/daisy/bell/star) + palette. Rendered by `g[appFlower]` everywhere (canvas glyphs, branch blossoms, minis, trunk-base flowers, meadow flowers). One tree = one species, botanically consistent.
- Weather is split in two layers: `SceneBackdrop` (BEHIND the scenery: clouds, lightning, sky mist banks, fog-seam, mountain dissolve) and `WeatherFront` (OVER the scenery, pointer-transparent: the rain itself and the fog's ground veil). Rain/fog must never end at the landscape's edge — that hard line is why the split exists. Both take the same `mood` input (latest check-in feeling); `?mood=` query override for demos.
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
- **Version tag**: pre-launch semver in `core/version.ts` — `'0.0.N · <date> — <release name>'`, bumped on every notable deploy (rendered twice in Settings).
- **Pages flake playbook** (encountered repeatedly): `deploy-pages` fails with "Deployment failed, try again later" while status is operational. Reruns reuse the deployment id (= commit SHA) and keep failing — **push a fresh (empty) commit instead**. If no run appears after a push at all (dropped webhook), `workflow_dispatch` the workflow. Deep links returning HTTP 404 with the app body is expected Pages SPA behavior, not a bug.

## Deliberately NOT built (do not "fix" these)

- No event-log store, no merge-import, no dirty/sync flags (v2 sync concerns).
- No priority fields (executive-function tax for this audience).
- No push notifications, streaks, or usage nudges. The former "stale-branch nudge" deferral was resolved in v32 as the **pull-based** `/trail` "Ramas dormidas" section (30 days, dateless seed/growing LEAVES only, `resting` exempt, no day counters, renders only when non-empty) — do not convert it into a push notification or a forest-side badge.

## Docs to keep in sync when features change

`docs/manual-usuario.md` (source of the Word handout — regenerate with `pandoc docs/manual-usuario.md -o Manual_RodeMap2U.docx --toc --toc-depth=2`) and the in-app guide dictionaries (`guide` section in `es.ts`/`en.ts`).
