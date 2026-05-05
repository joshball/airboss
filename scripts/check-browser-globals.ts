import { $ } from 'bun';

// Static guard against Node-only globals (`Buffer`, `process`) leaking into
// browser-bundled libs. Biome's `noNodejsModules` already catches static
// `import 'node:*'` statements, but it does not catch bare references to
// the Node globals -- and `Buffer.from(...)` will silently work in vitest
// (happy-dom polyfills it) and in node-mode tests, then ReferenceError
// at hydration in real browsers. ADR background: see CLAUDE.md "Browser-
// bundled libs must not statically import `node:*`".
//
// The list of browser-bundled libs is the same one Biome's lint config
// enforces. Source files (.ts / .svelte / .svelte.ts) are scanned for
// bare `Buffer\.` and `process\.` outside string literals and comments
// (best-effort, regex-based). Lazy access via `process.getBuiltinModule`
// gated behind `typeof process !== 'undefined'` is the documented
// escape hatch and is allowed when wrapped in such a guard.

const BROWSER_BUNDLED_LIBS = [
	'libs/constants',
	'libs/utils',
	'libs/types',
	'libs/themes',
	'libs/ui',
	'libs/help',
	'libs/aviation',
	'libs/audit',
	'libs/sources',
	'libs/activities',
	'libs/bc/study',
	'libs/bc/sim',
] as const;

// Anything matching these patterns is allowed (the documented lazy-load
// escape hatch). The check is intentionally narrow: a function-scoped
// `process.getBuiltinModule(...)` after a `typeof process` guard.
const ALLOW_PROCESS_PATTERNS = [/typeof\s+process\s*!==\s*['"]undefined['"]/, /process\.getBuiltinModule\s*\(/];

// Files that opt out by declaring server-only at the top. These files live
// in a directory that is otherwise browser-bundled but are themselves never
// imported by client `.svelte` -- typically CLI entry points for ingest
// scripts. The marker is a comment within the first 8 lines:
//   // @browser-globals: server-only
// New files added to browser-bundled libs MUST justify their server-only
// status if they want to use Node globals.
const SERVER_ONLY_MARKER = /@browser-globals:\s*server-only/;

interface Finding {
	file: string;
	line: number;
	text: string;
	symbol: 'Buffer' | 'process';
}

const findings: Finding[] = [];

function scanFile(file: string, contents: string): void {
	const lines = contents.split('\n');
	// Server-only marker must appear in the first 8 lines (file header).
	for (let i = 0; i < Math.min(8, lines.length); i++) {
		const line = lines[i];
		if (line !== undefined && SERVER_ONLY_MARKER.test(line)) return;
	}
	let inBlockComment = false;
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw === undefined) continue;
		// Strip block comments (best-effort -- multi-line spans handled).
		let line = raw;
		if (inBlockComment) {
			const end = line.indexOf('*/');
			if (end < 0) continue;
			line = line.slice(end + 2);
			inBlockComment = false;
		}
		const blockStart = line.indexOf('/*');
		if (blockStart >= 0) {
			const blockEnd = line.indexOf('*/', blockStart);
			if (blockEnd < 0) {
				line = line.slice(0, blockStart);
				inBlockComment = true;
			} else {
				line = line.slice(0, blockStart) + line.slice(blockEnd + 2);
			}
		}
		// Strip line comments and string literals (rough: drop after // and
		// remove balanced single/double/backtick strings on this line). False
		// negatives are acceptable; false positives are noisy and worse.
		const lineCommentIdx = line.indexOf('//');
		if (lineCommentIdx >= 0) line = line.slice(0, lineCommentIdx);
		line = line.replace(/'(?:[^'\\]|\\.)*'/g, "''");
		line = line.replace(/"(?:[^"\\]|\\.)*"/g, '""');
		line = line.replace(/`(?:[^`\\]|\\.)*`/g, '``');

		if (/\bBuffer\./.test(line)) {
			findings.push({ file, line: i + 1, text: raw.trim(), symbol: 'Buffer' });
		}
		if (/\bprocess\./.test(line)) {
			const allowed = ALLOW_PROCESS_PATTERNS.some((re) => re.test(raw));
			if (!allowed) findings.push({ file, line: i + 1, text: raw.trim(), symbol: 'process' });
		}
	}
}

const fileListing =
	await $`find ${BROWSER_BUNDLED_LIBS} -type f \( -name '*.ts' -o -name '*.svelte' \) -not -path '*/node_modules/*' -not -path '*/dist/*'`.text();

for (const file of fileListing.split('\n')) {
	if (file.length === 0) continue;
	if (file.endsWith('.test.ts') || file.endsWith('.svelte.test.ts')) continue;
	if (file.endsWith('.d.ts')) continue;
	const contents = await Bun.file(file).text();
	scanFile(file, contents);
}

if (findings.length === 0) {
	console.log('check-browser-globals: ok (scanned browser-bundled libs)');
	process.exit(0);
}

console.error('check-browser-globals: bare Node globals in browser-bundled libs:\n');
for (const f of findings) {
	console.error(`  ${f.file}:${f.line}  ${f.symbol}  ${f.text}`);
}
console.error('\nThese references will ReferenceError at hydration in real browsers.');
console.error('Use web-platform APIs (TextEncoder / btoa / atob / fetch) or lazy-load via');
console.error('`process.getBuiltinModule(...)` gated by `typeof process !== "undefined"`.');
process.exit(1);
