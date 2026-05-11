# wp-flightbag-reader-ux -- tasks

Phase-by-phase build order. Each task is one PR-sized chunk unless noted.

## Phase 1: chrome consolidation

- [ ] **`<ReaderEmptyState>`**: ship in `libs/library/`, props `kind` / `localPdfHref` / `externalUrl` / `note`. Vitest visual snapshots for each kind. Ship as PR-1.
- [ ] **Hoist `<HeartbeatTicker>`**: move to `<ReaderLayout>`. Make `sectionId` optional on the layout. Ship in PR-1.
- [ ] **Migrate handbook landing** to `<ReaderLayout>`. Replace inline `.page-header` block. Use `<ReaderEmptyState>` for empty case. Ship as PR-2.
- [ ] **Migrate handbook chapter** to `<ReaderLayout>`. Drop hand-rolled grid CSS. Ship in PR-2.
- [ ] **Migrate AIM landing + chapter + section + paragraph** (4 pages). Each one: replace hand-rolled header with `<ReaderLayout>` snippets, use `<ReaderEmptyState>` for empty cases. Ship as PR-3.
- [ ] **Migrate CFR landing + section** (2 pages). Same pattern. The eCFR callout becomes `<ReaderEmptyState kind="not-yet-ingested" externalUrl={ecfrUrl} note="...">`. Ship as PR-3.
- [ ] **Migrate AC landing + chapter + section** (3 pages). Same pattern. Ship as PR-4.
- [ ] **Migrate catalog `+page.svelte`** to use `<ReaderLayout>` (no TOC). Extract `<ReferenceCard>` + `<SubjectChip>` to `libs/library/`. Ship as PR-4.
- [ ] **Single SourceLinks placement**: move all SourceLinks calls into `<ReaderLayout>`'s `sourceLinks` snippet. Remove from `<RenderedSection>` breadcrumb snippets. Ship in PR-4.
- [ ] **Single Breadcrumbs placement**: same. Ship in PR-4.

## Phase 2: study `/library/*` cutover

- [ ] **301 handlers**: write `+server.ts` redirect handlers for each `/library/*` route in study, resolving the latest edition server-side for handbook routes. Ship as PR-5.
- [ ] **Delete duplicate pages**: remove `apps/study/src/routes/(app)/library/<route>/+page.svelte` and `+page.server.ts` for every route that has a flightbag equivalent. Leave the `+server.ts` redirects. Ship in PR-5.
- [ ] **Internal link migration**: grep `apps/study/src` for `ROUTES.LIBRARY_*` callers. Each call site flips to `ROUTES.FLIGHTBAG_*`. Add `@deprecated` JSDoc on `LIBRARY_*` constants. Ship in PR-5.
- [ ] **Study app nav**: "References" item points at `ROUTES.FLIGHTBAG_HOME` (cross-app). Ship in PR-5.
- [ ] **e2e smoke**: hit `/library/handbook/phak` -> 301 -> `/handbook/phak/<latest-edition>`. Hit `/library/handbook/phak/chapter/4` -> 301 -> equivalent. Ship in PR-5.

## Phase 3: reader pref tokens + control

