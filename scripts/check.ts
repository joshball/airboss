import { $ } from 'bun';
import { existsSync } from 'node:fs';

// Ensure every SvelteKit app has its generated `.svelte-kit/tsconfig.json`
// before svelte-check reads each app's local tsconfig (which `extends` it).
// `svelte-kit sync` is idempotent and cheap; running it up-front makes a
// fresh worktree self-bootstrap instead of failing the first `bun run check`.
const SVELTE_APPS = ['apps/study', 'apps/sim', 'apps/hangar', 'apps/avionics'] as const;
for (const app of SVELTE_APPS) {
	const generated = `${app}/.svelte-kit/tsconfig.json`;
	if (!existsSync(generated)) {
		console.log(`svelte-kit sync (${app})...`);
		await $`cd ${app} && bunx svelte-kit sync`.quiet();
	}
}

console.log('Running svelte-check (study)...');
const svelteCheck = await $`cd apps/study && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

console.log('\nRunning svelte-check (sim)...');
const svelteCheckSim = await $`cd apps/sim && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

console.log('\nRunning svelte-check (hangar)...');
const svelteCheckHangar = await $`cd apps/hangar && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

console.log('\nRunning svelte-check (avionics)...');
const svelteCheckAvionics = await $`cd apps/avionics && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

console.log('\nRunning biome...');
const biome = await $`bunx biome check .`.nothrow();

console.log('\nValidating references (schema + wiki-links)...');
const references = await $`bun scripts/references.ts validate`.nothrow();

console.log('\nValidating reference identifiers (airboss-ref: per ADR 019)...');
const airbossRef = await $`bun scripts/airboss-ref.ts`.nothrow();

console.log('\nValidating knowledge graph (db build --dry-run)...');
const knowledge = await $`bun scripts/build-knowledge-index.ts --dry-run`.nothrow();

console.log('\nRunning theme-lint...');
const themeLint = await $`bun tools/theme-lint/bin.ts`.nothrow();

console.log('\nValidating help-ids (InfoTip / PageHelp)...');
const helpIds = await $`bun scripts/validate-help-ids.ts`.nothrow();

const failed =
	svelteCheck.exitCode !== 0 ||
	svelteCheckSim.exitCode !== 0 ||
	svelteCheckHangar.exitCode !== 0 ||
	svelteCheckAvionics.exitCode !== 0 ||
	biome.exitCode !== 0 ||
	references.exitCode !== 0 ||
	airbossRef.exitCode !== 0 ||
	knowledge.exitCode !== 0 ||
	themeLint.exitCode !== 0 ||
	helpIds.exitCode !== 0;
if (failed) {
	console.error('\nChecks failed.');
	process.exit(1);
}

console.log('\nAll checks passed.');
