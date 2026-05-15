// @browser-globals: server-only -- never imported by client .svelte
/**
 * Server-side query for per-user wx-practice mastery rows. Thin pass-through
 * to `@ab/bc-wx-practice/server` `getMasteryFor`. The mastery dashboard owns
 * the catalog-join + display-row composition; this module is purely the
 * "fetch rows for one user / product" boundary.
 */
import type { WxPracticeMasteryRow } from '@ab/bc-wx-practice';
import { getMasteryFor } from '@ab/bc-wx-practice/server';
import type { WxProduct } from '@ab/constants';

/** Fetch every mastery row for one user / product. */
export async function fetchMasteryRows(
	userId: string,
	product: WxProduct,
): Promise<ReadonlyArray<WxPracticeMasteryRow>> {
	return getMasteryFor({ userId, product });
}
