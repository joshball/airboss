import { $ } from 'bun';

console.log('Running svelte-check (study)...');
const svelteCheck = await $`cd apps/study && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

console.log('\nRunning svelte-check (sim)...');
const svelteCheckSim = await $`cd apps/sim && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

console.log('\nRunning svelte-check (hangar)...');
const svelteCheckHangar = await $`cd apps/hangar && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

console.log('\nRunning biome...');
const biome = await $`bunx biome check .`.nothrow();

console.log('\nValidating references (schema + wiki-links)...');
const references = await $`bun scripts/references.ts validate`.nothrow();

console.log('\nValidating knowledge graph (db build --dry-run)...');
const knowledge = await $`bun scripts/build-knowledge-index.ts --dry-run`.nothrow();

console.log('\nRunning theme-lint...');
const themeLint = await $`bun tools/theme-lint/bin.ts`.nothrow();

const failed =
	svelteCheck.exitCode !== 0 ||
	svelteCheckSim.exitCode !== 0 ||
	svelteCheckHangar.exitCode !== 0 ||
	biome.exitCode !== 0 ||
	references.exitCode !== 0 ||
	knowledge.exitCode !== 0 ||
	themeLint.exitCode !== 0;
if (failed) {
	console.error('\nChecks failed.');
	process.exit(1);
}

console.log('\nAll checks passed.');
