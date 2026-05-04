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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { acManifestSchema, handbookWarningsFileSchema } from './manifest-validation';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');
const AC_ROOT = join(REPO_ROOT, 'ac');

function listAcTrees(): { docSlug: string; revision: string }[] {
	const out: { docSlug: string; revision: string }[] = [];
	if (!existsSync(AC_ROOT)) return out;
	for (const docSlug of readdirSync(AC_ROOT)) {
		const docDir = join(AC_ROOT, docSlug);
		try {
			if (!statSync(docDir).isDirectory()) continue;
		} catch {
			continue;
		}
		try {
			for (const revision of readdirSync(docDir)) {
				if (existsSync(join(docDir, revision, 'manifest.json'))) {
					out.push({ docSlug, revision });
				}
			}
		} catch {
			// Skip non-directory entries.
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
