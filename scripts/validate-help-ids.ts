#!/usr/bin/env bun

/**
 * Static validator: every `helpId` / `pageId` prop literal referenced in a
 * `.svelte` or `.svelte.ts` file must resolve to a registered help page.
 *
 * Why this exists:
 *   - Nothing else catches a typo in `helpId="memory-revue"`. At runtime
 *     `<PageHelp>` dev-warns and renders nothing; `<InfoTip>` just ships a
 *     broken "Learn more" link that 404s. Both fail silently in prod.
 *   - This script fails the build the moment a static reference drifts.
 *
 * Wiring:
 *   - Invoked as part of `bun run check` (see `scripts/check.ts`).
 *   - Exit code 0 on clean, 1 on any unregistered id.
 *   - Dynamic props (`helpId={someVar}`) are reported as "skipped" and do
 *     not fail the gate -- we cannot statically resolve them. The count
 *     lands in the summary line so drift is visible.
 *
 * Why a static registry scan instead of importing `helpRegistry`:
 *   - Running this script under Bun imports code from `apps/*` that
 *     transitively resolves `@ab/constants` via SvelteKit Vite aliases
 *     that Bun does not see. Static scanning of the `HelpPage` content
 *     files keeps the validator standalone -- it depends on neither the
 *     runtime registry nor the alias setup and is therefore not dragged
 *     down by env-specific resolution issues.
 *   - The list of scanned directories is configured in
 *     `scripts/validate-help-ids/registry-scan.ts`. Future apps add
 *     their help-content directory there.
 *
 * Output format on failure (one line per finding, grep-able):
 *
 *   unregistered helpId: "onboarding.welcome" (apps/study/src/routes/+layout.svelte:42)
 *   unregistered pageId: "reps.start" (apps/study/src/routes/(app)/reps/+page.svelte:18)
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { discoverSvelteFiles, toRelative } from './validate-help-ids/discover';
import { extractHelpIdRefs, type HelpIdRef } from './validate-help-ids/extract';
import { collectRegisteredHelpIds } from './validate-help-ids/registry-scan';
import { validateHelpIds } from './validate-help-ids/validate';

const REPO_ROOT = resolve(import.meta.dirname, '..');

const scan = await collectRegisteredHelpIds(REPO_ROOT);
if (scan.registeredIds.size === 0) {
	console.error('help-id validator: found 0 registered help-page ids. The scanner config is likely stale.');
	process.exit(1);
}

const files = await discoverSvelteFiles(REPO_ROOT);
const allRefs: HelpIdRef[] = [];
for (const filePath of files) {
	const content = await readFile(filePath, 'utf8');
	// Fast-skip files that don't mention either prop name at all.
	if (!content.includes('helpId') && !content.includes('pageId')) continue;
	const relPath = toRelative(filePath, REPO_ROOT);
	for (const ref of extractHelpIdRefs(content, relPath)) {
		allRefs.push(ref);
	}
}

const result = validateHelpIds(allRefs, scan.registeredIds);

for (const err of result.errors) {
	console.error(`unregistered ${err.propName}: "${err.helpId}" (${err.filePath}:${err.line})`);
}

const summaryParts = [
	`${scan.registeredIds.size} registered page id(s)`,
	`${result.staticChecked} static reference(s) checked`,
	`${result.dynamicSkipped} dynamic reference(s) skipped`,
];
console.log(`help-id validator: ${summaryParts.join(', ')}.`);

if (result.errors.length > 0) {
	console.error(`help-id validator: ${result.errors.length} unregistered id(s). Register them or fix the typo.`);
	process.exit(1);
}

console.log('help-id validator: OK');
