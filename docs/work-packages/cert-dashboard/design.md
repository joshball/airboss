# Design: Cert Dashboard

Companion to [spec.md](./spec.md). Notes the route shape, page composition, mastery display, and the boundary against sibling WPs.

## Route shape

| Route                                              | Purpose                                                              | Loader inputs                  |
| -------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| `/credentials`                                     | Index of active credentials, default-filtered to the primary goal   | `userId`                        |
| `/credentials/[slug]`                              | Per-credential detail (header, prereqs, mastery rollup, area list)  | `userId`, `slug`, `?edition=`   |
| `/credentials/[slug]/areas/[areaCode]`             | Area drill (task list, expandable elements with linked nodes)       | `userId`, `slug`, `areaCode`    |
| `/credentials/[slug]/areas/[areaCode]/tasks/[tc]`  | Task drill (deferred -- area drill expands inline first)            | n/a                             |

The fourth route (`CREDENTIAL_TASK`) exists in `libs/constants/src/routes.ts` but is reserved for a future expansion. Today's area drill expands tasks inline; a dedicated task page would only earn its keep when one task carries enough content to warrant its own surface.

## Page composition

### Index (`/credentials`)

```text
[ Header banner: primary goal | "Set a primary goal" CTA ]
[ Card grid (3-up desktop) ]
   ┌─────────────────────────────┐
   │ Title                  Kind │
   │ Category / Class            │
   │ Coverage XX%   Mastery XX%  │
   └─────────────────────────────┘
```

Default ordering: primary-goal credentials first (in the order they appear on the goal), then other active credentials.

### Detail (`/credentials/[slug]`)

```text
[ Breadcrumbs: Credentials > Private ]
[ Title bar: Private Pilot Certificate (kind, category, class) ]
[ Prereq snippet: required prereqs (one hop) | recommended prereqs ]
[ Mastery card: Coverage XX%, Mastery XX%, by-area bar list ]
[ Area list -> deep links into /areas/[areaCode] ]
[ Disclosure: Supplemental syllabi (collapsed) ]
```

### Area drill (`/credentials/[slug]/areas/[areaCode]`)

```text
[ Breadcrumbs: Credentials > Private > Area V ]
[ Area header: code + title ]
[ Task list ]
  Task A
    [K elements]   K1, K2, ...   each: mastery, citations, linked nodes
    [R elements]   R1, R2, ...   each: mastery, citations, linked nodes
    [S elements]   S1, S2, ...   each: mastery, citations, linked nodes
  Task B ...
```

Element rows expand inline. The expanded view shows: triad badge, mastery indicator, citation chips (resolved to the handbook reader), linked knowledge nodes (jump-to-learn buttons).

## Mastery display

Three numbers, three meanings:

| Metric      | Source                                                | Meaning                                    |
| ----------- | ----------------------------------------------------- | ------------------------------------------ |
| Coverage %  | `coveredLeaves / totalLeaves`                         | "I have touched this many of the leaves"   |
| Mastery %   | `masteredLeaves / totalLeaves`                        | "I have demonstrated mastery on this many" |
| Gap         | `coveredLeaves - masteredLeaves`                      | "Started but not yet mastered"             |

Coverage and mastery render as separate bars. A 90%-mastered cert at 30% coverage reads "expert at the third you've studied; two-thirds untouched" -- the user must see both. An InfoTip on the index card clarifies the distinction.

## Edition pinning

`?edition=<slug>` resolves the credential's primary syllabus to the matching edition. The loader:

1. Reads `getCredentialPrimarySyllabus(credentialId)` to get the *current active* syllabus.
2. If `?edition=` is present and resolves to a syllabus row for the same credential, that row wins.
3. The pinned edition stays in the URL across navigation (shared affordance with other edition-pinned surfaces).
4. A subtle banner reads "Pinned to edition X. Switch to current."

A learner mid-prep on an older edition keeps their syllabus tree, mastery state, and citations all consistent against that edition until they choose to migrate.

## Boundary against sibling WPs

| Concern                          | Owned by                | Why                                                                                                  |
| -------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `/credentials/...`               | this WP                 | Per-credential dashboard is the surface ADR 016 phase 7 names                                         |
| `/lens/...`                      | [lens-ui](../lens-ui/spec.md)        | Cross-lens browse (handbook lens, weakness lens, etc.) is its own surface                            |
| `/goals/...`                     | [goal-composer](../goal-composer/spec.md) | Goal CRUD belongs to a writable surface; cert dashboard reads the primary goal but never writes one |
| `getPrimaryGoal` read            | this WP (read-only)     | Read for default-filter; no mutation                                                                 |
| Credential authoring             | YAML + `bun run db seed credentials` | System content lives in `course/credentials/`; not authored in-app                                   |

## Design principles applied

| Principle                                  | Application                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Debrief Culture                            | Mastery surfaces what's untouched without shame; gaps are next-action data, not a report card            |
| Cert as constraint set (Learning #2)       | The dashboard never recommends "next cert"; it just renders the constraint set                           |
| DAG composition (Learning #3)              | Prereq snippet shows the DAG one hop at a time; full DAG visualisation deferred until it earns its keep  |
| Mastery rollups (Learning #5)              | Coverage and mastery shown distinct; rollup math lives in the BC, this WP just renders                    |
| Lenses (Learning #6)                       | Cert dashboard is the ACS lens for one credential; cross-lens browse is `/lens/...` in [lens-ui](../lens-ui/spec.md) |

## Performance

`getCredentialMastery` is one round-trip per credential. The index page issues N round-trips for N credentials (typical: 3-7 for a returning CFI). Acceptable for the v1 surface; if a future user-zero pursues 20 credentials, switch to a single batch query.

`getSyllabusTree` is one round-trip per area page; the BC's in-memory tree projection is O(leaves) which is bounded (~hundreds for an ACS area).

## Risks

| Risk                                                                                       | Mitigation                                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Empty syllabi (most credentials beyond PPL ACS Area V are not yet authored)                | Empty state explicit; phase 10 transcription is iterative human content work               |
| Edition pin diverges from authored syllabi mid-WP (FAA publishes new ACS during build)     | New edition = new syllabus row; pinned edition stays valid; diff surface is a future WP    |
| Goal-filter ordering surprises the user when no primary goal is set                        | Banner makes it explicit; ordering falls back to credential `kind` then `slug`             |
