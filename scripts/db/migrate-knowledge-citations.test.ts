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
	buildProposedYaml,
	extractLegacyCitations,
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

	it('returns null when no edition tag is present', () => {
		expect(parseLegacySource('AFH')).toBeNull();
	});

	it('returns null for unrecognised handbook strings', () => {
		expect(parseLegacySource('AOPA Air Safety Institute')).toBeNull();
	});

	it('extracts PHAK slug + edition', () => {
		expect(parseLegacySource('PHAK (FAA-H-8083-25C)')).toEqual({ slug: 'phak', edition: 'FAA-H-8083-25C' });
	});
});

describe('parseLegacyDetail', () => {
	it('parses `Chapter 3 -- Basic Flight Maneuvers`', () => {
		expect(parseLegacyDetail('Chapter 3 -- Basic Flight Maneuvers')).toEqual({
			chapter: 3,
			chapterTitle: 'Basic Flight Maneuvers',
		});
	});

	it('parses `Chapter 4 -- Slow Flight, Stalls, and Spins`', () => {
		expect(parseLegacyDetail('Chapter 4 -- Slow Flight, Stalls, and Spins')).toEqual({
			chapter: 4,
			chapterTitle: 'Slow Flight, Stalls, and Spins',
		});
	});

	it('returns null chapter for free-text detail', () => {
		expect(parseLegacyDetail('Recovery from unusual attitudes (visual)')).toEqual({
			chapter: null,
			chapterTitle: null,
		});
	});

	it('parses `Chapter 16 -- Navigation` (multi-digit)', () => {
		expect(parseLegacyDetail('Chapter 16 -- Navigation')).toEqual({ chapter: 16, chapterTitle: 'Navigation' });
	});
});

describe('buildProposedYaml', () => {
	it('emits ref + chapter_title + note for the four-forces case', () => {
		const yaml = buildProposedYaml({
			slug: 'afh',
			chapter: 3,
			chapterTitle: 'Basic Flight Maneuvers',
			note: 'Practical flight interpretation of the four forces.',
		});
		expect(yaml).toBe(
			'ref: airboss-ref:handbooks/afh/3\nchapter_title: Basic Flight Maneuvers\nnote: Practical flight interpretation of the four forces.',
		);
	});

	it('omits chapter_title when null', () => {
		const yaml = buildProposedYaml({ slug: 'afh', chapter: null, chapterTitle: null, note: 'a note' });
		expect(yaml).toBe('ref: airboss-ref:handbooks/afh\nnote: a note');
	});

	it('omits note when blank', () => {
		const yaml = buildProposedYaml({ slug: 'afh', chapter: 3, chapterTitle: 'X', note: '' });
		expect(yaml).toBe('ref: airboss-ref:handbooks/afh/3\nchapter_title: X');
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
		expect(after).toContain('note: Practical flight interpretation of the four forces.');
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
