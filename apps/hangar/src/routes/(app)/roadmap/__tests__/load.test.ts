/**
 * Unit tests for the `/roadmap` index + `/roadmap/[wp_id]` detail loaders.
 *
 *   - Index: filters narrow the row list; facet counts are computed off the
 *     un-filtered set; an empty filter set returns every row including
 *     unparseable WPs; the search term narrows id+title.
 *   - Detail: missing WP returns 404; missing sub-doc files (tasks.md, etc.)
 *     drop from the panels list silently; existing sub-docs render markdown
 *     to HTML; depends_on / unblocks resolve to the matching WP rows.
 *
 * The wp-loader is mocked per-test so we don't read the real on-disk WP
 * corpus from this test file.
 */

import type { WorkPackage } from '@ab/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SAMPLE_WPS: WorkPackage[] = [
	{
		id: 'alpha-feature',
		specPath: '/repo/docs/work-packages/alpha-feature/spec.md',
		frontmatter: {
			id: 'alpha-feature',
			title: 'Alpha feature',
			product: 'study',
			category: 'feature',
			status: 'in-flight',
			agent_review_status: 'pending',
			human_review_status: 'pending',
			created: '2026-04-01',
			shipped_prs: [],
			depends_on: ['beta-feature'],
			unblocks: [],
			tags: ['alpha', 'experiment'],
		},
		rawFrontmatter: {},
		validation_errors: [],
	},
	{
		id: 'beta-feature',
		specPath: '/repo/docs/work-packages/beta-feature/spec.md',
		frontmatter: {
			id: 'beta-feature',
			title: 'Beta feature',
			product: 'hangar',
			category: 'platform',
			status: 'shipped',
			agent_review_status: 'done',
			human_review_status: 'signed-off',
			created: '2026-03-01',
			shipped_date: '2026-04-15',
			shipped_prs: [617, 622],
			depends_on: [],
			unblocks: ['alpha-feature'],
			tags: ['beta'],
		},
		rawFrontmatter: {},
		validation_errors: [],
	},
	{
		id: 'broken-wp',
		specPath: '/repo/docs/work-packages/broken-wp/spec.md',
		frontmatter: null,
		rawFrontmatter: null,
		validation_errors: [{ field: '<frontmatter>', message: 'YAML parse error: bad indent' }],
	},
];

function installLoaderMock(wps: WorkPackage[] = SAMPLE_WPS): void {
	vi.doMock('@ab/wp-loader', () => ({
		loadAllWorkPackages: () => wps,
		isShipped: (wp: WorkPackage) => wp.frontmatter?.status === 'shipped',
	}));
}

beforeEach(() => {
	vi.resetModules();
	vi.doMock('@ab/auth', () => ({
		requireRole: () => ({ id: 'user_test', role: 'admin' }),
	}));
});

afterEach(() => {
	vi.restoreAllMocks();
});

interface LoadEventStub {
	url: URL;
	params: Record<string, string>;
}

function makeEvent(url: string, params: Record<string, string> = {}): LoadEventStub {
	return {
		url: new URL(url),
		params,
	};
}

/** SvelteKit `PageServerLoad` is typed as `(event) => MaybePromise<void | T>`,
 * which makes property accesses on the awaited result implicitly `void` for
 * the type checker. Every test path here returns a real object; this helper
 * narrows it so the assertions compile without per-call casts. */
async function runLoader<TResult>(load: unknown, event: LoadEventStub): Promise<TResult> {
	const fn = load as (event: unknown) => unknown | Promise<unknown>;
	const result = await fn(event);
	if (result === undefined || result === null) {
		throw new Error('loader returned void');
	}
	return result as TResult;
}

interface IndexResult {
	rows: ReadonlyArray<{ id: string; title: string; status: string | null }>;
	filters: {
		product: string | null;
		category: string | null;
		status: string | null;
		humanReview: string | null;
		tag: string | null;
		search: string;
	};
	facets: {
		products: ReadonlyArray<{ value: string; count: number }>;
		categories: ReadonlyArray<{ value: string; count: number }>;
		statuses: ReadonlyArray<{ value: string; count: number }>;
		humanReviews: ReadonlyArray<{ value: string; count: number }>;
		agentReviews: ReadonlyArray<{ value: string; count: number }>;
	};
	totalCount: number;
	filteredCount: number;
}

