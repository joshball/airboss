#!/usr/bin/env bun

/**
 * Weather-chart dispatcher for airboss.
 *
 * Single entry point for the wx chart authoring + build pipeline. Mirrors
 * `scripts/db.ts` / `scripts/sources.ts` / `scripts/wp.ts`.
 *
 * Usage:
 *   bun run charts                                # index
 *   bun run charts help
 *
 *   bun run charts build <slug>                   # render one chart
 *   bun run charts build --all                    # render every chart
 *   bun run charts validate <slug>                # spec + sources resolvable
 *   bun run charts validate --all                 # validate every chart
 *   bun run charts list                           # flat slug list
 *   bun run charts list --by-type                 # grouped by chart type
 *
 * Source of truth:
 *   - docs/work-packages/wx-chart-symbology-library/spec.md "Chart authoring flow"
 *   - libs/wx-charts/ public API
 */

import { runBuild } from './charts/build';
import { runList } from './charts/list';
import { runValidate } from './charts/validate';

interface CommandHelp {
	summary: string;
	example: string;
}

const COMMAND_HELP: Record<string, CommandHelp> = {
	build: {
		summary: 'Render a chart from its spec.yaml + cache sources, write chart.svg + meta.json',
		example: 'bun run charts build wx-surface-analysis-2024-12-23-12z',
	},
	validate: {
		summary: 'Spec-shape + sources-resolvable check for a chart (no render)',
		example: 'bun run charts validate wx-surface-analysis-2024-12-23-12z',
	},
	list: {
		summary: 'Enumerate every chart slug under data/charts/wx/',
		example: 'bun run charts list --by-type',
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
		case 'build':
			await runBuild(rest);
			return;
		case 'validate':
			await runValidate(rest);
			return;
		case 'list':
			runList(rest);
			return;
		default:
			console.error(`charts: unknown command '${command}'.`);
			printHelp();
			process.exit(2);
	}
}

function printHelp(): void {
	console.log('charts -- weather-chart authoring + build dispatcher\n');
	console.log('Usage:  bun run charts <command> [args]\n');
	console.log('Commands:');
	for (const [name, help] of Object.entries(COMMAND_HELP)) {
		console.log(`  ${name.padEnd(10)} ${help.summary}`);
		console.log(`  ${' '.repeat(10)}   e.g. ${help.example}`);
	}
	console.log('\nSee docs/work-packages/wx-chart-symbology-library/spec.md for the full contract.');
}

main().catch((err) => {
	console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
	process.exit(1);
});
