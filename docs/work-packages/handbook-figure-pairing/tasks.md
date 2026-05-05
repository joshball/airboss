---
title: 'Tasks: Handbook Figure-Caption Pairing'
product: flightbag
feature: handbook-figure-pairing
type: tasks
status: unread
review_status: pending
---

# Tasks: Handbook Figure-Caption Pairing

Sequenced build plan for the figure-pairing fix. Each phase is independently shippable; later phases depend on earlier ones for evidence (orphan-rate measurement) but not for code.

## Phase 0: measurement baseline

Establish the today-numbers in a reproducible script. The spec quotes 1,435 / 347; verify exactly with code so phase-2 onward has a deterministic reference.

- [ ] `tools/handbook-ingest/bin/orphan-report.py`: walk every `handbooks/*/*/warnings.json`, count `caption-without-figure` and `figure-without-caption` per handbook, print a markdown table.
- [ ] Commit the current-state output as `docs/work-packages/handbook-figure-pairing/baseline.md` so the post-fix delta is visible without rerunning the script.

## Phase 1: regression-test harness (Fix 5)

Land the budget-assertion test before the heuristic fixes so the fix-vs-budget loop is tight.

- [ ] `tools/handbook-ingest/tests/test_orphan_thresholds.py`: per-handbook `assert orphan_count <= ORPHAN_BUDGET[handbook]`. Initial budgets set to today's counts (so the test passes on main pre-fix); each subsequent phase tightens the budget.
- [ ] Wire into the python test runner the ingest pipeline already uses. If there isn't one, run `pytest tools/handbook-ingest/tests/` from the existing `bun run check` orchestrator (`scripts/check.ts`).
- [ ] Confirm the test passes on main.

## Phase 2: stricter caption regex (Fix 1, addresses Mode A)

The biggest single win. Removes sentence-reference false positives.

- [ ] [tools/handbook-ingest/ingest/figures.py:58](../../../tools/handbook-ingest/ingest/figures.py#L58): change `figure_pattern` default to `r"^Figure (\d+)-(\d+)\.\s+[A-Z]"`.
- [ ] Apply the regex with `re.MULTILINE` flag in `_find_captions_on_page`.
- [ ] Re-extract one handbook (start with IFH; smallest figure count of the high-orphan books). Measure orphan delta. Expect a 60-80% drop in `caption-without-figure`.
- [ ] If the drop is in range and `figure-without-caption` did not rise: re-extract the remaining six handbooks.
- [ ] Tighten `ORPHAN_BUDGET` per handbook to the new measured counts. Test still green.

## Phase 3: cross-section image dictionary (Fix 2, addresses Mode B)

The structural fix that closes the bulk of the residual orphans.

- [ ] Refactor [figures.py:97-122](../../../tools/handbook-ingest/ingest/figures.py#L97-L122): build `images_by_page` once at the document level inside `extract_figures`. Pass the dict (and the shared `used_image_keys` set) into `_extract_for_node`.
- [ ] Defer PNG extraction: store `_ImageLoc` with `xref` instead of raw `png_bytes`; resolve to bytes only when the pairing pass picks a winner. (Per the Risks section, keeps memory bounded for 500-page books.)
- [ ] Re-extract all seven handbooks. Measure delta. Expect another 30-50% drop in `caption-without-figure` AND a sharp drop in `figure-without-caption`.
- [ ] Tighten `ORPHAN_BUDGET` again.

## Phase 4: smaller image floor with proximity allowlist (Fix 3, addresses Mode C)

Long-tail rescue for small symbol-legend figures.

- [ ] [figures.py:262-263](../../../tools/handbook-ingest/ingest/figures.py#L262-L263): lower `64` to `32`.
- [ ] Add an "is small but near a caption" check in `_pair_caption_with_image`'s Tier 1 path. If a same-page candidate image is between `32x32` and `64x64` AND its vertical distance to a caption is < ~50 pdf-units, keep it; otherwise filter it out.
- [ ] Re-extract. Confirm `figure-without-caption` did not balloon. Tighten budgets one last time.

## Phase 5: triage-friendly warning messages (Fix 4)

Annotate residual warnings with their detected mode so future ingest tuning is fast.

- [ ] In `_extract_for_node`, classify each unpaired caption: `in-sentence-reference` (regex match was mid-sentence after fixes 1 fail), `image-extracted-elsewhere` (would have paired against a `_ImageLoc` that exists in another section's range — only relevant if Fix 2 left edge cases), `image-filtered-by-floor` (image exists at the right page/position but width/height < 32).
- [ ] Extend `FigureWarning.message` to include `-> mode: <mode-name>`.
- [ ] Sample 10 messages per mode after re-extraction; spot-check that the classification matches reality.

## Phase 6: restore strict assertion + sweep

- [ ] [tests/e2e/flightbag/reader.spec.ts](../../../tests/e2e/flightbag/reader.spec.ts) IFH §2.5 figure test: remove the TODO, restore the strict `expect(figure).toBeVisible()` assertion. Run the spec to confirm it passes against the freshly-ingested IFH tree.
- [ ] Re-ingest the entire handbook fleet from a clean cache (`bun run sources ingest --all` or equivalent) and commit the regenerated trees in one PR. This is the data refresh step the spec's Risks section flagged.
- [ ] Update `docs/work-packages/handbook-figure-pairing/baseline.md` with the post-fix numbers so the WP record reflects what shipped.

## Phase 7: doc + close

- [ ] Update [docs/work-packages/handbook-ingestion-and-reader/spec.md](../handbook-ingestion-and-reader/spec.md) to cross-reference this WP from the figure-pairing section.
- [ ] Update this WP's status to `done` and `review_status` per the project rules in `CLAUDE.md`.
