/**
 * Shared SQL fragments that bridge `study.reference` rows to the registry-
 * canonical edition coherence model from ADR 026. Both Drizzle predicates
 * (`notSupersededInRegistry`) and raw-SQL aggregates (`getReferenceCountsByTopic`)
 * share one source of truth for the per-row `airboss-ref:<corpus>/<slug>`
 * concat -- mirroring the `sourceIdForReference` TS helper in `@ab/sources`
 * so the SQL the BC sends to Postgres is provably the same shape the seed
 * pipeline writes into `sources_registry.editions.source_id`.
 *
 * The corpus mapping (`handbook -> handbooks`, `cfr -> regs`) comes from
 * `CORPUS_PREFIX_FOR_REFERENCE_KIND` in `@ab/sources`. Adding a new corpus
 * shorthand happens in one place.
 */

import { CORPUS_PREFIX_FOR_REFERENCE_KIND } from '@ab/sources';
import { editions as editionsTable } from '@ab/sources/server';
import { type AnyColumn, type SQL, sql } from 'drizzle-orm';
import { reference } from './schema.ts';

const SCHEME_PREFIX = 'airboss-ref:';

/**
 * Build the SQL `CASE` expression that translates a `kind` column value to
 * the corpus segment used in `sources_registry.editions.source_id`. Pure: only
 * walks the static `CORPUS_PREFIX_FOR_REFERENCE_KIND` map; no DB access.
 *
 * Accepts any column reference so callers using table aliases inside raw
 * `db.execute(sql\`...\`)` blocks (e.g. `r.kind` instead of `${reference.kind}`)
 * can pass the literal column expression they need.
 */
function corpusCaseSql(kindCol: SQL | AnyColumn): SQL {
	const branches = Object.entries(CORPUS_PREFIX_FOR_REFERENCE_KIND).map(
		([kind, prefix]) => sql`WHEN ${kindCol} = ${kind} THEN ${prefix}`,
	);
	return sql.join([sql`(CASE`, ...branches, sql`ELSE ${kindCol} END)`], sql` `);
}

/**
 * Reference-row source-id expression for the typed `study.reference` table.
 * Use inside Drizzle predicates that already have the typed table in scope:
 *
 *     db.select().from(reference).where(notSupersededInRegistry())
 */
export function sourceIdSqlForReference(): SQL {
	return sql`(${SCHEME_PREFIX} || ${corpusCaseSql(reference.kind)} || '/' || ${reference.documentSlug})`;
}

/**
 * Reference-row source-id expression for raw SQL blocks that alias the
 * `study.reference` table (e.g. `FROM study.reference AS r`). Pass the
 * aliased column refs as raw `sql\`r.kind\`` / `sql\`r.document_slug\``.
 */
export function sourceIdSqlForAliasedReference(kindCol: SQL, slugCol: SQL): SQL {
	return sql`(${SCHEME_PREFIX} || ${corpusCaseSql(kindCol)} || '/' || ${slugCol})`;
}

/**
 * Drizzle predicate: "this `study.reference` row is NOT superseded according
 * to `sources_registry.editions`." Per ADR 026 the registry is the single
 * source of truth for edition supersession; this predicate replaces the
 * dropped `study.reference.supersededById` self-FK column.
 *
 * Single round-trip: the source-id concat happens inside the subquery so the
 * outer SELECT does not pay a per-row N+1 lookup.
 */
export function notSupersededInRegistry(): SQL {
	return sql`NOT EXISTS (
		SELECT 1 FROM ${editionsTable}
		WHERE ${editionsTable.sourceId} = ${sourceIdSqlForReference()}
		  AND ${editionsTable.editionLabel} = ${reference.edition}
		  AND ${editionsTable.retiredAt} IS NOT NULL
	)`;
}
