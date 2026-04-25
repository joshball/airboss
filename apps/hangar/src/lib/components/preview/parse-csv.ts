/**
 * Minimal RFC-4180-flavoured CSV parser. Handles quoted cells, embedded
 * commas, doubled-quote escapes, and CR/LF line endings. Returns a 2D
 * string array; callers pick the header row off the front.
 *
 * Kept local to the preview component because the only consumer today is
 * the files browser. If a second caller appears, lift to `@ab/utils`.
 */

export interface ParsedCsv {
	header: readonly string[];
	rows: readonly (readonly string[])[];
}

const FIELD_DELIMITER_DEFAULT = ',';
const QUOTE = '"';
const CR = '\r';
const LF = '\n';

export function parseCsv(input: string, delimiter: string = FIELD_DELIMITER_DEFAULT): ParsedCsv {
	const records: string[][] = [];
	let field = '';
	let record: string[] = [];
	let i = 0;
	let inQuotes = false;
	const len = input.length;

	while (i < len) {
		const ch = input[i];
		if (inQuotes) {
			if (ch === QUOTE) {
				// Doubled quote -> literal quote.
				if (input[i + 1] === QUOTE) {
					field += QUOTE;
					i += 2;
					continue;
				}
				inQuotes = false;
				i += 1;
				continue;
			}
			field += ch;
			i += 1;
			continue;
		}
		if (ch === QUOTE) {
			inQuotes = true;
			i += 1;
			continue;
		}
		if (ch === delimiter) {
			record.push(field);
			field = '';
			i += 1;
			continue;
		}
		if (ch === CR) {
			// Treat CR / CRLF as record terminator.
			record.push(field);
			records.push(record);
			field = '';
			record = [];
			i += 1;
			if (input[i] === LF) i += 1;
			continue;
		}
		if (ch === LF) {
			record.push(field);
			records.push(record);
			field = '';
			record = [];
			i += 1;
			continue;
		}
		field += ch;
		i += 1;
	}
	// Flush any trailing field / record.
	if (field.length > 0 || record.length > 0) {
		record.push(field);
		records.push(record);
	}

	if (records.length === 0) {
		return { header: [], rows: [] };
	}
	const [headerRow, ...rest] = records;
	return { header: headerRow ?? [], rows: rest };
}
