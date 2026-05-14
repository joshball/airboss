/**
 * Shared catalog fixture loader. Reads the on-disk catalog.json (built
 * by `bun tools/catalog-build/bin.ts`) once and exposes per-product
 * example arrays for the explain-* test files.
 *
 * Server-only -- reads from disk. Imported only inside __tests__/.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CatalogExample {
	slug: string;
	product: string;
	raw: string;
	tokenFamilies: string[];
	synoptic: string;
	triageDrivers: string[];
}

interface ProductCatalog {
	product: string;
	tokenFamilies: { slug: string; label: string; decode: string; examples: string[] }[];
	examples: CatalogExample[];
}

interface EncodedTextCatalog {
	generatedAt: string;
	products: {
		metar: ProductCatalog;
		taf: ProductCatalog;
		pirep: ProductCatalog;
		fb: ProductCatalog;
		airmetSigmet: ProductCatalog;
	};
}

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const CATALOG_PATH = resolve(REPO_ROOT, 'course/knowledge/weather/encoded-text-catalog/catalog.json');

let cached: EncodedTextCatalog | null = null;

export function loadCatalog(): EncodedTextCatalog {
	if (cached !== null) return cached;
	const raw = readFileSync(CATALOG_PATH, 'utf8');
	cached = JSON.parse(raw) as EncodedTextCatalog;
	return cached;
}

export function metarExamples(): CatalogExample[] {
	return loadCatalog().products.metar.examples;
}

export function tafExamples(): CatalogExample[] {
	return loadCatalog().products.taf.examples;
}

export function pirepExamples(): CatalogExample[] {
	return loadCatalog().products.pirep.examples;
}

export function fbExamples(): CatalogExample[] {
	return loadCatalog().products.fb.examples;
}

export function airmetExamples(): CatalogExample[] {
	return loadCatalog().products.airmetSigmet.examples;
}

export function allTokenFamilies(): { product: string; slug: string }[] {
	const cat = loadCatalog();
	const out: { product: string; slug: string }[] = [];
	for (const product of Object.values(cat.products)) {
		for (const family of product.tokenFamilies) {
			out.push({ product: product.product, slug: family.slug });
		}
	}
	return out;
}
