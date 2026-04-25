#!/usr/bin/env bun
/**
 * Emit the generated theme artifacts from the registered TypeScript themes.
 *
 * Outputs:
 *   `libs/themes/generated/tokens.css`         -- role tokens + per-theme blocks
 *   `libs/themes/generated/pre-hydration.js`   -- inline script body for app.html
 *   `libs/themes/generated/pre-hydration.ts`   -- typed module exporting the
 *                                                 script body + its CSP hash
 *
 * Determinism is required: two back-to-back runs must produce
 * byte-identical output. The registry sorts themes alphabetically and
 * `emitAllThemes` iterates palette / chrome / alias blocks in fixed
 * order; the pre-hydration generator sorts the theme allow-list. As long
 * as the theme source files are untouched the output (and CSP hash) is
 * stable.
 *
 * A pre-commit / CI check runs this and fails if the committed output
 * drifts.
 */

import { $ } from 'bun';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildPreHydrationCspHash, buildPreHydrationScript, emitAllThemes } from '@ab/themes';

const generatedDir = resolve(import.meta.dir, '../../libs/themes/generated');
const tokensPath = resolve(generatedDir, 'tokens.css');
const scriptPath = resolve(generatedDir, 'pre-hydration.js');
const modulePath = resolve(generatedDir, 'pre-hydration.ts');

mkdirSync(dirname(tokensPath), { recursive: true });

const css = emitAllThemes();
writeFileSync(tokensPath, css, 'utf8');
console.log(`emitted ${css.length.toLocaleString()} bytes → ${tokensPath}`);

const scriptBody = buildPreHydrationScript();
writeFileSync(scriptPath, scriptBody, 'utf8');
console.log(`emitted ${scriptBody.length.toLocaleString()} bytes → ${scriptPath}`);

const cspHash = await buildPreHydrationCspHash(scriptBody);
const moduleSource = `/**
 * GENERATED FILE -- do not edit by hand.
 *
 * Source: \`bun themes:emit\` (scripts/themes/emit.ts).
 * Origin: \`libs/themes/picker/pre-hydration.ts\`.
 *
 * Carries the inline pre-hydration script body and its SHA-256 CSP hash.
 * - \`PRE_HYDRATION_SCRIPT\` is dropped into \`<script>\` in each app's
 *   \`app.html\` via the \`%theme-pre-hydration%\` placeholder + the
 *   \`transformPageChunk\` hook.
 * - \`PRE_HYDRATION_SCRIPT_CSP_HASH\` goes into each app's
 *   \`svelte.config.js\` \`script-src\` directive so a strict CSP allows
 *   the inline script to run.
 *
 * Determinism: regenerated on every \`themes:emit\`; byte-identical when
 * the registered themes are unchanged.
 */

export const PRE_HYDRATION_SCRIPT = ${JSON.stringify(scriptBody)};

export const PRE_HYDRATION_SCRIPT_CSP_HASH = ${JSON.stringify(cspHash)};
`;
writeFileSync(modulePath, moduleSource, 'utf8');

// Run biome on the generated TS module so the emitted file matches the
// repo's formatting rules (single quotes, line wrapping, trailing
// commas). Without this the next `bun run check` fails on a freshly
// regenerated file. Biome's normalization is deterministic, so the
// determinism contract still holds.
await $`bunx biome format --write ${modulePath}`.quiet();

console.log(`emitted ${moduleSource.length.toLocaleString()} bytes → ${modulePath}`);
console.log(`  CSP hash: ${cspHash}`);
