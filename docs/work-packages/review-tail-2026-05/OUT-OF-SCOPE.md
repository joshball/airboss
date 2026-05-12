---
title: 'Out of Scope: Review Tail 2026-05'
product: platform
feature: review-tail-2026-05
type: out-of-scope
status: unread
---

# Out of Scope: Review Tail 2026-05

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

The items below were enumerated in [spec.md](./spec.md) §"Tier 3 -- surgical
majors and deferred-with-trigger items" with named triggers. Each is a
deferred cluster carried forward from the 6-chunk 2026-05 review program;
the WP closes when Tier 1 + Tier 2 land, while Tier 3 / Tier 4 ride along
with their containing PRs.

## Summary

| Item                                                     | Status   | Trigger to revisit                                                    |
| -------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| chunk-2 schema cleanup migration                         | Deferred | Next schema-touch PR -- bundle three column changes into one regen    |
| chunk-2 knowledge-node updater audit column              | Deferred | When the `knowledge_node_version` deferred work activates             |
| chunk-3 carries (21 items)                               | Deferred | Each item has its own trigger documented in the chunk-3 INDEX         |
| chunk-5 carries (8 deferred + 17 dropped-with-rationale) | Deferred | Documented in PR #568; revisit per-item triggers in the chunk-5 INDEX |
| chunk-6 carries (10 deferred)                            | Deferred | Documented in PR #565; revisit per-item triggers in the chunk-6 INDEX |

## chunk-2 schema cleanup migration

Status: Deferred

What was deferred:
Three minor schema-cleanup changes bundled for a single regen of
`drizzle/0000_initial.sql`:

- `lifecycle` column notNull tightening on the relevant table
- Drop the `references_v2_migrated` flag column
- Drop the deprecated `cert_goals` column

Why:
Each on its own is a one-line schema edit, but airboss has no migrations;
every schema change regenerates `0000_initial.sql` and triggers a reseed.
Bundling the three avoids three reseed cycles. Per the project rule that
schema cleanup is one step with no phases, the cluster waits for the
next schema-touch PR in the affected area so the work amortizes.

Trigger to revisit:
The next schema-touch PR that modifies any of `lifecycle`,
`references_v2_migrated`, or `cert_goals` columns -- or the next
broader BC-study cleanup that already regenerates the schema and
reseeds. At that point, fold all three changes in.

Implementation pattern when triggered:
Edit `libs/bc/study/src/schema.ts` to tighten / drop the three columns,
regenerate `drizzle/0000_initial.sql`, run the standard reseed. One
step, no phases (per the no-migrations rule).

References:

- [spec.md](./spec.md) §"Tier 3" bullet 1
- `docs/work/reviews/2026-05-01-study-bc-domain-INDEX.md`

## chunk-2 knowledge-node updater audit column

Status: Deferred

What was deferred:
Adding an updater audit column (e.g. `updated_by`, `updated_by_actor_id`)
to the `knowledge_node` table. Today the table records the row state but
not the actor who last mutated it.

Why:
The audit column is tied to the deferred `knowledge_node_version`
work -- the version table will host the per-revision actor field and
the live table either denormalises the latest one or joins through.
Adding the column to the live table before the version table lands
would lock the shape and require a follow-up migration when the
version table arrives.

Trigger to revisit:
When the `knowledge_node_version` deferred work activates -- i.e. when
there is a concrete decision to ship the version table (either because
knowledge-node edit conflict resolution becomes a need, or because the
audit log surfaces "who edited node X" requests).

Implementation pattern when triggered:
Land the `knowledge_node_version` table alongside, with the actor
columns on the version table. Decide at that point whether the live
table denormalises the latest actor or joins through.

References:

- [spec.md](./spec.md) §"Tier 3" bullet 2
- `docs/work/reviews/2026-05-01-study-bc-domain-INDEX.md`

## chunk-3 carries (21 items)

Status: Deferred

What was deferred:
21 items from chunk-3 (auth-identity audit) carried forward with named
triggers per the chunk-3 INDEX:

- sim/avionics auth surface (5 items)
- proxy-trust validation (2 items)
- plugin-cookie churn (2 items)
- `auditColumns` placement (2 items)
- 10 operational polish items

Why:
Each item has a concrete trigger in the chunk-3 INDEX. They are not
gated on a single carrier; they are independent operational items
each with its own activation condition. Bundling them into one WP
would force serial close-out when most can land independently.

Trigger to revisit:
Each item's own trigger as documented in
`docs/work/reviews/2026-05-01-auth-identity-audit-INDEX.md`. The chunk-3
INDEX is the source of truth; this WP does not re-host them.

Implementation pattern when triggered:
Per-item -- the chunk-3 INDEX documents the file path, the fix shape,
and the test plan for each item.

References:

- [spec.md](./spec.md) §"Tier 3" bullet 3
- `docs/work/reviews/2026-05-01-auth-identity-audit-INDEX.md`

## chunk-5 carries (8 deferred + 17 dropped-with-rationale)

Status: Deferred

What was deferred:
8 deferred items from chunk-5 (UI / library / themes) with per-item
triggers; plus 17 items dropped with rationale (not "rejected" in the
OUT-OF-SCOPE sense because the chunk-5 close-out documented the
rationale at decision time -- they are noted here so a future reader
sees the full count).

Why:
Per PR #568, chunk-5 closed by triaging every finding into shipped /
deferred-with-trigger / dropped-with-rationale. The deferred items
carry forward with their named triggers, not because they're blocked
on a single carrier but because each waits for a concrete activation
condition.

Trigger to revisit:
Each item's own trigger as documented in
`docs/work/reviews/2026-05-02-ui-library-themes-INDEX.md` and the
chunk-5 close-out PR (#568).

Implementation pattern when triggered:
Per-item -- the chunk-5 INDEX is the source of truth.

References:

- [spec.md](./spec.md) §"Tier 3" bullet 4
- `docs/work/reviews/2026-05-02-ui-library-themes-INDEX.md`
- PR #568

## chunk-6 carries (10 deferred)

Status: Deferred

What was deferred:
10 items from chunk-6 (hangar cluster) carried forward, including
REPO_ROOT consolidation, 9 schema partial-index migrations, and
cosmetic items.

Why:
Per PR #565, chunk-6 closed with these 10 items deferred with named
triggers. The partial-index migrations group into the next hangar
schema-touch PR (same logic as chunk-2 schema cleanup -- amortize
one regen). REPO_ROOT consolidation waits for a touch on the
top-level path helpers.

Trigger to revisit:
Each item's own trigger as documented in
`docs/work/reviews/2026-05-02-hangar-cluster-INDEX.md` and the chunk-6
close-out PR (#565). The partial-index cluster activates with the next
hangar schema-touch PR; REPO_ROOT consolidation activates when path
helpers are next refactored.

Implementation pattern when triggered:
Per-item -- the chunk-6 INDEX is the source of truth. For the
partial-index cluster, regenerate `drizzle/0000_initial.sql` once with
all nine changes (no migrations rule).

References:

- [spec.md](./spec.md) §"Tier 3" bullet 5
- `docs/work/reviews/2026-05-02-hangar-cluster-INDEX.md`
- PR #565
