#!/usr/bin/env bun
/**
 * Bun -> Python dispatcher for the handbook ingestion pipeline.
 *
 * Wraps `python -m ingest <args>` from `tools/handbook-ingest/`. If the local
 * venv exists at `tools/handbook-ingest/.venv/bin/python`, we use it; otherwise
 * we fall back to `python3` on PATH and let Python report missing deps.
 *
 * The Bun root `package.json` exposes this as `bun run handbook-ingest` so the
 * developer entry point matches every other script in the repo.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..');
const toolDir = join(repoRoot, 'tools/handbook-ingest');
const venvPython = join(toolDir, '.venv/bin/python');

const pythonBin = existsSync(venvPython) ? venvPython : 'python3';

const userArgs = process.argv.slice(2);
const cmd = [pythonBin, '-m', 'ingest', ...userArgs];

console.log(`> ${cmd.join(' ')}`);
const proc = Bun.spawn(cmd, {
	cwd: toolDir,
	stdio: ['inherit', 'inherit', 'inherit'],
	env: process.env,
});
const code = await proc.exited;
process.exit(code);
