#!/usr/bin/env bun

/**
 * Reference system dispatcher for airboss.
 *
 * Usage:
 *   bun run references <command> [flags]
 *   bun run references help                 # full command index
 *   bun run references <command> --help     # detailed help for one command
 */

import { run } from './lib/spawn';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('-'));
const command = positional[0];
const passthrough = args.slice(args.indexOf(command ?? '') + 1).filter((a) => a !== '--help' && a !== '-h');
const flags = new Set(args.filter((a) => a.startsWith('-')));
const wantsHelp = flags.has('--help') || flags.has('-h');

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

interface CommandHelp {
	summary: string;
	what: string;
	why: string;
	how: string;
	links?: string[];
}

const COMMAND_HELP: Record<string, CommandHelp> = {
	scan: {
		summary: 'Walk content, build manifest of wiki-link ids (default command)',
		what: 'Crawls every content location (course/knowledge/**/node.md, apps/*/src/lib/help/content/**/*.ts, reference paraphrase fields) and extracts every `[[display::id]]` wiki-link. Emits `data/references/manifest.json` with each id, first-seen location, and use count; emits `unresolvedText` for `[[text::]]` TBD-id links.',
		why: 'The manifest is the "demand side" of the reference system. Extraction routes to parsers per-id from the manifest. The scanner is also how `bun run dev` and `bun run check` catch broken wiki-links before they ship.',
		how: "Sub-second on today's content. Pure-text regex + markdown-context-aware (skips fenced code + inline code). Fails fast when a link is malformed. Broken ids (target not in registry) become errors when the validator runs.",
		links: [
			'scripts/references/scan.ts',
			'data/references/manifest.json',
			'docs/work/todos/20260422-reference-system-architecture.md',
		],
	},
	extract: {
		summary: 'Materialize VerbatimBlocks from downloaded sources',
		what: "Reads the manifest, looks up each reference's source in libs/aviation/src/sources/registry.ts, routes to the right parser (cfr/aim/poh/...), and produces a VerbatimBlock per id. Writes the merged results into libs/aviation/src/references/<source>-generated.ts.\n\n  bun run references extract                    # everything in manifest\n  bun run references extract --id cfr-14-91-155 # one reference\n  bun run references extract --source cfr-14    # all refs from one source",
		why: 'Separates the "authoring teaching voice" (paraphrase, hand-written) from the "authoritative source text" (verbatim, machine-extracted). Running extraction yearly against a new CFR annual XML is the refresh loop that keeps the verbatim layer current.',
		how: 'Decision #3 of the reference architecture: extraction is MANUAL, never on `bun run dev`. Parsers live at libs/aviation/src/sources/<type>/extract.ts and implement the SourceExtractor contract. Binaries not on disk cause a warn-and-skip; parse errors fail.',
		links: [
			'scripts/references/extract.ts',
			'libs/aviation/src/sources/cfr/extract.ts',
			'libs/aviation/src/schema/source.ts',
		],
	},
	build: {
		summary: 'End-to-end: scan + extract + write generated files',
		what: 'Shell for scan -> extract -> materialize. Writes `libs/aviation/src/references/<source>-generated.ts` for each source type the manifest touches, ready to commit.',
		why: 'One command to refresh every machine-extracted reference from the current source corpus. Used at the start of each year and any time an author has added enough new wiki-links to want a batch extraction pass.',
		how: 'Runs `scan`, then `extract` with no filter. Same warn/fail rules as extract. Output files are committed so diffs are reviewable.',
		links: ['scripts/references/build.ts'],
	},
	diff: {
		summary: 'Show verbatim changes vs committed generated files',
		what: "Re-runs extraction into a scratch location and produces a unified diff vs the committed `<source>-generated.ts`. Excludes `extractedAt` from comparison so timestamps don't create noise.\n\n  bun run references diff             # diff every source\n  bun run references diff cfr-14      # diff one source only",
		why: 'The yearly refresh review artifact. Drop in a new annual CFR XML, run build, then diff to see exactly which regs changed text. Hand-review the diff, update `paraphrase` where the meaning shifted, PR it.',
		how: 'LCS-based unified diff, 3 lines of context per hunk. Outputs changed ids, added ids, removed ids, then the text diff per changed id.',
		links: ['scripts/references/diff.ts'],
	},
	validate: {
		summary: 'Gate: unresolved ids, registry coherence, meta integrity',
		what: 'Runs five layers of validation:\n\n  1) Reference schema gates -- required tags, related symmetric, verbatim+sources coherent, no duplicate ids.\n  2) Content wiki-link resolution -- every `[[*::id]]` resolves; TBD-ids counted as warnings.\n  3) Help-page validation -- registered pages pass the same gates.\n  4) Source registry coherence -- cited sourceIds exist with matching type.\n  5) Meta.json integrity + generated-file freshness.',
		why: 'The quality gate. Wired into `bun run check` and `bun run dev` so broken wiki-links and missing tags fail fast during development, never at render time.',
		how: 'Pure function over AVIATION_REFERENCES, helpRegistry.getAllPages(), and SOURCES. Exit code 1 on any error; exit 0 on clean or warnings-only. Errors go to stderr, warnings to stdout.',
		links: ['scripts/references/validate.ts', 'libs/aviation/src/validation.ts', 'libs/help/src/validation.ts'],
	},
	download: {
		summary: 'Download a binary-visual source (sectional chart) via the hangar fetch pipeline',
		what: "Runs the same in-process pipeline the hangar UI's Fetch action drives (`handleBinaryVisualFetch`). Resolves the current edition from the upstream index, short-circuits if the on-disk edition + sha still match, otherwise downloads the archive, rotates prior editions, generates a thumbnail, writes meta.json, and updates the `hangar.source` row.\n\n  bun run references download --id sectional-denver",
		why: 'Gives operators a terminal-only path for source fetches without standing up the hangar dev app. Same pipeline, same audit writes, same drift detection, driven from argv instead of a form action.',
		how: 'Requires a live Postgres with migration 0003 applied and the source row authored as a binary-visual kind. Progress + event lines stream to stdout; errors (drift, 404, checksum mismatch) go to stderr with a non-zero exit. Wraps `apps/hangar/src/lib/server/source-fetch.ts`. Non-binary-visual source kinds are rejected by the pipeline.',
		links: [
			'scripts/references/download.ts',
			'apps/hangar/src/lib/server/source-fetch.ts',
			'docs/work-packages/hangar-non-textual/spec.md',
		],
	},
	'size-report': {
		summary: 'Tally data/sources/ sizes + storage classification',
		what: 'Walks data/sources/**, measures every binary + every .meta.json, groups by source type, and classifies each file: commit-directly (<1 MB), commit-borderline (1-5 MB), use-LFS (5-100 MB), external-storage (>100 MB).',
		why: 'Decision #2 of the reference architecture: data/sources/ is gitignored during initial build-out; storage strategy gets decided per-source once we have actual files on disk. This script produces the report that drives that decision.',
		how: "Runs when you ask. Outputs a table to stdout and writes docs/work/todos/20260422-source-sizes-report.md if there's anything to classify.",
		links: ['scripts/references/size-report.ts', 'docs/work/todos/20260422-reference-system-architecture.md'],
	},
	help: {
		summary: 'Show the command index (or detailed help for one command)',
		what: '`bun run references help` prints the index of every command with its one-line summary. `bun run references <command> --help` prints a what/why/how/links block for that command only.',
		why: 'The dispatcher is the single entry point for every reference-system task. Help has to be discoverable, not buried in the npm script list.',
		how: 'Authored in a COMMAND_HELP record in scripts/references.ts, one entry per command. Keep it terse and links-driven.',
		links: ['scripts/references.ts', 'CLAUDE.md'],
	},
};

