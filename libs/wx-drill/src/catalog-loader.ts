/**
 * Read the encoded-text catalog families from
 * `course/knowledge/weather/encoded-text-catalog/catalog.json` and project
 * to the `CatalogFamiliesByProduct` shape the sampler expects.
 *
 * Server-only: reads from disk. Pulled into a dedicated file so the
 * sampler stays free of fs imports.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogFamiliesByProduct } from './sample';

const HERE = dirname(fileURLToPath(import.meta.url));

interface RawCatalogFamily {
	slug: string;
}

interface RawCatalog {
	products: {
		metar: { tokenFamilies: RawCatalogFamily[] };
		taf: { tokenFamilies: RawCatalogFamily[] };
		pirep: { tokenFamilies: RawCatalogFamily[] };
		fb: { tokenFamilies: RawCatalogFamily[] };
		airmetSigmet: { tokenFamilies: RawCatalogFamily[] };
	};
}

export interface CatalogLoadOptions {
	/**
	 * Absolute path to the repository root. Defaults to a path relative to
	 * `import.meta.dir` (matching the CLI's resolution). Tests / sub-callers
	 * can override.
	 */
	repoRoot?: string;
}

export function loadCatalogFamilies(opts: CatalogLoadOptions = {}): CatalogFamiliesByProduct {
	const repoRoot = opts.repoRoot ?? resolve(HERE, '..', '..', '..');
	const catalogPath = resolve(repoRoot, 'course/knowledge/weather/encoded-text-catalog/catalog.json');
	const raw = readFileSync(catalogPath, 'utf8');
	const parsed = JSON.parse(raw) as RawCatalog;
	return {
		metar: parsed.products.metar.tokenFamilies.map((f) => f.slug),
		taf: parsed.products.taf.tokenFamilies.map((f) => f.slug),
		pirep: parsed.products.pirep.tokenFamilies.map((f) => f.slug),
		fb: parsed.products.fb.tokenFamilies.map((f) => f.slug),
		airmet: parsed.products.airmetSigmet.tokenFamilies.map((f) => f.slug),
	};
}
