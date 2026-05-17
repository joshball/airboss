# Manual test walkthrough -- test suite + validator fixes (2026-05-13)

Covers PR #939, #941, and (pending) #943. Budget: ~10-15 minutes for the first two, plus ~5 minutes for #943 once it lands.

## Setup

```bash
cd /Users/joshua/src/_me/aviation/airboss
git checkout main
git pull --ff-only
bun install
```

Confirm you're on the right commits:

```bash
git log --oneline -5
# Should show #941 and #939 near the top
```

---

## PR #939 -- test suite green

### What it changed

- [vitest.config.ts](../../../vitest.config.ts) -- added `@ab/audit/server` alias
- [apps/hangar/.../bucket-actions.test.ts](../../../apps/hangar/src/routes/(app)/review/admin/buckets/bucket-actions.test.ts) -- moved `auditWrite` mock to the right barrel
- [apps/hangar/.../loader-actions.test.ts](../../../apps/hangar/src/routes/(app)/review/admin/loader/loader-actions.test.ts) -- same fix
- 6 pages got `data-testid="page-anchor"` (courses/[slug]/[stepCode], dev/palette index + 3 variants, notes/[id])

### Test 1 -- Full suite passes

```bash
bun run test 2>&1 | tail -5
```

**Pass criteria:** `Test Files  558+ passed`, `Tests  6800+ passed | 38 skipped`. Zero failures. (The 38 skips are advisory contrast pairs; PR #943 closes those.)

### Test 2 -- Page-anchor static guard catches new pages

```bash
bun run vitest --run apps/study/src/lib/server/page-anchor-guard.test.ts 2>&1 | tail -5
```

**Pass criteria:** 2 tests passed, 0 failed. Static guard now walks every `(app)/+page.svelte` and finds the anchor on each.

### Test 3 -- Anchors actually render in the browser

```bash
bun run dev
```

Open these 6 pages and inspect the page header:

| Route                                 | Where to find the anchor                   |
| ------------------------------------- | ------------------------------------------ |
| `/courses/<any-slug>/<any-step-code>` | The step title `<h1>` at the top           |
| `/dev/palette`                        | "Palette visual variants" `<h1>`           |
| `/dev/palette/list`                   | "Variant A -- Linear-style sectioned list" |
| `/dev/palette/raycast`                | "Variant B -- narrow column..."            |
| `/dev/palette/wide`                   | "Variant C -- wide 4-column grid..."       |
| `/notes/<any-note-id>`                | Visually-hidden `<h1>` (inspect DOM)       |

**Pass criteria:** Open devtools, run in the console:

```javascript
document.querySelector('[data-testid="page-anchor"]')
```

Should return a non-null element on every one of those routes. The notes page returns a `visually-hidden` h1 -- that's intentional (it had no header before; the test plan requires every `(app)` page to surface the anchor).

### Test 4 -- Hangar bucket admin actions work end-to-end (the real fix)

This is the user-facing surface the broken tests were guarding. Sign in as Abby in the hangar app.

Navigate to `/review/admin/buckets`. Then:

1. Click **New bucket**. Fill name + kind. Save.
   - **Pass criteria:** Redirects back to the buckets list. New bucket appears.
2. Edit the bucket you just created. Change the name. Save.
   - **Pass criteria:** Redirects back to list with updated name.
3. Try creating a bucket with the same name as the first.
   - **Pass criteria:** Inline error "name already exists" (PG 23505 unique violation handled).
4. Delete the bucket.
   - **Pass criteria:** Redirects back, bucket gone.

All four flows write audit-log rows; the test fixes ensured the `auditWrite` mock was hooking the right module. If any flow returns 500 in the URL bar instead of the redirect, **report it** -- that's the original bug not actually fixed.

### Test 5 -- Loader admin runs ingest

Navigate to `/review/admin/loader`. Click **Run loader**.

**Pass criteria:** Result counts appear at top of page. No 500. Audit row written.

---

## PR #941 -- validator warnings cleared

### What it changed

- TBD wiki-link `[[discovery-first pedagogy::]]` replaced with plain prose in 2 help-content files
- 5 orphan help pages mounted via `<PageHelp pageId="...">` on their respective routes:

| Help page           | Route                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `goals`             | [/program/goals](../../../apps/study/src/routes/(app)/program/goals/+page.svelte)                 |
| `library`           | [flightbag landing](../../../apps/flightbag/src/routes/+page.svelte)                              |
| `invite-accept`     | [/invite/[token]](../../../apps/study/src/routes/invite/[token]/+page.svelte)                     |
| `users-invitations` | [hangar /users/invitations](../../../apps/hangar/src/routes/(app)/users/invitations/+page.svelte) |
| `users-detail`      | [hangar /users/[id]](../../../apps/hangar/src/routes/(app)/users/[id]/+page.svelte)               |

### Test 1 -- Validator is clean

```bash
bun scripts/references/validate.ts
```

**Pass criteria:** Last line reads `references: 0 errors, 0 warning(s); scanned NNN content location(s), 0 wiki-link(s); ...`. The `0 warning(s)` and `0 wiki-link(s)` numbers are the load-bearing ones.

### Test 2 -- `bun run dev` boot is quiet

```bash
bun run dev 2>&1 | head -30
```

Watch for the `validate` line near the top. Expected:

```text
references: 0 errors, 0 warning(s); ...
```

Pre-#941 you would have seen `2 warning(s)`. Now zero.

### Test 3 -- Each help chicklet renders and opens the right page

Navigate to each route below and click the `?` / `Help` chicklet. Drawer opens with the right help content:

| Route                                | Drawer title                         |
| ------------------------------------ | ------------------------------------ |
| `/program/goals` (study)             | "Goals" -- goals primitive explainer |
| `/` (flightbag landing)              | "Library" -- library overview        |
| `/invite/<any-token>` (study, guest) | "Accept invite" / invite-accept help |
| `/users/invitations` (hangar)        | "User invitations"                   |
| `/users/<some-user-id>` (hangar)     | "User detail"                        |

**Pass criteria for each:** chicklet visible in the page header (or `.badges` area for hangar users-detail). Click opens drawer. Content matches the page subject. No console errors.

### Test 4 -- Knowledge-graph help page no longer has TBD link

```bash
grep -rn "::\]\]" apps/study/src/lib/help/content/
```

**Pass criteria:** No output. Pre-#941 there were 2 hits with `[[discovery-first pedagogy::]]`.

---

## PR #943 -- 38 advisory contrast skips (pending)

> **Status:** agent dispatched in background, not yet merged. Section drops in once the PR lands.

When it lands:

### What it changed (placeholder)

- Tightened `edge.default` in every theme (light + dark appearances) to hit 3:1 against `surface.{page,panel}`
- Introduced `signal.{success,warning,danger,info}.deepInk` tokens (or renamed `.ink` if no non-wash consumers existed)
- Migrated text-on-wash call-sites to the new `.deepInk` variant
- Updated `ADVISORY_PAIRS` in `contrast-matrix.test.ts` to reference the new tokens

### Test 1 -- Contrast matrix has zero skips

```bash
bun run vitest --run libs/themes/__tests__/contrast-matrix.test.ts 2>&1 | grep -E "Tests +[0-9]"
```

**Pass criteria:** `Tests N passed (N)` -- no `| M skipped` segment. Was `38 skipped`; should be `0`.

```bash
bun run test 2>&1 | grep -E "Tests +[0-9]"
```

**Pass criteria:** `Tests 6840+ passed` (was 6837 + 38 skipped). Total tests run up by 38; skipped count drops to 0.

### Test 2 -- Borders look subtle, not harsh

Spot-check border treatment in every theme. Walk these pages in both light and dark:

- Study home (`/`)
- Memory dashboard (`/memory`)
- Reps (`/reps`)
- Goals (`/program/goals`)
- Library landing (`/library`)
- Any `<Card>`-heavy admin page (hangar `/sources`)

**Pass criteria:** Borders are visible against page + panel surfaces (you can tell where one card ends and the next begins) but read as "subtle line," not "hard rule." If borders look aggressive or thick, that's a regression -- the agent over-tightened.

### Test 3 -- Signal callouts still look like signal colors

Find signal banners/chips/alerts in the app. Examples:

- A success toast after saving anything (try saving a card edit)
- A warning chip in a reps result
- A danger alert (delete confirm dialogs)
- An info callout (any `:::note` rendered help section)

**Pass criteria:** Each retains its semantic color identity (green/yellow/red/blue). The text on the wash background is readable but the color family is still recognizable -- "darker green on light green," not "black on light green." If a signal looks gray or muddy, that's a regression.

### Test 4 -- `bun run check dirty` clean

```bash
bun run check dirty
```

**Pass criteria:** All steps green. Specifically theme-lint, biome, svelte-check.

---

## Sign-off checklist

- [ ] All 5 PR #939 tests pass
- [ ] All 4 PR #941 tests pass
- [ ] (Once #943 lands) all 4 PR #943 tests pass
- [ ] No console errors on any page walked
- [ ] No regressions surfaced

If anything fails, capture: which URL, which test #, console output. File via `bun run bug new <slug>` or just report back.
