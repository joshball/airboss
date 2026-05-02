/**
 * Unit tests for the `handbooks-extras` ingest pipeline.
 *
 * The smoke path uses the live developer cache (the 6 cached PDFs); the
 * unit tests here use a self-contained fake cache so the suite runs on any
 * machine that has poppler installed. Both layers are necessary -- the
 * fake-cache tests cover error / skip paths the live cache never exercises.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCacheRoot } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry } from '../registry/__test_helpers__.ts';
import { _setHandbooksExtrasYamlPath, readExtrasCorpusIndex } from './derivative-reader.ts';
import { DOC_ID_TO_FRIENDLY, parseCliArgs, runHandbooksExtrasIngest } from './ingest.ts';

let tempCache: string;
let tempDerivative: string;
let tempYaml: string;

function writeYaml(entries: ReadonlyArray<{ doc_id: string; edition: string | null; filename: string }>): void {
	const yaml =
		`base_url: https://example.invalid\nentries:\n` +
		entries
			.map(
				(e) =>
					`  - doc_id: ${e.doc_id}\n    edition: ${e.edition === null ? 'null' : `'${e.edition}'`}\n    url: https://example.invalid/${e.filename}\n    filename: ${e.filename}\n`,
			)
			.join('');
	writeFileSync(tempYaml, yaml, 'utf-8');
}

function writeCacheManifest(docId: string, edition: string | null): void {
	const dir = join(tempCache, 'handbooks', docId);
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, 'manifest.json'),
		`${JSON.stringify(
			{
				schema_version: 1,
				corpus: 'handbooks',
				doc: docId,
				edition,
				primary: {
					corpus: 'handbooks',
					doc: docId,
					edition,
					source_url: `https://example.invalid/${docId}.pdf`,
					source_filename: `${docId}.pdf`,
					source_sha256: 'deadbeef'.repeat(8),
					size_bytes: 1024,
					fetched_at: '2026-04-30T12:00:00.000Z',
					last_modified: 'Thu, 02 Jun 2022 20:16:25 GMT',
					schema_version: 1,
				},
			},
			null,
			2,
		)}\n`,
		'utf-8',
	);
}

beforeEach(() => {
	tempCache = mkdtempSync(join(tmpdir(), 'hbx-cache-'));
	tempDerivative = mkdtempSync(join(tmpdir(), 'hbx-deriv-'));
	const yamlDir = mkdtempSync(join(tmpdir(), 'hbx-yaml-'));
	tempYaml = join(yamlDir, 'handbooks-extras.yaml');
	_setHandbooksExtrasYamlPath(tempYaml);
	resetRegistry();
});

afterEach(() => {
	_setHandbooksExtrasYamlPath(null);
	rmSync(tempCache, { recursive: true, force: true });
	rmSync(tempDerivative, { recursive: true, force: true });
	resetRegistry();
});

describe('parseCliArgs', () => {
	it('parses --cache and --out', () => {
		const r = parseCliArgs(['--cache=/tmp/c', '--out=/tmp/o']);
		if ('error' in r) throw new Error('expected ok');
		expect(r.cacheRoot).toBe('/tmp/c');
		expect(r.derivativeRoot).toBe('/tmp/o');
	});

	it('rejects unknown args', () => {
		const r = parseCliArgs(['--bogus']);
		expect('error' in r).toBe(true);
	});

	it('handles --help', () => {
		const r = parseCliArgs(['--help']);
		if ('error' in r) throw new Error('expected ok');
		expect(r.help).toBe(true);
	});
});

describe('DOC_ID_TO_FRIENDLY', () => {
	it('covers every doc_id in the canonical YAML', () => {
		// Authoritative list per scripts/sources/config/handbooks-extras.yaml. If
		// this drifts, ingest.test.ts fails before the live YAML can mismatch.
		const expected = [
			'faa-h-8083-2',
			'faa-h-8083-9',
			'faa-h-8083-15',
			'faa-h-8083-16',
			'faa-h-8083-30',
			'faa-h-8083-32',
		];
		for (const docId of expected) {
			expect(DOC_ID_TO_FRIENDLY[docId]).toBeDefined();
		}
	});
});

describe('runHandbooksExtrasIngest -- empty cache', () => {
	it('walks a cache with no matching downloads and reports zero ingestion gracefully', async () => {
		// One YAML entry but no cached PDF -- the typical state on a machine
		// that hasn't run `sources download --include-handbooks-extras` yet.
		writeYaml([{ doc_id: 'faa-h-8083-2', edition: '2A', filename: 'risk_management_handbook_2A.pdf' }]);
		const report = await runHandbooksExtrasIngest({ cacheRoot: tempCache, derivativeRoot: tempDerivative });
		expect(report.ingested).toBe(0);
		expect(report.skipped).toBe(1);
		expect(report.promotionBatchId).toBeNull();
		// Index still gets written (empty entries[] -- nothing actually ingested).
		expect(existsSync(report.indexPath)).toBe(true);
		const idx = readExtrasCorpusIndex(tempDerivative);
		expect(idx?.entries).toEqual([]);
	});

	it('reports skip with reason when YAML lists a doc not in cache', async () => {
		writeYaml([{ doc_id: 'faa-h-8083-2', edition: '2A', filename: 'risk_management_handbook_2A.pdf' }]);
		const report = await runHandbooksExtrasIngest({ cacheRoot: tempCache, derivativeRoot: tempDerivative });
		expect(report.ingested).toBe(0);
		expect(report.skipped).toBe(1);
		expect(report.skipReasons.length).toBe(1);
		const reason = report.skipReasons[0] ?? '';
		expect(reason).toContain('faa-h-8083-2');
		expect(reason).toContain('PDF not cached');
	});

	it('reports skip when YAML has an unmapped doc_id', async () => {
		writeYaml([{ doc_id: 'faa-h-9999-99', edition: 'Z', filename: 'made_up.pdf' }]);
		const report = await runHandbooksExtrasIngest({ cacheRoot: tempCache, derivativeRoot: tempDerivative });
		expect(report.ingested).toBe(0);
		expect(report.skipped).toBe(1);
		const reason = report.skipReasons[0] ?? '';
		expect(reason).toContain('faa-h-9999-99');
		expect(reason).toContain('DOC_ID_TO_FRIENDLY');
	});

	it('reports skip when cache manifest is missing', async () => {
		writeYaml([{ doc_id: 'faa-h-8083-2', edition: '2A', filename: 'rmh.pdf' }]);
		// Create the dir + PDF but no manifest.json
		mkdirSync(join(tempCache, 'handbooks', 'faa-h-8083-2'), { recursive: true });
		writeFileSync(join(tempCache, 'handbooks', 'faa-h-8083-2', 'faa-h-8083-2.pdf'), 'fake', 'utf-8');
		const report = await runHandbooksExtrasIngest({ cacheRoot: tempCache, derivativeRoot: tempDerivative });
		expect(report.skipped).toBe(1);
		expect(report.skipReasons[0] ?? '').toContain('cache manifest not found');
	});

	it('reports skip when extraction fails (non-PDF bytes)', async () => {
		writeYaml([{ doc_id: 'faa-h-8083-2', edition: '2A', filename: 'rmh.pdf' }]);
		writeCacheManifest('faa-h-8083-2', '2A');
		// Write a non-PDF as the "PDF" so extractPdf fails downstream.
		writeFileSync(join(tempCache, 'handbooks', 'faa-h-8083-2', 'faa-h-8083-2.pdf'), 'not a pdf', 'utf-8');
		const report = await runHandbooksExtrasIngest({ cacheRoot: tempCache, derivativeRoot: tempDerivative });
		expect(report.ingested).toBe(0);
		expect(report.skipped).toBeGreaterThanOrEqual(1);
		expect(report.skipReasons.some((r) => r.includes('faa-h-8083-2'))).toBe(true);
	});
});

describe('runHandbooksExtrasIngest -- live cache (smoke)', () => {
	const liveCache = resolveCacheRoot({ ensureExists: false });
	const haveLiveCache = existsSync(join(liveCache, 'handbooks', 'faa-h-8083-2', 'faa-h-8083-2.pdf'));

	(haveLiveCache ? it : it.skip)(
		'ingests all 7 cached handbooks against the live YAML',
		async () => {
			// Use the live YAML so this also validates that the YAML and
			// DOC_ID_TO_FRIENDLY agree.
			_setHandbooksExtrasYamlPath(null);
			const report = await runHandbooksExtrasIngest({ cacheRoot: liveCache, derivativeRoot: tempDerivative });
			expect(report.ingested).toBe(7);
			expect(report.skipped).toBe(0);
			expect(report.promotionBatchId).not.toBeNull();
			// Each derivative has a manifest + body
			for (const slug of [
				'risk-management',
				'aviation-instructor',
				'ifh',
				'iph',
				'amt-general',
				'amt-powerplant',
				'tips-mountain-flying',
			]) {
				const dir = join(tempDerivative, slug);
				expect(existsSync(dir)).toBe(true);
			}

			// Re-running is idempotent (every entry already accepted).
			// Cluster J fix (ADR 022): re-running with identical inputs must
			// produce zero file mutations on disk. Force a measurable mtime
			// gap, re-run, then assert mtime is unchanged on the tracked
			// derivative outputs + the corpus index.
			const trackedPaths = [
				join(tempDerivative, 'handbooks-extras-index.json'),
				join(tempDerivative, 'risk-management', 'FAA-H-8083-2A', 'manifest.json'),
				join(tempDerivative, 'risk-management', 'FAA-H-8083-2A', 'document.md'),
			];
			const past = new Date(Date.now() - 5000);
			for (const p of trackedPaths) {
				utimesSync(p, past, past);
			}
			const beforeBytes = trackedPaths.map((p) => readFileSync(p, 'utf-8'));
			const beforeMtimes = trackedPaths.map((p) => statSync(p).mtimeMs);

			const second = await runHandbooksExtrasIngest({ cacheRoot: liveCache, derivativeRoot: tempDerivative });
			expect(second.ingested).toBe(0);
			expect(second.alreadyAccepted).toBe(7);
			expect(second.promotionBatchId).toBeNull();

			const afterBytes = trackedPaths.map((p) => readFileSync(p, 'utf-8'));
			const afterMtimes = trackedPaths.map((p) => statSync(p).mtimeMs);
			expect(afterBytes).toEqual(beforeBytes);
			expect(afterMtimes).toEqual(beforeMtimes);

			// Manifest carries the whole-doc body_path that the resolver short-circuits on.
			const rmhManifestPath = join(tempDerivative, 'risk-management', 'FAA-H-8083-2A', 'manifest.json');
			const rmhManifest = JSON.parse(readFileSync(rmhManifestPath, 'utf-8')) as Record<string, unknown>;
			expect(rmhManifest.body_path).toBe('handbooks/risk-management/FAA-H-8083-2A/document.md');
			expect(rmhManifest.sections).toEqual([]);
		},
		// The smoke test runs the full extract pipeline twice (initial + the
		// idempotency re-check), so 7 entries means 14 PDF extractions. Each
		// takes ~30-60s; observed total is 400-520s on a warm cache. Budget
		// 720s to keep CI green even on cold-cache + slower-machine runs.
		720000,
	);
});
