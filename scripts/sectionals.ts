#!/usr/bin/env bun

/**
 * Sectionals dispatcher.
 *
 * Manages the XC viewer's layer-1 sectional regions: enumerate ingested
 * regions, ingest a region's vector geometry from the FAA dCS source
 * archive in the developer-local cache.
 *
 * Usage:
 *   bun run sectionals                  # index
 *   bun run sectionals help
 *
 *   bun run sectionals list             # enumerate registered regions
 *   bun run sectionals ingest <region>  # read FAA dCS source, write vectors
 *
 * Source of truth: docs/work-packages/xc-viewer-v1/spec.md "CLI dispatcher".
 */

import { SECTIONALS_SUBCOMMANDS, XC_REGION_LABELS, XC_REGION_VALUES, type XcRegion } from '@ab/constants';
import { ingestSectional } from '@ab/spatial-engine/server';

function runList(): void {
	for (const region of XC_REGION_VALUES) {
		console.log(`${region} -- ${XC_REGION_LABELS[region]}`);
	}
}

function runIngest(args: readonly string[]): void {
	const region = args[0];
	if (!region || !(XC_REGION_VALUES as readonly string[]).includes(region)) {
		console.error(`sectionals ingest: unknown or missing region. Legal regions: ${XC_REGION_VALUES.join(', ')}`);
		process.exit(2);
	}
	const result = ingestSectional(region as XcRegion);
	console.log(result.message);
	if (!result.ok) {
		process.exit(1);
	}
}

function printHelp(): void {
	console.log('sectionals -- XC viewer sectional-region dispatcher\n');
	console.log('Usage:  bun run sectionals <command> [args]\n');
	console.log('Commands:');
	console.log(`  ${SECTIONALS_SUBCOMMANDS.LIST.padEnd(10)} Enumerate every registered sectional region`);
	console.log(`  ${SECTIONALS_SUBCOMMANDS.INGEST.padEnd(10)} Ingest a region's vector geometry from the FAA dCS cache`);
	console.log('\n  e.g. bun run sectionals ingest memphis');
	console.log('\nSee docs/work-packages/xc-viewer-v1/spec.md for the full contract.');
}

function main(): void {
	const argv = process.argv.slice(2);
	const command = argv[0] ?? '';
	const rest = argv.slice(1);

	if (command === '' || command === 'help' || command === '-h' || command === '--help') {
		printHelp();
		return;
	}

	switch (command) {
		case SECTIONALS_SUBCOMMANDS.LIST:
			runList();
			return;
		case SECTIONALS_SUBCOMMANDS.INGEST:
			runIngest(rest);
			return;
		default:
			console.error(`sectionals: unknown command '${command}'.`);
			printHelp();
			process.exit(2);
	}
}

main();