- [ ] **Constants**: ship `libs/constants/src/reading.ts` with all the value sets and defaults. Update `libs/constants/src/study-home.ts` to add `READING_*` keys to `USER_PREF_KEYS`. Update `USER_PREF_KEY_VALUES`. Ship as PR-6.
- [ ] **USER_PREF_SCHEMAS**: add Zod schemas for each new key in `libs/bc/study/src/user-prefs.ts`. Ship in PR-6.
- [ ] **Server endpoint**: ship `apps/flightbag/src/routes/reading-prefs/+server.ts` and the mirror in `apps/study/src/routes/reading-prefs/+server.ts`. Both call `setUserPref`. Audit-log integration. Ship as PR-7.
- [ ] **`<ReadableScope>`**: ship in `libs/ui/components/`. Vitest test that the component sets the right CSS variables for each input combination. Ship as PR-7.
- [ ] **`<ReaderPrefsButton>`**: ship in `libs/library/`. Gear icon + popover with all controls. Optimistic-flip pattern from ThemePicker. Ship as PR-8.
- [ ] **Layout integration**: `apps/flightbag/src/routes/+layout.server.ts` loads the 5 prefs. `+layout.svelte` mounts `<ReadableScope>` around `<main>`. Same for `apps/study/src/routes/(app)/+layout.{svelte,server.ts}`. Ship as PR-8.
- [ ] **`<RenderedSection>` consumes `--reader-*`**: replace `var(--font-family-base)` / `var(--font-size-base)` / `var(--line-height-relaxed)` / `max-width: 72ch` with the new tokens (with global token fallbacks). Ship in PR-8.
- [ ] **`<TOCDrawer>` consumes `--reader-*`** (font-size + line-height only). Ship in PR-8.
- [ ] **`<ReaderPrefsButton>` mount points**: add to flightbag's `AppHeader` (next to ThemePicker) and to study's `AppHeader`. Ship in PR-8.
- [ ] **Default flip to serif**: `READING_FONT_FAMILY_DEFAULT = 'serif'` triggers a serif body. Verify against actual Georgia / ui-serif rendering. Ship in PR-8.
- [ ] **e2e smoke**: open prefs popover, change font scale, confirm body text size jumps; reload, confirm persisted. Ship in PR-8.

## Phase 4: overview view + persistent rail + transitions

- [ ] **`<TOCRender>`**: ship in `libs/library/` with three modes (`overview` / `rail` / `compact`). `<TOCDrawer>` becomes a thin wrapper for backward compat. Ship as PR-9.
- [ ] **`<ChapterTile>`**: per-chapter card for overview mode. Title, code, sub-section list (collapsed by default; click-to-expand), progress ring, reading-time, "Continue here" button when this chapter contains the user's last-read section. Ship in PR-9.
- [ ] **Shared layout for `/handbook/[slug]/[edition]/*`**: new `+layout.svelte` + `+layout.server.ts`. Mounts `<ReaderLayout>` once with `<TOCRender mode="rail">`. Children inject body. Ship as PR-10.
- [ ] **Reshape handbook landing**: `+page.svelte` body content becomes `<TOCRender mode="overview">`. Add "Resume reading at §X.Y" pinned line (loader queries `MAX(last_read_at)` for this user × this reference). Ship in PR-10.
- [ ] **View Transitions helper**: ship `libs/utils/src/view-transition.ts`. Wrap `goto` in TOC link clicks. Verify graceful fallback (Firefox / Safari). Ship as PR-11.
- [ ] **Keyboard shortcuts**: layout-level handler for `j` / `k` / `o` / `?`. Skip when input has focus. Lift `<KeyboardCheatsheet>` from sim into `libs/ui/`. Ship in PR-11.
- [ ] **TOC auto-scroll active entry**: `$effect` in `<TOCRender>` to `scrollIntoView({ block: 'nearest' })`. Ship in PR-11.
- [ ] **Mobile TOC auto-close on link click**: `onnavigate` from `$app/navigation` flips `mobileOpen = false`. Ship in PR-11.
- [ ] **End-of-doc footer**: `<ReaderNav variant="end-of-doc">` when `nav.next === null`. Includes progress summary + "Mark this whole chapter as read" + (placeholder) "Next handbook in syllabus." Ship in PR-11.
- [ ] **Same shared-layout pattern extended to AIM, CFR, ACS, AC**: each subtree gets a `+layout.svelte` + `+layout.server.ts` + reshape its landing into overview mode. Ship as PR-12.

## Verification gates per PR

- `bun run check all` clean.
- New tests pass.
- Browser-load smoke (Chrome at minimum) for any phase that changes the reader chrome.
- Visual regression check: load PHAK, AIM, CFR, ACS, AC in turn; confirm consistent chrome.
- WP frontmatter contract enforced.
