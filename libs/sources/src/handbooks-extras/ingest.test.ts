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
import { _setHandbooksExtrasYamlPath, loadHandbooksExtrasYaml, readExtrasCorpusIndex } from './derivative-reader.ts';
import { DOC_ID_TO_FRIENDLY, parseCliArgs, runHandbooksExtrasIngest } from './ingest.ts';

let tempCache: string;
let tempDerivative: string;
let tempYaml: string;

interface TestYamlEntry {
	doc_id: string;
	edition: string | null;
	filename: string;
	/** Defaults to `[human-factors]` so existing tests don't have to spell it out. */
	subjects?: readonly string[];
	/** Defaults to `null` (cert-agnostic). Use the literal string `'private'` etc. for typed values. */
	primary_cert?: string | null;
}

function writeYaml(entries: ReadonlyArray<TestYamlEntry>): void {
	const yaml =
		`base_url: https://example.invalid\nentries:\n` +
		entries
			.map((e) => {
				const subjects = e.subjects ?? ['human-factors'];
				const primaryCert = 'primary_cert' in e ? e.primary_cert : null;
				const certLine = primaryCert === null ? 'null' : primaryCert;
				return (
					`  - doc_id: ${e.doc_id}\n` +
					`    edition: ${e.edition === null ? 'null' : `'${e.edition}'`}\n` +
					`    url: https://example.invalid/${e.filename}\n` +
					`    filename: ${e.filename}\n` +
					`    subjects: [${subjects.join(', ')}]\n` +
					`    primary_cert: ${certLine}\n`
				);
			})
			.join('');
	writeFileSync(tempYaml, yaml, 'utf-8');
}

