/**
 * Unit tests for the binary-visual fetch pipeline. Exercises the happy,
 * no-change, and edition-drift paths with every external dependency
 * (resolver, downloader, thumbnail, archive reader, db updater) injected.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JobContext, JobProgress } from '@ab/hangar-jobs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	formatEditionDiff,
	handleBinaryVisualFetch,
	runSectionalFetch,
	type SectionalFetchInput,
} from './source-fetch';

vi.mock('@ab/audit', () => ({
	AUDIT_OPS: { CREATE: 'create', UPDATE: 'update', DELETE: 'delete' },
	auditWrite: vi.fn(async () => {}),
}));

const TMP_ROOT = join(import.meta.dirname, '__tmp_sectional__');

async function freshTmp() {
	await rm(TMP_ROOT, { recursive: true, force: true });
	await mkdir(TMP_ROOT, { recursive: true });
	await mkdir(join(TMP_ROOT, 'data', 'sources', 'sectional', 'sectional-denver'), { recursive: true });
}

interface FakeCtx {
	ctx: JobContext;
	events: string[];
	stdout: string[];
	stderr: string[];
	progress: JobProgress[];
}

function fakeCtx(): FakeCtx {
	const events: string[] = [];
	const stdout: string[] = [];
	const stderr: string[] = [];
	const progress: JobProgress[] = [];
	const ctx: JobContext = {
		job: {
			id: 'job_bv_1',
			kind: 'fetch-source',
			status: 'running',
			targetType: 'hangar.source',
			targetId: 'sectional-denver',
			actorId: 'actor_1',
			progress: {},
			payload: { sourceId: 'sectional-denver' },
			// biome-ignore lint/suspicious/noExplicitAny: test-only narrow.
			result: null as any,
			// biome-ignore lint/suspicious/noExplicitAny: test-only narrow.
			error: null as any,
			// biome-ignore lint/suspicious/noExplicitAny: test-only narrow.
			createdAt: new Date() as any,
			startedAt: new Date(),
			finishedAt: null,
		},
		reportProgress: async (p) => {
			progress.push(p);
		},
		logStdout: async (l) => {
			stdout.push(l);
		},
		logStderr: async (l) => {
			stderr.push(l);
		},
		logEvent: async (l) => {
			events.push(l);
		},
		isCancelled: async () => false,
	};
	return { ctx, events, stdout, stderr, progress };
}

function baseRow(overrides: Partial<Record<string, unknown>> = {}): SectionalFetchInput['row'] {
	const literal = {
		id: 'sectional-denver',
		rev: 1,
		type: 'sectional',
		title: 'Denver VFR Sectional Chart',
		version: 'pending-download',
		url: 'https://aeronav.faa.gov/visual/{edition-date}/sectional-files/{region}.zip',
		path: 'data/sources/sectional/sectional-denver',
		format: 'geotiff-zip',
		checksum: 'pending-download',
		downloadedAt: 'pending-download',
		sizeBytes: null,
		locatorShape: {
			region: 'Denver',
			index_url: 'https://aeronav.faa.gov/visual/',
			cadence_days: 56,
			kind: 'binary-visual',
		},
		media: null,
		edition: null,
		dirty: false,
		updatedBy: null,
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
	return literal as unknown as SectionalFetchInput['row'];
}

describe('runSectionalFetch happy path', () => {
	beforeEach(freshTmp);
	afterEach(async () => rm(TMP_ROOT, { recursive: true, force: true }));

	it('resolves edition, downloads, writes thumb + meta.json, updates row', async () => {
		const { ctx, events, progress } = fakeCtx();
		const row = baseRow();

		const fakeArchiveBytes = new Uint8Array([
			0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		]);
		const thumbBytes = new Uint8Array([0xff, 0xd8, 0xff]);

		const dbPatches: Array<{ id: string; patch: Record<string, unknown> }> = [];
		const outcome = await runSectionalFetch(
			ctx,
			{
				row,
				repoRoot: TMP_ROOT,
				fetchHtml: async () => '<p>Denver 2026-03-21 Edition 116</p>',
			},
			{
				resolver: async (o) => ({
					effectiveDate: '2026-03-21',
					editionNumber: 116,
					resolvedUrl: `https://host/${o.region}.zip`,
					resolvedAt: '2026-04-24T12:00:00.000Z',
				}),
				downloader: async (_url, dest) => {
					await writeFile(dest, fakeArchiveBytes);
					return { sha256: 'aa'.repeat(32), fileSize: fakeArchiveBytes.length };
				},
				thumbnail: async (opts) => {
					await writeFile(opts.outPath, thumbBytes);
					return {
						thumbnailPath: opts.recordedPath,
						thumbnailSha256: 'bb'.repeat(32),
						thumbnailSizeBytes: thumbBytes.length,
						generator: 'gdal_translate',
					};
				},
				readArchive: async () => [{ name: 'Denver.tif', sizeBytes: 100 }],
				dbUpdate: async (id, patch) => {
					dbPatches.push({ id, patch: patch as Record<string, unknown> });
				},
				now: () => new Date('2026-04-24T12:00:00.000Z'),
			},
		);

		expect(outcome.kind).toBe('fetched');
		expect(outcome.editionDate).toBe('2026-03-21');
		expect(outcome.sha256).toBe('aa'.repeat(32));
		expect(outcome.generator).toBe('gdal_translate');
		expect(outcome.archiveEntries).toEqual([{ name: 'Denver.tif', sizeBytes: 100 }]);

		// Disk layout
		const editionDir = join(TMP_ROOT, 'data/sources/sectional/sectional-denver/2026-03-21');
		const archive = await readFile(join(editionDir, 'chart.zip'));
		expect(archive.length).toBe(fakeArchiveBytes.length);
		const meta = JSON.parse(await readFile(join(editionDir, 'meta.json'), 'utf8'));
		expect(meta.edition.effectiveDate).toBe('2026-03-21');
		expect(meta.media.generator).toBe('gdal_translate');

		// DB update patch.
		expect(dbPatches).toHaveLength(1);
		expect(dbPatches[0]?.patch.checksum).toBe('aa'.repeat(32));
		expect(dbPatches[0]?.patch.version).toBe('2026-03-21');

		// Events include the pipeline steps.
		const eventText = events.join('\n');
		expect(eventText).toContain('edition resolved');
		expect(eventText).toContain('downloading');
		expect(eventText).toContain('thumbnail generated');
		expect(progress.some((p) => p.message === 'done')).toBe(true);
	});

	it('short-circuits with no-change when edition + sha + size match', async () => {
		const { ctx, events } = fakeCtx();
		// Pre-populate a matching edition + media + archive on disk.
		const editionDir = join(TMP_ROOT, 'data/sources/sectional/sectional-denver/2026-03-21');
		await mkdir(editionDir, { recursive: true });
		const bytes = new Uint8Array([1, 2, 3, 4, 5]);
		await writeFile(join(editionDir, 'chart.zip'), bytes);

		// Pre-compute the sha so the row's checksum matches.
		const { createHash } = await import('node:crypto');
		const expectedSha = createHash('sha256').update(bytes).digest('hex');

		const row = baseRow({
			checksum: expectedSha,
			sizeBytes: bytes.length,
			edition: {
				effectiveDate: '2026-03-21',
				editionNumber: 116,
				resolvedUrl: 'https://host/Denver.zip',
				resolvedAt: '2026-04-24T12:00:00.000Z',
			},
			media: {
				thumbnailPath: 'data/sources/sectional/sectional-denver/2026-03-21/thumb.jpg',
				thumbnailSha256: 'bb',
				thumbnailSizeBytes: 100,
				archiveEntries: [{ name: 'x', sizeBytes: 1 }],
				generator: 'gdal_translate',
			},
		});

		const downloaderCalled = vi.fn();
		const outcome = await runSectionalFetch(
			ctx,
			{ row, repoRoot: TMP_ROOT, fetchHtml: async () => '' },
			{
				resolver: async () => ({
					effectiveDate: '2026-03-21',
					editionNumber: 116,
					resolvedUrl: 'https://host/Denver.zip',
					resolvedAt: 'now',
				}),
				downloader: async (...a) => {
					downloaderCalled(...a);
					return { sha256: '', fileSize: 0 };
				},
				thumbnail: async () => ({
					thumbnailPath: 'x',
					thumbnailSha256: 'x',
					thumbnailSizeBytes: 0,
					generator: 'gdal_translate',
				}),
				dbUpdate: async () => {},
			},
		);

		expect(outcome.kind).toBe('no-change');
		expect(downloaderCalled).not.toHaveBeenCalled();
		expect(events.join('\n')).toContain('no change');
	});

	it('throws edition-drift when same edition date but different sha', async () => {
		const { ctx } = fakeCtx();
		const row = baseRow({
			checksum: 'oldsha',
			edition: {
				effectiveDate: '2026-03-21',
				editionNumber: 116,
				resolvedUrl: 'https://host/Denver.zip',
				resolvedAt: '2026-04-01T00:00:00.000Z',
			},
		});

		await expect(
			runSectionalFetch(
				ctx,
				{ row, repoRoot: TMP_ROOT, fetchHtml: async () => '' },
				{
					resolver: async () => ({
						effectiveDate: '2026-03-21',
						editionNumber: 116,
						resolvedUrl: 'https://host/Denver2.zip',
						resolvedAt: 'now',
					}),
					downloader: async (_url, dest) => {
						await writeFile(dest, new Uint8Array([9, 9, 9]));
						return { sha256: 'newsha', fileSize: 3 };
					},
					thumbnail: async () => ({
						thumbnailPath: '',
						thumbnailSha256: '',
						thumbnailSizeBytes: 0,
						generator: 'gdal_translate',
					}),
					readArchive: async () => [],
					dbUpdate: async () => {},
				},
			),
		).rejects.toThrow(/edition-drift/);
	});

	it('rejects when locator_shape.region is missing', async () => {
		const { ctx } = fakeCtx();
		const row = baseRow({ locatorShape: { index_url: 'x' } });
		await expect(runSectionalFetch(ctx, { row, repoRoot: TMP_ROOT, fetchHtml: async () => '' }, {})).rejects.toThrow(
			/region/,
		);
	});
});

describe('formatEditionDiff', () => {
	it('labels a fresh edition', () => {
		expect(
			formatEditionDiff(null, {
				effectiveDate: '2026-03-21',
				editionNumber: 116,
				resolvedUrl: 'x',
				resolvedAt: 'y',
			}),
		).toContain('no prior edition');
	});

	it('labels an edition advance', () => {
		expect(
			formatEditionDiff(
				{ effectiveDate: '2026-01-24', editionNumber: 115, resolvedUrl: 'x', resolvedAt: 'y' },
				{ effectiveDate: '2026-03-21', editionNumber: 116, resolvedUrl: 'x2', resolvedAt: 'y2' },
			),
		).toContain('prior was 2026-01-24');
	});

	it('labels no-change on matching edition', () => {
		const e = { effectiveDate: '2026-03-21', editionNumber: 116, resolvedUrl: 'x', resolvedAt: 'y' };
		expect(formatEditionDiff(e, e)).toContain('no edition change');
	});
});

describe('handleBinaryVisualFetch dispatcher', () => {
	beforeEach(freshTmp);
	afterEach(async () => rm(TMP_ROOT, { recursive: true, force: true }));

	it('throws when the source kind does not match binary-visual', async () => {
		const { ctx } = fakeCtx();
		await expect(
			handleBinaryVisualFetch(ctx, 'cfr-14', {
				repoRoot: TMP_ROOT,
				loadSource: async () => baseRow({ type: 'cfr' }),
			}),
		).rejects.toThrow(/not a binary-visual kind/);
	});

	it('throws when the source is not found', async () => {
		const { ctx } = fakeCtx();
		await expect(
			handleBinaryVisualFetch(ctx, 'missing', { repoRoot: TMP_ROOT, loadSource: async () => null }),
		).rejects.toThrow(/not found/);
	});
});
