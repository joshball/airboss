---
title: 'Walkthrough -- e2e isolation + figure-pairing manual gate (2026-05-06)'
date: 2026-05-06
status: pending
walker: user
captured-by: agent
covers:
  - PR #643 (e2e port + DB isolation)
  - PR #646 (e2e regression repair)
  - PR #651 (hangar setup serialize)
  - PR #652 (figure-pairing WP)
  - PR #660 (figure-pairing implementation)
---

# Walkthrough -- e2e isolation + figure-pairing manual gate

Manual verification for the work-package shipped in PRs #643, #646, #651, #652, #660. The automated regression-test harness (`test_orphan_thresholds.py`) and the playwright e2e suite catch the structural cases. This walkthrough is the eyes-on-content gate per `CLAUDE.md`: "Nothing merges without a manual test plan. User tests every feature by hand before it ships."

The PR body of #660 left two manual checkboxes unchecked. This doc closes them, plus exercises the e2e isolation infra one more time.

## Setup

```bash
# 1. Start the dev servers (any cwd in the repo)
bun run dev --bg
bun run dev status

# 2. Confirm hangar / study / flightbag are reachable on the canonical ports
#    (NOT the e2e ports -- this is the dev surface, not the test surface)
open https://study.airboss.test
open https://hangar.airboss.test
open https://flightbag.airboss.test
```

If anything fails to come up, check `bun run dev log <app>`. If a port is stuck, `bun run dev kill && bun run dev --bg`.

## Section 1: figure-pairing -- IFH §2.5 strict assertion (success criterion #3)

This is the load-bearing case. The IFH §2.5 e2e assertion was relaxed during the e2e-isolation cleanup; PR #660 restored the strict shape. The page should render Figure 2-5 inline with the body text.

### Steps

1. Navigate to: <https://flightbag.airboss.test/handbook/ifh/FAA-H-8083-15B/02-the-air-traffic-control-system/05-mode-c-altitude-reporting>
2. Scroll to the body text that introduces Figure 2-5 ("A phonetic pronunciation guide has been developed..." or similar -- the section is short).
3. Confirm: Figure 2-5 ("Phonetic pronunciation guide") renders inline as an image, not as a broken / missing-asset placeholder.
4. Right-click the image -> "Open image in new tab" -> confirm a real PNG loads (not a 404).

### Pass criteria

- Image visible and recognizable (a phonetic alphabet table -- Alpha / Bravo / Charlie ... / Zulu).
- No `[Figure 2-5]` text fragment visible in the body where the image should sit.
- Image alt text reads "Figure 2-5" or "Phonetic pronunciation guide" (whichever the renderer authored).

### Fail mode

If the figure is missing or shows a broken-image icon: the regenerated handbook tree didn't include the asset OR the renderer URL is wrong. Capture the network 404 URL in the bug entry below.

### Bugs

(empty -- fill during walk)

## Section 2: figure-pairing -- multi-figure section pages (PR #660 manual item 1)

Three handbook section pages with multiple figures. Each must render every prose `Figure N-N` reference with its corresponding image. The selection samples three different ingestion sources: AvWX (high `figure-without-caption` count pre-fix; ML for cross-section dict), IPH (departures = lots of route diagrams), risk-management (smaller corpus).

### Page A -- AvWX chapter 11 (Air Masses, Fronts, and the Wave Cyclone Model)

URL: <https://flightbag.airboss.test/handbook/avwx/FAA-H-8083-28B/11-air-masses-fronts-and-the-wave-cyclone-model/00-air-masses-fronts-and-the-wave-cyclone-model>

Expected: 14 figures inline. Walk top-to-bottom; for each `Figure 11-N` mention in prose, confirm the matching image renders. Look for misalignment (wrong image attached to a caption number).

### Page B -- IPH chapter 1 (Departure Procedures)

URL: <https://flightbag.airboss.test/handbook/iph/FAA-H-8083-16B/01-departure-procedures/00-departure-procedures>

Expected: 21 figures inline. This is the densest figure page in the fleet. Watch especially for the route / airway diagrams in the middle of the chapter -- those are the cross-section overlap cases the doc-wide image dictionary fixed.

### Page C -- Risk Management chapter 3 (Identifying Hazards and Associated Risks)

URL: <https://flightbag.airboss.test/handbook/risk-management/FAA-H-8083-2A/03-identifying-hazards-associated-risks/00-identifying-hazards-associated-risks>

Expected: 10 figures inline. Smaller handbook with a different layout style; confirms the regex / floor changes don't regress on lighter material.

### Pass criteria (all three pages)

- Every `Figure N-N` mention in prose has a corresponding image rendered.
- No image appears under the wrong caption number (caption-rescoping correctness).
- No broken-image icons.
- Image-to-prose vertical alignment looks reasonable (this is reader-rendering, separate from ingest, but worth a sanity glance).

