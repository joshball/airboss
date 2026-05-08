/**
 * Tests for the handbook-* plugin shared helpers (warnings.json + manifest.json
 * readers, page-number / caption / mode extractors).
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	extractCaption,
	extractImageStats,
	extractMode,
	extractPageNumber,
	HandbookManifestError,
	listHandbookEditions,
	readManifest,
	readWarnings,
} from './handbook-shared';

let workspace: string;

beforeEach(async () => {
	workspace = await mkdir(
		path.join(tmpdir(), `airboss-ingest-test-${Date.now()}-${Math.random().toString(16).slice(2)}`),
		{
			recursive: true,
		},
	).then(() => path.join(tmpdir(), `airboss-ingest-test-${Date.now()}-${Math.random().toString(16).slice(2)}`));
	// The mkdir-then-redeclare dance happens because `mkdir` returns the
	// resolved path on success. We just want a unique sandbox per test.
	await mkdir(workspace, { recursive: true });
});

afterEach(async () => {
	if (workspace) await rm(workspace, { recursive: true, force: true });
});

async function seedHandbook(slug: string, edition: string, warnings: unknown, manifest: unknown): Promise<void> {
	const dir = path.join(workspace, 'handbooks', slug, edition);
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, 'warnings.json'), JSON.stringify(warnings), 'utf8');
	await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
}

describe('extractPageNumber', () => {
	it('parses the literal page number out of a warning message', () => {
		expect(
			extractPageNumber(
				'Caption `Figure 4-7. Koch chart.` on page 83 had no paired image. -> mode: image-extracted-elsewhere',
			),
		).toBe(83);
	});

	it('returns null when no page mention is present', () => {
		expect(extractPageNumber('empty-section-kept: section had no body.')).toBeNull();
	});
});

describe('extractCaption', () => {
	it('pulls the back-quoted caption text', () => {
		expect(extractCaption('Caption `Figure 4-7. Koch chart sample.` on page 83 had no paired image.')).toBe(
			'Figure 4-7. Koch chart sample.',
		);
	});

	it('returns null when no quotes are present', () => {
		expect(extractCaption('Image on page 7 (index 3, 480x320) had no paired caption.')).toBeNull();
	});
});

describe('extractMode', () => {
	it('parses the `-> mode: ...` tail', () => {
		expect(extractMode('foo bar -> mode: image-extracted-elsewhere')).toBe('image-extracted-elsewhere');
	});

	it('returns `unknown` when the mode is missing', () => {
		expect(extractMode('caption-without-figure: nothing here')).toBe('unknown');
	});
});

describe('extractImageStats', () => {
	it('parses index/width/height out of a figure-without-caption message', () => {
		expect(extractImageStats('Image on page 7 (index 3, 480x320) had no paired caption.')).toEqual({
			index: 3,
			width: 480,
			height: 320,
		});
	});

	it('returns null when the stats are missing', () => {
		expect(extractImageStats('Image on some unspecified page had no caption.')).toBeNull();
	});
});

describe('listHandbookEditions', () => {
	it('returns nothing when the handbooks directory is missing', async () => {
		expect(await listHandbookEditions(workspace)).toEqual([]);
	});

	it('lists every (slug, edition) pair that has both warnings.json and manifest.json', async () => {
		await seedHandbook(
			'ifh',
			'FAA-H-8083-15B',
			{ document_slug: 'ifh', edition: 'FAA-H-8083-15B', warnings: [] },
			{ document_slug: 'ifh', edition: 'FAA-H-8083-15B', figures: [] },
		);
		await seedHandbook(
			'phak',
			'FAA-H-8083-25C',
			{ document_slug: 'phak', edition: 'FAA-H-8083-25C', warnings: [] },
			{ document_slug: 'phak', edition: 'FAA-H-8083-25C', figures: [] },
		);
		const out = await listHandbookEditions(workspace);
		expect(out).toHaveLength(2);
		expect(out.map((e) => e.slug)).toEqual(['ifh', 'phak']);
	});

	it('filters by slug when supplied', async () => {
		await seedHandbook(
			'ifh',
			'FAA-H-8083-15B',
			{ document_slug: 'ifh', edition: 'FAA-H-8083-15B', warnings: [] },
			{ document_slug: 'ifh', edition: 'FAA-H-8083-15B', figures: [] },
		);
		await seedHandbook(
			'phak',
			'FAA-H-8083-25C',
			{ document_slug: 'phak', edition: 'FAA-H-8083-25C', warnings: [] },
			{ document_slug: 'phak', edition: 'FAA-H-8083-25C', figures: [] },
		);
		const out = await listHandbookEditions(workspace, 'ifh');
		expect(out.map((e) => e.slug)).toEqual(['ifh']);
	});
});

describe('readWarnings', () => {
	it('parses a valid file', async () => {
		await seedHandbook(
			'ifh',
			'FAA-H-8083-15B',
			{
				document_slug: 'ifh',
				edition: 'FAA-H-8083-15B',
				warnings: [{ id: 'aaa111', code: 'caption-without-figure', section_code: '4', message: 'fixture' }],
			},
			{ document_slug: 'ifh', edition: 'FAA-H-8083-15B', figures: [] },
		);
		const editions = await listHandbookEditions(workspace, 'ifh');
		expect(editions).toHaveLength(1);
		const target = editions[0];
		if (!target) throw new Error('target edition missing');
		const result = await readWarnings(target.warningsPath);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]?.id).toBe('aaa111');
	});

	it('throws HandbookManifestError on malformed JSON', async () => {
		const dir = path.join(workspace, 'handbooks', 'ifh', 'FAA-H-8083-15B');
		await mkdir(dir, { recursive: true });
		await writeFile(path.join(dir, 'warnings.json'), 'not json', 'utf8');
		await expect(readWarnings(path.join(dir, 'warnings.json'))).rejects.toBeInstanceOf(HandbookManifestError);
	});
});

describe('readManifest', () => {
	it('parses a valid file', async () => {
		await seedHandbook(
			'ifh',
			'FAA-H-8083-15B',
			{ document_slug: 'ifh', edition: 'FAA-H-8083-15B', warnings: [] },
			{
				document_slug: 'ifh',
				edition: 'FAA-H-8083-15B',
				figures: [
					{
						id: 'fig-1-1-00',
						section_code: '1.1',
						ordinal: 0,
						caption: 'Figure 1-1.',
						asset_path: 'handbooks/ifh/FAA-H-8083-15B/figures/fig-1-00.png',
						width: 1,
						height: 1,
					},
				],
			},
		);
		const editions = await listHandbookEditions(workspace, 'ifh');
		expect(editions).toHaveLength(1);
		const target = editions[0];
		if (!target) throw new Error('target edition missing');
		const result = await readManifest(target.manifestPath);
		expect(result.figures).toHaveLength(1);
		expect(result.figures[0]?.id).toBe('fig-1-1-00');
	});
});
