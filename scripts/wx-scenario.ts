#!/usr/bin/env bun

/**
 * Weather-scenario-engine dispatcher.
 *
 * Single entry point for the wx-engine authoring + validation pipeline.
 * Mirrors `scripts/charts.ts` / `scripts/wp.ts` / `scripts/track.ts`.
 *
 * Usage:
 *   bun run wx-scenario                        # index
 *   bun run wx-scenario help
 *
 *   bun run wx-scenario list                   # enumerate every registered scenario
 *   bun run wx-scenario build <slug>           # generate + write the bundle
 *   bun run wx-scenario build --all            # walk every scenario
 *   bun run wx-scenario validate <slug>        # round-trip + consistency + knowledge (no writes)
 *   bun run wx-scenario check-round-trip --all # full-scope check, wired into `bun run check`
 *
 * Source of truth:
 *   - docs/work-packages/wx-engine/spec.md "Scope -> CLI dispatcher"
 *   - docs/work-packages/wx-engine/design.md "CLI dispatcher"
 */

import { WX_SCENARIO_SUBCOMMANDS } from '@ab/constants';
import { runBuild } from './wx-scenario/build';
import { runCheckCatalog } from './wx-scenario/check-catalog';
import { runCheckRoundTrip } from './wx-scenario/check-round-trip';
import { runCoverage } from './wx-scenario/coverage';
import { runDrill } from './wx-scenario/drill';
import { runList } from './wx-scenario/list';
import { runValidate } from './wx-scenario/validate';

interface CommandHelp {
	summary: string;
	example: string;
}

const COMMAND_HELP: Record<string, CommandHelp> = {
	[WX_SCENARIO_SUBCOMMANDS.LIST]: {
		summary: 'Enumerate every registered scenario slug + its human label',
		example: 'bun run wx-scenario list',
	},
	[WX_SCENARIO_SUBCOMMANDS.BUILD]: {
		summary: 'Generate + write a scenario bundle (truth + products + charts + commentary)',
		example: 'bun run wx-scenario build frontal-xc-march  |  bun run wx-scenario build --all',
	},
	[WX_SCENARIO_SUBCOMMANDS.VALIDATE]: {
		summary: 'Run round-trip + consistency + knowledge-node resolution (no writes)',
		example: 'bun run wx-scenario validate frontal-xc-march',
	},
	[WX_SCENARIO_SUBCOMMANDS.CHECK_ROUND_TRIP]: {
		summary: 'Walk every scenario, run the full validate suite. Wired into `bun run check`.',
		example: 'bun run wx-scenario check-round-trip --all',
	},
	[WX_SCENARIO_SUBCOMMANDS.CHECK_CATALOG]: {
		summary:
			'Validate the encoded-text catalog (round-trip every example, check catalog.json freshness). Wired into `bun run check`.',
		example: 'bun run wx-scenario check-catalog',
	},
	[WX_SCENARIO_SUBCOMMANDS.DRILL]: {
		summary: 'Generate a pack of practice products (METAR / TAF / PIREP / FB / AIRMET) with per-token annotations',
		example: 'bun run wx-scenario drill --count 20 --products metar,taf --output /tmp/sample-drill',
	},
	[WX_SCENARIO_SUBCOMMANDS.COVERAGE]: {
		summary: 'Report catalog coverage across scenarios -- totals, per-scenario contribution, uncovered token families',
		example: 'bun run wx-scenario coverage  |  bun run wx-scenario coverage --format json',
	},
};

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const command = argv[0] ?? '';
	const rest = argv.slice(1);

	if (command === '' || command === 'help' || command === '-h' || command === '--help') {
		printHelp();
		return;
	}

	switch (command) {
		case WX_SCENARIO_SUBCOMMANDS.LIST:
			runList(rest);
			return;
		case WX_SCENARIO_SUBCOMMANDS.BUILD:
			await runBuild(rest);
			return;
		case WX_SCENARIO_SUBCOMMANDS.VALIDATE:
			await runValidate(rest);
			return;
		case WX_SCENARIO_SUBCOMMANDS.CHECK_ROUND_TRIP:
			await runCheckRoundTrip(rest);
			return;
		case WX_SCENARIO_SUBCOMMANDS.CHECK_CATALOG:
			await runCheckCatalog(rest);
			return;
		case WX_SCENARIO_SUBCOMMANDS.DRILL:
			await runDrill(rest);
			return;
		case WX_SCENARIO_SUBCOMMANDS.COVERAGE:
			runCoverage(rest);
			return;
		default:
			console.error(`wx-scenario: unknown command '${command}'.`);
			printHelp();
			process.exit(2);
	}
}

function printHelp(): void {
	console.log('wx-scenario -- truth-aware weather scenario engine dispatcher\n');
	console.log('Usage:  bun run wx-scenario <command> [args]\n');
	console.log('Commands:');
	for (const [name, help] of Object.entries(COMMAND_HELP)) {
		console.log(`  ${name.padEnd(20)} ${help.summary}`);
		console.log(`  ${' '.repeat(20)}   e.g. ${help.example}`);
	}
	console.log('\nSee docs/work-packages/wx-engine/spec.md for the full contract.');
}

main().catch((err) => {
	console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
	process.exit(1);
});
