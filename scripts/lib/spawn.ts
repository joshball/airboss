/**
 * Shared subprocess runner for the dispatcher scripts in `scripts/`.
 *
 * Echoes the command, inherits stdio, and exits the parent on a non-zero exit
 * code. Every dispatcher (db, references, sources, smoke, test) used to define
 * its own copy of this -- they all called it `run`. Now they import from here.
 */
export async function run(
	cmd: readonly string[],
	opts: { readonly cwd?: string; readonly env?: Record<string, string | undefined> } = {},
): Promise<void> {
	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn([...cmd], {
		cwd: opts.cwd,
		env: opts.env,
		stdio: ['inherit', 'inherit', 'inherit'],
	});
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

/**
 * Variant of `runOrThrow` that pipes the child's stdout/stderr through the
 * parent process's `process.stdout` / `process.stderr` instead of inheriting
 * the file descriptors directly. The visible output is identical, but every
 * line passes through `process.stdout.write`, so any tee/intercept on the
 * parent (e.g. the per-phase `.reports/seed/<phase>.log` capture in
 * `seed-all.ts`) sees the child's output too. Inherited stdio bypasses
 * monkey-patching because the child writes straight to the same fd that the
 * parent's `console.log` writes to, never crossing the JS layer.
 *
 * Use this for any subprocess whose output the parent wants to capture for
 * archival; keep `runOrThrow` for one-shots that don't need archival.
 */
export async function runOrThrowPiped(cmd: readonly string[], opts: { readonly cwd?: string } = {}): Promise<void> {
	const proc = Bun.spawn([...cmd], {
		cwd: opts.cwd,
		stdio: ['inherit', 'pipe', 'pipe'],
	});
	const forward = async (stream: ReadableStream<Uint8Array> | null, sink: NodeJS.WriteStream): Promise<void> => {
		if (stream === null) return;
		const reader = stream.getReader();
		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				if (value && value.length > 0) sink.write(Buffer.from(value));
			}
		} finally {
			reader.releaseLock();
		}
	};
	await Promise.all([forward(proc.stdout, process.stdout), forward(proc.stderr, process.stderr)]);
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(`subprocess failed (exit ${code}): ${cmd.join(' ')}`);
	}
}