interface DetailResult {
	id: string;
	panels: ReadonlyArray<{ key: string; label: string; bodyHtml: string }>;
	dependsOn: ReadonlyArray<{ id: string; status: string | null; exists: boolean }>;
	activeTab: string;
	shippedPrs: ReadonlyArray<{ number: number; url: string }>;
}

describe('/roadmap index loader', () => {
	it('returns every WP when no filters are set', async () => {
		installLoaderMock();
		const mod = await import('../+page.server');
		const result = await runLoader<IndexResult>(mod.load, makeEvent('http://hangar.test/roadmap'));
		// Row count includes the unparseable WP (visible when no concrete
		// filter is active so authors notice the breakage).
		expect(result.rows.map((r) => r.id).sort()).toEqual(['alpha-feature', 'beta-feature', 'broken-wp']);
		expect(result.totalCount).toBe(3);
		expect(result.filteredCount).toBe(3);
	});

	it('filters by product narrows the result list', async () => {
		installLoaderMock();
		const mod = await import('../+page.server');
		const result = await runLoader<IndexResult>(mod.load, makeEvent('http://hangar.test/roadmap?product=hangar'));
		expect(result.rows.map((r) => r.id)).toEqual(['beta-feature']);
	});

	it('filters by status narrows the result list', async () => {
		installLoaderMock();
		const mod = await import('../+page.server');
		const result = await runLoader<IndexResult>(mod.load, makeEvent('http://hangar.test/roadmap?status=shipped'));
		expect(result.rows.map((r) => r.id)).toEqual(['beta-feature']);
	});

	it('filters by tag narrows the result list', async () => {
		installLoaderMock();
		const mod = await import('../+page.server');
		const result = await runLoader<IndexResult>(mod.load, makeEvent('http://hangar.test/roadmap?tag=alpha'));
		expect(result.rows.map((r) => r.id)).toEqual(['alpha-feature']);
	});

	it('search term narrows the result list by id+title substring', async () => {
		installLoaderMock();
		const mod = await import('../+page.server');
		const result = await runLoader<IndexResult>(mod.load, makeEvent('http://hangar.test/roadmap?q=beta'));
		expect(result.rows.map((r) => r.id)).toEqual(['beta-feature']);
	});

	it('hides unparseable WPs when a concrete filter is active', async () => {
		installLoaderMock();
		const mod = await import('../+page.server');
		const result = await runLoader<IndexResult>(mod.load, makeEvent('http://hangar.test/roadmap?status=shipped'));
		expect(result.rows.find((r) => r.id === 'broken-wp')).toBeUndefined();
	});

	it('facet counts are computed against the un-filtered set', async () => {
		installLoaderMock();
		const mod = await import('../+page.server');
		const result = await runLoader<IndexResult>(mod.load, makeEvent('http://hangar.test/roadmap?product=hangar'));
		// Even though `product=hangar` filtered the row list to one WP,
		// the product facet still shows study=1 + hangar=1 so a chip click
		// to switch to study works.
		const study = result.facets.products.find((f) => f.value === 'study');
		const hangar = result.facets.products.find((f) => f.value === 'hangar');
		expect(study?.count).toBe(1);
		expect(hangar?.count).toBe(1);
	});

	it('drops invalid filter values silently (server side)', async () => {
		installLoaderMock();
		const mod = await import('../+page.server');
		const result = await runLoader<IndexResult>(
			mod.load,
			makeEvent('http://hangar.test/roadmap?product=not-a-product&status=fake'),
		);
		expect(result.filters.product).toBeNull();
		expect(result.filters.status).toBeNull();
		// All rows still surface.
		expect(result.rows).toHaveLength(3);
	});
});

