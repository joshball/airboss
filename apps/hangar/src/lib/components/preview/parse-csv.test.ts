import { describe, expect, it } from 'vitest';
import { parseCsv } from './parse-csv';

describe('parseCsv', () => {
	it('parses a header + simple rows with comma delimiter', () => {
		const result = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
		expect(result.header).toEqual(['a', 'b', 'c']);
		expect(result.rows).toEqual([
			['1', '2', '3'],
			['4', '5', '6'],
		]);
	});

	it('handles quoted cells containing commas', () => {
		const result = parseCsv('name,note\nfoo,"hello, world"\nbar,baz\n');
		expect(result.rows[0]).toEqual(['foo', 'hello, world']);
		expect(result.rows[1]).toEqual(['bar', 'baz']);
	});

	it('handles escaped quotes inside a quoted cell', () => {
		const result = parseCsv('a,b\n"he said ""hi""",end\n');
		expect(result.rows[0]).toEqual(['he said "hi"', 'end']);
	});

	it('treats CRLF the same as LF', () => {
		const result = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
		expect(result.rows).toEqual([
			['1', '2'],
			['3', '4'],
		]);
	});

	it('parses tab-delimited rows when tab delimiter is passed', () => {
		const result = parseCsv('a\tb\n1\t2\n3\t4\n', '\t');
		expect(result.header).toEqual(['a', 'b']);
		expect(result.rows).toEqual([
			['1', '2'],
			['3', '4'],
		]);
	});

	it('returns an empty header + rows for an empty input', () => {
		const result = parseCsv('');
		expect(result.header).toEqual([]);
		expect(result.rows).toEqual([]);
	});

	it('captures a trailing record without a final newline', () => {
		const result = parseCsv('a,b\n1,2');
		expect(result.rows).toEqual([['1', '2']]);
	});

	it('preserves embedded newlines inside quoted cells', () => {
		const result = parseCsv('a,b\n"line1\nline2",end\n');
		expect(result.rows[0]).toEqual(['line1\nline2', 'end']);
	});
});
