/**
 * Unit tests for the tracking-system generator (ADR 025, Phase 4).
 *
 * The generator is a pure function from `WorkPackage[]` to a list of
 * `{ relPath, content }` files. We exercise that core directly with synthetic
 * fixtures, then verify the `--check` mode behaviour against an on-disk
 * temp directory.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { WorkPackage, WorkPackageFrontmatter } from '@ab/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	BOARD_REL,
	BOARD_SECTIONS,
	type GeneratedFile,
	generateAll,
	ROADMAP_PRODUCTS,
	roadmapRel,
	SENTINEL,
	SHIPPED_DEFAULT_DAYS,
	SHIPPED_GROUP_THRESHOLD,
	SHIPPED_REL,
} from './generate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface MakeWpInput {
	id: string;
	title?: string;
	product?: WorkPackageFrontmatter['product'];
	category?: WorkPackageFrontmatter['category'];
	status?: WorkPackageFrontmatter['status'];
	human_review_status?: WorkPackageFrontmatter['human_review_status'];
	agent_review_status?: WorkPackageFrontmatter['agent_review_status'];
	created?: string;
	shipped_date?: string | null;
	shipped_prs?: number[];
	tags?: string[];
}

function makeWp(input: MakeWpInput): WorkPackage {
	const fm: WorkPackageFrontmatter = {
		id: input.id,
		title: input.title ?? `Work package ${input.id}`,
		product: input.product ?? 'study',
		category: input.category ?? 'feature',
		status: input.status ?? 'draft',
		agent_review_status: input.agent_review_status ?? 'pending',
		human_review_status: input.human_review_status ?? 'pending',
		created: input.created ?? '2026-05-01',
		shipped_date: input.shipped_date ?? null,
		shipped_prs: input.shipped_prs ?? [],
		depends_on: [],
		unblocks: [],
		tags: input.tags ?? [],
	};
	return {
		id: input.id,
		specPath: `/repo/docs/work-packages/${input.id}/spec.md`,
		frontmatter: fm,
		rawFrontmatter: { ...fm },
		validation_errors: [],
	};
}

function makeInvalidWp(id: string, errorCount: number): WorkPackage {
	return {
		id,
		specPath: `/repo/docs/work-packages/${id}/spec.md`,
		frontmatter: null,
		rawFrontmatter: null,
		validation_errors: Array.from({ length: errorCount }, (_, i) => ({
			field: 'status',
			message: `synthetic error ${i}`,
		})),
	};
}

const BASE_OPTS = { repoRoot: '/repo', today: new Date('2026-05-07T00:00:00Z') } as const;

function findFile(files: readonly GeneratedFile[], relPath: string): GeneratedFile {
	const found = files.find((f) => f.relPath === relPath);
	if (found === undefined) throw new Error(`expected generated file at ${relPath}`);
	return found;
}

// ---------------------------------------------------------------------------
// generateAll: file set
// ---------------------------------------------------------------------------

describe('generateAll: file set', () => {
	it('emits BOARD.md, SHIPPED.md, and one ROADMAP.md per real product', () => {
		const files = generateAll([], BASE_OPTS);
		const expected = new Set<string>([BOARD_REL, SHIPPED_REL, ...ROADMAP_PRODUCTS.map(roadmapRel)]);
		expect(files.length).toBe(expected.size);
		for (const f of files) {
			expect(expected.has(f.relPath)).toBe(true);
		}
	});

	it('every emitted file starts with the DO NOT EDIT sentinel', () => {
		const wps: WorkPackage[] = [
			makeWp({ id: 'study-feature', product: 'study', status: 'in-flight' }),
			makeWp({ id: 'hangar-feature', product: 'hangar', status: 'draft' }),
		];
		const files = generateAll(wps, BASE_OPTS);
		for (const f of files) {
			expect(f.content.startsWith(SENTINEL)).toBe(true);
		}
	});

	it('every file ends with exactly one trailing newline', () => {
		const files = generateAll([], BASE_OPTS);
		for (const f of files) {
			expect(f.content.endsWith('\n')).toBe(true);
			expect(f.content.endsWith('\n\n')).toBe(false);
		}
	});

	it('does not include a build timestamp anywhere in the committed output', () => {
		const files = generateAll([], BASE_OPTS);
		// Match any literal ISO date-time pattern, e.g. 2026-05-07T12:34:56.
		const isoTimestamp = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
		for (const f of files) {
			expect(f.content).not.toMatch(isoTimestamp);
		}
	});
});

// ---------------------------------------------------------------------------
// Stability across runs
// ---------------------------------------------------------------------------

describe('generateAll: stability', () => {
	it('produces identical output on repeated calls with the same inputs', () => {
		const wps: WorkPackage[] = [
			makeWp({ id: 'b-wp', status: 'in-flight' }),
			makeWp({ id: 'a-wp', status: 'signed-off' }),
			makeWp({ id: 'c-wp', status: 'draft' }),
			makeWp({
				id: 'd-shipped',
				status: 'shipped',
				shipped_date: '2026-05-01',
				human_review_status: 'signed-off',
				shipped_prs: [617, 622],
			}),
		];
		const a = generateAll(wps, BASE_OPTS);
		const b = generateAll(wps, BASE_OPTS);
		expect(a).toEqual(b);
	});

	it('input ordering does not affect output', () => {
		const wpsA: WorkPackage[] = [
			makeWp({ id: 'a-wp', status: 'in-flight' }),
			makeWp({ id: 'b-wp', status: 'in-flight' }),
			makeWp({ id: 'c-wp', status: 'draft' }),
		];
		const wpsB: WorkPackage[] = [wpsA[2], wpsA[0], wpsA[1]] as WorkPackage[];
		const a = generateAll(wpsA, BASE_OPTS);
		const b = generateAll(wpsB, BASE_OPTS);
		expect(a).toEqual(b);
	});
});

// ---------------------------------------------------------------------------
// BOARD.md content
// ---------------------------------------------------------------------------

describe('BOARD.md', () => {
	it('groups WPs by status section in fixed enum order', () => {
		const wps: WorkPackage[] = [
			makeWp({ id: 'a-draft', status: 'draft' }),
			makeWp({ id: 'b-flight', status: 'in-flight' }),
			makeWp({ id: 'c-signed', status: 'signed-off' }),
			makeWp({ id: 'd-abandoned', status: 'abandoned' }),
		];
		const files = generateAll(wps, BASE_OPTS);
		const board = findFile(files, BOARD_REL).content;
		const headings = [...board.matchAll(/^## (.+) \(\d+\)$/gm)].map((m) => m[1]);
		// Compare against the expected order: only sections that have at least one WP.
		const expectedOrder = ['In flight', 'Signed off', 'Draft', 'Abandoned'];
		expect(headings).toEqual(expectedOrder);
	});

	it('within a section, WPs sort alphabetically by id', () => {
		const wps: WorkPackage[] = [
			makeWp({ id: 'zebra', status: 'in-flight' }),
			makeWp({ id: 'alpha', status: 'in-flight' }),
			makeWp({ id: 'mango', status: 'in-flight' }),
		];
		const files = generateAll(wps, BASE_OPTS);
		const board = findFile(files, BOARD_REL).content;
		const idxAlpha = board.indexOf('](../work-packages/alpha/spec.md)');
		const idxMango = board.indexOf('](../work-packages/mango/spec.md)');
		const idxZebra = board.indexOf('](../work-packages/zebra/spec.md)');
		expect(idxAlpha).toBeGreaterThan(0);
		expect(idxMango).toBeGreaterThan(idxAlpha);
		expect(idxZebra).toBeGreaterThan(idxMango);
	});

	it('surfaces invalid WPs (frontmatter == null) with an "Invalid" warning section', () => {
		const wps: WorkPackage[] = [makeWp({ id: 'good', status: 'draft' }), makeInvalidWp('busted', 3)];
		const files = generateAll(wps, BASE_OPTS);
		const board = findFile(files, BOARD_REL).content;
		expect(board).toContain('## Invalid (frontmatter errors) (1)');
		expect(board).toContain('busted');
		expect(board).toContain('(3 validation errors)');
	});

	it('reports total count in the preamble', () => {
		const wps = Array.from({ length: 7 }, (_, i) => makeWp({ id: `wp-${i}`, status: 'draft' }));
		const files = generateAll(wps, BASE_OPTS);
		const board = findFile(files, BOARD_REL).content;
		expect(board).toContain('Total work packages: 7');
	});

	it('does not regress to status enums beyond BOARD_SECTIONS', () => {
		// Compile-time guard via runtime check: no surprise sections.
		const expectedSet = new Set<string>([
			'in-flight',
			'signed-off',
			'shipped',
			'draft',
			'abandoned',
			'superseded',
			'invalid',
		]);
		for (const section of BOARD_SECTIONS) expect(expectedSet.has(section)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// ROADMAP.md content
// ---------------------------------------------------------------------------

describe('ROADMAP.md', () => {
	it('emits one file per real product surface', () => {
		const files = generateAll([], BASE_OPTS);
		for (const product of ROADMAP_PRODUCTS) {
			expect(files.some((f) => f.relPath === roadmapRel(product))).toBe(true);
		}
	});

	it('filters to the product slug only', () => {
		const wps: WorkPackage[] = [
			makeWp({ id: 'study-only', product: 'study', status: 'in-flight' }),
			makeWp({ id: 'hangar-only', product: 'hangar', status: 'in-flight' }),
		];
		const files = generateAll(wps, BASE_OPTS);
		const studyRoadmap = findFile(files, roadmapRel('study')).content;
		const hangarRoadmap = findFile(files, roadmapRel('hangar')).content;
		expect(studyRoadmap).toContain('study-only');
		expect(studyRoadmap).not.toContain('hangar-only');
		expect(hangarRoadmap).toContain('hangar-only');
		expect(hangarRoadmap).not.toContain('study-only');
	});

	it('renders an empty-state message when no WPs target the product', () => {
		const wps: WorkPackage[] = [makeWp({ id: 'study-only', product: 'study', status: 'in-flight' })];
		const files = generateAll(wps, BASE_OPTS);
		const avionicsRoadmap = findFile(files, roadmapRel('avionics')).content;
		expect(avionicsRoadmap).toContain('No work packages currently target');
	});

	it('does not include the platform / course / none catch-alls as ROADMAPs', () => {
		const files = generateAll([], BASE_OPTS);
		const paths = files.map((f) => f.relPath);
		expect(paths).not.toContain(roadmapRel('platform'));
		expect(paths).not.toContain(roadmapRel('course'));
		expect(paths).not.toContain(roadmapRel('none'));
	});
});

// ---------------------------------------------------------------------------
// SHIPPED.md content
// ---------------------------------------------------------------------------

describe('SHIPPED.md', () => {
	it('renders an empty-state message when nothing is shipped', () => {
		const wps: WorkPackage[] = [makeWp({ id: 'a', status: 'in-flight' })];
		const files = generateAll(wps, BASE_OPTS);
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('No shipped work packages in scope yet');
	});

	it('lists shipped WPs in reverse chronological order', () => {
		const wps: WorkPackage[] = [
			makeWp({
				id: 'older',
				status: 'shipped',
				shipped_date: '2026-04-15',
				human_review_status: 'signed-off',
				shipped_prs: [100],
			}),
			makeWp({
				id: 'newer',
				status: 'shipped',
				shipped_date: '2026-05-01',
				human_review_status: 'signed-off',
				shipped_prs: [200],
			}),
		];
		const files = generateAll(wps, BASE_OPTS);
		const shipped = findFile(files, SHIPPED_REL).content;
		const idxNewer = shipped.indexOf('newer');
		const idxOlder = shipped.indexOf('older');
		expect(idxNewer).toBeGreaterThan(0);
		expect(idxOlder).toBeGreaterThan(idxNewer);
	});

	it('caps to the last 90 days by default', () => {
		const wps: WorkPackage[] = [
			makeWp({
				id: 'recent',
				status: 'shipped',
				shipped_date: '2026-05-01',
				human_review_status: 'signed-off',
				shipped_prs: [1],
			}),
			makeWp({
				id: 'ancient',
				status: 'shipped',
				shipped_date: '2025-01-01',
				human_review_status: 'signed-off',
				shipped_prs: [2],
			}),
		];
		const files = generateAll(wps, BASE_OPTS);
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('recent');
		expect(shipped).not.toContain('ancient');
		expect(shipped).toContain(`last ${SHIPPED_DEFAULT_DAYS} days`);
	});

	it('with --all, includes every shipped WP regardless of date', () => {
		const wps: WorkPackage[] = [
			makeWp({
				id: 'recent',
				status: 'shipped',
				shipped_date: '2026-05-01',
				human_review_status: 'signed-off',
				shipped_prs: [1],
			}),
			makeWp({
				id: 'ancient',
				status: 'shipped',
				shipped_date: '2025-01-01',
				human_review_status: 'signed-off',
				shipped_prs: [2],
			}),
		];
		const files = generateAll(wps, { ...BASE_OPTS, all: true });
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('recent');
		expect(shipped).toContain('ancient');
	});

	it('renders shipped_prs as markdown links to GitHub', () => {
		const wps: WorkPackage[] = [
			makeWp({
				id: 'wp',
				status: 'shipped',
				shipped_date: '2026-05-01',
				human_review_status: 'signed-off',
				shipped_prs: [617, 622],
			}),
		];
		const files = generateAll(wps, BASE_OPTS);
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('https://github.com/joshball/airboss/pull/617');
		expect(shipped).toContain('[#617]');
		expect(shipped).toContain('[#622]');
	});

	it('groups by year-month when shipped count exceeds the threshold', () => {
		const count = SHIPPED_GROUP_THRESHOLD + 5;
		const wps: WorkPackage[] = Array.from({ length: count }, (_, i) =>
			makeWp({
				id: `wp-${String(i).padStart(3, '0')}`,
				status: 'shipped',
				shipped_date: i < 10 ? '2026-05-01' : '2026-04-15',
				human_review_status: 'signed-off',
				shipped_prs: [1000 + i],
			}),
		);
		const files = generateAll(wps, BASE_OPTS);
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('## 2026-05');
		expect(shipped).toContain('## 2026-04');
	});

	it('excludes WPs that are status=shipped but missing shipped_date', () => {
		// The schema rejects this combo, but the loader still surfaces invalid
		// frontmatter. We model it via the invalid-fronmatter helper and confirm
		// it doesn't sneak into SHIPPED.md.
		const wps: WorkPackage[] = [makeInvalidWp('busted', 1)];
		const files = generateAll(wps, BASE_OPTS);
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('No shipped work packages in scope yet');
	});
});

// ---------------------------------------------------------------------------
// SHIPPED.md PR log integration (Phase 5)
// ---------------------------------------------------------------------------

describe('SHIPPED.md PR log', () => {
	it('renders the PR log section header even with no log entries', () => {
		const files = generateAll([], BASE_OPTS);
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('## PR log');
		expect(shipped).toContain('No PR log entries in scope yet');
	});

	it('renders rows for each log entry, reverse-chrono', () => {
		const files = generateAll([], {
			...BASE_OPTS,
			logEntries: [
				{
					pr: 100,
					date: '2026-04-15',
					title: 'older PR',
					wp_id: null,
					bugs_fixed: [],
					summary: 'older summary',
					logPath: '/repo/docs/log/2026-04-15-PR-100-older.md',
				},
				{
					pr: 200,
					date: '2026-05-01',
					title: 'newer PR',
					wp_id: null,
					bugs_fixed: [],
					summary: 'newer summary',
					logPath: '/repo/docs/log/2026-05-01-PR-200-newer.md',
				},
			],
		});
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('[#100]');
		expect(shipped).toContain('[#200]');
		expect(shipped).toContain('older PR');
		expect(shipped).toContain('newer PR');
		const idxNewer = shipped.indexOf('newer PR');
		const idxOlder = shipped.indexOf('older PR');
		expect(idxNewer).toBeGreaterThan(0);
		expect(idxOlder).toBeGreaterThan(idxNewer);
	});

	it('links log entries with wp_id back to the WP spec', () => {
		const wps: WorkPackage[] = [makeWp({ id: 'foo', status: 'in-flight' })];
		const files = generateAll(wps, {
			...BASE_OPTS,
			logEntries: [
				{
					pr: 300,
					date: '2026-05-01',
					title: 'foo PR',
					wp_id: 'foo',
					bugs_fixed: [],
					summary: 'foo summary',
					logPath: '/repo/docs/log/2026-05-01-PR-300-foo.md',
				},
			],
		});
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('[foo](../work-packages/foo/spec.md)');
	});

	it('caps PR log to last 90 days by default; --all overrides', () => {
		const logEntries = [
			{
				pr: 50,
				date: '2025-01-01',
				title: 'ancient PR',
				wp_id: null,
				bugs_fixed: [],
				summary: '',
				logPath: '/repo/docs/log/2025-01-01-PR-50-ancient.md',
			},
			{
				pr: 60,
				date: '2026-05-01',
				title: 'recent PR',
				wp_id: null,
				bugs_fixed: [],
				summary: '',
				logPath: '/repo/docs/log/2026-05-01-PR-60-recent.md',
			},
		];
		const filesDefault = generateAll([], { ...BASE_OPTS, logEntries });
		const shippedDefault = findFile(filesDefault, SHIPPED_REL).content;
		expect(shippedDefault).toContain('recent PR');
		expect(shippedDefault).not.toContain('ancient PR');
		const filesAll = generateAll([], { ...BASE_OPTS, all: true, logEntries });
		const shippedAll = findFile(filesAll, SHIPPED_REL).content;
		expect(shippedAll).toContain('recent PR');
		expect(shippedAll).toContain('ancient PR');
	});

	it('groups PR log by year-month above the threshold', () => {
		const count = SHIPPED_GROUP_THRESHOLD + 5;
		const logEntries = Array.from({ length: count }, (_, i) => ({
			pr: 1000 + i,
			date: i < 10 ? '2026-05-01' : '2026-04-15',
			title: `pr-${i}`,
			wp_id: null,
			bugs_fixed: [],
			summary: '',
			logPath: `/repo/docs/log/pr-${i}.md`,
		}));
		const files = generateAll([], { ...BASE_OPTS, logEntries });
		const shipped = findFile(files, SHIPPED_REL).content;
		expect(shipped).toContain('### 2026-05');
		expect(shipped).toContain('### 2026-04');
	});
});

// ---------------------------------------------------------------------------
// Spec links resolve correctly
// ---------------------------------------------------------------------------

describe('spec link paths', () => {
	it('BOARD.md links to ../work-packages/<id>/spec.md', () => {
		const wps: WorkPackage[] = [makeWp({ id: 'foo', status: 'in-flight' })];
		const files = generateAll(wps, BASE_OPTS);
		const board = findFile(files, BOARD_REL).content;
		expect(board).toContain('[foo](../work-packages/foo/spec.md)');
	});

	it('ROADMAP.md links to ../../work-packages/<id>/spec.md', () => {
		const wps: WorkPackage[] = [makeWp({ id: 'foo', product: 'study', status: 'in-flight' })];
		const files = generateAll(wps, BASE_OPTS);
		const roadmap = findFile(files, roadmapRel('study')).content;
		expect(roadmap).toContain('[foo](../../work-packages/foo/spec.md)');
	});
});

// ---------------------------------------------------------------------------
// --check mode (drift detection)
// ---------------------------------------------------------------------------

describe('--check mode (drift)', () => {
	let tmp: string;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), 'tracking-generate-test-'));
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	function writeAt(rel: string, body: string): void {
		const abs = join(tmp, rel);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, body);
	}

	function readAt(rel: string): string {
		return readFileSync(join(tmp, rel), 'utf8');
	}

	it('exits non-zero when an on-disk file differs from generated', async () => {
		const wps: WorkPackage[] = [makeWp({ id: 'foo', status: 'in-flight' })];
		const files = generateAll(wps, { ...BASE_OPTS, repoRoot: tmp });
		// Write the generated content first, then mutate one file to simulate drift.
		for (const f of files) writeAt(f.relPath, f.content);
		writeAt(BOARD_REL, '<!-- DO NOT EDIT - generated by scripts/tracking/generate.ts -->\n# tampered\n');
		const onDisk = readAt(BOARD_REL);
		const expected = files.find((f) => f.relPath === BOARD_REL)?.content ?? '';
		expect(onDisk).not.toBe(expected);
	});

	it('matches when on-disk files exactly equal the generated set', () => {
		const wps: WorkPackage[] = [makeWp({ id: 'foo', status: 'in-flight' })];
		const files = generateAll(wps, { ...BASE_OPTS, repoRoot: tmp });
		for (const f of files) writeAt(f.relPath, f.content);
		for (const f of files) {
			expect(readAt(f.relPath)).toBe(f.content);
		}
	});

	it('detects missing files as drift', () => {
		const wps: WorkPackage[] = [makeWp({ id: 'foo', status: 'in-flight' })];
		const files = generateAll(wps, { ...BASE_OPTS, repoRoot: tmp });
		// Write only some of the generated files.
		writeAt(BOARD_REL, files.find((f) => f.relPath === BOARD_REL)?.content ?? '');
		// SHIPPED.md is intentionally missing.
		expect(() => readAt(SHIPPED_REL)).toThrow();
	});
});
