---
id: card-question-tier
title: 'Design: Card Question-Tier + Provenance'
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on: []
unblocks: []
tags:
  - cards
  - schema
  - design
legacy_fields:
  feature: card-question-tier
  type: design
---

# Design: Card Question-Tier + Provenance

WP-specific design notes for [spec.md](./spec.md). The schema decisions here are load-bearing for Phase 2 (backfill) and Phase 3 (surfaces); the rest of this doc explains why each shape was chosen and what the alternative paths cost.

## Why three columns and not one polymorphic field

A reader staring at this WP could reasonably ask: "why three new columns instead of one `provenance jsonb` blob with `{ tier, sources, acsCodes }`?" Three reasons:

- **Filter cardinality differs.** `question_tier` is a closed three-value enum and the most common filter dimension on the review queue. It earns its own column with a CHECK constraint and an index-friendly text storage. `source_authority` is a nested array (zero to many entries per card) and never the primary filter axis. `acs_codes` is also an array but each element is a single string -- Postgres `text[]` handles it natively with GIN-friendly array operators.
- **Validation ergonomics.** A jsonb blob hides the schema. Three typed columns let `bun run db psql -c '\d study.card'` show the contract at the prompt; the BC's Zod schemas type each field independently; future surfaces read `card.questionTier` instead of `card.provenance.tier ?? null`.
- **Future indexability.** When a "drill only my FAA-written cards" surface ships, a `CREATE INDEX ON study.card (user_id, question_tier) WHERE question_tier = 'faa-written'` is a one-line cost. With a jsonb blob the same query needs a generated column or a function-expression index, neither of which earn the complexity.

## Why `question_tier` is nullable

