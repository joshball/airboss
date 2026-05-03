/**
 * Unit tests for `aim/source-ingest.ts`.
 *
 * Focus: the cache-manifest reader and edition-resolution logic. The
 * extraction step (PdfPath -> ExtractedAim) needs a real PDF and is exercised
 * by the smoke + ingest fixture suites; here we cover the manifest-shape +
 * edition-override paths that the chunk-4 review found broken (read
 * `entries[]` vs the actual `primary` + `sections[]` + `appendices[]` shape
 * per ADR 021/022).
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExtractedAim } from './extract.ts';
import { __aim_source_ingest_internal__, parseSourceCliArgs, writeAimDerivatives } from './source-ingest.ts';

const { discoverCachedAim, readAimCorpusManifest } = __aim_source_ingest_internal__;

interface PartialEntry {
	readonly corpus?: string;
	readonly doc?: string;
	readonly edition?: string | null;
	readonly source_url?: string;
	readonly source_filename?: string;
	readonly source_sha256?: string;
	readonly fetched_at?: string;
	readonly size_bytes?: number;
	readonly schema_version?: number;
}

function writeAimManifest(
	cacheRoot: string,
	body: {
		readonly schema_version?: number;
		readonly corpus?: string;
		readonly primary?: PartialEntry | null;
		readonly sections?: readonly PartialEntry[];
		readonly appendices?: readonly PartialEntry[];
		readonly entries?: readonly PartialEntry[];
	},
): string {
	const aimDir = join(cacheRoot, 'aim');
	mkdirSync(aimDir, { recursive: true });
	const manifestPath = join(aimDir, 'manifest.json');
	writeFileSync(manifestPath, JSON.stringify(body), 'utf-8');
	return manifestPath;
}

function makePrimary(overrides: Partial<PartialEntry> = {}): PartialEntry {
	return {
		corpus: 'aim',
		doc: 'aim',
		edition: null,
		source_url: 'https://www.faa.gov/air_traffic/publications/media/aim.pdf',
		source_filename: 'aim.pdf',
		source_sha256: 'a'.repeat(64),
		size_bytes: 1024,
		fetched_at: '2026-04-29T00:00:00.000000+00:00',
		schema_version: 1,
		...overrides,
	};
}

function writePdf(cacheRoot: string, filename: string): void {
	writeFileSync(join(cacheRoot, 'aim', filename), 'fake-pdf-bytes', 'utf-8');
}

let cacheRoot = '';

beforeEach(() => {
	cacheRoot = mkdtempSync(join(tmpdir(), 'aim-source-ingest-test-'));
});

afterEach(() => {
	rmSync(cacheRoot, { recursive: true, force: true });
});

describe('readAimCorpusManifest', () => {
	it('reads a primary + sections + appendices manifest per ADR 021/022', () => {
		const path = writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			primary: makePrimary({ edition: '2026-04' }),
			sections: [
				{
					corpus: 'aim',
					doc: 'aim-chap05-section01',
					edition: null,
					source_url: 'https://www.faa.gov/.../chap5_section_1.html',
					source_filename: 'chap05_section_01.html',
					source_sha256: 'b'.repeat(64),
					fetched_at: '2026-04-29T00:00:00.000000+00:00',
				},
			],
			appendices: [],
		});
		const m = readAimCorpusManifest(path);
		expect(m.corpus).toBe('aim');
		expect(m.primary.edition).toBe('2026-04');
		expect(m.sections).toHaveLength(1);
		expect(m.appendices).toHaveLength(0);
	});

	it('rejects a manifest with the legacy entries[] shape (no primary)', () => {
		// This is exactly the chunk-4 finding: pre-fix the reader required
		// entries[] (legacy shape) and the actual cache writes primary +
		// sections + appendices. The new reader rejects the legacy shape
		// with an explicit message about primary.
		const path = writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			entries: [makePrimary()],
		});
		expect(() => readAimCorpusManifest(path)).toThrow(/missing or malformed 'primary'/);
	});

	it('rejects a manifest whose corpus is not aim', () => {
		const path = writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'ac',
			primary: makePrimary(),
		});
		expect(() => readAimCorpusManifest(path)).toThrow(/expected 'aim'/);
	});
});

describe('discoverCachedAim', () => {
	it('returns no cached entry when the cache dir does not exist', () => {
		const result = discoverCachedAim(join(cacheRoot, 'missing'), null);
		expect(result.cached).toBeNull();
		expect(result.skipped).toEqual([]);
	});

	it('skips with a reason when manifest.json is absent', () => {
		mkdirSync(join(cacheRoot, 'aim'), { recursive: true });
		const result = discoverCachedAim(cacheRoot, null);
		expect(result.cached).toBeNull();
		expect(result.skipped).toHaveLength(1);
		expect(result.skipped[0]).toMatch(/manifest.json: per-corpus manifest not found/);
	});

	it('skips with a reason when manifest is malformed (legacy entries[] shape)', () => {
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			entries: [makePrimary()],
		});
		const result = discoverCachedAim(cacheRoot, null);
		expect(result.cached).toBeNull();
		expect(result.skipped).toHaveLength(1);
		expect(result.skipped[0]).toMatch(/invalid manifest/);
		expect(result.skipped[0]).toMatch(/'primary'/);
	});

	it('uses primary.edition when set and ignores override match', () => {
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			primary: makePrimary({ edition: '2026-04' }),
		});
		writePdf(cacheRoot, 'aim.pdf');
		const result = discoverCachedAim(cacheRoot, '2026-04');
		expect(result.skipped).toEqual([]);
		expect(result.cached).not.toBeNull();
		expect(result.cached?.edition).toBe('2026-04');
		expect(result.cached?.pdfPath).toBe(join(cacheRoot, 'aim', 'aim.pdf'));
	});

	it('skips when override does not match primary.edition', () => {
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			primary: makePrimary({ edition: '2026-04' }),
		});
		writePdf(cacheRoot, 'aim.pdf');
		const result = discoverCachedAim(cacheRoot, '2026-09');
		expect(result.cached).toBeNull();
		expect(result.skipped[0]).toMatch(/does not match cached primary.edition='2026-04'/);
	});

	it('falls back to the override when primary.edition is null (continuous-edition AIM)', () => {
		// AIM ships continuous_edition: true in aim.yaml, so the downloader
		// writes primary.edition=null. The operator must supply --edition.
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			primary: makePrimary({ edition: null }),
		});
		writePdf(cacheRoot, 'aim.pdf');
		const result = discoverCachedAim(cacheRoot, '2026-04');
		expect(result.skipped).toEqual([]);
		expect(result.cached?.edition).toBe('2026-04');
	});

	it('skips when primary.edition is null and no override is given', () => {
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			primary: makePrimary({ edition: null }),
		});
		writePdf(cacheRoot, 'aim.pdf');
		const result = discoverCachedAim(cacheRoot, null);
		expect(result.cached).toBeNull();
		expect(result.skipped[0]).toMatch(/cached primary.edition is null/);
		expect(result.skipped[0]).toMatch(/no --edition=YYYY-MM provided/);
	});

	it('skips when the cached PDF file is missing', () => {
		writeAimManifest(cacheRoot, {
			schema_version: 1,
			corpus: 'aim',
			primary: makePrimary({ edition: '2026-04' }),
		});
		// Note: no writePdf here.
		const result = discoverCachedAim(cacheRoot, null);
		expect(result.cached).toBeNull();
		expect(result.skipped[0]).toMatch(/PDF not found at aim.pdf/);
	});
});

describe('parseSourceCliArgs', () => {
	it('parses --cache, --out, --edition', () => {
		const r = parseSourceCliArgs(['--cache=/tmp/c', '--out=/tmp/o', '--edition=2026-04']);
		if ('error' in r) throw new Error('expected ok');
		expect(r.cacheRoot).toBe('/tmp/c');
		expect(r.derivativeRoot).toBe('/tmp/o');
		expect(r.edition).toBe('2026-04');
	});

	it('rejects unknown args', () => {
		const r = parseSourceCliArgs(['--bogus']);
		expect('error' in r).toBe(true);
	});

	it('handles --help', () => {
		const r = parseSourceCliArgs(['--help']);
		if ('error' in r) throw new Error('expected ok');
		expect(r.help).toBe(true);
	});
});

/**
 * Unit tests for the AIM source-PDF derivative writer.
 *
 * Cluster J (sources & content pipeline 10x review, perf): the writer used
 * to call `writeFileSync` unconditionally, breaking ADR 022's byte-equal
 * idempotent regen contract. These tests pin the post-fix behaviour --
 * re-running the writer with identical inputs produces zero file mutations.
 */

