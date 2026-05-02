/**
 * Tests for the per-corpus manifest writer.
 *
 * Covers ADR 021 atomicity: writes go through `<path>.tmp` + rename so a
 * crash mid-write never leaves a half-written manifest at the canonical
 * path. We exercise three cases:
 *   1. Happy path: write produces a valid manifest readable by the reader,
 *      and no `.tmp` sibling lingers.
 *   2. Mid-write failure: when `renameSync` cannot complete because the
 *      destination is a non-empty directory, the canonical path is
 *      unchanged -- the writer surfaces the error rather than corrupting
 *      the manifest.
 *   3. Existing dest replaced: writing a second entry merges and replaces
 *      atomically (the prior file is fully overwritten with the merged
 *      contents).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	type ManifestEntry,
	manifestPathFor,
	readCorpusManifestFile,
	readManifestEntry,
	writeManifestEntry,
} from './manifest';
import type { DownloadPlan } from './plans';

let tempRoot: string;

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-manifest-'));
});

afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

function makePlan(doc: string): DownloadPlan {
	return {
		corpus: 'ac',
		doc,
		edition: null,
		url: `https://example.test/${doc}.pdf`,
		destPath: join(tempRoot, 'ac', `${doc}.pdf`),
		extension: 'pdf',
		kind: 'whole-doc',
		ordinal: null,
		section: null,
		ancillaryKind: null,
		chapterPageUrl: null,
	};
}

function makeEntry(doc: string, sha: string): ManifestEntry {
	return {
		corpus: 'ac',
		doc,
		edition: null,
		source_url: `https://example.test/${doc}.pdf`,
		source_filename: `${doc}.pdf`,
		source_sha256: sha,
		size_bytes: 1024,
		fetched_at: '2026-05-01T00:00:00.000Z',
		schema_version: 1,
	};
}

describe('writeManifestEntry (atomicity per ADR 021)', () => {
	it('happy path -- writes a valid manifest readable by readManifestEntry', () => {
		const plan = makePlan('ac-90-100');
		const entry = makeEntry('ac-90-100', 'a'.repeat(64));
		writeManifestEntry(plan, entry);

		const path = manifestPathFor(plan);
		expect(existsSync(path)).toBe(true);

		// Round-trip through the reader.
		const round = readManifestEntry(plan);
		expect(round).not.toBeNull();
		expect(round?.source_sha256).toBe('a'.repeat(64));
		expect(round?.doc).toBe('ac-90-100');

		// And the on-disk JSON is valid.
		const raw = readFileSync(path, 'utf-8');
		expect(() => JSON.parse(raw)).not.toThrow();

		// Tmp file is removed after a successful write.
		expect(existsSync(`${path}.tmp`)).toBe(false);
	});

	it('mid-write failure -- canonical path is never partially written', () => {
		// Force renameSync to fail by planting a non-empty directory at the
		// canonical manifest path. `rename(src, dst)` with `dst` as a non-empty
		// directory fails on every platform, so the writer must throw -- and
		// must NOT have replaced the directory with a half-written JSON file.
		const plan = makePlan('ac-90-100');
		const path = manifestPathFor(plan);
		mkdirSync(dirname(path), { recursive: true });
		mkdirSync(path);
		writeFileSync(join(path, 'sentinel'), 'block', 'utf-8');

		expect(() => writeManifestEntry(plan, makeEntry('ac-90-100', 'a'.repeat(64)))).toThrow();

		// Canonical path is still the directory we planted -- the writer did
		// NOT silently turn it into a half-written file. Atomicity holds.
		expect(statSync(path).isDirectory()).toBe(true);
		expect(existsSync(join(path, 'sentinel'))).toBe(true);
	});

	it('existing dest replaced atomically -- merged contents overwrite', () => {
		const planA = makePlan('ac-90-100');
		const entryA = makeEntry('ac-90-100', 'a'.repeat(64));
		writeManifestEntry(planA, entryA);

		const planB = makePlan('ac-91-100');
		const entryB = makeEntry('ac-91-100', 'b'.repeat(64));
		writeManifestEntry(planB, entryB);

		const path = manifestPathFor(planA);
		// After two writes, the canonical file holds both entries (sorted).
		const file = readCorpusManifestFile(path);
		expect(file).not.toBeNull();
		expect(file?.entries).toHaveLength(2);
		const docs = file?.entries.map((e) => e.doc).sort() ?? [];
		expect(docs).toEqual(['ac-90-100', 'ac-91-100']);

		// And replacing one of them does not partially-write -- the file remains
		// valid JSON and both entries are present.
		const entryAUpdated = makeEntry('ac-90-100', 'c'.repeat(64));
		writeManifestEntry(planA, entryAUpdated);

		const updated = readCorpusManifestFile(path);
		expect(updated?.entries).toHaveLength(2);
		const updatedA = updated?.entries.find((e) => e.doc === 'ac-90-100');
		expect(updatedA?.source_sha256).toBe('c'.repeat(64));
		const stillB = updated?.entries.find((e) => e.doc === 'ac-91-100');
		expect(stillB?.source_sha256).toBe('b'.repeat(64));

		// No leftover .tmp file from any of the writes.
		expect(existsSync(`${path}.tmp`)).toBe(false);
	});
});
