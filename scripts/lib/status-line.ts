/**
 * Single in-place status line for long-running CLI tasks.
 *
 * Why custom and not `ora`/`@clack/prompts`/etc.: the seed pipeline already
 * tee's stdout into per-phase log files via monkey-patching `process.stdout.
 * write`. A library that holds its own write-to-stderr handle would dodge the
 * tee and spew its frames into the terminal but never the log. This helper
 * keeps every byte going through `process.stdout.write` so the tee captures
 * the cleaned-up final state of each phase (rendered as "<phase>: <last
 * detail line>" once the phase resolves).
 *
 * Behaviour:
 *  - In a TTY: emits `\r` + content + ANSI clear-to-end-of-line for each
 *    update. Spinner cycles every {@link FRAME_MS}.
 *  - Non-TTY (piped to file, CI): emits one plain line per update so the log
 *    still tells the story.
 *  - {@link finish} clears the line and (TTY only) writes the final summary
 *    as a regular line. Non-TTY just appends the summary line.
 */

const FRAME_MS = 100;
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const ANSI_CLEAR_LINE = '[2K';
const ANSI_CR = '\r';
const ANSI_CURSOR_HIDE = '[?25l';
const ANSI_CURSOR_SHOW = '[?25h';

export interface StatusLine {
	/** Replace the visible status line text (next render uses this). */
	set(label: string, detail?: string): void;
	/** Update only the detail half (label stays the same). */
	detail(detail: string): void;
	/** Stop the spinner, clear the line, optionally print a final summary. */
	finish(summary?: string): void;
	/** Best-effort no-op shutdown for callers that don't have a summary. */
	stop(): void;
}

/**
 * Start a new status line. Caller is responsible for calling `finish` (or
 * `stop`) before exiting; otherwise the cursor stays hidden in TTY mode.
 */
export function startStatusLine(initialLabel: string): StatusLine {
	const isTty = Boolean(process.stdout.isTTY);
	const startedAt = Date.now();
	let label = initialLabel;
	let detail = '';
	let frameIndex = 0;
	let interval: NodeJS.Timeout | null = null;
	let stopped = false;
	let lastNonTtyEmittedAt = 0;
	/** Last `label: detail` actually emitted to a non-TTY stream (no timestamp). */
	let lastNonTtyContent = '';

	const formatElapsed = (): string => {
		const seconds = Math.floor((Date.now() - startedAt) / 1000);
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		const s = seconds - m * 60;
		return `${m}m${s.toString().padStart(2, '0')}s`;
	};

	const render = (): void => {
		if (stopped) return;
		const elapsed = formatElapsed();
		if (isTty) {
			const spinner = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
			frameIndex += 1;
			const line =
				detail.length > 0 ? `${spinner} ${label} (${elapsed}) -- ${detail}` : `${spinner} ${label} (${elapsed})`;
			process.stdout.write(`${ANSI_CR}${ANSI_CLEAR_LINE}${truncateForTerminal(line)}`);
		} else {
			// Non-TTY (piped to a file / through `runTee`): emit one plain
			// line per *real* state change -- a new label or detail -- not
			// once per elapsed-clock tick. The old throttle keyed off the
			// whole line (which carries the timestamp), so a 50s phase that
			// never changed its detail still printed 10 near-identical
			// `[5s]/[10s]/.../[50s]` lines. A heartbeat every HEARTBEAT_MS
			// proves liveness on a long silent phase without the spam.
			const HEARTBEAT_MS = 30_000;
			const content = detail.length > 0 ? `${label}: ${detail}` : label;
			const contentChanged = content !== lastNonTtyContent;
			const heartbeatDue = Date.now() - lastNonTtyEmittedAt >= HEARTBEAT_MS;
			if (contentChanged || heartbeatDue) {
				const suffix = contentChanged ? '' : ' (still running)';
				process.stdout.write(`[${elapsed}] ${content}${suffix}\n`);
				lastNonTtyContent = content;
				lastNonTtyEmittedAt = Date.now();
			}
		}
	};

	const start = (): void => {
		if (interval !== null) return;
		if (isTty) process.stdout.write(ANSI_CURSOR_HIDE);
		render();
		interval = setInterval(render, FRAME_MS);
		// Don't keep the event loop alive solely for the spinner.
		interval.unref();
	};

	const clearLine = (): void => {
		if (isTty) process.stdout.write(`${ANSI_CR}${ANSI_CLEAR_LINE}`);
	};

	const stop = (): void => {
		if (stopped) return;
		stopped = true;
		if (interval !== null) {
			clearInterval(interval);
			interval = null;
		}
		clearLine();
		if (isTty) process.stdout.write(ANSI_CURSOR_SHOW);
	};

	start();

	return {
		set(nextLabel, nextDetail) {
			label = nextLabel;
			detail = nextDetail ?? '';
			if (!isTty) render();
		},
		detail(nextDetail) {
			detail = nextDetail;
			if (!isTty) render();
		},
		finish(summary) {
			stop();
			if (summary !== undefined && summary.length > 0) {
				process.stdout.write(`${summary}\n`);
			}
		},
		stop,
	};
}

/**
 * Trim a line to one terminal width minus 1 so a wrap-around doesn't double
 * the rendered height (which would leave a stale tail line behind on the
 * next `\r`-clear cycle). When stdout columns aren't reported (rare), fall
 * back to 200 -- big enough that few status lines hit it but small enough
 * that we don't allocate megabytes on a runaway label.
 */
function truncateForTerminal(text: string): string {
	const width = process.stdout.columns ?? 200;
	if (text.length <= width - 1) return text;
	return `${text.slice(0, width - 4)}...`;
}
