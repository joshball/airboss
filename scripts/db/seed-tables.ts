/**
 * Single source of truth for the set of tables that carry a `seed_origin`
 * marker. Used by:
 *
 *   - `scripts/db/seed-remove.ts`  -- delete-by-tag (FK order)
 *   - `scripts/db/seed-check.ts`   -- summary count by table + tag
 *   - the yellow CLI warning in `scripts/db/seed-all.ts` -- per-table totals
 *
 * Order matters for delete: children before parents. Each entry pairs the
 * fully-qualified table name with the column expression that holds the marker.
 *
 * `bauth_user` is special: better-auth owns the table so we can't add a
 * column. Abby's row is tagged via the existing `address` jsonb (key
 * `seed_origin`); the entry below uses a jsonb path expression so the same
 * tooling works.
 */

import { SCHEMAS } from '@ab/constants';

export interface SeedTable {
	/** Fully-qualified `schema.table` (or `public.table`). */
	qualifiedName: string;
	/** Where the marker lives. Most tables: a `seed_origin` column. bauth_user: jsonb path on `address`. */
	markerExpression: string;
	/** Friendly label used in the yellow warning summary. */
	label: string;
}

/**
 * FK-respecting delete order. session_item_result references session AND
 * review; review references card; everything except plan + scenario references
 * either bauth_user or knowledge_node. Cards reference knowledge_node; plans
 * are referenced by sessions; scenarios are referenced by session_item_result.
 *
 * Children first means: SIR -> review -> session -> plan -> scenario -> card -> knowledge_node -> bauth_user.
 * card_state has no marker (its lifecycle is bound 1:1 to card; cascade delete
 * handles the cleanup).
 */
export const SEED_TABLES: readonly SeedTable[] = [
	{
		qualifiedName: `${SCHEMAS.STUDY}.session_item_result`,
		markerExpression: 'seed_origin',
		label: 'study.session_item_result',
	},
	{ qualifiedName: `${SCHEMAS.STUDY}.review`, markerExpression: 'seed_origin', label: 'study.review' },
	{ qualifiedName: `${SCHEMAS.STUDY}.session`, markerExpression: 'seed_origin', label: 'study.session' },
	{ qualifiedName: `${SCHEMAS.STUDY}.study_plan`, markerExpression: 'seed_origin', label: 'study.study_plan' },
	{ qualifiedName: `${SCHEMAS.STUDY}.scenario`, markerExpression: 'seed_origin', label: 'study.scenario' },
	{ qualifiedName: `${SCHEMAS.STUDY}.card`, markerExpression: 'seed_origin', label: 'study.card' },
	{
		qualifiedName: `${SCHEMAS.STUDY}.knowledge_node`,
		markerExpression: 'seed_origin',
		label: 'study.knowledge_node',
	},
	{
		qualifiedName: 'public.bauth_user',
		markerExpression: "address->>'seed_origin'",
		label: 'public.bauth_user (via address.seed_origin)',
	},
];
