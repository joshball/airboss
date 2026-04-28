/**
 * Postgres schema namespaces used across the app. Per ADR 004 each BC owns a
 * distinct schema; the partition keeps `study.*`, `audit.*`, and any future
 * identity tables from colliding with each other or with better-auth's
 * `public` tables.
 *
 * - `IDENTITY`: reserved for future non-better-auth identity tables. Currently
 *   unused -- better-auth writes `bauth_*` rows into `public` and the vendor
 *   code does not support Postgres schemas, so we keep identity-adjacent
 *   custom tables (user preferences, roles mappings, etc.) in this namespace
 *   as they land. Remove this key if that plan changes.
 * - `AUDIT`: home of the `audit_log` table declared in `libs/audit/src/schema.ts`.
 *   One append-only row per tracked mutation.
 * - `STUDY`: home of the study BC tables (cards, reviews, scenarios, plans,
 *   sessions, knowledge graph). Schema defined in `libs/bc/study/src/schema.ts`.
 * - `HANGAR`: home of the hangar BC tables -- runtime mirror of the TOML
 *   content registry (reference, source), the job queue + log, and the
 *   sync-to-disk ledger. Schema defined in `libs/db/src/hangar.ts` (slated to
 *   move under a `libs/bc/hangar/` BC -- see
 *   `docs/work-packages/extract-hangar-bc/spec.md`).
 * - `SIM`: home of the sim BC persistence tables. Today: `sim_attempt`
 *   (one row per completed flight, with grade + outcome + tape ref).
 *   Schema defined in `libs/db/src/sim.ts` (slated to move under
 *   `libs/bc/sim/src/schema.ts` with the same WP). Future spaced-rep
 *   integration reads this to bias the scheduler when a sim drill grades
 *   poorly.
 */
export const SCHEMAS = {
	IDENTITY: 'identity',
	AUDIT: 'audit',
	STUDY: 'study',
	HANGAR: 'hangar',
	SIM: 'sim',
} as const;

export type SchemaName = (typeof SCHEMAS)[keyof typeof SCHEMAS];
