/**
 * Atomic file-write helpers for the regs cache + derivative writer.
 *
 * Per ADR 021 §Atomicity, every cache writer must use a tmp+rename pattern so
 * a crash, SIGINT, or network drop never leaves a half-written file at the
 * destination. POSIX `rename(2)` is atomic on the same filesystem, which is
 * why the temp file MUST be created in the destination directory rather than
 * under `/tmp`.
 *
 * Reference implementation: `libs/aviation/src/sources/download.ts` uses
 * `.part`+rename for streamed downloads. Buffered text writes here use a
 * `.tmp` suffix; either suffix works as long as the side file lives next to
 * the destination.
 */

import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Write `content` to `destPath` atomically: first to `<destPath>.tmp` in the
 * same directory, then `rename` over the destination. The destination
 * directory is created on demand. On failure the partial side file is
 * removed before the error is rethrown.
 */
export function writeFileAtomic(destPath: string, content: string | Uint8Array): void {
	mkdirSync(dirname(destPath), { recursive: true });
	const tmp = `${destPath}.tmp`;
	try {
		if (typeof content === 'string') {
			writeFileSync(tmp, content, 'utf-8');
		} else {
			writeFileSync(tmp, content);
		}
		renameSync(tmp, destPath);
	} catch (err) {
		try {
			unlinkSync(tmp);
		} catch {
			// Side file may not exist; ignore.
		}
		throw err;
	}
}
