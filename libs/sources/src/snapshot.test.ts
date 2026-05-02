import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resetRegistry, withTestEditions, withTestEntries } from './registry/__test_helpers__.ts';
import {
	DEFAULT_SNAPSHOT_PATH,
	generateSnapshot,
	parseSnapshotArgs,
	runSnapshotCli,
	SNAPSHOT_VERSION,
	type SnapshotShape,
	writeSnapshotData,
	writeSnapshotSync,
} from './snapshot.ts';
import type { Edition, SourceEntry, SourceId } from './types.ts';

let workDir: string;

beforeEach(() => {
	resetRegistry();
	workDir = `${tmpdir()}/airboss-snap-${process.pid}-${Date.now()}-${Math.random()}`;
	mkdirSync(workDir, { recursive: true });
});

afterEach(() => {
	rmSync(workDir, { recursive: true, force: true });
	resetRegistry();
});

function makeEntry(id: string): SourceEntry {
	return {
		id: id as SourceId,
		corpus: id.split(':')[1]?.split('/')[0] ?? 'regs',
		canonical_short: '§91.103',
		canonical_formal: '14 CFR § 91.103',
		canonical_title: 'Preflight action',
		last_amended_date: new Date('2026-01-01'),
		lifecycle: 'accepted',
	};
}

describe('generateSnapshot', () => {
	test('S-01: empty registry produces empty entries', () => {
		const snap = generateSnapshot();
		expect(snap.version).toBe(SNAPSHOT_VERSION);
		expect(typeof snap.generatedAt).toBe('string');
		expect(snap.entries).toEqual({});
	});

	test('S-02: snapshot includes primed test entries', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const editions: readonly Edition[] = [
			{ id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' },
		];
		withTestEntries({ [id]: makeEntry(id) }, () => {
			withTestEditions(new Map([[id as SourceId, editions]]), () => {
				const snap = generateSnapshot();
				expect(Object.keys(snap.entries)).toHaveLength(1);
				const entry = snap.entries[id as SourceId];
				expect(entry).toBeDefined();
				expect(entry?.entry.canonical_short).toBe('§91.103');
				expect(entry?.editions).toHaveLength(1);
			});
		});
	});
});

describe('writeSnapshotSync', () => {
	test('S-03: writes valid JSON; round-trips', () => {
		const path = join(workDir, 'snap.json');
		writeSnapshotSync(path);
		expect(existsSync(path)).toBe(true);
		const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
		expect((parsed as { version: number }).version).toBe(SNAPSHOT_VERSION);
		expect((parsed as { entries: Record<string, unknown> }).entries).toEqual({});
	});

	test('writeSnapshotSync creates intermediate directories', () => {
		const path = join(workDir, 'nested/dir/snap.json');
		writeSnapshotSync(path);
		expect(existsSync(path)).toBe(true);
	});

	test('relative paths resolve against cwd', () => {
		writeSnapshotSync('snap.json', workDir);
		expect(existsSync(join(workDir, 'snap.json'))).toBe(true);
	});
});

describe('parseSnapshotArgs', () => {
	test('S-04: defaults to DEFAULT_SNAPSHOT_PATH when no --out= given', () => {
		const result = parseSnapshotArgs([]);
		expect(result.kind).toBe('ok');
		if (result.kind === 'ok') {
			expect(result.out).toBe(DEFAULT_SNAPSHOT_PATH);
		}
	});

	test('S-05: --out= sets output path', () => {
		const result = parseSnapshotArgs(['--out=/tmp/foo.json']);
		expect(result.kind).toBe('ok');
		if (result.kind === 'ok') {
			expect(result.out).toBe('/tmp/foo.json');
		}
	});

	test('S-06: unknown args produce error', () => {
		const result = parseSnapshotArgs(['--unknown=bar']);
		expect(result.kind).toBe('error');
	});

	test('--out= with empty value is rejected', () => {
		const result = parseSnapshotArgs(['--out=']);
		expect(result.kind).toBe('error');
	});
});

describe('runSnapshotCli', () => {
	test('writes default-path snapshot and returns 0', async () => {
		const code = await runSnapshotCli(['--no-bootstrap'], { cwd: workDir });
		expect(code).toBe(0);
		expect(existsSync(join(workDir, DEFAULT_SNAPSHOT_PATH))).toBe(true);
	});

	test('writes custom-path snapshot when --out= given', async () => {
		const code = await runSnapshotCli(['--out=custom/path.json', '--no-bootstrap'], { cwd: workDir });
		expect(code).toBe(0);
		expect(existsSync(join(workDir, 'custom/path.json'))).toBe(true);
	});

	test('returns 2 on argument error', async () => {
		const code = await runSnapshotCli(['--bogus']);
		expect(code).toBe(2);
	});

	test('S-07: --no-bootstrap parses', () => {
		const result = parseSnapshotArgs(['--no-bootstrap']);
		expect(result.kind).toBe('ok');
		if (result.kind === 'ok') expect(result.skipBootstrap).toBe(true);
	});

	test('S-08: hydrates registry from on-disk derivatives by default (was broken pre-fix)', async () => {
		// Build a minimal regs derivative tree the bootstrap can consume.
		const regsDir = join(workDir, 'regulations', 'cfr-14', '2026');
		mkdirSync(regsDir, { recursive: true });
		const manifest = {
			schemaVersion: 1,
			title: '14',
			editionSlug: '2026',
			editionDate: '2026-01-01',
			sourceUrl: 'about:blank',
		};
		writeFileSync(join(regsDir, 'manifest.json'), JSON.stringify(manifest), 'utf-8');
		const sections = {
			schemaVersion: 1,
			edition: '2026',
			sectionsByPart: {
				'91': [
					{
						id: 'airboss-ref:regs/cfr-14/91/103',
						canonical_short: '§91.103',
						canonical_title: 'Preflight action',
						last_amended_date: '2026-01-01',
						body_path: '91/103.md',
						body_sha256: 'aaaa',
					},
				],
			},
		};
		writeFileSync(join(regsDir, 'sections.json'), JSON.stringify(sections), 'utf-8');

		const out = join(workDir, 'snap.json');
		const code = await runSnapshotCli([`--out=${out}`], { cwd: workDir });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(out, 'utf-8')) as SnapshotShape;
		const ids = Object.keys(parsed.entries);
		// Pre-fix: would be []. Post-fix: contains the synthesized regs entries.
		expect(ids.length).toBeGreaterThan(0);
		expect(ids).toContain('airboss-ref:regs/cfr-14/91/103');
	});

	test('S-09: writeSnapshotData accepts a pre-built snapshot (no double generate)', () => {
		const out = join(workDir, 'manual.json');
		const data: SnapshotShape = {
			version: SNAPSHOT_VERSION,
			generatedAt: '2026-05-01T00:00:00.000Z',
			entries: {},
		};
		writeSnapshotData(out, data);
		const parsed = JSON.parse(readFileSync(out, 'utf-8')) as SnapshotShape;
		expect(parsed.generatedAt).toBe('2026-05-01T00:00:00.000Z');
	});
});
