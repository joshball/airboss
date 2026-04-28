/**
 * Output formatters for the source downloader.
 *
 * Two surfaces:
 *
 *   - `printSummary` -- end-of-run per-corpus rollup. Counts are colored:
 *     files green when > 0, errors red when > 0, skipped yellow when > 0,
 *     dimmed when zero.
 *   - `printVerifyTable` -- HEAD-only audit table. HTTP status colored:
 *     2xx green, 4xx yellow, 5xx + ERR red.
 */

import { formatBytes } from '../../lib/bytes';
import { dim, green, red, yellow } from '../../lib/colors';
import type { Corpus } from './args';

export interface CorpusResult {
	readonly corpus: Corpus;
	files: number;
	bytes: number;
	errors: number;
	skipped: number;
}

export interface VerifyRow {
	readonly label: string;
	readonly url: string;
	readonly status: number | string;
	readonly contentLength: number | null;
	readonly lastModified: string | null;
	readonly cacheHit: boolean;
	readonly note: string;
}

function colorCount(n: number, paint: (s: string) => string): string {
	const text = String(n);
	return n > 0 ? paint(text) : dim(text);
}

function colorStatus(status: number | string): string {
	const text = String(status).padStart(3);
	if (typeof status === 'number') {
		if (status >= 200 && status < 300) return green(text);
		if (status >= 400 && status < 500) return yellow(text);
		return red(text);
	}
	return red(text);
}

export function printSummary(results: readonly CorpusResult[], cacheRoot: string, dryRun: boolean): void {
	console.log('');
	console.log('Source download summary');
	console.log('=======================');
	let totalFiles = 0;
	let totalBytes = 0;
	let totalErrors = 0;
	let totalSkipped = 0;
	for (const r of results) {
		const files = `${colorCount(r.files, green)} files`;
		const bytes = r.bytes > 0 ? formatBytes(r.bytes) : dim('0 B');
		const errors = `${colorCount(r.errors, red)} errors`;
		const skippedPart = r.skipped > 0 ? `, ${colorCount(r.skipped, yellow)} skipped` : '';
		console.log(`${r.corpus.padEnd(10)} ${files}, ${bytes}, ${errors}${skippedPart}`);
		totalFiles += r.files;
		totalBytes += r.bytes;
		totalErrors += r.errors;
		totalSkipped += r.skipped;
	}
	console.log('');
	const totals =
		`Total: ${colorCount(totalFiles, green)} files, ` +
		`${totalBytes > 0 ? formatBytes(totalBytes) : dim('0 B')}, ` +
		`${colorCount(totalErrors, red)} errors` +
		(totalSkipped > 0 ? `, ${colorCount(totalSkipped, yellow)} skipped` : '');
	console.log(totals);
	console.log(`Cache root: ${cacheRoot}`);
	if (dryRun) console.log('(dry-run -- nothing was fetched)');
}

export function printVerifyTable(rows: readonly VerifyRow[]): void {
	console.log('');
	console.log('URL verification (HEAD only):');
	const labelWidth = Math.max(8, ...rows.map((r) => r.label.length));
	for (const r of rows) {
		const size = r.contentLength === null ? '-' : formatBytes(r.contentLength).padStart(8);
		const lm = r.lastModified ?? '-';
		const hit = r.cacheHit ? green('hit ') : dim('miss');
		const status = colorStatus(r.status);
		console.log(
			`${r.label.padEnd(labelWidth)}  ${status}  ${size}  ${lm.padEnd(30)}  ${hit}${r.note ? `  ${red(r.note)}` : ''}`,
		);
	}
	const okCount = rows.filter((r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300).length;
	const hits = rows.filter((r) => r.cacheHit).length;
	console.log('');
	const okText = okCount === rows.length ? green(`${okCount}/${rows.length}`) : red(`${okCount}/${rows.length}`);
	console.log(`${okText} URLs OK. ${hits} cache hits, ${rows.length - hits} misses.`);
	if (okCount === rows.length) console.log('(Run without --verify to download misses.)');
}