/** Write a raw YAML string -- for tests that exercise validation failures. */
function writeRawYaml(yaml: string): void {
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
		const expected = ['faa-h-8083-2', 'faa-h-8083-9', 'faa-h-8083-15', 'faa-h-8083-16'];
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

describe('loadHandbooksExtrasYaml -- subjects + primary_cert validation', () => {
	it('rejects a row missing subjects', () => {
		writeRawYaml(
			[
				`base_url: https://example.invalid`,
				`entries:`,
				`  - doc_id: faa-h-8083-2`,
				`    edition: '2A'`,
				`    url: https://example.invalid/rmh.pdf`,
				`    filename: rmh.pdf`,
				`    primary_cert: private`,
				``,
			].join('\n'),
		);
		expect(() => loadHandbooksExtrasYaml()).toThrow(/invalid subjects/i);
	});

	it('rejects subjects with 0 entries', () => {
		writeYaml([{ doc_id: 'faa-h-8083-2', edition: '2A', filename: 'rmh.pdf', subjects: [] }]);
		expect(() => loadHandbooksExtrasYaml()).toThrow(/invalid subjects/i);
	});

	it('rejects subjects with 4+ entries', () => {
		writeYaml([
			{
				doc_id: 'faa-h-8083-2',
				edition: '2A',
				filename: 'rmh.pdf',
				subjects: ['weather', 'navigation', 'procedures', 'performance'],
			},
		]);
		expect(() => loadHandbooksExtrasYaml()).toThrow(/invalid subjects/i);
	});

	it('rejects an unknown subject value', () => {
		writeYaml([{ doc_id: 'faa-h-8083-2', edition: '2A', filename: 'rmh.pdf', subjects: ['made-up-topic'] }]);
		expect(() => loadHandbooksExtrasYaml()).toThrow(/invalid subjects/i);
	});

	it('rejects a row missing primary_cert entirely', () => {
		writeRawYaml(
			[
				`base_url: https://example.invalid`,
				`entries:`,
				`  - doc_id: faa-h-8083-2`,
				`    edition: '2A'`,
				`    url: https://example.invalid/rmh.pdf`,
				`    filename: rmh.pdf`,
				`    subjects: [human-factors]`,
				``,
			].join('\n'),
		);
		expect(() => loadHandbooksExtrasYaml()).toThrow(/missing primary_cert/i);
	});

	it('rejects an unknown primary_cert value', () => {
		writeYaml([
			{
				doc_id: 'faa-h-8083-2',
				edition: '2A',
				filename: 'rmh.pdf',
				subjects: ['human-factors'],
				primary_cert: 'made-up-cert',
			},
		]);
		expect(() => loadHandbooksExtrasYaml()).toThrow(/invalid primary_cert/i);
	});

	it('accepts null primary_cert (cert-agnostic)', () => {
		writeYaml([
			{
				doc_id: 'faa-h-8083-2',
				edition: '2A',
				filename: 'rmh.pdf',
				subjects: ['human-factors'],
				primary_cert: null,
			},
		]);
		const yaml = loadHandbooksExtrasYaml();
		expect(yaml.entries).toHaveLength(1);
		expect(yaml.entries[0]?.primary_cert).toBeNull();
		expect(yaml.entries[0]?.subjects).toEqual(['human-factors']);
	});

	it('accepts a typed primary_cert', () => {
		writeYaml([
			{
				doc_id: 'faa-h-8083-2',
				edition: '2A',
				filename: 'rmh.pdf',
				subjects: ['human-factors'],
				primary_cert: 'private',
			},
		]);
		const yaml = loadHandbooksExtrasYaml();
		expect(yaml.entries[0]?.primary_cert).toBe('private');
	});
});

describe('loadHandbooksExtrasYaml -- body_override validation', () => {
	it('accepts a string body_override path', () => {
		writeRawYaml(
			[
				`base_url: https://example.invalid`,
				`entries:`,
				`  - doc_id: faa-mtn-tips`,
				`    edition: '2003'`,
				`    url: https://example.invalid/mtn.pdf`,
				`    filename: mtn.pdf`,
				`    subjects: [weather]`,
				`    primary_cert: null`,
				`    body_override: scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md`,
				``,
			].join('\n'),
		);
		const yaml = loadHandbooksExtrasYaml();
		expect(yaml.entries[0]?.body_override).toBe('scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md');
	});

	it('treats absent body_override as undefined', () => {
		writeYaml([
			{
				doc_id: 'faa-h-8083-2',
				edition: '2A',
				filename: 'rmh.pdf',
				subjects: ['human-factors'],
				primary_cert: 'private',
			},
		]);
		const yaml = loadHandbooksExtrasYaml();
		expect(yaml.entries[0]?.body_override).toBeUndefined();
	});

	it('rejects a non-string body_override', () => {
		writeRawYaml(
			[
				`base_url: https://example.invalid`,
				`entries:`,
				`  - doc_id: faa-mtn-tips`,
				`    edition: '2003'`,
				`    url: https://example.invalid/mtn.pdf`,
				`    filename: mtn.pdf`,
				`    subjects: [weather]`,
				`    primary_cert: null`,
				`    body_override: 42`,
				``,
			].join('\n'),
		);
		expect(() => loadHandbooksExtrasYaml()).toThrow(/invalid body_override/i);
	});

	it('rejects an empty body_override', () => {
		writeRawYaml(
			[
				`base_url: https://example.invalid`,
				`entries:`,
				`  - doc_id: faa-mtn-tips`,
				`    edition: '2003'`,
				`    url: https://example.invalid/mtn.pdf`,
				`    filename: mtn.pdf`,
				`    subjects: [weather]`,
				`    primary_cert: null`,
				`    body_override: ''`,
				``,
			].join('\n'),
		);
		expect(() => loadHandbooksExtrasYaml()).toThrow(/invalid body_override/i);
	});
});

describe('runHandbooksExtrasIngest -- live cache (smoke)', () => {
	const liveCache = resolveCacheRoot({ ensureExists: false });
	const haveLiveCache = existsSync(join(liveCache, 'handbooks', 'faa-h-8083-2', 'faa-h-8083-2.pdf'));

	(haveLiveCache ? it : it.skip)(
		'ingests all 5 active cached handbooks against the live YAML',
		async () => {
			// Use the live YAML so this also validates that the YAML and
			// DOC_ID_TO_FRIENDLY agree.
			_setHandbooksExtrasYamlPath(null);
			const report = await runHandbooksExtrasIngest({ cacheRoot: liveCache, derivativeRoot: tempDerivative });
			expect(report.ingested).toBe(5);
			expect(report.skipped).toBe(0);
			expect(report.promotionBatchId).not.toBeNull();
			// Each derivative has a manifest + body
			for (const slug of ['risk-management', 'aviation-instructor', 'ifh', 'iph', 'tips-mountain-flying']) {
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
				join(tempDerivative, 'risk-management', 'FAA-H-8083-2A', 'risk-management-FAA-H-8083-2A.md'),
			];
			const past = new Date(Date.now() - 5000);
			for (const p of trackedPaths) {
				utimesSync(p, past, past);
			}
			const beforeBytes = trackedPaths.map((p) => readFileSync(p, 'utf-8'));
			const beforeMtimes = trackedPaths.map((p) => statSync(p).mtimeMs);

			const second = await runHandbooksExtrasIngest({ cacheRoot: liveCache, derivativeRoot: tempDerivative });
			expect(second.ingested).toBe(0);
			expect(second.alreadyAccepted).toBe(5);
			expect(second.promotionBatchId).toBeNull();

			const afterBytes = trackedPaths.map((p) => readFileSync(p, 'utf-8'));
			const afterMtimes = trackedPaths.map((p) => statSync(p).mtimeMs);
			expect(afterBytes).toEqual(beforeBytes);
			expect(afterMtimes).toEqual(beforeMtimes);

			// Manifest carries the whole-doc body_path that the resolver short-circuits on.
			const rmhManifestPath = join(tempDerivative, 'risk-management', 'FAA-H-8083-2A', 'manifest.json');
			const rmhManifest = JSON.parse(readFileSync(rmhManifestPath, 'utf-8')) as Record<string, unknown>;
			expect(rmhManifest.body_path).toBe('handbooks/risk-management/FAA-H-8083-2A/risk-management-FAA-H-8083-2A.md');
			expect(rmhManifest.sections).toEqual([]);
			// Subjects + primary_cert flow through from the YAML row (WP-EXTRAS-YAML).
			expect(rmhManifest.subjects).toEqual(['human-factors']);
			expect(rmhManifest.primary_cert).toBe('private');
			// Spot-check a row authored with primary_cert: null in the YAML.
			const mtnManifestPath = join(tempDerivative, 'tips-mountain-flying', 'MTN-2003', 'manifest.json');
			const mtnManifest = JSON.parse(readFileSync(mtnManifestPath, 'utf-8')) as Record<string, unknown>;
			expect(mtnManifest.subjects).toEqual(['performance', 'weather', 'emergencies']);
			expect(mtnManifest.primary_cert).toBeNull();

			// body_override: the mtn-tips entry declares an override at
			// scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md.
			// The produced `<slug>-<faaDir>.md` body file must be that file's
			// contents verbatim, not the OCR garbage that pdftotext would emit
			// for the scanned 1999 pamphlet.
			const mtnBodyPath = join(tempDerivative, 'tips-mountain-flying', 'MTN-2003', 'tips-mountain-flying-MTN-2003.md');
			const mtnBody = readFileSync(mtnBodyPath, 'utf-8');
			const overrideSource = readFileSync(
				join(process.cwd(), 'scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md'),
				'utf-8',
			);
			expect(mtnBody).toBe(overrideSource);
			expect(mtnBody).toContain('# Tips on Mountain Flying');
		},
		// The smoke test runs the full extract pipeline twice (initial + the
		// idempotency re-check), so 5 entries means 10 PDF extractions. Each
		// takes ~30-60s; observed total is 300-400s on a warm cache. Budget
		// 600s to keep CI green even on cold-cache + slower-machine runs.
		600000,
	);
});
