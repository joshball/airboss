/**
 * Tiny ANSI color helpers for `scripts/` output.
 *
 * Respects the `NO_COLOR` convention (https://no-color.org/) and detects
 * non-TTY stdout: in either case every helper returns its input unchanged so
 * piped output (e.g. `... | tee file.log`) stays plain ASCII.
 *
 * Kept dependency-free on purpose -- one byte fewer in the script tree is one
 * less reason for the source-downloader to drag in chalk.
 */

const FORCE_DISABLE = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
const STDOUT_IS_TTY = typeof process.stdout.isTTY === 'boolean' ? process.stdout.isTTY : false;

/**
 * Test seam + opt-in override. The `--no-color` flag (handled by callers) and
 * the `NO_COLOR` env var both flow through here. When `false`, every color
 * helper becomes the identity function.
 */
let enabled = !FORCE_DISABLE && STDOUT_IS_TTY;

export function setColorEnabled(value: boolean): void {
	enabled = value && !FORCE_DISABLE;
}

export function colorEnabled(): boolean {
	return enabled;
}

function wrap(open: string, close: string, value: string): string {
	if (!enabled) return value;
	return `\x1b[${open}m${value}\x1b[${close}m`;
}

export function green(value: string): string {
	return wrap('32', '39', value);
}

export function yellow(value: string): string {
	return wrap('33', '39', value);
}

export function red(value: string): string {
	return wrap('31', '39', value);
}

export function dim(value: string): string {
	return wrap('2', '22', value);
}

export function bold(value: string): string {
	return wrap('1', '22', value);
}
