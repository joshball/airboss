// @browser-globals: server-only -- never imported by client .svelte
/**
 * Server loader for the wx-practice catalog.
 *
 * Reads `course/knowledge/weather/encoded-text-catalog/catalog.json` (the
 * Catalog Phase 1 artifact) and projects each token family into a record the
 * mastery dashboard can render. The catalog is the canonical "all families"
 * set; the per-user mastery ledger is a sparse overlay supplied by
 * `@ab/bc-wx-practice/server` (when it lands).
 *
 * Server-only: `+page.server.ts` modules never reach the browser bundle, so
 * `node:fs` is safe here.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { WxProduct } from '@ab/constants';

// `_lib` is 9 directories deep relative to the repo root:
// apps/study/src/routes/(app)/practice/wx/mastery/_lib -> 9 `..` segments.
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..', '..', '..', '..', '..');
const CATALOG_PATH = resolve(REPO_ROOT, 'course', 'knowledge', 'weather', 'encoded-text-catalog', 'catalog.json');

/** One token family in the on-disk catalog. */
export interface CatalogTokenFamily {
	readonly slug: string;
	readonly label: string;
	readonly decode: string;
}

/** Subset of the catalog the dashboard needs (one entry per product). */
export interface CatalogProduct {
	readonly product: WxProduct;
	readonly families: ReadonlyArray<CatalogTokenFamily>;
}

/**
 * The on-disk JSON keys products as `metar` | `taf` | `pirep` | `fb` |
 * `airmetSigmet`. The dashboard contract collapses `airmetSigmet` -> `airmet`
 * to match the FROZEN `@ab/bc-wx-practice` enum.
 */
const PRODUCT_KEY_MAP: ReadonlyMap<string, WxProduct> = new Map([
	['metar', 'metar'],
	['taf', 'taf'],
	['pirep', 'pirep'],
	['fb', 'fb'],
	['airmetSigmet', 'airmet'],
]);

interface RawCatalogShape {
	readonly products: Readonly<
		Record<
			string,
			{
				readonly product: string;
				readonly tokenFamilies: ReadonlyArray<{
					readonly slug: string;
					readonly label: string;
					readonly decode: string;
				}>;
			}
		>
	>;
}

let cached: ReadonlyArray<CatalogProduct> | null = null;

/**
 * Load the wx-practice token-family catalog. Cached at module-eval after the
 * first call -- the on-disk JSON is regenerated only at build time, so the
 * cache lifetime is the dev-server process. No cache-invalidation hook
 * because the read is cheap (sub-millisecond) on a warm filesystem.
 */
export async function loadWxPracticeCatalog(): Promise<ReadonlyArray<CatalogProduct>> {
	if (cached) return cached;
	const raw = await readFile(CATALOG_PATH, 'utf8');
	const parsed = JSON.parse(raw) as RawCatalogShape;
	const out: CatalogProduct[] = [];
	for (const [diskKey, entry] of Object.entries(parsed.products)) {
		const product = PRODUCT_KEY_MAP.get(diskKey);
		if (!product) continue; // unknown product keys are silently dropped
		out.push({
			product,
			families: entry.tokenFamilies.map((f) => ({ slug: f.slug, label: f.label, decode: f.decode })),
		});
	}
	cached = out;
	return out;
}

/** Find a single product's family list. Returns an empty array if missing. */
export async function loadFamiliesForProduct(product: WxProduct): Promise<ReadonlyArray<CatalogTokenFamily>> {
	const all = await loadWxPracticeCatalog();
	const hit = all.find((p) => p.product === product);
	return hit ? hit.families : [];
}
