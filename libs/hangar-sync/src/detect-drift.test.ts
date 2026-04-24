/**
 * `detectDrift` tests -- two references in DB, one drifts, one matches.
 *
 * Uses a fake filesystem reader so the test has no IO side effects. The
 * fixture builds an on-disk TOML body for both references, then mutates one
 * reference's in-memory state. `detectDrift` should flag exactly one entry
 * as differing, leave the clean one untouched, and surface the glossary
 * file in `files` (because it needs rewriting).
 */

import type { Reference, Source } from '@ab/aviation';
import { encodeReferences, encodeSources } from '@ab/aviation';
import { describe, expect, it } from 'vitest';
import { detectDrift } from './detect-drift';

function makeReference(id: string, paraphrase: string): Reference {
	return {
		id,
		displayName: id.toUpperCase(),
		aliases: [],
		paraphrase,
		tags: {
			sourceType: 'cfr',
			aviationTopic: ['regulations'],
			flightRules: 'both',
			knowledgeKind: 'reference',
		},
		sources: [],
		related: [],
	};
}

function makeSource(id: string): Source {
	return {
		id,
		type: 'cfr',
		title: `Title ${id}`,
		version: 'v1',
		url: 'https://example.test',
		path: `data/sources/${id}.xml`,
		format: 'xml',
		downloadedAt: 'pending-download',
		checksum: 'pending-download',
	};
}

describe('detectDrift', () => {
	it('flags exactly the drifted reference and the file to rewrite', async () => {
		const clean = makeReference('clean-ref', 'the on-disk body');
		const dirty = makeReference('dirty-ref', 'edited in memory');
		const onDiskDirty = makeReference('dirty-ref', 'the on-disk body');
		const glossaryOnDisk = encodeReferences([clean, onDiskDirty]);
		const sourcesOnDisk = encodeSources([]);

		const fakeRead = async (path: string): Promise<string | null> => {
			if (path.endsWith('glossary.toml')) return glossaryOnDisk;
			if (path.endsWith('sources.toml')) return sourcesOnDisk;
			return null;
		};

		const report = await detectDrift(
			{
				references: [clean, dirty],
				sources: [],
				rows: {
					references: [
						{ kind: 'reference', id: 'clean-ref', dirty: false },
						{ kind: 'reference', id: 'dirty-ref', dirty: true },
					],
					sources: [],
				},
			},
			{ readFile: fakeRead },
		);

		expect(report.entries.length).toBe(1);
		expect(report.entries[0]?.id).toBe('dirty-ref');
		expect(report.entries[0]?.dirty).toBe(true);
		expect(report.entries[0]?.differsOnDisk).toBe(true);
		expect(report.files.some((f) => f.endsWith('glossary.toml'))).toBe(true);
		expect(report.files.some((f) => f.endsWith('sources.toml'))).toBe(false);
	});

	it('returns no entries when every row is clean + matches disk', async () => {
		const ref = makeReference('only-ref', 'body');
		const glossaryOnDisk = encodeReferences([ref]);
		const sourcesOnDisk = encodeSources([]);
		const report = await detectDrift(
			{
				references: [ref],
				sources: [],
				rows: {
					references: [{ kind: 'reference', id: 'only-ref', dirty: false }],
					sources: [],
				},
			},
			{
				readFile: async (path) => {
					if (path.endsWith('glossary.toml')) return glossaryOnDisk;
					if (path.endsWith('sources.toml')) return sourcesOnDisk;
					return null;
				},
			},
		);
		expect(report.entries).toEqual([]);
		expect(report.files).toEqual([]);
	});

	it('marks a source row dirty regardless of on-disk match and surfaces the sources file when different', async () => {
		const src = makeSource('source-1');
		const onDiskSource = makeSource('source-1');
		// Build a body representing the on-disk source as-is.
		const sourcesOnDisk = encodeSources([onDiskSource]);
		// Now mutate the in-memory source so detection flags a real diff.
		const dirtyInMemory: Source = { ...src, title: 'Edited title' };
		const report = await detectDrift(
			{
				references: [],
				sources: [dirtyInMemory],
				rows: {
					references: [],
					sources: [{ kind: 'source', id: 'source-1', dirty: true }],
				},
			},
			{
				readFile: async (path) => {
					if (path.endsWith('sources.toml')) return sourcesOnDisk;
					if (path.endsWith('glossary.toml')) return encodeReferences([]);
					return null;
				},
			},
		);
		expect(report.entries.length).toBe(1);
		expect(report.entries[0]?.kind).toBe('source');
		expect(report.entries[0]?.differsOnDisk).toBe(true);
		expect(report.files.some((f) => f.endsWith('sources.toml'))).toBe(true);
	});
});