### Bugs

(empty)

## Section 3: figure-pairing -- Tier 4 page-region rasterizer (PR #660 manual item 2)

PHAK chapter 11 (Aircraft Performance) is the canonical Tier 4 case. Performance charts (density-altitude graphs, takeoff-distance curves) are vector-only in the source PDF, so the embedded-raster extractor in tiers 1-3 misses them. The Tier 4 rasterizer clips the page region between consecutive captions and renders the result as a PNG.

### Steps

1. Navigate to: <https://flightbag.airboss.test/handbook/phak/FAA-H-8083-25C/11-aircraft-performance/00-aircraft-performance>
2. Scroll the entire chapter overview (7 figures expected).
3. Look specifically for performance-curve and density-altitude diagrams. These are the Tier 4 rescue path.
4. Right-click a chart figure -> "Open image in new tab" -> confirm it renders as a clean rasterization (text legible, lines visible). Tier 4 rasterizes at a sensible DPI; if the output looks blurry / pixelated, the DPI setting needs tuning.
5. Pick one section under chapter 11 with a figure (e.g. <https://flightbag.airboss.test/handbook/phak/FAA-H-8083-25C/11-aircraft-performance/05-pressure-altitude>). Confirm the in-section figure renders.

### Pass criteria

- Performance charts render inline with body text.
- Chart figures are legible (text inside the chart is readable; lines are crisp).
- No "Figure N-N." prose mentions in the chapter overview without a corresponding image.
- A spot-checked section page renders its figure(s) correctly.

### Fail mode

If a Tier 4 figure renders but text inside it is unreadable: rasterization DPI too low. Capture the figure URL and the source PDF page reference. If the figure is entirely missing: Tier 4 may not be triggering for this page; check the section's `warnings.json` entry and report the mode classification.

### Bugs

(empty)

## Section 4: e2e isolation infra (PRs #643, #646, #651) -- background sanity

This isn't a click-through test; it's a one-shot run of the e2e suite to confirm the isolation infra still holds.

```bash
# In a fresh terminal, with no dev server running on the e2e ports:
lsof -ti tcp:9603,9613,9623,9633,9643 | xargs -r kill -9
bun run test e2e
```

### Pass criteria

- The suite provisions `airboss_e2e` (you'll see "[e2e] provisioning..." log line).
- Vite spins up on 9603 / 9623 / 9643 (study, hangar, flightbag e2e ports).
- The dev DB (`airboss`) is untouched after the run -- spot-check by signing in as Abby in the regular dev study app and confirming her plan / sessions / reviews are intact.
- The hangar review-queue setup task (the one we serialized in #651) passes -- look for `seed hangar review items` line in the test list output, no timeout.

### Known failures (not my work; documented for context)

- ~24 specs in the `hangar-review-queue` project still fail with `500 Internal Error`. These are pre-existing app bugs from PR #638 that shipped without the suite ever being run end-to-end. Not in scope of any PR shipped this session. Tracked separately. **OK to see these red; do not investigate during this walkthrough.**

### Bugs

(empty)

## Section 5: residual orphans -- diagnostic, not a gate

After-action evidence. Not a pass / fail; just a "do these counts still match what the WP promised" check.

```bash
# Run from repo root:
for f in handbooks/*/*/warnings.json; do
  c=$(jq -r '[.warnings[] | select(.code == "caption-without-figure")] | length' "$f" 2>/dev/null)
  if [ "$c" != "" ] && [ "$c" -gt 0 ]; then echo "$c  $f"; fi
done | sort -rn
```

Expected output (current state, post-PR-660):

```text
13  handbooks/phak/FAA-H-8083-25C/warnings.json
 5  handbooks/iph/FAA-H-8083-16B/warnings.json
 2  handbooks/ifh/FAA-H-8083-15B/warnings.json
 1  handbooks/avwx/FAA-H-8083-28B/warnings.json
```

Total: 21 (vs. spec target of <=200). If the count grew between merge and your walk, something else regressed the ingest pipeline -- worth flagging.

### Notes for the next ingest WP

The 21 residuals split cleanly:

- **15 mode `image-extracted-elsewhere`** -- real captions whose paired image got claimed by an earlier section's pass. The image exists on disk; it's filed under the wrong section. A "secondary attachment" pass that reuses an already-claimed image when its caption number matches resolves all 15.
- **6 mode `image-filtered-by-floor`** -- small inset diagrams under the 32px floor. Lowering the floor to 16 risks decorative-glyph leakage; per-handbook tuning is the safer path.

Recommended follow-up: WP `handbook-figure-pairing-residuals`, two phases. Target: under 5 fleet-wide. Not blocking.

## Outcome

Walk complete: ☐
Date walked: ____
Walker: ____
Decision (close / file follow-ups / block on regression): ____
