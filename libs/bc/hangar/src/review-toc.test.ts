/**
 * `parseToc` tests -- covers the three accepted verbatim shapes, error
 * paths (missing label, wrong root type), nested children flattening, and
 * stable entryRef hashing.
 */

import { describe, expect, it } from 'vitest';
import { parseToc } from './review-toc';

describe('parseToc', () => {
	it('returns empty result for null verbatim', () => {
		const out = parseToc('ref-1', null);
		expect(out.entries).toEqual([]);
		expect(out.errors).toEqual([]);
	});

	it('rejects array root with an error', () => {
		const out = parseToc('ref-1', ['Chapter 1', 'Chapter 2']);
		expect(out.entries).toEqual([]);
		expect(out.errors).toMatchObject([{ message: 'verbatim is not an object', path: '$' }]);
	});

	it('parses the direct toc[] shape', () => {
		const verbatim = {
			toc: [
				{ label: 'Chapter 1: Introduction', page: '1' },
				{ label: 'Chapter 2: Aerodynamics', page: '12' },
			],
		};
		const out = parseToc('ref-afh', verbatim);
		expect(out.entries).toHaveLength(2);
		expect(out.entries[0].entryIndex).toBe(1);
		expect(out.entries[0].label).toBe('Chapter 1: Introduction');
		expect(out.entries[0].pageNumber).toBe('1');
		expect(out.entries[1].entryIndex).toBe(2);
		expect(out.entries[1].label).toBe('Chapter 2: Aerodynamics');
		expect(out.errors).toEqual([]);
	});

	it('parses the kind=toc + items shape', () => {
		const verbatim = {
			kind: 'toc',
			items: [{ title: 'Cover' }, { title: 'Preface' }],
		};
		const out = parseToc('ref-x', verbatim);
		expect(out.entries.map((e) => e.label)).toEqual(['Cover', 'Preface']);
		expect(out.errors).toEqual([]);
	});

	it('parses the legacy tableOfContents shape (array)', () => {
		const verbatim = {
			tableOfContents: [{ name: 'Section 1' }, { name: 'Section 2' }],
		};
		const out = parseToc('ref-y', verbatim);
		expect(out.entries.map((e) => e.label)).toEqual(['Section 1', 'Section 2']);
	});

	it('parses the legacy tableOfContents shape (object with entries)', () => {
		const verbatim = {
			tableOfContents: {
				entries: [{ text: 'Foreword' }],
			},
		};
		const out = parseToc('ref-z', verbatim);
		expect(out.entries.map((e) => e.label)).toEqual(['Foreword']);
	});

	it('flattens nested children with continuous entryIndex', () => {
		const verbatim = {
			toc: [
				{
					label: 'Part I',
					children: [{ label: 'Chapter 1' }, { label: 'Chapter 2' }],
				},
				{ label: 'Part II', children: [{ label: 'Chapter 3' }] },
			],
		};
		const out = parseToc('ref-nest', verbatim);
		expect(out.entries.map((e) => e.label)).toEqual(['Part I', 'Chapter 1', 'Chapter 2', 'Part II', 'Chapter 3']);
		expect(out.entries.map((e) => e.entryIndex)).toEqual([1, 2, 3, 4, 5]);
	});

	it('skips items missing a label and surfaces an error', () => {
		const verbatim = {
			toc: [{ label: 'OK' }, { page: '5' /* no label */ }, { label: 'Also OK' }],
		};
		const out = parseToc('ref-bad', verbatim);
		expect(out.entries.map((e) => e.label)).toEqual(['OK', 'Also OK']);
		expect(out.errors).toHaveLength(1);
		expect(out.errors[0].message).toMatch(/no label/);
	});

	it('accepts plain string entries', () => {
		const verbatim = { toc: ['Front Matter', 'Index'] };
		const out = parseToc('ref-str', verbatim);
		expect(out.entries.map((e) => e.label)).toEqual(['Front Matter', 'Index']);
	});

	it('produces stable entryRefs for the same input', () => {
		const verbatim = { toc: [{ label: 'A' }, { label: 'B' }] };
		const a = parseToc('ref-stable', verbatim);
		const b = parseToc('ref-stable', verbatim);
		expect(a.entries.map((e) => e.entryRef)).toEqual(b.entries.map((e) => e.entryRef));
	});

	it('produces different entryRefs for different referenceIds', () => {
		const verbatim = { toc: [{ label: 'A' }] };
		const a = parseToc('ref-a', verbatim);
		const b = parseToc('ref-b', verbatim);
		expect(a.entries[0].entryRef).not.toBe(b.entries[0].entryRef);
	});

	it('returns errors for unknown shape', () => {
		const verbatim = { something: 'else' };
		const out = parseToc('ref-?', verbatim);
		expect(out.entries).toEqual([]);
		expect(out.errors[0].message).toMatch(/no recognised TOC shape/);
	});

	it('rejects kind=toc when items is not an array', () => {
		const verbatim = { kind: 'toc', items: 'not an array' };
		const out = parseToc('ref-bad-kind', verbatim);
		expect(out.entries).toEqual([]);
		expect(out.errors[0].message).toMatch(/items is not an array/);
	});
});
