/**
 * Shared subprocess runner for the dispatcher scripts in `scripts/`.
 *
 * Echoes the command, inherits stdio, and exits the parent on a non-zero exit
 * code. Every dispatcher (db, references, sources, smoke, test) used to define
 * its own copy of this -- they all called it `run`. Now they import from here.
 */
export async function run(cmd: readonly string[]): Promise<void> {
	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn([...cmd], { stdio: ['inherit', 'inherit', 'inherit'] });
	const code = await proc.exited;
	if (code !== 0) process.exit(code);
}

/**
 * Variant of `run` that throws on non-zero exit instead of calling
 * `process.exit`. Used by `seed-all.ts`, which composes multiple subprocesses
 * inside a guarded orchestrator and wants the orchestrator to choose how to
 * handle a phase failure.
 */
export async function runOrThrow(cmd: readonly string[], opts: { readonly cwd?: string } = {}): Promise<void> {
	const proc = Bun.spawn([...cmd], { cwd: opts.cwd, stdio: ['inherit', 'inherit', 'inherit'] });
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(`subprocess failed (exit ${code}): ${cmd.join(' ')}`);
	}
}
