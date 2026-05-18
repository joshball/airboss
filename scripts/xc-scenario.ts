#!/usr/bin/env bun

/**
 * XC-scenario dispatcher.
 *
 * Single entry point for the XC viewer's scenario authoring + validation
 * pipeline. Mirrors `scripts/wx-scenario.ts`.
 *
 * Usage:
 *   bun run xc-scenario                        # index
 *   bun run xc-scenario help
 *
 *   bun run xc-scenario list                   # enumerate registered scenarios
 *   bun run xc-scenario build <slug>           # compose + write the bundle
 *   bun run xc-scenario build --all            # walk every scenario
 *   bun run xc-scenario validate <slug>        # schema + consistency (no writes)
 *   bun run xc-scenario validate --all         # wired into `bun run check`
 *
 * Source of truth:
 *   - docs/work-packages/xc-viewer-v1/spec.md "CLI dispatcher"
 *   - docs/work-packages/xc-viewer-v1/design.md "CLI dispatcher"
 */

import { XC_SCENARIO_SUBCOMMANDS } from '@ab/constants';
import { runBuild } from './xc-scenario/build';
import { runList } from './xc-scenario/list';
import { runValidate } from './xc-scenario/validate';

interface CommandHelp {
	summary: string;
	example: string;
}

const COMMAND_HELP: Record<string, CommandHelp> = {
	[XC_SCENARIO_SUBCOMMANDS.LIST]: {
		summary: 'Enumerate every registered scenario slug + its human label',
		example: 'bun run xc-scenario list',
	},
	[XC_SCENARIO_SUBCOMMANDS.BUILD]: {
		summary: 'Compose + write a scenario bundle (bundle.json + route.geojson + performance.json)',
		example: 'bun run xc-scenario build kmem-kmkl-kolv-frontal-march  |  bun run xc-scenario build --all',
	},
	[XC_SCENARIO_SUBCOMMANDS.VALIDATE]: {
		summary: 'Run schema + cross-layer consistency checks (no writes). Wired into `bun run check`.',
		example: 'bun run xc-scenario validate kmem-kmkl-kolv-frontal-march  |  bun run xc-scenario validate --all',
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
		case XC_SCENARIO_SUBCOMMANDS.LIST:
			runList(rest);
			return;
		case XC_SCENARIO_SUBCOMMANDS.BUILD:
			await runBuild(rest);
			return;
		case XC_SCENARIO_SUBCOMMANDS.VALIDATE:
			await runValidate(rest);
			return;
		default:
			console.error(`xc-scenario: unknown command '${command}'.`);
			printHelp();
			process.exit(2);
	}
}

function printHelp(): void {
	console.log('xc-scenario -- XC viewer scenario authoring + validation dispatcher\n');
	console.log('Usage:  bun run xc-scenario <command> [args]\n');
	console.log('Commands:');
	for (const [name, help] of Object.entries(COMMAND_HELP)) {
		console.log(`  ${name.padEnd(12)} ${help.summary}`);
		console.log(`  ${' '.repeat(12)}   e.g. ${help.example}`);
	}
	console.log('\nSee docs/work-packages/xc-viewer-v1/spec.md for the full contract.');
}

main().catch((err) => {
	console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
	process.exit(1);
});
