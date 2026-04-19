# 010: ID Strategy

Decided 2026-03-27.

## Context

All existing code uses raw `nanoid()` (21-char base-64 URL-safe strings) for every ID, with no typed prefixes, no structure, and no differentiation between a scenario run (FAA evidence record appearing in a URL) and a module (small bounded catalog item authored in hangar). Three problems emerged during Phase 2 design:

1. **Wasted entropy.** 21-char nanoid has 2^126 combinations. A module table that will never exceed 50 rows does not need this.
2. **No type context.** `V1StGXR8_Z5jdHi6B-myT` in a log, a URL, or a support ticket tells you nothing about what it identifies. FAA audit records need traceability.
3. **No slug support.** Learner-facing URLs like `/scenario/V1StGXR8_Z5jdHi6B-myT` are opaque. Human-readable slugs belong in URLs; synthetic IDs belong in the data model.
4. **Natural keys in URLs.** Slugs derived from content titles are not primary keys -- they are lookup columns. Using a slug as a PK couples the data model to a human-readable string that could theoretically change and corrupts every FK on rename.

## Decision

Two-tier ID system. All IDs are stored as `text` in the database.

### Tier A: Bounded catalog items (authored in hangar)

Used for: scenarios, modules, questions, micro-lessons, student models, releases, compliance records, platform boards/tasks.

Format: `{prefix}-{N}` where N is zero-padded decimal, uniform 3-digit width by default (4 digits for questions).

| Entity        | Prefix | Starting width | Example    |
| ------------- | ------ | -------------- | ---------- |
| scenario      | `scn`  | 3              | `scn-001`  |
| module        | `mod`  | 3              | `mod-001`  |
| question      | `qst`  | 4              | `qst-0001` |
| micro-lesson  | `ml`   | 3              | `ml-001`   |
| student model | `sm`   | 3              | `sm-001`   |
| release       | `rel`  | 3              | `rel-001`  |
| task          | `tsk`  | 4              | `tsk-0001` |

Width is extended by one digit when the range is exhausted (e.g., `scn-001` -> `scn-0001` at 1000). Because the DB column is `text`, this requires no migration -- only the generation logic changes.

Generation: a Postgres `SEQUENCE` object per entity type (`scn_seq`, `mod_seq`, etc.), called from the application via a `generateCatalogId(prefix, seq, digits)` helper. Sequences are atomic and concurrent-safe.

### Tier B: Event and FAA evidence records (generated at runtime)

Used for: scenario runs, evidence packets, score dimensions, enrollments, time log entries, lesson attempts, learner profiles, certificates.

Format: `{prefix}_{ulid_lowercase}` -- a 4-character type prefix, underscore, then a ULID in lowercase (26 chars). Total: 31 chars.

| Entity          | Prefix | Example                          |
| --------------- | ------ | -------------------------------- |
| scenario run    | `run`  | `run_01jvxyz4a3mn8p2q7wsrcnj5h3` |
| evidence packet | `pkt`  | `pkt_01jvxyz...`                 |
| score dimension | `sdm`  | `sdm_01jvxyz...`                 |
| enrollment      | `enr`  | `enr_01jvxyz...`                 |
| time log entry  | `tim`  | `tim_01jvxyz...`                 |
| lesson attempt  | `att`  | `att_01jvxyz...`                 |
| learner profile | `prf`  | `prf_01jvxyz...`                 |
| certificate     | `crt`  | `crt_01jvxyz...`                 |

ULID properties:

- 128-bit total (48-bit millisecond timestamp + 80-bit random)
- Sortable by creation time -- DB index performance for high-volume time-series tables (`time_log`, `score_dimension`) without a separate `created_at` index scan
- Crockford base-32 alphabet -- no ambiguous chars (`0`/`O`, `1`/`I`/`L`)
- ~3.4 × 10^38 unique IDs -- safe at any conceivable scale
- Lowercase prefix: consistent casing, URL-safe, easy to read aloud

The timestamp in the ULID is not a privacy concern for this system -- creation time is already stored explicitly in `started_at`, `completed_at`, etc.

### Slugs: lookup columns, not primary keys

Published content (scenarios, modules, micro-lessons) exposes human-readable slugs in learner-facing URLs:

```
/scenario/loc-base-to-final-approach   -- URL uses slug
published.scenario.id = 'scn-042'      -- DB PK is synthetic Tier A ID
published.scenario.slug = 'loc-base-to-final-approach'  -- unique indexed column
```

Rules:

- Slug is set at publish time, derived from the content title (kebab-case, max 60 chars, truncated if needed)
- Slug is immutable after publish (consistent with ADR-005: published content is versioned and locked)
- Slug has a unique index within a release -- duplicate slug within a release fails at publish with a clear error
- Load functions resolve slug -> ID once; all FK references use the synthetic ID
- Future slug redirects (if ever needed) are trivial because the PK was never the slug

### ID generation

All ID generation lives in `libs/utils/src/ids.ts`:

```typescript
import { ulid } from "ulidx";

// Tier B: event / FAA evidence records
export const generateRunId = () => `run_${ulid().toLowerCase()}`;
export const generatePacketId = () => `pkt_${ulid().toLowerCase()}`;
export const generateDimId = () => `sdm_${ulid().toLowerCase()}`;
export const generateEnrollmentId = () => `enr_${ulid().toLowerCase()}`;
export const generateTimeLogId = () => `tim_${ulid().toLowerCase()}`;
export const generateAttemptId = () => `att_${ulid().toLowerCase()}`;
export const generateProfileId = () => `prf_${ulid().toLowerCase()}`;
export const generateCertId = () => `crt_${ulid().toLowerCase()}`;

// Tier A: bounded catalog items (seq comes from Postgres SEQUENCE)
export function generateCatalogId(prefix: string, seq: number, digits = 3): string {
  return `${prefix}-${String(seq).padStart(digits, "0")}`;
}
```

Never call `nanoid()` directly in application code. Always use the typed generator functions.

## Migration

Existing code uses raw `nanoid()` for all IDs. The migration is:

1. Add `libs/utils/src/ids.ts` with the generator functions (add `ulidx` to dependencies)
2. Replace `nanoid()` calls in BC libs with the appropriate typed generator
3. Add Postgres sequences for each Tier A entity type
4. Add `slug` column to `published.scenario` and `published.module` (nullable initially, required after migration)
5. Update `publish.ts` to generate slug from title at publish time
6. Update sim routes to resolve slug -> ID in load functions

Existing data in development (no production data yet) can be wiped and re-seeded. No live migration needed for Phase 2.

## Consequences

- IDs in logs, errors, and FAA audit records are self-describing (`run_` vs `enr_`)
- Learner-facing URLs are human-readable (`/scenario/loc-base-to-final`)
- DB index performance is better for high-volume event tables (ULID sort order)
- Slug and PK are separate concerns -- renaming content never breaks FK integrity
- `libs/utils/` is a new lib (thin, no dependencies on other libs)
