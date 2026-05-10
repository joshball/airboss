/**
 * Content-hash + source-resolution helpers.
 *
 * The content hash drives idempotency for `bun run charts build` --
 * a regression that makes the hash non-deterministic would re-render
 * every chart on every CLI invocation. These tests pin determinism
 * + library_version inclusion (the spec.md WXC-70 invariant).
 */

import { describe, expect, it } from 'vitest';
import { computeContentHash, type RawChartSpec, type ResolvedSource, sha256Hex } from './lib';

const SAMPLE_SPEC: RawChartSpec = {
	slug: 'wx-surface-analysis-2024-12-23-12z',
	type: 'surface-analysis',
	title: 'Surface Analysis',
	subtitle: '2024-12-23 12Z',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: { fronts: 'cache://sfc-bulletin/2024-12-23-12z.json' },
};

const SAMPLE_SOURCES: ResolvedSource[] = [
	{
		key: 'fronts',
		uri: 'cache://sfc-bulletin/2024-12-23-12z.json',
		resolvedPath: '/tmp/foo.json',
		bytes: new TextEncoder().encode('{"centers":[],"fronts":[]}'),
	},
];

describe('sha256Hex()', () => {
	it('hashes a known string deterministically', () => {
		const a = sha256Hex('hello');
		const b = sha256Hex('hello');
		expect(a).toBe(b);
		expect(a).toMatch(/^[0-9a-f]{64}$/);
	});

	it('produces different hashes for different inputs', () => {
		expect(sha256Hex('hello')).not.toBe(sha256Hex('world'));
	});
});

describe('computeContentHash()', () => {
	it('is deterministic for the same spec + sources + version', () => {
		const a = computeContentHash({
			specObject: SAMPLE_SPEC,
			sources: SAMPLE_SOURCES,
			libraryVersion: '@ab/wx-charts@0.1.0',
		});
		const b = computeContentHash({
			specObject: SAMPLE_SPEC,
			sources: SAMPLE_SOURCES,
			libraryVersion: '@ab/wx-charts@0.1.0',
		});
		expect(a.contentHash).toBe(b.contentHash);
		expect(a.sourceHashes).toEqual(b.sourceHashes);
	});

	it('changes when library_version bumps (WXC-70)', () => {
		const a = computeContentHash({
			specObject: SAMPLE_SPEC,
			sources: SAMPLE_SOURCES,
			libraryVersion: '@ab/wx-charts@0.1.0',
		});
		const b = computeContentHash({
			specObject: SAMPLE_SPEC,
			sources: SAMPLE_SOURCES,
			libraryVersion: '@ab/wx-charts@0.2.0',
		});
		expect(a.contentHash).not.toBe(b.contentHash);
	});

	it('changes when source bytes change', () => {
		const a = computeContentHash({
			specObject: SAMPLE_SPEC,
			sources: SAMPLE_SOURCES,
			libraryVersion: '@ab/wx-charts@0.1.0',
		});
		const b = computeContentHash({
			specObject: SAMPLE_SPEC,
			sources: [
				{
					...SAMPLE_SOURCES[0],
					bytes: new TextEncoder().encode(
						'{"centers":[{"kind":"H","lon":-100,"lat":40,"pressureMb":1024}],"fronts":[]}',
					),
				},
			],
			libraryVersion: '@ab/wx-charts@0.1.0',
		});
		expect(a.contentHash).not.toBe(b.contentHash);
	});

	it('emits one source_hashes entry per source key', () => {
		const result = computeContentHash({
			specObject: SAMPLE_SPEC,
			sources: SAMPLE_SOURCES,
			libraryVersion: '@ab/wx-charts@0.1.0',
		});
		expect(Object.keys(result.sourceHashes)).toEqual(['fronts']);
		expect(result.sourceHashes.fronts).toMatch(/^[0-9a-f]{64}$/);
	});
});