Existing 250+ cards have no FAA-vs-CFI classification. Backfill happens hand-by-card during Phase 2 (or never, for cards where the distinction doesn't apply). NULL = "we haven't classified this yet"; the surfaces (filter chips, side-by-side panel) can choose to render unclassified cards under "all" or hide them when the user filters explicitly.

The three values are intentionally bounded to three:

| Value           | Meaning                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| `faa-written`   | This card exists because the FAA written test asks this exact question / this exact way. |
| `cfi-essential` | This card exists because real pilots / CFIs say this matters operationally.              |
| `both`          | The FAA tests it AND CFIs say it matters; the same fact serves both audiences.           |

A fourth value -- `cfi-only` (CFI says it matters AND the FAA doesn't test it) -- is collapsed into `cfi-essential`; the FAA-coverage signal lives in the *presence* of a `faa-written` sibling card on the same node, not in a negative attribute on the CFI card. This keeps the enum small and the Phase 3 side-by-side panel logic simple ("if a `faa-written` and a `cfi-essential` card share a node and overlap on `acs_codes`, pair them").

## Why `source_authority` is jsonb-array-of-objects, not text[]

A pilot card might cite `[14 CFR 91.155, AIM 7-1-21]` -- two distinct authorities. A flat `text[]` of cite strings loses the kind-of-authority signal a future surface needs ("show me a CFR badge here, an AIM badge there"). The shape `[{ kind, cite }]` keeps both pieces queryable and lets the citation rendering layer pick the right icon/colour per kind.

The `kind` enum stays small (six values) and matches the references registry's source-document taxonomy:

| Kind    | Covers                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------- |
| `cfr`   | 14 CFR Parts 1, 61, 91, 121, 125, 135, 141 (FAA regulations).                                       |
| `ac`    | FAA Advisory Circulars (AC 00-45H, AC 00-24C, AC 61-65K, AC 90-XX, etc.).                           |
| `aim`   | Aeronautical Information Manual sections (AIM 7-1-27, AIM 4-3-1, etc.).                             |
| `phak`  | Pilot's Handbook of Aeronautical Knowledge chapters (PHAK Ch 11, PHAK Ch 12, etc.).                 |
| `afh`   | Airplane Flying Handbook chapters / sections (AFH Ch 3, AFH 5-1, etc.).                             |
| `other` | Anything not in the above (FAA-S-ACS-* documents, manufacturer POH/AFM, third-party sources, etc.). |

`other` is the escape hatch; it earns the `cite` field but no kind-specific badge / deep-link. When a recurring `other` source pattern emerges (e.g. POH citations become common), it's a one-line constant addition to promote it into its own kind in a follow-on PR.

The jsonb path CHECK constraint validates each element of the array carries a recognised kind and a non-empty cite. The DB rejects any insert where the array is malformed; the BC Zod schema mirrors the rule with a per-field error path that surfaces in the seeder's per-card error message.

## Why `acs_codes` is `text[]`, not jsonb

ACS task element codes are flat strings with a known shape (`PA.I.C.K1`, `IR.II.A.K2c`, `CA.III.B.S1`, etc.). `text[]` is the right Postgres primitive: native array operators (`@>`, `&&`), GIN-indexable for "find all cards covering PA.I.C.K2" queries, and renders cleanly in psql output.

The `ACS_CODE_PATTERN` regex (`/^[A-Z]{2}\.[IVX]+\.[A-Z]+\.[KRS]\d+[a-z]?$/`) constrains the shape:

- Two uppercase letters for the rating prefix (`PA` private airplane, `IR` instrument, `CA` commercial airplane, `AS` ATP, etc.).
- Roman-numeral area code (`I`, `II`, `III`, ...).
- Uppercase letter for the task within the area (`A`, `B`, `C`, ...).
- One of `K` (knowledge), `R` (risk management), `S` (skill) for the ACS triad.
- Numeric ordinal (`1`, `2`, `3`, ...) optionally followed by a lowercase sub-letter (`a`, `b`, `c`, ...) for nested elements like `PA.I.C.K2a`.

Validation lives in the Zod schema (per-field error path) and is re-asserted in the seeder so a malformed code in a yaml-cards block fails at seed time with a clear pointer.

## Why `tags[]` stays

Tags are the free-form augmentation channel. Once `acs_codes` and `source_authority` are populated, the tag values that encoded those concepts (`PA.I.C.K2a`, `ac-00-45h`, `phak-11`) become redundant and Phase 2's backfill strips them. Tags continue to carry:

- Topical labels that aren't authoritative codes (`weather`, `density-altitude`, `go-nogo`, `triage`).
- Author-flagged sub-themes (`calculation`, `rule-of-thumb`, `trend-signal`).
- Cross-cutting attributes that don't fit a typed column (`exam-anti-pattern`, `safety-critical`).

The tag column is intentionally unconstrained; it absorbs the long-tail authoring vocabulary that doesn't earn promotion. When a tag pattern recurs across many cards and surfaces a useful filter, it's promoted (this WP is the template -- `acs_codes` and `source_authority` are former tags graduated to typed columns).

## Why no schema migration phasing

CLAUDE.md is explicit: airboss has no Drizzle migrations. The schema is greenfield: a single `drizzle/0000_initial.sql` is regenerated from `libs/**/schema.ts` whenever schema changes. There is no production DB to evolve in place, no deprecation window, no "drop column in commit N" sequence. The change is one step:

1. Edit `libs/bc/study/src/schema.ts` (add the three columns + the two CHECKs).
2. Regenerate `0000_initial.sql` (`bunx drizzle-kit generate` + manual cleanup, OR hand-edit; both are valid).
3. `bun run db reset --force` reseeds from scratch.

Phase 2 (backfill) does not touch the schema; it only edits node.md files (which the seeder consumes) and `tags[]` values. Phase 3 (surfaces) does not touch the schema; it only adds queries / read shapes.

## Why this WP earns its own work-package directory

Per the CLAUDE.md "When to use a work package" rules, this is a borderline case:

- "Schema migration / refactor" suggests a session todo would suffice.
- BUT this is a **cohesive feature with user-visible work**: the FAA-vs-CFI distinction the user explicitly asked for, the surfaces that ride on it (Phase 3), and the backfill effort (Phase 2). The total scope is multi-PR and multi-phase.

The WP exists to anchor Phases 2 and 3 against a stable schema contract authored once. Without the WP, the three follow-on surfaces (filter, side-by-side panel, ACS lens) would each redefine the schema concepts in their own specs, and the backfill effort would have no canonical "what shape are we backfilling toward" reference.

## Open design questions (resolved before this WP merges)

None. The three field shapes are settled per the user's framing. The jsonb-vs-text[] decision for `source_authority` is settled (jsonb-array-of-objects, per the kind+cite pairing). The ACS-code shape regex is settled (matches every code in the seeded ACS yaml).

If a future surface needs a fourth attribute on cards (e.g. `difficulty_for_learner: easy | hard`, or `aviation_phase: ground-school | flight-line`), it goes in its own WP. This WP is intentionally scoped to the three shapes the user named.