let tempDerivative: string;

beforeEach(() => {
	tempDerivative = mkdtempSync(join(tmpdir(), 'aim-deriv-'));
});

afterEach(() => {
	rmSync(tempDerivative, { recursive: true, force: true });
});

function buildExtracted(): ExtractedAim {
	return {
		chapters: [{ num: '1', title: 'Air Navigation', body: 'Chapter body.' }],
		sections: [{ chapter: '1', section: '1', code: '1-1', title: 'Navigation Aids', body: 'Section body.' }],
		paragraphs: [
			{
				chapter: '1',
				section: '1',
				paragraph: '1',
				code: '1-1-1',
				title: 'General',
				body: 'Paragraph body.',
			},
		],
		appendices: [{ num: '1', title: 'Bird Hazards', body: 'Appendix body.' }],
		glossary: [{ slug: 'absolute-altitude', title: 'ABSOLUTE ALTITUDE', body: 'Altitude above ground.' }],
		skipped: [],
		pageCount: 100,
	};
}

const TEST_EDITION = '2026-04';
const testPrimary = {
	corpus: 'aim',
	doc: 'aim',
	edition: TEST_EDITION,
	source_url: 'https://example.invalid/aim.pdf',
	source_filename: 'aim.pdf',
	source_sha256: 'deadbeef'.repeat(8),
	fetched_at: '2026-04-30T12:00:00.000Z',
} as const;

