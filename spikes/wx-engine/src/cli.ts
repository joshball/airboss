#!/usr/bin/env bun
// Spike 01 -- CLI runner.
//
// Usage:
//   bun run spikes/wx-engine/src/cli.ts generate frontal-xc-march
//   bun run spikes/wx-engine/src/cli.ts list
//
// `generate <scenario>` runs the engine end-to-end and writes:
//   - data/wx-scenarios/<scenario>/  (truth + products + charts + commentary)
//   - data/charts/wx/wx-scenario-<scenario>-<kind>/spec.yaml (mirror for chart build)
//   - <cache>/wx/scenarios/<scenario>/<kind>.json (source files chart specs reference)

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { generateScenario, writeScenarioBundle, type ScenarioSeed } from './engine';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

const SCENARIOS = ['frontal-xc-march'] as const;
type ScenarioName = (typeof SCENARIOS)[number];

function isScenarioName(s: string): s is ScenarioName {
	return (SCENARIOS as readonly string[]).includes(s);
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const cmd = argv[0] ?? '';

	if (cmd === '' || cmd === 'help' || cmd === '-h' || cmd === '--help') {
		printHelp();
		return;
	}

	if (cmd === 'list') {
		console.log('Available scenarios:');
		for (const s of SCENARIOS) console.log(`  ${s}`);
		return;
	}

	if (cmd === 'generate') {
		const name = argv[1] ?? '';
		if (!isScenarioName(name)) {
			console.error(`wx-engine: unknown scenario '${name}'. Run "list" to see options.`);
			process.exit(2);
		}
		const seed: ScenarioSeed = { kind: name };
		const t0 = performance.now();
		const bundle = generateScenario(seed);
		const tGen = performance.now() - t0;
		console.log(`generated scenario '${bundle.scenarioId}' in ${tGen.toFixed(0)} ms`);
		console.log(`  truth: ${Object.keys(bundle.truth.stations).length} stations, ${bundle.truth.synoptic.fronts.length} fronts, ${bundle.truth.airMasses.length} air masses`);
		console.log(`  products: ${bundle.products.metars.length} METARs, ${bundle.products.tafs.length} TAFs, ${bundle.products.airmets.length} AIRMETs, ${bundle.products.fbGrid.parsed.stations.length} FB stations, ${bundle.products.pireps.length} PIREPs`);
		console.log(`  charts: ${bundle.charts.length} chart specs`);
		console.log(`  commentary: ${bundle.commentary.length} callouts`);

		// Verify round-trip parse warnings.
		let warnCount = 0;
		for (const m of bundle.products.metars) warnCount += m.parsed.warnings.length;
		for (const t of bundle.products.tafs) warnCount += t.parsed.warnings.length;
		warnCount += bundle.products.fbGrid.parsed.warnings.length;
		for (const p of bundle.products.pireps) warnCount += p.parsed.warnings.length;
		console.log(`  round-trip warnings: ${warnCount}`);

		const t1 = performance.now();
		writeScenarioBundle(bundle, { repoRoot: REPO_ROOT });
		const tWrite = performance.now() - t1;
		console.log(`  wrote bundle in ${tWrite.toFixed(0)} ms`);
		console.log(`  output: data/wx-scenarios/${bundle.scenarioId}/`);
		console.log(`  chart slugs (run \`bun run charts build <slug>\` to render):`);
		for (const c of bundle.charts) console.log(`    ${c.slug}`);
		return;
	}

	console.error(`wx-engine: unknown command '${cmd}'.`);
	printHelp();
	process.exit(2);
}

function printHelp(): void {
	console.log('wx-engine spike 01 CLI');
	console.log('');
	console.log('Usage:');
	console.log('  bun run spikes/wx-engine/src/cli.ts list');
	console.log('  bun run spikes/wx-engine/src/cli.ts generate <scenario>');
}

main().catch((err) => {
	console.error('wx-engine: fatal:', err);
	process.exit(1);
});
