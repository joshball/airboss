---
title: 'Review: cert-syllabus-and-goal-composer (perf)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: perf
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 2
---

# Review: cert-syllabus performance

## Minor (2)

### perf1 -- `getCredentialMastery.ancestorAreaId` does O(leaves * nodes) scans

See correctness review m1. The `nodes.find((n) => n.id === cur)` in `libs/bc/study/src/credentials.ts:382-391` runs once per ancestor per leaf. For a 600-leaf ACS that's 1800 scans of a 700-node array (~1.3M comparisons). At full PPL/IR/CPL sizes the per-fetch cost is sub-millisecond, but a 2000-leaf cert (CFI) would be visible.

**Fix:** materialise `nodesById = new Map(nodes.map((n) => [n.id, n]))` once before the inner loop. One-line change.

### perf2 -- `acsLens` and `domainLens` re-fetch `getNodeMasteryMap` per call

`libs/bc/study/src/lenses.ts:124-133` (`fetchNodeMastery`) does a fresh DB round-trip per lens render. The cert dashboard surface will likely render multiple lenses on the same goal in one page-load (ACS lens + Domain lens + future Handbook lens).

**Fix (deferred):** when the cert dashboard page lands (follow-on WP), wire a per-request mastery cache so all lenses on one render share a single fetch. Not actionable this WP; capture as a follow-on input.

**Resolution:** Drop. The cert dashboard is a follow-on WP; it will own this optimisation.

## Notes

- The N+1 patterns in the seed pipeline (`seed-credentials.ts:172-208`, `seed-syllabi.ts:N`) are deliberate -- one `INSERT ... ON CONFLICT DO UPDATE` per row. For ~50 credentials and ~600 syllabus nodes, the seed runs in <1s. Bulk insert would micro-optimise but trade off line-by-line idempotency. Leave as-is.
- `getCredentialMastery` does ONE round-trip for nodes + ONE for links + ONE for mastery -- three queries, not three-per-leaf. Good fan-out structure.
- The GIN indexes on `regulatory_basis`, `citations`, plus the `(syllabus_id, parent_id, ordinal)` btree on `syllabus_node_tree_idx` are well-chosen for the documented query shapes.
- The relevance cache rebuild (`build-relevance-cache.ts`) iterates syllabi serially; for 1-3 syllabi (today's scope) that's fine.
- The migrate-study-plans-to-goals migration is per-plan transactional -- N transactions for N plans. Acceptable for the Abby + dev-seed scale; would benefit from batching if production ever grows to hundreds of users.
