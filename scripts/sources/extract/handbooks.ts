/**
 * `bun run sources extract handbooks` -- Bun -> Python dispatcher.
 *
 * Wraps `python -m ingest <args>` from `tools/handbook-ingest/`. If the local
 * venv exists at `tools/handbook-ingest/.venv/bin/python`, we use it; otherwise
 * we fall back to `python3` on PATH and let Python report missing deps.
 *
 * The Bun root `package.json` exposes the parent dispatcher as
 * `bun run sources` so the developer entry point matches every other script
 * in the repo.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '..', '..', '..');
const TOOL_DIR = join(REPO_ROOT, 'tools/handbook-ingest');
const VENV_PYTHON = join(TOOL_DIR, '.venv/bin/python');

export async function runExtractHandbooks(argv: readonly string[]): Promise<number> {
	const pythonBin = existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3';
	const cmd = [pythonBin, '-m', 'ingest', ...argv];
	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn(cmd, {
		cwd: TOOL_DIR,
		stdio: ['inherit', 'inherit', 'inherit'],
		env: process.env,
	});
	return await proc.exited;
}
