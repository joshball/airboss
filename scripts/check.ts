import { $ } from 'bun';

console.log('Running svelte-check...');
const svelteCheck = await $`cd apps/study && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

console.log('\nRunning biome...');
const biome = await $`bunx biome check .`.nothrow();

const failed = svelteCheck.exitCode !== 0 || biome.exitCode !== 0;
if (failed) {
	console.error('\nChecks failed.');
	process.exit(1);
}

console.log('\nAll checks passed.');
