# Manual QA for PRs merged in the 2026-04-22 session

Every PR below was gate-green (`bun run check` + `bun run test`) but never manually tested on the dev server. Project CLAUDE.md says "Nothing merges without a manual test plan. User tests every feature by hand before it ships." That rule was consistently bent this session because of the volume.

Prerequisites for smoke testing: local Postgres on port 5435 (OrbStack), `.env` populated, `bun run dev`.

## Design system + primitives

- [ ] **#22 dual-theme design system** — visit `/dashboard` and any route page; confirm TUI theme on dashboard (monospace, tight, 2px corners, full-bleed) and web theme everywhere else (reading column, rounded).
- [ ] **#27 dashboard panels on @ab/ui PanelShell** — all 9 dashboard panels render; gated panels (CertProgress, Map) show dashed border.
- [ ] **#28 ConfidenceSlider tokens + skip refinement** — start a review with a confidence prompt; confirm the slider reads correctly in web theme and the skip link reads as a quiet escape hatch (not peer to the 1-5 buttons).
- [ ] **#29 app.html :root tokens** — view-source on `/login` with JS disabled; body paints with token colors from first paint.

## Nav + identity

- [ ] **#23 nav identity + sign-out** — identity anchor visible in top-right; click → menu shows email + sign out; click sign out → logged out; below 640px width, label collapses to initials.

## Session substrate (ADR 012 — 7 PRs)

- [ ] **#33 preset gallery** — sign in with no active plan, hit any rep CTA → lands on `/session/start` gallery with 6 tiles; click "Quick reps" → plan created, session starts. (This was the #51 cert-agnostic fix; verify it no longer 500s.)
- [ ] **#38 BC refactor** — submit a rep attempt; `session_item_result` row written; dashboard, calibration, knowledge mastery all render.
- [ ] **#39 /reps/session redirect** — type `/reps/session` in the URL bar → 308 redirect to `/session/start`.
- [ ] **#41 schema drop** — `rep_attempt` table does not exist in the DB (`\dt study.rep_attempt` in psql → no relation).
- [ ] **#42 runner delete** — no file at `apps/study/src/routes/(app)/reps/session/`; the 308 is now a 404 for bookmarks.
- [ ] **#51 Skip-permanently + topic semantics** — start a session, click "Skip permanently" on a card → card status = SUSPENDED in browse; click "Skip topic" → card's domain appears in `plan.skipDomains`.
- [ ] **#52 Skip-topic UI** — confirm three skip buttons render in the session runner skip row (Today / Topic / Permanently). ConfirmAction reveals for Topic + Permanently. Skip-hint mentions both reactivatable kinds.

## UX (4 PRs)

- [ ] **#25 create/edit feedback convention** — `/memory/new` save → redirect with banner; `/memory/[id]` edit → stay-on-page toast; `/memory/browse` with filters shows chips.
- [ ] **#26 diagnostic→action CTAs** — `/calibration` with buckets that have ≥5% gap → "Practice level N" buttons; session summary shows clickable Suggested Next actions.
- [ ] **#49 UX residuals + a11y focus** — Archive card: Tab → Enter → focus lands on Confirm; Escape returns to trigger. Rating undo: rate, click Undo within 2.5s → card returns to queue top. Knowledge `/learn`: visit phases, leave, return → resumes at last phase with chip state. Stat tiles clickable on reps + memory dashboards. Sim app shows loading state while worker boots.
- [ ] **#57 UX tail** — browse pagination shows "Showing X–Y of T"; preset tile expands via `<details>` to show preview before commit; `/plans/new` shows live preview aside updating as form changes; calibration button label reads "Strengthen at this level"; `/reps/new` Cancel goes back via browser history; session summary Skipped tile lays out readably; `/knowledge?domain=X&other=Y` Reset preserves `other`.

## Correctness + backend + schema + perf

- [ ] **#51 (composite fix PR)** — empty certGoals creates plans without 500; dashboard cert panels render "No cert goal set" for cert-agnostic plans; UNIQUE(session_id, slot_index) — double-submit same slot → one row in session_item_result; session runner won't mutate slots on completed sessions; `/sessions/[id]/summary` is read-only (no writes from load); `/knowledge` browse loads fast (N+1 fixed).
- [ ] **#50 patterns/tokens/honest/architecture** — `/dashboard` still TUI, routes still web; grep for `\bhonest\b` in shipped code is clean of agent-voice uses; `@ab/bc-sim` resolves.
- [ ] **#55 BC semantic minors** — session summary still renders correctly after count-query batching; add-skip-domain is atomic (no partial state on concurrent calls); logout logs non-2xx auth errors instead of swallowing.
- [ ] **#56 schema + perf** — fresh env needs `bun scripts/db/apply-sql.ts scripts/db/apply-schema-perf-2026-04-22.sql` before `bun run db push` (pg_trgm + CHECK rewrites); after that `db push` reports no changes; memory/browse ILIKE search is fast (trigram-backed).
- [ ] **#59 security + arch + a11y + sim** — response headers include `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`; session cookies are SameSite=strict; `renderMarkdown` sites (knowledge detail, learn phases) still render correctly under CSP; skip a fake nodeId via plan.skipNodes → errors cleanly (validation added); calibration buckets show ✓/↑/↓ icons in addition to color; StatTile without href renders as `<article>`, with href as `<a>`; sim status lanes visually distinct (connecting/flying/paused/ok/fail).

## Known-accepted residuals (not QA, FYI)

- 5 pre-existing warnings in `libs/activities/crosswind-component/CrosswindComponent.svelte` (state_referenced_locally + a11y) — predate this session.
- 11 pre-existing knowledge-graph dry-run warnings (unresolved node references in course content) — authoring gap, not code.
- Sim instrument SVGs hardcode hex (Phase 0 prototype, documented as accepted in `apps/sim/README.md`).

## Follow-up perf PR (next)

There's a follow-up PR in flight (`perf/bc-read-path-followups`) for the 8 BC-read-path items flagged in PR #56's body (fetchCardCandidates, getStreakDays bound, loadSlot index-backed helper, getRepBacklog collapse, shared mastery map, shared loadPoints, getRepDashboard single scan). When that lands, the manual-QA items #56 and `/knowledge` browse perf may benefit from a re-smoke.