function printCommandHelp(name: string): void {
	const entry = COMMAND_HELP[name];
	if (!entry) {
		console.error(`No help entry for '${name}'.`);
		process.exit(1);
	}
	console.log(`\nbun run references ${name}`);
	console.log('-'.repeat(`bun run references ${name}`.length));
	console.log(`\n  ${entry.summary}`);
	console.log(`\nWhat\n  ${entry.what.replace(/\n/g, '\n  ')}`);
	console.log(`\nWhy\n  ${entry.why.replace(/\n/g, '\n  ')}`);
	console.log(`\nHow\n  ${entry.how.replace(/\n/g, '\n  ')}`);
	if (entry.links && entry.links.length > 0) {
		console.log('\nLinks');
		for (const link of entry.links) console.log(`  - ${link}`);
	}
	console.log('');
}

interface CommandGroup {
	label: string;
	commands: readonly string[];
}

// Grouped so the index reads in the order an author reaches for commands:
// inspect what's cited, build verbatim, validate, then meta/help.
const COMMAND_GROUPS: readonly CommandGroup[] = [
	{ label: 'Inspection', commands: ['scan', 'size-report'] },
	{ label: 'Build', commands: ['extract', 'build', 'diff', 'download'] },
	{ label: 'Validation', commands: ['validate'] },
	{ label: 'Utility', commands: ['help'] },
];

function printIndex(): void {
	console.log('Usage: bun run references <command> [flags]');
	console.log('       bun run references <command> --help   # detailed help for one command');
	console.log('');
	console.log('Commands:');
	const allNames = COMMAND_GROUPS.flatMap((g) => g.commands);
	const width = allNames.reduce((m, n) => Math.max(m, n.length), 0);
	for (const group of COMMAND_GROUPS) {
		console.log('');
		console.log(`  ${group.label}`);
		for (const name of group.commands) {
			const entry = COMMAND_HELP[name];
			if (!entry) continue;
			console.log(`    ${name.padEnd(width)}  ${entry.summary}`);
		}
	}
	console.log('');
	console.log('Flags:');
	console.log('  --help, -h    Show detailed help for a command');
	console.log('');
	console.log('All subcommands pass any remaining args through to their implementation script.');
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const handlers: Record<string, () => Promise<void> | void> = {
	scan: () => run(['bun', 'scripts/references/scan.ts', ...passthrough]),
	extract: () => run(['bun', 'scripts/references/extract.ts', ...passthrough]),
	build: () => run(['bun', 'scripts/references/build.ts', ...passthrough]),
	diff: () => run(['bun', 'scripts/references/diff.ts', ...passthrough]),
	download: () => run(['bun', 'scripts/references/download.ts', ...passthrough]),
	validate: () => run(['bun', 'scripts/references/validate.ts', ...passthrough]),
	'size-report': () => run(['bun', 'scripts/references/size-report.ts', ...passthrough]),
	help: printIndex,
};

if (wantsHelp) {
	if (!command || command === 'help') {
		printIndex();
	} else {
		printCommandHelp(command);
	}
	process.exit(0);
}

const handler = command ? handlers[command] : handlers.scan;
if (!handler) {
	console.error(`Unknown command: ${command}\n`);
	printIndex();
	process.exit(1);
}

await handler();
