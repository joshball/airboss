/**
 * Idempotent file write helper.
 *
 * Reads the existing file (when present) and skips the write when bytes
 * match the new content. This preserves mtime (and the working-tree-clean
 * signal) across no-op derivative regeneration.
 *
 * Source of truth: ADR 022 §"byte-equal idempotent regen" -- re-running
 * a derivative writer with no upstream input change must produce zero
 * file mutations on disk.
 *
 * Hoisted from `libs/sources/src/regs/derivative-writer.ts:writeIfChanged`
 * so the AIM, AC, ACS, and handbooks-extras pipelines share one
 * implementation rather than diverging copies.
 *
 * Compatible with atomic-write callers: callers that need tmp+rename
 * semantics can layer that on top -- this helper only governs the
 * "write at all?" decision. When this helper decides to write, the
 * caller's write happens (atomic or otherwise). When this helper skips,
 * no write happens at all, so the atomicity question doesn't arise.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface WriteIfChangedResult {
	/** True when the file was actually written; false when bytes already matched and the write was skipped. */
	readonly wrote: boolean;
}

/**
 * Write `content` to `path` only when the file does not exist, or its
 * current contents differ from `content`. Always ensures the parent
 * directory exists. Writes are atomic via tmp+rename (ADR 021).
 *
 * UTF-8 only. Callers writing binary should use a different helper.
 */
export function writeIfChanged(path: string, content: string): WriteIfChangedResult {
	mkdirSync(dirname(path), { recursive: true });
	if (existsSync(path)) {
		const current = readFileSync(path, 'utf-8');
		if (current === content) return { wrote: false };
	}
	const tmp = `${path}.tmp`;
	try {
		writeFileSync(tmp, content, 'utf-8');
		renameSync(tmp, path);
	} catch (err) {
		try {
			unlinkSync(tmp);
		} catch {
			// tmp may not exist; ignore.
		}
		throw err;
	}
	return { wrote: true };
}
