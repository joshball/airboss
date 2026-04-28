import { describe, expect, it } from 'vitest';
import { extractIdentifiers } from './extract.ts';

describe('extractIdentifiers', () => {
	it('returns [] for empty body', () => {
		expect(extractIdentifiers('')).toEqual([]);
	});

	it('extracts a single inline link', () => {
		const body = 'See [§91.103](airboss-ref:regs/cfr-14/91/103?at=2026).';
		expect(extractIdentifiers(body)).toEqual(['airboss-ref:regs/cfr-14/91/103?at=2026']);
	});

	it('dedupes two links to same raw id', () => {
		const body =
			'See [@cite](airboss-ref:regs/cfr-14/91/103?at=2026) and again [@short](airboss-ref:regs/cfr-14/91/103?at=2026).';
		expect(extractIdentifiers(body)).toEqual(['airboss-ref:regs/cfr-14/91/103?at=2026']);
	});

	it('keeps two links with different pins', () => {
		const body = '[@short](airboss-ref:regs/cfr-14/91/103?at=2026) vs [@short](airboss-ref:regs/cfr-14/91/103?at=2027)';
		expect(extractIdentifiers(body)).toEqual([
			'airboss-ref:regs/cfr-14/91/103?at=2026',
			'airboss-ref:regs/cfr-14/91/103?at=2027',
		]);
	});

	it('extracts reference-style links via their definitions', () => {
		const body = `
The [Walker letter][walker] established the standard.

[walker]: airboss-ref:interp/chief-counsel/walker-2017
`;
		expect(extractIdentifiers(body)).toEqual(['airboss-ref:interp/chief-counsel/walker-2017']);
	});

	it('extracts bare URLs (NOTICE-tier upstream; renderer treats as occurrence)', () => {
		const body = 'Cited as airboss-ref:regs/cfr-14/91/103?at=2026 directly in prose.';
		expect(extractIdentifiers(body)).toEqual(['airboss-ref:regs/cfr-14/91/103?at=2026']);
	});

	it('skips identifiers inside fenced code', () => {
		const body = `
\`\`\`
airboss-ref:regs/cfr-14/91/103?at=2026
\`\`\`

But [@cite](airboss-ref:regs/cfr-14/91/107?at=2026).
`;
		expect(extractIdentifiers(body)).toEqual(['airboss-ref:regs/cfr-14/91/107?at=2026']);
	});

	it('skips identifiers inside inline code', () => {
		const body = 'See `airboss-ref:regs/cfr-14/91/103?at=2026` for the literal.';
		expect(extractIdentifiers(body)).toEqual([]);
	});

	it('preserves source order across three identifiers', () => {
		const body = `
First [§91.103](airboss-ref:regs/cfr-14/91/103?at=2026), then
[§91.107](airboss-ref:regs/cfr-14/91/107?at=2026), then
[§91.113](airboss-ref:regs/cfr-14/91/113?at=2026).
`;
		expect(extractIdentifiers(body)).toEqual([
			'airboss-ref:regs/cfr-14/91/103?at=2026',
			'airboss-ref:regs/cfr-14/91/107?at=2026',
			'airboss-ref:regs/cfr-14/91/113?at=2026',
		]);
	});

	it('extracts links to multiple corpora', () => {
		const body =
			'Per [§91.103](airboss-ref:regs/cfr-14/91/103?at=2026) and [Walker letter](airboss-ref:interp/chief-counsel/walker-2017).';
		expect(extractIdentifiers(body)).toEqual([
			'airboss-ref:regs/cfr-14/91/103?at=2026',
			'airboss-ref:interp/chief-counsel/walker-2017',
		]);
	});
});