// Slug shapes derived from the test extract above (see buildExtracted):
//   chapter "1" / "Air Navigation" -> 01-air-navigation
//   section "1-1" / "Navigation Aids" -> 01-navigation-aids
//   paragraph "1-1-1" / "General" -> 01-general
const CH1_DIR = '01-air-navigation';
const SEC1_DIR = '01-navigation-aids';
const CH1_OVERVIEW = '00-air-navigation.md';
const SEC1_OVERVIEW = '00-navigation-aids.md';
const PARA_1_1_1 = '01-general.md';

describe('writeAimDerivatives -- idempotent regen (ADR 022)', () => {
	it('writes the manifest + per-entry markdown on first run', () => {
		const result = writeAimDerivatives({
			extracted: buildExtracted(),
			edition: TEST_EDITION,
			primary: testPrimary,
			derivativeRoot: tempDerivative,
		});
		expect(result.entriesWritten).toBeGreaterThan(0);
		const manifestPath = result.manifestPath;
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { entries: unknown[] };
		expect(manifest.entries.length).toBe(result.entriesWritten);
	});

	it('does not bump mtime on a second run with identical input', () => {
		writeAimDerivatives({
			extracted: buildExtracted(),
			edition: TEST_EDITION,
			primary: testPrimary,
			derivativeRoot: tempDerivative,
		});

		const editionRoot = join(tempDerivative, TEST_EDITION);
		const trackedPaths = [
			join(editionRoot, 'manifest.json'),
			join(editionRoot, CH1_DIR, CH1_OVERVIEW),
			join(editionRoot, CH1_DIR, SEC1_DIR, SEC1_OVERVIEW),
			join(editionRoot, CH1_DIR, SEC1_DIR, PARA_1_1_1),
			join(editionRoot, 'glossary', 'absolute-altitude.md'),
			join(editionRoot, 'appendix-1.md'),
		];

		// Force a measurable mtime gap so a no-op is detectable on a
		// second-resolution mtime filesystem.
		const past = new Date(Date.now() - 5000);
		for (const p of trackedPaths) {
			utimesSync(p, past, past);
		}
		const beforeBytes = trackedPaths.map((p) => readFileSync(p, 'utf-8'));
		const beforeMtimes = trackedPaths.map((p) => statSync(p).mtimeMs);

		writeAimDerivatives({
			extracted: buildExtracted(),
			edition: TEST_EDITION,
			primary: testPrimary,
			derivativeRoot: tempDerivative,
		});

		const afterBytes = trackedPaths.map((p) => readFileSync(p, 'utf-8'));
		const afterMtimes = trackedPaths.map((p) => statSync(p).mtimeMs);
		expect(afterBytes).toEqual(beforeBytes);
		expect(afterMtimes).toEqual(beforeMtimes);
	});

	it('rewrites only changed files when one body changes', () => {
		writeAimDerivatives({
			extracted: buildExtracted(),
			edition: TEST_EDITION,
			primary: testPrimary,
			derivativeRoot: tempDerivative,
		});

		const editionRoot = join(tempDerivative, TEST_EDITION);
		const stableMd = join(editionRoot, CH1_DIR, SEC1_DIR, SEC1_OVERVIEW);
		const changedMd = join(editionRoot, CH1_DIR, SEC1_DIR, PARA_1_1_1);
		const past = new Date(Date.now() - 5000);
		utimesSync(stableMd, past, past);
		utimesSync(changedMd, past, past);
		const stableBefore = statSync(stableMd).mtimeMs;
		const changedBefore = statSync(changedMd).mtimeMs;

		const next = buildExtracted();
		const mutated: ExtractedAim = {
			...next,
			paragraphs: [
				{
					chapter: '1',
					section: '1',
					paragraph: '1',
					code: '1-1-1',
					title: 'General',
					body: 'Paragraph body (revised).',
				},
			],
		};

		writeAimDerivatives({
			extracted: mutated,
			edition: TEST_EDITION,
			primary: testPrimary,
			derivativeRoot: tempDerivative,
		});

		expect(statSync(stableMd).mtimeMs).toBe(stableBefore);
		expect(statSync(changedMd).mtimeMs).not.toBe(changedBefore);
	});
});
