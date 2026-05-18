/**
 * Shared subprocess runner for the dispatcher scripts in `scripts/`.
 *
 * Echoes the command, inherits stdio, and exits the parent on a non-zero exit
 * code. Every dispatcher (db, references, sources, smoke, test) used to define
 * its own copy of this -- they all called it `run`. Now they import from here.
 *
 * Env handling: when the caller passes `opts.env`, it's used as-is. Otherwise
 * we default to a snapshot of `process.env`, which lets the parent's
 * mutations to `process.env` (e.g. `db.ts` overriding `DATABASE_URL` for a
 * worktree DB) propagate to the child. Without that explicit handoff Bun's
 * implicit `.env` re-reading clobbers the override on every child spawn.
 */
function spawnEnv(envOverride?: Record<string, string | undefined>): Record<string, string | undefined> {
	return envOverride ?? { ...process.env };
}

export async function run(
	cmd: readonly string[],
	opts: { readonly cwd?: string; readonly env?: Record<string, string | undefined> } = {},
): Promise<void> {
	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn([...cmd], {
		cwd: opts.cwd,
		env: spawnEnv(opts.env),
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
export async function runOrThrow(
	cmd: readonly string[],
	opts: { readonly cwd?: string; readonly env?: Record<string, string | undefined> } = {},
): Promise<void> {
	const proc = Bun.spawn([...cmd], {
		cwd: opts.cwd,
		env: spawnEnv(opts.env),
		stdio: ['inherit', 'inherit', 'inherit'],
	});
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
/**
 * Run a subprocess silently, capturing stdout+stderr into a string so the
 * caller can render a tight summary. Used by the `db reset` orchestrator so
 * each pre-seed step (drop / create / push / etc) shows up as a single
 * status-line update instead of pages of `docker exec` echo + psql output.
 *
 * Returns combined stdout+stderr regardless of exit status; throws with the
 * captured output included in the message on non-zero exit.
 */
export async function runQuiet(
	cmd: readonly string[],
	opts: { readonly cwd?: string; readonly env?: Record<string, string | undefined> } = {},
): Promise<string> {
	const proc = Bun.spawn([...cmd], {
		cwd: opts.cwd,
		env: spawnEnv(opts.env),
		stdio: ['inherit', 'pipe', 'pipe'],
	});
	const [stdout, stderr] = await Promise.all([
		proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(''),
		proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(''),
	]);
	const code = await proc.exited;
	const combined = `${stdout}${stderr}`;
	if (code !== 0) {
		throw new Error(`subprocess failed (exit ${code}): ${cmd.join(' ')}\n${combined}`);
	}
	return combined;
}

/**
 * Run a subprocess while teeing its stdout+stderr through the parent's
 * `process.stdout` / `process.stderr` AND appending every chunk to a log file.
 * The console output is identical to `run`; the log file gets the raw bytes
 * so post-run inspection has the full transcript. Returns the child's exit
 * code so the caller can decide how to surface failure (we want to print the
 * log path even on non-zero exits).
 */
export async function runTee(
	cmd: readonly string[],
	logPath: string,
	opts: { readonly cwd?: string; readonly env?: Record<string, string | undefined> } = {},
): Promise<number> {
	console.log(`> ${cmd.join(' ')}`);
	const logFile = Bun.file(logPath);
	const writer = logFile.writer();
	writer.write(`> ${cmd.join(' ')}\n`);
	const proc = Bun.spawn([...cmd], {
		cwd: opts.cwd,
		env: spawnEnv(opts.env),
		stdio: ['inherit', 'pipe', 'pipe'],
	});
	const forward = async (stream: ReadableStream<Uint8Array> | null, sink: NodeJS.WriteStream): Promise<void> => {
		if (stream === null) return;
		const reader = stream.getReader();
		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				if (value && value.length > 0) {
					sink.write(Buffer.from(value));
					writer.write(value);
				}
			}
		} finally {
			reader.releaseLock();
		}
	};
	await Promise.all([forward(proc.stdout, process.stdout), forward(proc.stderr, process.stderr)]);
	const code = await proc.exited;
	await writer.end();
	return code;
}

/**
 * Run a subprocess fully silently, streaming stdout+stderr only into a log
 * file. Nothing reaches the terminal -- the caller is expected to show its
 * own one-line status (e.g. a spinner) while this runs and to surface the
 * log path on failure. Returns the child's exit code.
 *
 * Use this for noisy build steps (`vite build` dumps a ~350-line asset
 * table) whose output is archival, not something the operator reads live.
 */
export async function runToLogFile(
	cmd: readonly string[],
	logPath: string,
	opts: { readonly cwd?: string; readonly env?: Record<string, string | undefined> } = {},
): Promise<number> {
	const writer = Bun.file(logPath).writer();
	writer.write(`> ${cmd.join(' ')}\n`);
	const proc = Bun.spawn([...cmd], {
		cwd: opts.cwd,
		env: spawnEnv(opts.env),
		stdio: ['inherit', 'pipe', 'pipe'],
	});
	const drain = async (stream: ReadableStream<Uint8Array> | null): Promise<void> => {
		if (stream === null) return;
		const reader = stream.getReader();
		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				if (value && value.length > 0) writer.write(value);
			}
		} finally {
			reader.releaseLock();
		}
	};
	await Promise.all([drain(proc.stdout), drain(proc.stderr)]);
	const code = await proc.exited;
	await writer.end();
	return code;
}

export async function runOrThrowPiped(
	cmd: readonly string[],
	opts: { readonly cwd?: string; readonly env?: Record<string, string | undefined> } = {},
): Promise<void> {
	const proc = Bun.spawn([...cmd], {
		cwd: opts.cwd,
		env: spawnEnv(opts.env),
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
