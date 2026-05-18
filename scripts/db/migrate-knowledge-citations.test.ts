/**
 * Tests for `scripts/db/migrate-knowledge-citations.ts`. Filesystem-only
 * migration -- the tests build a tiny temp repo with one node.md and one
 * handbook manifest, then drive the script through dry-run / apply paths.
 *
 * The safety property under test is the central one: `--apply` with no
 * ticked boxes never modifies any source file. ADR 019 amendment 2026-05 D2
 * forbids auto-rewrite, even on title match; the test asserts the script
 * honours that contract.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	buildOriginalAirbossRef,
	buildProposedYaml,
	extractLegacyCitations,
	parseExistingProposedRewrites,
	parseExistingTicks,
	parseLegacyDetail,
	parseLegacySource,
	REVIEW_FILE_RELPATH,
	runMigration,
} from './migrate-knowledge-citations';

// ---------------------------------------------------------------------------
// Pure parser tests
// ---------------------------------------------------------------------------

describe('parseLegacySource', () => {
	it('extracts AFH slug + edition from `AFH (FAA-H-8083-3B)`', () => {
		expect(parseLegacySource('AFH (FAA-H-8083-3B)')).toEqual({ slug: 'afh', edition: 'FAA-H-8083-3B' });
	});

	it('extracts AFH slug + edition from `FAA Airplane Flying Handbook (FAA-H-8083-3B)`', () => {
		expect(parseLegacySource('FAA Airplane Flying Handbook (FAA-H-8083-3B)')).toEqual({
			slug: 'afh',
			edition: 'FAA-H-8083-3B',
		});
	});

	it('matches the slug with an empty edition when no document-number tag is present', () => {
		// Per ADR 019 amendment 2026-05 §1 (optional edition), a citation that
		// names the handbook by acronym alone still migrates -- to an
		// editionless `ref:` URI with no `redirected_from` provenance tag.
		expect(parseLegacySource('AFH')).toEqual({ slug: 'afh', edition: '' });
	});

	it('returns null for unrecognised handbook strings', () => {
		expect(parseLegacySource('AOPA Air Safety Institute')).toBeNull();
	});

	it('extracts PHAK slug + edition', () => {
		expect(parseLegacySource('PHAK (FAA-H-8083-25C)')).toEqual({ slug: 'phak', edition: 'FAA-H-8083-25C' });
	});

	it('recognises a bare document number on the source line', () => {
		// The knowledge corpus writes `source: FAA-H-8083-25` as freely as
		// `source: PHAK`. The pattern lifts the slug and the edition tag.
		expect(parseLegacySource('FAA-H-8083-25')).toEqual({ slug: 'phak', edition: 'FAA-H-8083-25' });
		expect(parseLegacySource('FAA-H-8083-3')).toEqual({ slug: 'afh', edition: 'FAA-H-8083-3' });
		expect(parseLegacySource('FAA-H-8083-15')).toEqual({ slug: 'ifh', edition: 'FAA-H-8083-15' });
		expect(parseLegacySource('FAA-H-8083-2A')).toEqual({ slug: 'risk-management', edition: 'FAA-H-8083-2A' });
	});

	it('does not let the AFH `-3` pattern swallow a longer document number', () => {
		// `FAA-H-8083-3` must not prefix-match `FAA-H-8083-25` / `-28`.
		expect(parseLegacySource('FAA-H-8083-25')).toEqual({ slug: 'phak', edition: 'FAA-H-8083-25' });
		expect(parseLegacySource('FAA-H-8083-28')).toEqual({ slug: 'avwx', edition: 'FAA-H-8083-28' });
	});
});

describe('parseLegacyDetail', () => {
	it('parses `Chapter 3 -- Basic Flight Maneuvers`', () => {
		expect(parseLegacyDetail('Chapter 3 -- Basic Flight Maneuvers')).toEqual({
			chapter: 3,
			chapterTitle: 'Basic Flight Maneuvers',
			additionalChapters: [],
		});
	});

	it('parses `Chapter 4 -- Slow Flight, Stalls, and Spins`', () => {
		expect(parseLegacyDetail('Chapter 4 -- Slow Flight, Stalls, and Spins')).toEqual({
			chapter: 4,
			chapterTitle: 'Slow Flight, Stalls, and Spins',
			additionalChapters: [],
		});
	});

	it('returns null chapter for free-text detail', () => {
		expect(parseLegacyDetail('Recovery from unusual attitudes (visual)')).toEqual({
			chapter: null,
			chapterTitle: null,
			additionalChapters: [],
		});
	});

	it('parses `Chapter 16 -- Navigation` (multi-digit)', () => {
		expect(parseLegacyDetail('Chapter 16 -- Navigation')).toEqual({
			chapter: 16,
			chapterTitle: 'Navigation',
			additionalChapters: [],
		});
	});

	it('parses an AvWx detail with handbook-name prefix', () => {
		expect(
			parseLegacyDetail('Aviation Weather Handbook, Chapter 11 -- Air Masses, Fronts, and the Wave Cyclone Model'),
		).toEqual({
			chapter: 11,
			chapterTitle: 'Air Masses, Fronts, and the Wave Cyclone Model',
			additionalChapters: [],
		});
	});

	it('parses a multi-chapter detail separated by `;`', () => {
		expect(
			parseLegacyDetail(
				'Aviation Weather Handbook, Chapter 12 -- Vertical Motion and Clouds; Chapter 14 -- Precipitation',
			),
		).toEqual({
			chapter: 12,
			chapterTitle: 'Vertical Motion and Clouds',
			additionalChapters: [{ chapter: 14, chapterTitle: 'Precipitation' }],
		});
	});

	it('parses a detail with a `Section` qualifier without leaking the section into the title', () => {
		expect(parseLegacyDetail('Aviation Weather Handbook, Chapter 25 -- Analysis, Sections 25.4 and 25.5')).toEqual({
			chapter: 25,
			chapterTitle: 'Analysis',
			additionalChapters: [],
		});
	});

	it('parses a detail with a `§` section qualifier', () => {
		expect(
			parseLegacyDetail(
				'Aviation Weather Handbook, Chapter 27 -- Forecasts, Section 27.2 (Winds and Temperatures Aloft) and §27.2.1',
			),
		).toEqual({
			chapter: 27,
			chapterTitle: 'Forecasts',
			additionalChapters: [],
		});
	});

	it('parses a parenthesised-subsection detail without leaking it into the title', () => {
		expect(
			parseLegacyDetail('Aviation Weather Handbook, Chapter 25 -- Analysis (Surface Analysis Chart subsection)'),
		).toEqual({
			chapter: 25,
			chapterTitle: 'Analysis (Surface Analysis Chart subsection)',
			additionalChapters: [],
		});
	});
});

describe('buildProposedYaml', () => {
	it('emits ref + chapter_title + note for the four-forces case', () => {
		const yaml = buildProposedYaml({
			slug: 'afh',
			chapter: 3,
			chapterTitle: 'Basic Flight Maneuvers',
			note: 'Practical flight interpretation of the four forces.',
			redirectedFrom: null,
		});
		expect(yaml).toBe(
			'ref: airboss-ref:handbooks/afh/3\nchapter_title: Basic Flight Maneuvers\nnote: Practical flight interpretation of the four forces.',
		);
	});

	it('omits chapter_title when null', () => {
		const yaml = buildProposedYaml({
			slug: 'afh',
			chapter: null,
			chapterTitle: null,
			note: 'a note',
			redirectedFrom: null,
		});
		expect(yaml).toBe('ref: airboss-ref:handbooks/afh\nnote: a note');
	});

	it('omits note when blank', () => {
		const yaml = buildProposedYaml({
			slug: 'afh',
			chapter: 3,
			chapterTitle: 'X',
			note: '',
			redirectedFrom: null,
		});
		expect(yaml).toBe('ref: airboss-ref:handbooks/afh/3\nchapter_title: X');
	});

	it('includes redirected_from when populated, between chapter_title and note', () => {
		const yaml = buildProposedYaml({
			slug: 'afh',
			chapter: 3,
			chapterTitle: 'Basic Flight Maneuvers',
			note: 'Practical interpretation.',
			redirectedFrom: 'airboss-ref:handbooks/afh/FAA-H-8083-3B/3',
		});
		expect(yaml).toBe(
			'ref: airboss-ref:handbooks/afh/3\n' +
				'chapter_title: Basic Flight Maneuvers\n' +
				'redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B/3\n' +
				'note: Practical interpretation.',
		);
	});

	it('includes redirected_from on a doc-only rewrite (no chapter parseable)', () => {
		const yaml = buildProposedYaml({
			slug: 'afh',
			chapter: null,
			chapterTitle: null,
			note: 'a note',
			redirectedFrom: 'airboss-ref:handbooks/afh/FAA-H-8083-3B',
		});
		expect(yaml).toBe(
			'ref: airboss-ref:handbooks/afh\nredirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B\nnote: a note',
		);
	});
});

describe('buildOriginalAirbossRef', () => {
	it('builds a chapter-pinned URI when slug + edition + chapter are known', () => {
		expect(buildOriginalAirbossRef({ slug: 'afh', edition: 'FAA-H-8083-3B' }, 4)).toBe(
			'airboss-ref:handbooks/afh/FAA-H-8083-3B/4',
		);
	});

	it('builds a doc-only URI when chapter is null', () => {
		expect(buildOriginalAirbossRef({ slug: 'afh', edition: 'FAA-H-8083-3B' }, null)).toBe(
			'airboss-ref:handbooks/afh/FAA-H-8083-3B',
		);
	});

	it('returns null when the legacy source did not parse to a recognised handbook', () => {
		expect(buildOriginalAirbossRef(null, 4)).toBeNull();
		expect(buildOriginalAirbossRef(null, null)).toBeNull();
	});
});

describe('extractLegacyCitations', () => {
	it('extracts every entry from a references block with line numbers', () => {
		const md = [
			'---',
			'id: kn_test',
			'title: Test',
			'references:',
			'  - source: AFH (FAA-H-8083-3B)',
			'    detail: Chapter 3 -- Basic Flight Maneuvers',
			'    note: Practical flight interpretation.',
			'  - source: AC 61-67C',
			'    detail: stall warning',
			'    note: AC reference.',
			'assessable: true',
			'---',
			'',
			'# Body',
			'',
		].join('\n');
		const blocks = extractLegacyCitations(md, 'rel/path/node.md');
		expect(blocks).toHaveLength(2);
		expect(blocks[0].source).toBe('AFH (FAA-H-8083-3B)');
		expect(blocks[0].detail).toBe('Chapter 3 -- Basic Flight Maneuvers');
		expect(blocks[0].note).toBe('Practical flight interpretation.');
		expect(blocks[0].startLine).toBe(5);
		expect(blocks[0].endLine).toBe(7);
		expect(blocks[0].bodyIndent).toBe('    ');
		expect(blocks[1].source).toBe('AC 61-67C');
		expect(blocks[1].startLine).toBe(8);
		expect(blocks[1].endLine).toBe(10);
	});

	it('handles folded-block-scalar notes (`>-`)', () => {
		const md = [
			'---',
			'id: kn_test',
			'references:',
			'  - source: AFH (FAA-H-8083-3B)',
			'    detail: Chapter 3 -- Basic Flight Maneuvers',
			'    note: >-',
			'      Practical recovery procedure in light singles.',
			'      Reduce AOA by relaxing back pressure.',
			'assessable: true',
			'---',
			'',
		].join('\n');
		const blocks = extractLegacyCitations(md, 'rel/path/node.md');
		expect(blocks).toHaveLength(1);
		expect(blocks[0].note).toBe('Practical recovery procedure in light singles. Reduce AOA by relaxing back pressure.');
		expect(blocks[0].endLine).toBe(8);
	});
});

describe('parseExistingTicks', () => {
	it('reads ticked and unticked rows', () => {
		const text = [
			'# Header',
			'',
			'- [ ] **course/knowledge/foo/node.md** (line 32)',
			'    body',
			'- [x] **course/knowledge/bar/node.md** (line 50)',
			'    body',
		].join('\n');
		const ticks = parseExistingTicks(text);
		expect(ticks.get('course/knowledge/foo/node.md:32')).toBe(false);
		expect(ticks.get('course/knowledge/bar/node.md:50')).toBe(true);
	});
});

describe('parseExistingProposedRewrites', () => {
	it('extracts the second yaml fence body for each row, stripped of markdown indent', () => {
		const text = [
			'<!-- migration-row -->',
			'- [x] **course/knowledge/foo/node.md** (line 5)',
			'',
			'  Legacy citation:',
			'',
			'  ```yaml',
			'    - source: AFH (FAA-H-8083-3B)',
			'      detail: Chapter 3 -- Basic Flight Maneuvers',
			'      note: Practical interpretation.',
			'  ```',
			'',
			'  Proposed rewrite:',
			'',
			'  ```yaml',
			'  - ref: airboss-ref:handbooks/afh/3',
			'    chapter_title: Basic Flight Maneuvers',
			'    redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B/3',
			'    note: Practical interpretation.',
			'  ```',
			'',
			'  Slug: `afh`',
		].join('\n');
		const rewrites = parseExistingProposedRewrites(text);
		expect(rewrites.size).toBe(1);
		expect(rewrites.get('course/knowledge/foo/node.md:5')).toBe(
			[
				'- ref: airboss-ref:handbooks/afh/3',
				'  chapter_title: Basic Flight Maneuvers',
				'  redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B/3',
				'  note: Practical interpretation.',
			].join('\n'),
		);
	});

	it('extracts a multi-citation hand-edited block', () => {
		const text = [
			'<!-- migration-row -->',
			'- [x] **course/knowledge/foo/node.md** (line 5)',
			'',
			'  Legacy citation:',
			'',
			'  ```yaml',
			'    - source: AFH (FAA-H-8083-3B)',
			'      detail: Chapter 4 -- Slow Flight, Stalls, and Spins',
			'      note: Stall recovery.',
			'  ```',
			'',
			'  Proposed rewrite:',
			'',
			'  ```yaml',
			'  - ref: airboss-ref:handbooks/afh/5',
			"    chapter_title: 'Maintaining Aircraft Control: Upset Prevention and Recovery'",
			'    redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B/4',
			'    note: Stall recovery -- pinned to current Ch. 5.',
			'  - ref: airboss-ref:handbooks/afh/8083-3B/4',
			"    chapter_title: 'Slow Flight, Stalls, and Spins'",
			'    note: Original 3B Ch. 4 retained for traceability.',
			'  ```',
		].join('\n');
		const rewrites = parseExistingProposedRewrites(text);
		const body = rewrites.get('course/knowledge/foo/node.md:5');
		expect(body).toContain('- ref: airboss-ref:handbooks/afh/5');
		expect(body).toContain('- ref: airboss-ref:handbooks/afh/8083-3B/4');
	});
});

// ---------------------------------------------------------------------------
// Filesystem driver tests
// ---------------------------------------------------------------------------

interface TempRepo {
	root: string;
	nodeMdPath: string;
	originalNodeMd: string;
}

function makeTempRepo(): TempRepo {
	const root = mkdtempSync(join(tmpdir(), 'migrate-citations-'));
	const knowledgeDir = join(root, 'course', 'knowledge', 'aerodynamics', 'four-forces');
	mkdirSync(knowledgeDir, { recursive: true });
	const nodeMd = [
		'---',
		'id: kn_four_forces',
		'title: Four Forces',
		'references:',
		'  - source: AFH (FAA-H-8083-3B)',
		'    detail: Chapter 3 -- Basic Flight Maneuvers',
		'    note: Practical flight interpretation of the four forces.',
		'assessable: true',
		'---',
		'',
		'# Body',
		'',
	].join('\n');
	const nodeMdPath = join(knowledgeDir, 'node.md');
	writeFileSync(nodeMdPath, nodeMd, 'utf8');
	const handbookDir = join(root, 'handbooks', 'afh', 'FAA-H-8083-3C');
	mkdirSync(handbookDir, { recursive: true });
	const manifest = {
		document_slug: 'afh',
		edition: 'FAA-H-8083-3C',
		kind: 'handbook',
		title: 'Airplane Flying Handbook',
		sections: [
			{ level: 'chapter', code: '3', title: 'Basic Flight Maneuvers' },
			{ level: 'chapter', code: '4', title: 'Energy Management: Mastering Altitude and Airspeed Control' },
		],
	};
	writeFileSync(join(handbookDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
	return { root, nodeMdPath, originalNodeMd: nodeMd };
}

function cleanup(repo: TempRepo): void {
	rmSync(repo.root, { recursive: true, force: true });
}

describe('runMigration', () => {
	let repo: TempRepo;
	beforeEach(() => {
		repo = makeTempRepo();
	});
	afterEach(() => {
		cleanup(repo);
	});

	it('--dry-run writes the review file and never modifies source files', () => {
		const before = statSync(repo.nodeMdPath).mtimeMs;
		const report = runMigration({ repoRoot: repo.root, mode: 'dry-run' });
		expect(report.mode).toBe('dry-run');
		expect(report.rowsScanned).toBe(1);
		expect(report.rowsApplied).toBe(0);
		const reviewPath = join(repo.root, REVIEW_FILE_RELPATH);
		const review = readFileSync(reviewPath, 'utf8');
		expect(review).toContain('Knowledge citation migration');
		expect(review).toContain('AFH (FAA-H-8083-3B)');
		expect(review).toContain('airboss-ref:handbooks/afh/3');
		expect(review).toContain('redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B/3');
		expect(review).toContain('Title match: **yes**');
		// Source file untouched.
		const after = readFileSync(repo.nodeMdPath, 'utf8');
		expect(after).toBe(repo.originalNodeMd);
		// mtime tolerance: at minimum the contents must match.
		expect(statSync(repo.nodeMdPath).mtimeMs).toBeGreaterThanOrEqual(before - 1);
	});

	it('--apply with no ticked boxes never modifies source files', () => {
		// Seed a review file with no ticks.
		runMigration({ repoRoot: repo.root, mode: 'dry-run' });
		const reviewPath = join(repo.root, REVIEW_FILE_RELPATH);
		const reviewBefore = readFileSync(reviewPath, 'utf8');
		expect(reviewBefore).not.toMatch(/- \[x\]/);
		const report = runMigration({ repoRoot: repo.root, mode: 'apply' });
		expect(report.mode).toBe('apply');
		expect(report.rowsScanned).toBe(1);
		expect(report.rowsTicked).toBe(0);
		expect(report.rowsApplied).toBe(0);
		const after = readFileSync(repo.nodeMdPath, 'utf8');
		expect(after).toBe(repo.originalNodeMd);
	});

	it('--apply with one ticked box rewrites exactly that citation', () => {
		runMigration({ repoRoot: repo.root, mode: 'dry-run' });
		const reviewPath = join(repo.root, REVIEW_FILE_RELPATH);
		const review = readFileSync(reviewPath, 'utf8');
		const ticked = review.replace('- [ ]', '- [x]');
		writeFileSync(reviewPath, ticked, 'utf8');
		const report = runMigration({ repoRoot: repo.root, mode: 'apply' });
		expect(report.rowsApplied).toBe(1);
		const after = readFileSync(repo.nodeMdPath, 'utf8');
		expect(after).not.toContain('AFH (FAA-H-8083-3B)');
		expect(after).toContain('ref: airboss-ref:handbooks/afh/3');
		expect(after).toContain('chapter_title: Basic Flight Maneuvers');
		expect(after).toContain('redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B/3');
		expect(after).toContain('note: Practical flight interpretation of the four forces.');
	});

	it('--apply uses hand-edited proposed-rewrite YAML when present', () => {
		runMigration({ repoRoot: repo.root, mode: 'dry-run' });
		const reviewPath = join(repo.root, REVIEW_FILE_RELPATH);
		let review = readFileSync(reviewPath, 'utf8');
		// Tick the box.
		review = review.replace('- [ ]', '- [x]');
		// Replace the script-built proposed YAML with a multi-citation hand-edited block.
		// Rebuild the second yaml fence body verbatim.
		const handEdited = [
			'  ```yaml',
			'  - ref: airboss-ref:handbooks/afh/3',
			'    chapter_title: Basic Flight Maneuvers',
			'    redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B/3',
			'    note: Hand-edited note about basic flight maneuvers.',
			'  - ref: airboss-ref:handbooks/afh/8083-3B/3',
			'    chapter_title: Basic Flight Maneuvers',
			"    note: 'Original 3B pin retained for traceability.'",
			'  ```',
		].join('\n');
		review = review.replace(
			/[ ]{2}```yaml\n[ ]{2}- ref: airboss-ref:handbooks\/afh\/3\n[\s\S]*?\n[ ]{2}```/,
			(match, _) => {
				// Only replace the SECOND occurrence (proposed rewrite, not legacy).
				return match;
			},
		);
		// Simpler approach: split and patch the second yaml fence in-place.
		const parts = review.split('\n');
		let yamlFenceCount = 0;
		const newParts: string[] = [];
		let i = 0;
		while (i < parts.length) {
			const l = parts[i];
			if (/^[ ]{2}```yaml\s*$/.test(l)) {
				yamlFenceCount += 1;
				if (yamlFenceCount === 2) {
					// Skip up to the closing fence and replace with handEdited.
					newParts.push(...handEdited.split('\n'));
					i += 1;
					while (i < parts.length && !/^[ ]{2}```\s*$/.test(parts[i])) i += 1;
					i += 1; // skip closing fence; handEdited has its own
					continue;
				}
			}
			newParts.push(l);
			i += 1;
		}
		writeFileSync(reviewPath, newParts.join('\n'), 'utf8');
		const report = runMigration({ repoRoot: repo.root, mode: 'apply' });
		expect(report.rowsApplied).toBe(1);
		const after = readFileSync(repo.nodeMdPath, 'utf8');
		expect(after).not.toContain('AFH (FAA-H-8083-3B)');
		expect(after).toContain('- ref: airboss-ref:handbooks/afh/3');
		expect(after).toContain('- ref: airboss-ref:handbooks/afh/8083-3B/3');
		expect(after).toContain('Hand-edited note about basic flight maneuvers.');
		expect(after).toContain('Original 3B pin retained for traceability.');
	});

	it('idempotent re-run preserves ticks across regeneration', () => {
		runMigration({ repoRoot: repo.root, mode: 'dry-run' });
		const reviewPath = join(repo.root, REVIEW_FILE_RELPATH);
		const r1 = readFileSync(reviewPath, 'utf8');
		const ticked = r1.replace('- [ ]', '- [x]');
		writeFileSync(reviewPath, ticked, 'utf8');
		// Re-run dry-run -- should regenerate but preserve the tick.
		runMigration({ repoRoot: repo.root, mode: 'dry-run' });
		const r2 = readFileSync(reviewPath, 'utf8');
		expect(r2).toContain('- [x] **course/knowledge/aerodynamics/four-forces/node.md** (line 5)');
	});
});
