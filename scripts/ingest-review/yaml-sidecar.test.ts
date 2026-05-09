/**
 * YAML sidecar serialise/parse contract.
 *
 * Hard requirements:
 *   - serialize -> parse round-trips losslessly for the documented shape.
 *   - serialize is byte-stable across runs given the same input.
 *   - parse rejects unknown action / kind values.
 *   - parse tolerates an empty file and a comments-only file.
 */

import type { YamlSidecarEntry } from '@ab/bc-ingest-review';
import { INGEST_REVIEW } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { parseSidecar, serializeSidecar, YamlSidecarParseError } from './yaml-sidecar';

const SAMPLE_ENTRIES: readonly YamlSidecarEntry[] = [
	{
		external_id: 'b8fa45834d84872b',
		kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
		action: INGEST_REVIEW.ACTIONS.PAIR,
		payload: { imagePage: 82, imageXref: 1234, figureId: 'fig-4-7-00' },
	},
	{
		external_id: '6cbeaa346a6108b9',
		kind: INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
		action: INGEST_REVIEW.ACTIONS.MARK_NO_FIGURE,
		payload: {},
	},
];

describe('serializeSidecar', () => {
	it('produces byte-stable output across runs', () => {
		const a = serializeSidecar({ slug: 'ifh', edition: 'FAA-H-8083-15B', overrides: SAMPLE_ENTRIES });
		const b = serializeSidecar({ slug: 'ifh', edition: 'FAA-H-8083-15B', overrides: SAMPLE_ENTRIES });
		expect(a).toBe(b);
	});

	it('sorts entries by external_id regardless of input order', () => {
		const reversed: YamlSidecarEntry[] = [];
		for (let i = SAMPLE_ENTRIES.length - 1; i >= 0; i -= 1) {
			const entry = SAMPLE_ENTRIES[i];
			if (entry) reversed.push(entry);
		}
		const a = serializeSidecar({ slug: 'ifh', edition: 'FAA-H-8083-15B', overrides: SAMPLE_ENTRIES });
		const b = serializeSidecar({ slug: 'ifh', edition: 'FAA-H-8083-15B', overrides: reversed });
		expect(a).toBe(b);
	});

	it('emits a single trailing newline', () => {
		const text = serializeSidecar({ slug: 'ifh', edition: 'FAA-H-8083-15B', overrides: SAMPLE_ENTRIES });
		expect(text.endsWith('\n')).toBe(true);
		expect(text.endsWith('\n\n')).toBe(false);
	});

	it('emits `payload: {}` for empty payloads', () => {
		const empty = SAMPLE_ENTRIES[1];
		if (!empty) throw new Error('fixture[1] missing');
		const text = serializeSidecar({
			slug: 'ifh',
			edition: 'FAA-H-8083-15B',
			overrides: [empty],
		});
		expect(text).toContain('payload: {}');
	});

	it('emits `overrides: []` for empty inputs', () => {
		const text = serializeSidecar({ slug: 'ifh', edition: 'FAA-H-8083-15B', overrides: [] });
		expect(text).toContain('overrides: []');
	});
});

describe('parseSidecar', () => {
	it('round-trips a serialised sidecar back to the input shape', () => {
		const text = serializeSidecar({ slug: 'ifh', edition: 'FAA-H-8083-15B', overrides: SAMPLE_ENTRIES });
		const parsed = parseSidecar(text);
		expect(parsed.overrides).toHaveLength(2);
		const sortedInput = [...SAMPLE_ENTRIES].sort((a, b) => a.external_id.localeCompare(b.external_id));
		expect(parsed.overrides).toEqual(sortedInput);
	});

	it('returns an empty list for an empty file', () => {
		expect(parseSidecar('').overrides).toEqual([]);
	});

	it('returns an empty list for a comments-only file', () => {
		expect(parseSidecar('# only a comment\n').overrides).toEqual([]);
	});

	it('returns an empty list for a missing `overrides` key', () => {
		expect(parseSidecar('something_else: 1\n').overrides).toEqual([]);
	});

	it('rejects unknown kinds', () => {
		const text = `overrides:\n  - external_id: x\n    kind: handbook.unknown\n    action: pair\n    payload: {}\n`;
		expect(() => parseSidecar(text)).toThrow(YamlSidecarParseError);
	});

	it('rejects unknown actions', () => {
		const text = `overrides:\n  - external_id: x\n    kind: handbook.caption-orphan\n    action: not-a-real-action\n    payload: {}\n`;
		expect(() => parseSidecar(text)).toThrow(YamlSidecarParseError);
	});

	it('rejects malformed YAML', () => {
		expect(() => parseSidecar('overrides: [\n')).toThrow(YamlSidecarParseError);
	});
});
