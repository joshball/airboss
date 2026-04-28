# Relevance cache rebuild -- live write report (Gate A)

Generated: 2026-04-28T03:06:39Z

## Summary

- Run mode: live (no `--dry-run`)
- Syllabi processed: 1 (PPL ACS Area V)
- Leaves scanned: 28
- Links scanned: 12
- Knowledge nodes affected: 7
- Diffs vs prior cache: 7 (every node was previously empty; entries are
  all additive)

This live write follows the dry-run manifest from PR #264
(`docs/work/build-reports/relevance-rebuild-2026-04-28T01-13-29-810Z.md`).
Counts match the dry-run exactly (7 nodes, 28 leaves, 12 links).

## Idempotency check

Re-running `bun scripts/db/build-relevance-cache.ts` immediately after
the live write reports `0 diffs vs current cache`. Cache is the source
of truth.

## Affected nodes

- `aero-coordination-rudder`
- `aero-load-factor-and-bank-angle`
- `aero-four-forces`
- `aero-angle-of-attack-and-stall`
- `proc-stall-recovery`
- `perf-crosswind-component`
- `proc-traffic-pattern`

Each node now carries one entry per cert in `{atp, cfi, cfii, commercial,
instrument, mei, meii, private}`. The `private` entries match the
examiner-priority rule from `examinerPriority` in
`scripts/db/build-relevance-cache.ts`; everything else is inherited at
`standard` priority.

## Cross-references

- Gate A as defined in `docs/work-packages/cert-syllabus-and-goal-composer/tasks.md` Phase 18.
- Dry-run manifest reviewed in PR #264.
- Resolves the live-write step of WP cert-syllabus PR 4.