describe('/roadmap/[wp_id] detail loader', () => {
	it('throws 404 when the WP id does not match any known WP', async () => {
		installLoaderMock();
		const mod = await import('../[wp_id]/+page.server');
		const event = makeEvent('http://hangar.test/roadmap/missing', { wp_id: 'missing' });
		await expect(async () => runLoader<DetailResult>(mod.load, event)).rejects.toMatchObject({ status: 404 });
	});

	it('throws 404 when the WP id has invalid characters', async () => {
		installLoaderMock();
		const mod = await import('../[wp_id]/+page.server');
		const event = makeEvent('http://hangar.test/roadmap/bad..id', { wp_id: 'bad..id' });
		await expect(async () => runLoader<DetailResult>(mod.load, event)).rejects.toMatchObject({ status: 404 });
	});

	it('renders only the sub-docs that exist on disk and resolves dependencies', async () => {
		installLoaderMock();
		// Mock node:fs so existsSync returns true for spec.md only;
		// readFileSync returns a frontmatter-prefixed body that the loader
		// strips before feeding to renderMarkdown.
		vi.doMock('node:fs', () => ({
			existsSync: (path: string) => /\/spec\.md$/.test(path),
			readFileSync: () => '---\nid: alpha-feature\n---\n\n## Section\n\nBody.',
		}));
		const mod = await import('../[wp_id]/+page.server');
		const event = makeEvent('http://hangar.test/roadmap/alpha-feature', { wp_id: 'alpha-feature' });
		const result = await runLoader<DetailResult>(mod.load, event);
		expect(result.id).toBe('alpha-feature');
		expect(result.panels.map((p) => p.key)).toEqual(['spec']);
		// Frontmatter fence is stripped before rendering.
		expect(result.panels[0]?.bodyHtml).not.toContain('---');
		expect(result.panels[0]?.bodyHtml).toContain('Section');
		expect(result.dependsOn).toHaveLength(1);
		expect(result.dependsOn[0]).toMatchObject({ id: 'beta-feature', exists: true, status: 'shipped' });
	});

	it('marks dependencies as missing when the target id is not on disk', async () => {
		const lonely: WorkPackage[] = [
			{
				...SAMPLE_WPS[0],
				frontmatter: { ...SAMPLE_WPS[0].frontmatter, depends_on: ['ghost-wp'], unblocks: [] } as NonNullable<
					(typeof SAMPLE_WPS)[0]['frontmatter']
				>,
			} as WorkPackage,
		];
		installLoaderMock(lonely);
		vi.doMock('node:fs', () => ({
			existsSync: () => false,
			readFileSync: () => '',
		}));
		const mod = await import('../[wp_id]/+page.server');
		const event = makeEvent('http://hangar.test/roadmap/alpha-feature', { wp_id: 'alpha-feature' });
		const result = await runLoader<DetailResult>(mod.load, event);
		expect(result.dependsOn).toEqual([{ id: 'ghost-wp', status: null, exists: false }]);
	});

	it('honors the ?tab query when valid; falls back to the first panel otherwise', async () => {
		installLoaderMock();
		vi.doMock('node:fs', () => ({
			existsSync: (path: string) => /(spec|tasks)\.md$/.test(path),
			readFileSync: () => '## Section',
		}));
		const mod = await import('../[wp_id]/+page.server');
		const valid = await runLoader<DetailResult>(
			mod.load,
			makeEvent('http://hangar.test/roadmap/alpha-feature?tab=tasks', { wp_id: 'alpha-feature' }),
		);
		expect(valid.activeTab).toBe('tasks');
		const bogus = await runLoader<DetailResult>(
			mod.load,
			makeEvent('http://hangar.test/roadmap/alpha-feature?tab=fake', { wp_id: 'alpha-feature' }),
		);
		expect(bogus.activeTab).toBe('spec');
	});

	it('builds GitHub PR URLs for shipped_prs', async () => {
		installLoaderMock();
		vi.doMock('node:fs', () => ({
			existsSync: () => false,
			readFileSync: () => '',
		}));
		const mod = await import('../[wp_id]/+page.server');
		const event = makeEvent('http://hangar.test/roadmap/beta-feature', { wp_id: 'beta-feature' });
		const result = await runLoader<DetailResult>(mod.load, event);
		expect(result.shippedPrs).toEqual([
			{ number: 617, url: 'https://github.com/joshball/airboss/pull/617' },
			{ number: 622, url: 'https://github.com/joshball/airboss/pull/622' },
		]);
	});
});
