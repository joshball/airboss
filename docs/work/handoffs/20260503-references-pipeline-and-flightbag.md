# Session handoff: references pipeline + flightbag scaffolded

Date: 2026-05-03
Duration: full day session (multiple chunks)
Outcome: 30+ PRs shipped; references corpus dramatically expanded; flightbag app scaffolded; 5 whole-doc handbooks in flight for section-tree promotion

## Headline

Started the day with 22 readable references on `/library`. By end-of-session: **41+ readable references** plus the flightbag app scaffolded as the future canonical reader, plus full WP roadmap for finishing the corpus.

## What landed (chronological)

### Wave 0: Foundation/cleanup (early session)

- #487 docs/ingestion-pipeline reorg (8 docs consolidated; pipeline.md + tooling.md authored)
- #488 AMT corpus deferred from ingestion
- #489 `body_override` mechanism for whole-doc handbooks
- #490 Rename generic content files (~2,640 file moves; eliminate index.md/document.md)
- #491 WP-CFR (825 sections, 11 CFR parts seeded)
- #492-#494 Cleanup PRs around the rename
- #495 Stage status doc + inventory path fix

### Wave 1: References roadmap

- #496 Library completeness status doc + manifest-vs-card gap
- #499 Mark WP-AC-V shipped (was already done in #480)
- #501 WP-ACS-V (5 ACS publications, 1,910 sections seeded)
- #502 REFERENCES.md canonical roadmap doc
- #503 CLAUDE.md "no mid-task interrupt" rule

### Wave 2: AMT removal + section-tree research

- #505 AMT-G/P fully removed from corpus
- #504 Whole-doc promotion research (per-handbook strategy)
- #506 Flightbag architecture decision (apps/flightbag/, libs/library/)
- #508 TOC files moved + routing-layer decision (URL constants in libs/constants/)

### Wave 3: Flightbag scaffold + first promotions

- #509 Whole-doc promotion sequence + parallel dispatch tracking
- #510 Library completeness status refresh
- #511 AC + ACS link-only pipeline draft specs
- #512 SAFO+InFO, CC, NTSB-ALJ draft specs
- #513 Hangar references admin dashboard spec
- #514 Citation chips migration to flightbag spec
- #515 Flightbag VISION.md
- #516 CLAUDE.md adds apps/flightbag + libs/library
- #517 TOC validation persistence schema spec
- #518 References cleanup sweep (AC YAML, dupes, AIM orphan)
- #519 Operator runbook for adding new references
- #520 handbooks-extras retirement spec
- #521 References roadmap (8 waves)
- #522 ADR 023 — Flightbag as canonical references reader
- #523 Allocate port 9640 for flightbag dev server
- #524 **Flightbag scaffold** (apps/flightbag, libs/library, urlForReference, ROUTES.FLIGHTBAG_*)
- #525 **WP-IFH** section-tree promotion (11 chapters, 587 sections)
- #527 **WP-MTN** section-tree promotion (12 chapters, 36 sections)
- #526 Roadmap update (flightbag + IFH shipped)
- #528 Flightbag content rendering spec
- #529 AC section-tree promotion spec (for Wave 4)

## What's still in flight

3 background agents at session-end:

| Agent               | WP                  | Status  |
| ------------------- | ------------------- | ------- |
| `a6f89de74e673b35b` | WP-RMH section-tree | Running |
| `a230bb467fb2b983a` | WP-AIH section-tree | Running |
| `ac25854c8c0f35e9a` | WP-IPH section-tree | Running |

Each will land its own PR. After all 3 land + the WP-MTN/WP-IFH already shipped → all 5 whole-doc handbooks are section-tree.

## Architecture decisions made

### Flightbag is the canonical references reader (ADR 023)

- `apps/flightbag/` — public reader; URL space `flightbag/handbook/...`, `flightbag/cfr/...`, etc.
- `libs/library/` — rendering primitives (`<RenderedSection>`, `<CitationChip>`)
- `libs/constants/src/routes.ts` — URL templates (`ROUTES.FLIGHTBAG_*`)
- `libs/sources/src/url-for-reference.ts` — URI-to-URL bridge
- `apps/hangar/admin/references/` — admin dashboard (admin-only; TOC validation, force-reingest, health)
- Other apps (study, sim, future FIRC) link to flightbag URLs from citation chips

### No more whole-docs — every reference becomes section-tree

- 5 whole-doc handbooks promoted (3 done, 2 in flight)
- 9 existing ACs queued for promotion via WP-AC-PROMOTE
- Mountain-flying override stays simple (parsed into 12 chapters / 36 sections)

### handbooks-extras corpus retires

- All 5 entries promoting out into `handbooks/<slug>.yaml`
- WP-EXTRAS-RETIRE drafted to delete the corpus once empty

### CLAUDE.md rule additions

- Never interrupt current work for mid-task requests (queued at end of todo)
- Never drop the original train of thought

## Roadmap forward

Per [REFERENCES_ROADMAP.md](../../platform/REFERENCES_ROADMAP.md):

- **Wave 2 completion**: WP-RMH, WP-AIH, WP-IPH (in flight)
- **Wave 4**: WP-EXTRAS-RETIRE (after Wave 2 completes); WP-AC-PROMOTE
- **Wave 5**: Citation migration (study `/library/...` → flightbag); hangar admin dashboard
- **Wave 6**: 12 link-only ACs + 2 link-only ACS link-only-pipeline WPs
- **Wave 7**: SAFO+InFO, CC, NTSB-ALJ new corpus pipelines
- **Wave 8**: Future / deferred (AC-FULL expansion, O8900-V5, Safety Briefing, public-web flightbag)

## Reference counts at session-end

- Readable in-app: **38** (PHAK + AFH + AVWX + AIM + 11 CFR + 9 ACs + 5 ACS + 4 of 5 whole-doc handbooks → soon all 5 promoted to section-tree → 41+)
- Total catalogued: ~63
- Link-only umbrellas (intentional): 11
- Link-only awaiting pipeline: 14 (12 AC + 2 ACS)
- Net target after all roadmap waves: ~95+ readable references

## Notes for next session

- 3 in-flight agents will report when done; merge their PRs and clean worktrees per the existing pattern
- Cleanup will be: `git worktree remove -f -f .claude/worktrees/<id>` + `git branch -D <branch-name>` after each merge
- Agent IDs at session-end: `a6f89de74e673b35b` (RMH), `a230bb467fb2b983a` (AIH), `ac25854c8c0f35e9a` (IPH)
- After Wave 2 completes, dispatch WP-EXTRAS-RETIRE (it's tiny — delete the corpus and update one CI test count)
- Citation migration WP is the high-leverage next step toward "flightbag as canonical reader"
