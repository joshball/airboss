#!/usr/bin/env bun
/**
 * Emit the generated tokens CSS from the registered TypeScript themes.
 *
 * Output: `libs/themes/generated/tokens.css`.
 *
 * Determinism is required: two back-to-back runs must produce
 * byte-identical output. The registry + `emitAllThemes` sort themes
 * alphabetically and iterate palette / chrome / alias blocks in fixed
 * order, so as long as the theme source files are untouched the
 * output is stable.
 *
 * A pre-commit / CI check runs this and fails if the committed CSS
 * drifts.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { emitAllThemes } from '@ab/themes';

const output = resolve(import.meta.dir, '../../libs/themes/generated/tokens.css');
const css = emitAllThemes();

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, css, 'utf8');

console.log(`emitted ${css.length.toLocaleString()} bytes → ${output}`);
