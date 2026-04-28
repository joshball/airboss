/**
 * Shared interactive prompt helpers for `scripts/`.
 *
 * Hand-rolled because Bun's `for await (const line of console)` loop is the
 * idiomatic way to read a single line; both `db.ts` and `db/seed-all.ts`
 * carried local copies. They now import from here.
 */
export async function prompt(message: string): Promise<string> {
	process.stdout.write(message);
	for await (const line of console) {
		return line;
	}
	return '';
}

/**
 * Prompt y/N. Resolves on `y`/`Y` (any case), exits the process on anything
 * else with the given message. The `force` flag short-circuits the prompt --
 * the dispatchers wire it to `--force` / `-f`.
 */
export async function confirmOrAbort(message: string, opts: { readonly force?: boolean } = {}): Promise<void> {
	if (opts.force === true) return;
	const answer = await prompt(`${message} [y/N] `);
	if (answer.trim().toLowerCase() !== 'y') {
		console.log('Aborted.');
		process.exit(0);
	}
}
