---
title: 'Test Plan: Handbook Figure-Caption Pairing'
product: flightbag
feature: handbook-figure-pairing
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Handbook Figure-Caption Pairing

How we verify each phase of the figure-pairing WP. Three layers: per-handbook orphan budgets (the durable guardrail), spot-check fidelity (caught real captions, didn't add noise), and the user-facing reader spec (the success criterion that ties the work to the product).

## Layer 1: orphan-budget regression test

Lives at `tools/handbook-ingest/tests/test_orphan_thresholds.py`. Runs in `bun run check` (or its python sibling). Locks in the per-handbook orphan rate so future ingest changes can't silently regress.

```python
ORPHAN_BUDGET = {
    "ifh":                  {"caption_without_figure": <N>, "figure_without_caption": <M>},
    "aviation-instructor":  {...},
    "phak":                 {...},
    "afh":                  {...},
    "iph":                  {...},
    "avwx":                 {...},
    "risk-management":      {...},
}
```

`<N>` and `<M>` get tightened at the end of each phase. Initial budgets = today's counts (so the test passes on main pre-fix). Final budgets = what the spec promises (total <= 200 caption orphans, <= 100 image orphans).

**Pass criterion:** every handbook is at or under its budget after re-extraction.

**Failure mode:** any handbook over budget fails the build. CI gate prevents merging an ingest change that regresses the rate.

## Layer 2: spot-check fidelity (per-phase)

Per-phase manual sampling against the actual PDFs to confirm the heuristic change did the right thing on real content, not just the right thing on aggregate counts.

### After phase 2 (regex fix)

Pick 20 IFH orphan captions from today's `warnings.json`. Re-run extraction. For each:

- If the caption was a sentence-internal reference like "shown in Figure 7-22.": it must NOT appear in the new warnings.json (the regex now skips it).
- If the caption was a real header like "Figure 1-19. Descent rate table.": the new pipeline must EITHER pair it with an image OR leave it as a real warning. It must NOT silently disappear (would mean the regex went too strict).

Repeat for 20 AvWX orphans (different layout style; AvWX has the highest unpaired-image count, so it's the canary for "did we drop real captions on the floor").

### After phase 3 (cross-section dict)

Pick 20 AvWX orphan captions from the post-phase-2 warnings.json. Re-run extraction. Most should now pair (they were the cross-section overlap victims). Open the source PDF for any that still don't pair; the residual should be either Mode C (small image) candidates (defer to phase 4) or genuine PDF-extraction casualties (small enough to leave for the long tail).

Verify `figure-without-caption` count drops in lockstep — same root cause; if those don't drop, the fix is wrong.

### After phase 4 (image floor)

Pick 20 small-image candidates (32-63px width or height) that newly enter the figure set. For each: open the page in the source PDF, confirm it's a legitimate figure (symbol legend, inset diagram), not a decorative inline icon (callout glyph, page-number ornament). If more than 2/20 are false positives, the proximity allowlist needs tightening before merging the floor change.

## Layer 3: reader spec restoration (success criterion)

Lives at [tests/e2e/flightbag/reader.spec.ts](../../../tests/e2e/flightbag/reader.spec.ts). The IFH §2.5 figure test was relaxed during the e2e-isolation cleanup with a TODO comment. Restoring it is item 3 in the spec's success criteria.

Remove the TODO. Restore the strict assertion shape:

```typescript
const figure = page.locator('figure[data-figure="2-5"]');
await expect(figure).toBeVisible();
await expect(figure.locator('img')).toBeVisible();
```

(Or whatever the canonical figure-rendering selector is in the reader; verify against the rendered DOM at the time of the fix.) Run:

```bash
bunx playwright test tests/e2e/flightbag/reader.spec.ts --project=flightbag
```

Expect green. If red because the IFH re-extraction still doesn't recover Figure 2-5 specifically, that single figure is a Mode C / Mode B residual that may need a manual override (see spec's Design alternatives). Document the override in the WP and ship.

## Cross-cutting: re-ingest correctness

Phase 6 re-ingests the entire handbook fleet from a clean cache. Verification of the regenerated trees:

- `bun run check` passes (catches markdown / wikilink / frontmatter regressions surfaced by the new figure tree).
- `bunx playwright test --project=flightbag` passes (catches any reader-rendering regressions from the figure path / asset name changes).
- `git diff --stat handbooks/` shows roughly: same number of `.md` files, image counts trending up (we recovered figures), warnings.json line counts trending down (we recovered captions).

A figure-asset filename collision check: the dedup pass writes one file per canonical SHA-256, so the new tree should not have orphan PNG files that aren't referenced in any markdown. Add to the re-ingest verification:

```bash
# every .png referenced in markdown exists on disk
grep -roh 'figures/[^)]*\.png' handbooks/ | sort -u > /tmp/referenced.txt
find handbooks -name '*.png' -path '*/figures/*' | sed 's|.*/figures/|figures/|' | sort -u > /tmp/actual.txt
diff /tmp/referenced.txt /tmp/actual.txt
```

Empty diff = no orphan asset files, no missing assets.

## Manual sanity (the user gate)

Per `CLAUDE.md`: "Nothing merges without a manual test plan. User tests every feature by hand before it ships."

For this WP the manual gate is:

1. Open `https://study.airboss.test/flightbag/handbook/ifh/FAA-H-8083-15B/02-the-air-traffic-control-system/05-mode-c-altitude-reporting` (or the post-fix equivalent route). Confirm Figure 2-5 renders inline.
2. Open three more handbook section pages (one per handbook from PHAK, AFH, AvWX -- pick any section with multiple figures). Confirm every "Figure N-N" body-text reference has a corresponding rendered figure on the page.
3. Open one handbook section page in PHAK that previously had a `caption-without-figure` warning. Confirm the figure now renders.
