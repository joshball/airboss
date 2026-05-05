import { $ } from 'bun';

// Static guard against Node-only globals (`Buffer`, `process`) AND server-only
// runtime imports (`@ab/db/connection`, the postgres driver, etc.) leaking
// into browser-bundled libs and client-bundled app code. Biome's
// `noNodejsModules` already catches static `import 'node:*'` statements, but
// it does not catch bare references to the Node globals -- and `Buffer.from`
// will silently work in vitest (happy-dom polyfills it) and in node-mode
// tests, then ReferenceError at hydration in real browsers.
//
// Two scans:
//
//   1. Bare-globals (`Buffer.`, `process.`) in browser-bundled libs.
//   2. Runtime imports of server-only packages from client-eligible files
//      (Svelte components and non-server `.ts` under `apps/*/src/**`, plus
//      browser-bundled libs). Type-only imports (`import type { ... }`)
//      erase at compile time and are allowed.
//
// Background: PR #656 fixed a bare `Buffer.from` regression in deck-spec.
// The follow-up `ReferenceError: Buffer is not defined` on `/memory` came
// from a deeper leak: `@ab/bc-study`'s barrel re-exported every server-only
// module, which Vite's deps optimizer then dragged into the client bundle
// along with `postgres` (whose top-level `bytes.js` references `Buffer`).
// The bc-study barrel-split PR splits that surface; this scanner keeps the
// next direct-import regression visible at lint time.

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

// Server-only packages that must never be runtime-imported from
// client-eligible files. `@ab/db` (root) re-exports pure column helpers
// (`timestamps`, `escapeLikePattern`) and is browser-safe; `@ab/db/connection`
// opens the live postgres pool and is server-only. `drizzle-orm` itself is
// a SQL builder and is browser-safe -- only the postgres driver is the
// leak vector. The pattern requires `^import\s+(?!type\s)` to allow
// `import type { ... }` (which erases at compile time).
const SERVER_ONLY_PACKAGE_PATTERNS = [
	/^\s*import\s+(?!type\s)[^;]*\bfrom\s+['"]@ab\/db\/connection['"]/,
	/^\s*import\s+(?!type\s)[^;]*\bfrom\s+['"]@ab\/bc-study\/server['"]/,
	/^\s*import\s+(?!type\s)[^;]*\bfrom\s+['"]@ab\/bc-study\/build['"]/,
	/^\s*import\s+(?!type\s)[^;]*\bfrom\s+['"]postgres['"]/,
	/^\s*import\s+(?!type\s)[^;]*\bfrom\s+['"]node:[^'"]+['"]/,
];

// Files exempt from the server-only-import scan. Server-side route files,
// server-side libs, scripts, tools, and tests run in Node and may freely
// import server-only packages. The patterns match path suffixes.
const SERVER_FILE_PATTERNS = [
	/\.server\.ts$/,
	/\+server\.ts$/,
	/\+page\.server\.ts$/,
	/\+layout\.server\.ts$/,
	/\/server\//,
	/\/_lib\/build-[^/]+\.ts$/, // route-collocated server-only builders (e.g. apps/study/src/routes/.../_lib/build-*.ts)
	/^scripts\//,
	/^tools\//,
	/^tests\//,
	/\.test\.ts$/,
	/\.svelte\.test\.ts$/,
	/^drizzle\//,
];

interface Finding {
	file: string;
	line: number;
	text: string;
	symbol: 'Buffer' | 'process' | 'server-only-import';
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

// Second scan: runtime imports of server-only packages from client-eligible
// files. Catches the next direct-import regression of the postgres-via-bc-study
// pattern. Scope: every `.svelte` and non-server `.ts` under `apps/*/src/**`,
// plus the browser-bundled libs already scanned for bare globals.
function isServerFile(path: string): boolean {
	return SERVER_FILE_PATTERNS.some((re) => re.test(path));
}

function scanForServerImports(file: string, contents: string): void {
	if (isServerFile(file)) return;
	const lines = contents.split('\n');
	// Honor the same server-only marker used for the bare-globals scan --
	// a file can opt out if it's a CLI / cache helper that lives in a
	// client-eligible directory but is never bundled into the client.
	for (let i = 0; i < Math.min(8, lines.length); i++) {
		const line = lines[i];
		if (line !== undefined && SERVER_ONLY_MARKER.test(line)) return;
	}
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw === undefined) continue;
		const trimmed = raw.trim();
		// Only scan import-statement starts; cheaper and avoids matching
		// regex/string literals on unrelated lines.
		if (!trimmed.startsWith('import')) continue;
		for (const re of SERVER_ONLY_PACKAGE_PATTERNS) {
			if (re.test(raw)) {
				findings.push({ file, line: i + 1, text: trimmed, symbol: 'server-only-import' });
				break;
			}
		}
	}
}

// Scope: `apps/*/src/**` only. Browser-bundled libs already have their
// own internal split (e.g. `@ab/bc-study/server`); the runtime barrel
// `index.ts` is what gets bundled, and the bare-globals scan above
// catches a regression there. The risk surface for "wrong import drags
// postgres into the browser" is concentrated in app source files.
const appsListing =
	await $`find apps -type f \( -name '*.ts' -o -name '*.svelte' \) -not -path '*/node_modules/*' -not -path '*/.svelte-kit/*' -not -path '*/build/*'`.text();

for (const file of appsListing.split('\n')) {
	if (file.length === 0) continue;
	if (file.endsWith('.d.ts')) continue;
	const contents = await Bun.file(file).text();
	scanForServerImports(file, contents);
}

if (findings.length === 0) {
	console.log('check-browser-globals: ok (scanned browser-bundled libs + apps client-eligible files)');
	process.exit(0);
}

const globalFindings = findings.filter((f) => f.symbol !== 'server-only-import');
const importFindings = findings.filter((f) => f.symbol === 'server-only-import');

if (globalFindings.length > 0) {
	console.error('check-browser-globals: bare Node globals in browser-bundled libs:\n');
	for (const f of globalFindings) {
		console.error(`  ${f.file}:${f.line}  ${f.symbol}  ${f.text}`);
	}
	console.error('\nThese references will ReferenceError at hydration in real browsers.');
	console.error('Use web-platform APIs (TextEncoder / btoa / atob / fetch) or lazy-load via');
	console.error('`process.getBuiltinModule(...)` gated by `typeof process !== "undefined"`.\n');
}

if (importFindings.length > 0) {
	console.error('check-browser-globals: server-only runtime imports from client-eligible files:\n');
	for (const f of importFindings) {
		console.error(`  ${f.file}:${f.line}  ${f.text}`);
	}
	console.error('\nThese imports drag the postgres driver / Node built-ins into the browser bundle.');
	console.error('Switch to a type-only import (`import type { ... }`), move the work into a');
	console.error('`+page.server.ts` / `+server.ts` / `apps/*/src/lib/server/**` file, or import');
	console.error('the browser-safe entry point (`@ab/bc-study` instead of `@ab/bc-study/server`).');
}

process.exit(1);
