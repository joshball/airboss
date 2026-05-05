import { $ } from 'bun';
import { existsSync } from 'node:fs';

// Ensure every SvelteKit app has its generated `.svelte-kit/tsconfig.json`
// before svelte-check reads each app's local tsconfig (which `extends` it).
// `svelte-kit sync` is idempotent and cheap; running it up-front makes a
// fresh worktree self-bootstrap instead of failing the first `bun run check`.
const SVELTE_APPS = ['apps/study', 'apps/sim', 'apps/hangar', 'apps/avionics', 'apps/flightbag'] as const;
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

console.log('\nRunning svelte-check (flightbag)...');
const svelteCheckFlightbag = await $`cd apps/flightbag && bunx svelte-check --tsconfig ./tsconfig.json`.nothrow();

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

console.log('\nRunning test-lint...');
const testLint = await $`bun tools/test-lint/bin.ts`.nothrow();

console.log('\nValidating help-ids (InfoTip / PageHelp)...');
const helpIds = await $`bun scripts/validate-help-ids.ts`.nothrow();

console.log('\nValidating course/regulations frontmatter...');
const courseFrontmatter = await $`bun tools/course-frontmatter/check.ts`.nothrow();

// Handbook ingest pytest. Pinned to the orphan-threshold suite so a
// missing pytest install on a developer machine surfaces a clear error
// instead of silently skipping the figure-pairing regression guardrail
// (per docs/work-packages/handbook-figure-pairing).
console.log('\nRunning handbook-ingest pytest...');
const handbookIngestVenv = 'tools/handbook-ingest/.venv/bin/python';
const handbookIngestPython = existsSync(handbookIngestVenv) ? handbookIngestVenv : 'python3';
const handbookIngest =
	await $`cd tools/handbook-ingest && ${handbookIngestPython} -m pytest tests/test_orphan_thresholds.py`.nothrow();

// Glossary corpus size trip-wire. Every file under
// `libs/help/src/glossary/content/*.md` is bundled eagerly into every
// app that imports `@ab/help/glossary` (Vite `import.meta.glob({ eager: true })`).
// We accept the eager-glob shape today because the corpus is small;
// this trip-wire fires when the corpus crosses ~64 KB so the next
// author has to make an informed decision (lazy `import()` or accept
// the bundle cost). See `libs/help/src/glossary/index.ts` design note.
console.log('\nChecking glossary corpus size...');
const GLOSSARY_BUDGET_BYTES = 64 * 1024;
const glossaryListing = await $`find libs/help/src/glossary/content -name '*.md'`.text();
let glossaryBytes = 0;
for (const file of glossaryListing.split('\n')) {
	if (file.length === 0) continue;
	glossaryBytes += Bun.file(file).size;
}
const glossaryOk = glossaryBytes <= GLOSSARY_BUDGET_BYTES;
if (glossaryOk) {
	console.log(`glossary corpus: ${glossaryBytes} / ${GLOSSARY_BUDGET_BYTES} bytes (OK)`);
} else {
	console.error(
		`glossary corpus: ${glossaryBytes} bytes exceeds budget of ${GLOSSARY_BUDGET_BYTES} bytes.\n` +
			'Eager-globbed bundle cost is no longer trivial. Either trim entries or move to lazy `import()`.',
	);
}

const failed =
	svelteCheck.exitCode !== 0 ||
	svelteCheckSim.exitCode !== 0 ||
	svelteCheckHangar.exitCode !== 0 ||
	svelteCheckAvionics.exitCode !== 0 ||
	svelteCheckFlightbag.exitCode !== 0 ||
	biome.exitCode !== 0 ||
	references.exitCode !== 0 ||
	airbossRef.exitCode !== 0 ||
	knowledge.exitCode !== 0 ||
	themeLint.exitCode !== 0 ||
	testLint.exitCode !== 0 ||
	helpIds.exitCode !== 0 ||
	courseFrontmatter.exitCode !== 0 ||
	handbookIngest.exitCode !== 0 ||
	!glossaryOk;
if (failed) {
	console.error('\nChecks failed.');
	process.exit(1);
}

console.log('\nAll checks passed.');
