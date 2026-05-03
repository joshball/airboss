/**
 * Validation test for the IPH (FAA-H-8083-16B) manifest produced by the
 * chapter-aware ingest pipeline (per WP-IPH-section-tree).
 *
 * Reads the in-repo manifest at `handbooks/iph/FAA-H-8083-16B/manifest.json`
 * and asserts the section-tree shape matches the post-promotion contract:
 *
 * - `kind === 'handbook'` (not `'whole-doc'`).
 * - `body_path` is absent at the top level (each section now owns its body).
 * - 7 chapter rows, in code order `1..7`.
 * - Every chapter has at least one section (TOC parser produced rows).
 * - Every section / subsection has a non-empty `body_path` and `content_hash`.
 *
 * The numeric counts are anchored to the 2026-05-03 ingest output:
 * 7 chapters + 84 sections + 228 subsections = 319 entries. Re-extracting
 * after a future TOC parser improvement may shift those by a small amount;
 * the test asserts ranges rather than exact counts so the upper bounds keep
 * the parser honest while leaving room for legitimate refinements.
 */

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readManifest } from './derivative-reader.ts';

const REPO_ROOT = process.cwd();
const HANDBOOKS_ROOT = join(REPO_ROOT, 'handbooks');

describe('IPH manifest (FAA-H-8083-16B)', () => {
	const manifest = readManifest('FAA-H-8083-16B', HANDBOOKS_ROOT, 'iph');

	it('reports the chapter-aware kind', () => {
		expect(manifest.kind).toBe('handbook');
		expect(manifest.document_slug).toBe('iph');
		expect(manifest.edition).toBe('FAA-H-8083-16B');
	});

	it('does not carry a top-level body_path (each section owns its body)', () => {
		expect(manifest.body_path).toBeUndefined();
	});

	it('emits exactly 7 chapter rows in ordinal order', () => {
		const chapters = manifest.sections.filter((s) => s.level === 'chapter');
		expect(chapters.map((c) => c.code)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
		expect(chapters.map((c) => c.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('every chapter carries the migrated title (not the bare "Chapter N" sentinel)', () => {
		const expected: Readonly<Record<string, string>> = {
			'1': 'Departure Procedures',
			'2': 'En Route Operations',
			'3': 'Arrivals',
			'4': 'Approaches',
			'5': 'Improvement Plans',
			'6': 'Airborne Navigation Databases',
			'7': 'Helicopter Instrument Procedures',
		};
		for (const ch of manifest.sections.filter((s) => s.level === 'chapter')) {
			expect(ch.title).toBe(expected[ch.code]);
		}
	});

	it('emits a non-trivial section + subsection tree under every chapter', () => {
		const sections = manifest.sections.filter((s) => s.level === 'section');
		const subsections = manifest.sections.filter((s) => s.level === 'subsection');
		// Anchored ranges: as of the 2026-05-03 ingest the counts were 84 / 228.
		// A future TOC parser refinement may legitimately shift these; the
		// ranges here keep the test robust without ignoring regressions.
		expect(sections.length).toBeGreaterThanOrEqual(60);
		expect(sections.length).toBeLessThanOrEqual(120);
		expect(subsections.length).toBeGreaterThanOrEqual(180);
		expect(subsections.length).toBeLessThanOrEqual(280);
		const chaptersWithChildren = new Set(
			manifest.sections.filter((s) => s.level !== 'chapter' && s.code.includes('.')).map((s) => s.code.split('.')[0]),
		);
		expect(chaptersWithChildren).toEqual(new Set(['1', '2', '3', '4', '5', '6', '7']));
	});

	it('every non-chapter row has a body_path and a content hash', () => {
		for (const s of manifest.sections) {
			if (s.level === 'chapter') continue;
			expect(s.body_path.length).toBeGreaterThan(0);
			expect(s.body_path.startsWith('handbooks/iph/FAA-H-8083-16B/')).toBe(true);
			expect(s.content_hash).toMatch(/^[a-f0-9]{64}$/);
		}
	});

	it('every section row points at a parent chapter / section that exists', () => {
		const codes = new Set(manifest.sections.map((s) => s.code));
		for (const s of manifest.sections) {
			if (s.parent_code === null) {
				expect(s.level).toBe('chapter');
				continue;
			}
			expect(codes.has(s.parent_code)).toBe(true);
		}
	});
});
