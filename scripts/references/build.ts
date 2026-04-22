#!/usr/bin/env bun
/**
 * End-to-end reference build: scan -> extract -> write.
 *
 * CLI:
 *   bun scripts/references/build.ts               Full scan + extract.
 *   bun scripts/references/build.ts --dry-run     Do not write; print summary.
 *   bun scripts/references/build.ts --source cfr  Extract only one source type.
 *
 * Same fail/warn semantics as `extract.ts`. This script is the yearly-refresh
 * entry point: drop the new source file in, update the registry, run `build`.
 */

import { runExtract } from './extract';
import { scanContent } from './scan';

interface BuildOptions {
	dryRun?: boolean;
	sourceTypeFilter?: string;
}

function parseArgs(argv: readonly string[]): BuildOptions {
	const opts: BuildOptions = {};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--dry-run') {
			opts.dryRun = true;
		} else if (arg === '--source') {
			const value = argv[i + 1];
			if (!value) throw new Error('--source requires a value');
			opts.sourceTypeFilter = value;
			i += 1;
		} else if (arg === '--help' || arg === '-h') {
			console.log('Usage: bun scripts/references/build.ts [--source <source-type>] [--dry-run]');
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return opts;
}

export async function runBuild(options: BuildOptions = {}): Promise<void> {
	console.log('scan: walking content...');
	const { manifest } = scanContent();
	console.log(`scan: ${manifest.references.length} unique id(s), ${manifest.unresolvedText.length} TBD-id link(s).`);

	console.log('extract: dispatching per-id...');
	const result = await runExtract({
		manifest,
		dryRun: options.dryRun,
		sourceTypeFilter: options.sourceTypeFilter,
	});

	for (const w of result.warnings) {
		console.log(`warn: ${w.id}: ${w.reason}`);
	}
	for (const s of result.skipped) {
		console.log(`skip: ${s.id}: ${s.reason}`);
	}
	for (const e of result.errors) {
		console.error(`error: ${e.id}: ${e.reason}`);
	}

	const perTypeCounts = Object.entries(result.perSourceType)
		.map(([t, b]) => `${t}=${Object.keys(b).length}`)
		.join(', ');
	console.log(
		`build: ${result.extracted.length} extracted${perTypeCounts ? ` (${perTypeCounts})` : ''}, ${result.skipped.length} skipped, ${result.errors.length} errors, ${result.warnings.length} warnings${options.dryRun ? ' [dry-run]' : ''}.`,
	);

	if (result.errors.length > 0) {
		process.exit(1);
	}
}

if (import.meta.main) {
	const options = parseArgs(process.argv.slice(2));
	await runBuild(options);
}
