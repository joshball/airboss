import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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
	test('writes default-path snapshot and returns 0', () => {
		const code = runSnapshotCli([], { cwd: workDir });
		expect(code).toBe(0);
		expect(existsSync(join(workDir, DEFAULT_SNAPSHOT_PATH))).toBe(true);
	});

	test('writes custom-path snapshot when --out= given', () => {
		const code = runSnapshotCli(['--out=custom/path.json'], { cwd: workDir });
		expect(code).toBe(0);
		expect(existsSync(join(workDir, 'custom/path.json'))).toBe(true);
	});

	test('returns 2 on argument error', () => {
		const code = runSnapshotCli(['--bogus']);
		expect(code).toBe(2);
	});
});
