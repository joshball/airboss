/**
 * AC conformance shim tests (WP-HANDBOOK-RE-EXTRACTION-V2 Phase 3).
 *
 * The conformance shim re-emits each AC manifest with `warnings: []` and
 * writes a sibling `warnings.json` under the same directory so the BC
 * reader (`getOpenWarningsForReference`) consumes handbook + AC corpora
 * through one dispatch. AC ingest does NOT emit v2 codes today; the
 * empty array is intentional.
 *
 * These tests pin the on-disk shape against the committed AC derivative
 * tree so a regression in the ingest writer (e.g. dropping the warnings
 * field, forgetting the sibling file, breaking the schema) fails CI
 * without needing a re-ingest with a populated cache.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { acManifestSchema, handbookWarningsFileSchema } from './manifest-validation';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');
const AC_ROOT = join(REPO_ROOT, 'ac');
const AC_INDEX = join(AC_ROOT, 'index.json');

/**
 * Production AC trees only -- read from the committed `ac/index.json`
 * manifest, NOT by scanning the directory.
 *
 * `scripts/db/seed-references-from-manifest.test.ts` writes synthetic AC
 * fixture trees (`ac/999-<token>-1/`, `ac/888-<token>-9/`) directly under
 * `ac/` and tears them down per-test. A directory scan races those
 * fixtures: the conformance shim's collection phase catches a half-built
 * tree that has a `manifest.json` but no sibling `warnings.json`, and the
 * conformance assertion fails non-deterministically. Synthetic fixtures
 * are never registered in `index.json`, so keying off the manifest makes
 * this test immune to the race.
 */
function listAcTrees(): { docSlug: string; revision: string }[] {
	if (!existsSync(AC_INDEX)) return [];
	const index = JSON.parse(readFileSync(AC_INDEX, 'utf-8')) as {
		entries?: { doc_slug: string; revision: string }[];
	};
	const out: { docSlug: string; revision: string }[] = [];
	for (const entry of index.entries ?? []) {
		if (existsSync(join(AC_ROOT, entry.doc_slug, entry.revision, 'manifest.json'))) {
			out.push({ docSlug: entry.doc_slug, revision: entry.revision });
		}
	}
	return out;
}

describe('AC conformance shim (WP-HANDBOOK-RE-EXTRACTION-V2 Phase 3)', () => {
	const trees = listAcTrees();

	it('finds at least one ingested AC derivative tree to check', () => {
		expect(trees.length).toBeGreaterThan(0);
	});

	for (const { docSlug, revision } of trees) {
		describe(`ac/${docSlug}/${revision}`, () => {
			const docDir = join(AC_ROOT, docSlug, revision);
			const manifestPath = join(docDir, 'manifest.json');
			const warningsPath = join(docDir, 'warnings.json');

			it('manifest.json carries `warnings: []` (conformance shim)', () => {
				const raw = readFileSync(manifestPath, 'utf-8');
				const parsed = acManifestSchema.parse(JSON.parse(raw));
				expect(parsed.warnings).toEqual([]);
			});

			it('emits a sibling warnings.json conforming to handbookWarningsFileSchema', () => {
				expect(existsSync(warningsPath)).toBe(true);
				const raw = readFileSync(warningsPath, 'utf-8');
				const parsed = handbookWarningsFileSchema.parse(JSON.parse(raw));
				expect(parsed.warnings).toEqual([]);
				expect(parsed.document_slug).toBe(docSlug);
				// Edition tag in the sibling file is `<doc_slug>-<revision>`
				// (the on-disk identity), not the DB-side `AC <doc>X` form.
				expect(parsed.edition).toBe(`${docSlug}-${revision}`);
				expect(parsed.manifest_sha256).toMatch(/^[0-9a-f]{64}$/);
			});
		});
	}
});
