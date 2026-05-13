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
	'libs/autocomplete',
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
	/^\s*import\s+(?!type\s)[^;]*\bfrom\s+['"]@ab\/bc-hangar\/server['"]/,
	/^\s*import\s+(?!type\s)[^;]*\bfrom\s+['"]@ab\/sources\/server['"]/,
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
	symbol: 'Buffer' | 'process' | 'server-only-import' | 'barrel-leak';
	chain?: readonly string[];
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

// Third scan: walk every value-re-export from a runtime barrel and confirm
// no module on that transitive chain imports `@ab/db/connection`, the
// postgres driver, or another server-only entry point. This is what the
// `/memory` Buffer crash needed -- the bare-globals scan caught direct
// `Buffer.` references but not the case where a runtime barrel value-
// re-exported a module whose own value imports reached `db/connection`.
//
// Entries are runtime barrels: client-eligible by design, and any value
// reachable from them must be browser-safe.
interface BarrelSpec {
	readonly path: string;
	// When false, `node:*` static imports along the transitive chain are
	// tolerated -- Vite stubs them in the browser bundle and they do not
	// crash hydration. The check still flags `@ab/db/connection`, `postgres`,
	// `drizzle-orm/postgres-js`, and per-package server barrels, which DO
	// crash (postgres' `bytes.js` evaluates `Buffer.allocUnsafe` at module
	// top). Set to true for barrels that have no escape hatch for `node:*`.
	readonly flagNodeBuiltins: boolean;
}

// Every browser-bundled lib with a runtime barrel needs to be walked here. The
// `BROWSER_BUNDLED_LIBS` scan above catches direct `Buffer.` / `process.` /
// static `node:*` imports inside each lib; this walk catches the harder case
// where the barrel value-re-exports a module whose transitive imports reach
// `@ab/db/connection`, `postgres`, or another server-only specifier. Both
// scans should cover the same 13-lib surface.
//
// `flagNodeBuiltins: true` is the strict mode -- any static `node:*` import on
// the chain is a leak (matches Biome's `noNodejsModules` policy at the source
// level). The looser `flagNodeBuiltins: false` mode is for libs that have
// pre-existing static `node:*` imports along server-only-marked subpaths that
// the walk still recurses into. Vite stubs `node:*` for the client bundle so
// those static imports survive as no-ops in the browser; only the
// postgres-shaped leaks crash hydration. New entries should default to
// `true`; only relax it after auditing the leak chain.
const RUNTIME_BARRELS: readonly BarrelSpec[] = [
	// BC libs -- the original /memory crash surface.
	{ path: 'libs/bc/study/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/bc/hangar/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/bc/ingest-review/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/bc/sim/src/index.ts', flagNodeBuiltins: true },
	// `@ab/sources` is browser-bundled via `urlForReference` / locator parser
	// imports from `.svelte` files (palette detail pane, citation chips). The
	// runtime barrel must not value-reach `@ab/db/connection` or `postgres`
	// (those crash hydration with `ReferenceError: Buffer is not defined`).
	// Pre-existing `node:fs` / `node:path` static imports along corpus
	// resolvers / `registry/query.ts` / `check.ts` are tolerated -- Vite
	// stubs `node:*` for the client bundle and they no-op at runtime in the
	// browser. Only flag the postgres-shaped leaks.
	{ path: 'libs/sources/src/index.ts', flagNodeBuiltins: false },
	// Remaining browser-bundled libs. All ship via SvelteKit's bundler into
	// the client; any value-re-export reaching `postgres` / `@ab/db/connection`
	// crashes hydration. `flagNodeBuiltins: true` because none of these libs
	// have a documented `node:*`-tolerated subpath today.
	{ path: 'libs/constants/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/utils/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/types/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/themes/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/ui/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/help/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/aviation/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/autocomplete/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/audit/src/index.ts', flagNodeBuiltins: true },
	{ path: 'libs/activities/src/index.ts', flagNodeBuiltins: true },
];

// Module specifiers whose runtime evaluation pulls a server-only chunk
// into the client bundle. `import type` is allowed (erases at compile
// time); a non-type runtime import is a leak.
const SERVER_ONLY_SPECIFIERS = [
	'@ab/db/connection',
	'@ab/bc-study/server',
	'@ab/bc-study/build',
	'@ab/bc-ingest-review/server',
	'@ab/sources/server',
	'postgres',
	'drizzle-orm/postgres-js',
];

function isNodeBuiltin(spec: string): boolean {
	return spec.startsWith('node:');
}

interface ParsedImport {
	specifier: string;
	isTypeOnly: boolean;
}

function parseValueImports(contents: string): ParsedImport[] {
	const imports: ParsedImport[] = [];
	const lines = contents.split('\n');
	// Concatenate continuation lines so multi-line `import { ... } from '...'`
	// resolves to a single record. Cheap state machine: track open `{` count.
	let buf = '';
	let depth = 0;
	for (const line of lines) {
		buf += `${line}\n`;
		for (const ch of line) {
			if (ch === '{') depth++;
			else if (ch === '}') depth--;
		}
		if (depth !== 0) continue;
		const stmt = buf.trim();
		buf = '';
		if (!stmt.startsWith('import') && !stmt.startsWith('export')) continue;
		// `import` and `export ... from` both imply module evaluation if
		// any part is non-type.
		const fromMatch = stmt.match(/from\s+['"]([^'"]+)['"]/);
		if (!fromMatch) continue;
		const specifier = fromMatch[1];
		if (specifier === undefined) continue;
		// `import type { ... } from` and `export type { ... } from` are erased.
		const isTypeOnly = /^\s*(import|export)\s+type\b/.test(stmt);
		imports.push({ specifier, isTypeOnly });
	}
	return imports;
}

import { dirname, resolve } from 'node:path';

async function resolveLocal(fromFile: string, specifier: string): Promise<string | null> {
	if (!specifier.startsWith('.')) return null;
	const base = resolve(dirname(fromFile), specifier);
	for (const candidate of [base, `${base}.ts`, `${base}.svelte`, `${base}/index.ts`]) {
		if (await Bun.file(candidate).exists()) return candidate;
	}
	return null;
}

const barrelFindings: Finding[] = [];
const visited = new Set<string>();

async function walkForLeaks(file: string, chain: readonly string[], flagNodeBuiltins: boolean): Promise<void> {
	const key = file;
	if (visited.has(key)) return;
	visited.add(key);
	if (file.endsWith('.svelte')) return; // svelte components don't run in the barrel-eval chain
	const contents = await Bun.file(file).text();
	const imports = parseValueImports(contents);
	for (const imp of imports) {
		if (imp.isTypeOnly) continue;
		// Hit on a server-only specifier => report and stop walking this branch.
		const isServerOnly = SERVER_ONLY_SPECIFIERS.includes(imp.specifier);
		const isNodeImport = isNodeBuiltin(imp.specifier);
		if (isServerOnly || (isNodeImport && flagNodeBuiltins)) {
			barrelFindings.push({
				file,
				line: 0,
				text: `imports '${imp.specifier}' as a value`,
				symbol: 'barrel-leak',
				chain: [...chain, file, `(import) ${imp.specifier}`],
			});
			continue;
		}
		if (isNodeImport && !flagNodeBuiltins) {
			// Tolerated per barrel spec -- Vite stubs `node:*` in the browser
			// bundle so the static import survives without crashing hydration.
			continue;
		}
		// Recurse into local relative imports.
		const local = await resolveLocal(file, imp.specifier);
		if (local !== null) {
			await walkForLeaks(local, [...chain, file], flagNodeBuiltins);
		}
	}
}

for (const barrel of RUNTIME_BARRELS) {
	visited.clear();
	await walkForLeaks(barrel.path, [], barrel.flagNodeBuiltins);
}

if (findings.length === 0 && barrelFindings.length === 0) {
	console.log(
		'check-browser-globals: ok (scanned browser-bundled libs + apps client-eligible files + runtime barrels)',
	);
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

if (barrelFindings.length > 0) {
	console.error('\ncheck-browser-globals: runtime barrel value-re-exports a module that loads server-only code:\n');
	for (const f of barrelFindings) {
		console.error(`  ${f.file}: ${f.text}`);
		if (f.chain) {
			for (const step of f.chain) {
				console.error(`    -> ${step}`);
			}
		}
	}
	console.error('\nThe runtime barrel is bundled into the browser. Any value re-export here MUST resolve');
	console.error('to a module whose transitive runtime imports stay browser-safe. Fix by:');
	console.error('  - Removing the value re-export from the runtime barrel and adding it to the');
	console.error('    matching `/server` barrel (the canonical pattern -- see PR #664), OR');
	console.error('  - Refactoring the offending file so its server-only imports are dynamic');
	console.error('    (lazy `await import()` inside async function bodies).');
}

process.exit(1);
