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
 * - `AUDIT`: home of the `audit_log` table declared in `libs/db/src/audit.ts`.
 *   One append-only row per tracked mutation.
 * - `STUDY`: home of the study BC tables (cards, reviews, scenarios, plans,
 *   sessions, knowledge graph).
 */
export const SCHEMAS = {
	IDENTITY: 'identity',
	AUDIT: 'audit',
	STUDY: 'study',
} as const;

export type SchemaName = (typeof SCHEMAS)[keyof typeof SCHEMAS];
