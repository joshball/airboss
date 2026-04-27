import { describe, expect, it } from 'vitest';
import { parseAdvanceArgs, parseDiffArgs } from './cli.ts';

describe('parseDiffArgs', () => {
	it('defaults corpus to regs and parses help', () => {
		const result = parseDiffArgs(['--help']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.help).toBe(true);
		expect(result.corpus).toBe('regs');
	});

	it('parses an explicit edition pair', () => {
		const result = parseDiffArgs(['--edition-pair=2025,2027']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.editionPair).toEqual({ old: '2025', new: '2027' });
	});

	it('rejects malformed edition pair', () => {
		const result = parseDiffArgs(['--edition-pair=2027']);
		expect('error' in result).toBe(true);
	});

	it('parses fixture pair', () => {
		const result = parseDiffArgs(['--fixture-pair=a.xml,b.xml']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.fixturePair).toEqual({ oldXml: 'a.xml', newXml: 'b.xml' });
	});

	it('rejects unknown arguments', () => {
		const result = parseDiffArgs(['--bogus']);
		expect('error' in result).toBe(true);
	});

	it('parses --out and --regulations-root', () => {
		const result = parseDiffArgs(['--out=/tmp/r.json', '--regulations-root=/tmp/regs']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.outPath).toBe('/tmp/r.json');
		expect(result.regulationsRoot).toBe('/tmp/regs');
	});
});

describe('parseAdvanceArgs', () => {
	it('parses --report and --cwd', () => {
		const result = parseAdvanceArgs(['--report=/tmp/r.json', '--cwd=/tmp/wd']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.reportPath).toBe('/tmp/r.json');
		expect(result.cwd).toBe('/tmp/wd');
	});

	it('returns null reportPath when --report missing', () => {
		const result = parseAdvanceArgs([]);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.reportPath).toBeNull();
	});

	it('rejects unknown arguments', () => {
		const result = parseAdvanceArgs(['--bogus']);
		expect('error' in result).toBe(true);
	});

	it('parses --help', () => {
		const result = parseAdvanceArgs(['--help']);
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.help).toBe(true);
	});
});
