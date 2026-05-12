---
title: 'Out of Scope: WP-EXTRAS-RETIRE'
product: study
feature: wp-handbooks-extras-retire
type: out-of-scope
status: unread
---

# Out of Scope: WP-EXTRAS-RETIRE

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                             | Status       | Trigger to revisit                                                        |
| ------------------------------------------------ | ------------ | ------------------------------------------------------------------------- |
| Full retirement of the `handbooks-extras` corpus | Follow-on WP | When `body_override` is ported to the chapter-aware section-tree pipeline |

## Full retirement of the `handbooks-extras` corpus

Status: Follow-on WP

What was deferred to a follow-on WP:
Full retirement of the `handbooks-extras` corpus -- deleting
`libs/sources/src/handbooks-extras/`, the `handbooks-extras.yaml`
config, the `handbooks-extras-overrides/` directory, the
`scripts/sources/register/handbooks-extras.ts` sub-command, the
`libs/bc/study/src/seeders/whole-doc.ts` seeder, the
`kind: 'whole-doc'` discriminator on `manifest-validation.ts`, and
the `body_override` field in the schema. This WP slimmed
handbooks-extras to a single entry (`mtn-tips`) but did not
delete the corpus.

Why:
Per the spec's "Outcome (2026-05-03)" note: retiring the whole corpus
would require porting `body_override` plus the section-tree parser
to the chapter-aware pipeline for one document (mtn-tips). mtn-tips
is unique -- a scanned 1999 pamphlet with unusable OCR and
hand-curated `body_override` markdown. The chapter-aware pipeline
doesn't support `body_override` today. The two options for full
retirement were (a) port `body_override` to chapter-aware (real work,
one consumer) or (b) delete mtn-tips (rejected -- it's a useful
pilot-training pamphlet). Slim-not-retire was the chosen ROI call.

Trigger to spawn:
When `body_override` is ported to the chapter-aware section-tree
pipeline -- either as part of a broader source-pipeline cleanup, or
as a targeted WP authored against this deferral. The signal is a PR
that lands `body_override` support in the chapter-aware path; at
that point, migrate mtn-tips to `handbooks/` and execute Phases 2-5
of this WP's plan.

Implementation pattern when spawned:
Follow Phases 2-5 in [spec.md](./spec.md):

- Phase 2: `git rm -rf` the directories listed in the spec's "What
  to delete -> Code" section; update the dispatcher and
  `manifest-validation.ts`.
- Phase 3: delete configs and tests.
- Phase 4: update REFERENCES.md, CLAUDE.md, ingestion-pipeline docs;
  archive `docs/work-packages/handbooks-extras-ingestion/` and
  `docs/work-packages/handbooks-extras-yaml-metadata/` to
  `docs/.archive/`.
- Phase 5: verify (`bun run check`, `bun test`, reseed + library
  count comparison).

Pre-conditions before spawning:

- Audit for any other consumer of `kind: 'whole-doc'` shape (per
  spec §"Risks"). If a non-mtn-tips consumer exists, decide whether
  to keep the schema discriminator under a renamed corpus or fold
  them into chapter-aware too.
- Confirm no citations exist with `airboss-ref:handbooks-extras/...`
  prefix (per spec §"Risks"); ADR 019 should never have allowed it,
  but any survivors must be fixed before retirement.

References:

- [spec.md](./spec.md) §"Outcome (2026-05-03)" (the slim-not-retire decision)
- [spec.md](./spec.md) §"What to delete" (full retirement payload)
- [spec.md](./spec.md) §"Phases" (Phases 2-5)
- [spec.md](./spec.md) §"Risks" (pre-conditions)
- PR #540 (the slim pass)
- `feedback_no_legacy_in_airboss.md` (the retire-on-sight rule)
