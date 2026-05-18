/**
 * Cross-process exclusive file lock.
 *
 * Built on `open(path, 'wx')` -- the `wx` flag maps to `O_CREAT | O_EXCL`,
 * which the kernel guarantees is atomic: exactly one process wins the
 * create, every other open fails with `EEXIST`. That makes it a real
 * mutex across separate `bun` / `node` processes, which a JS-level flag
 * (module singleton, in-memory promise) can never be.
 *
 * The lock file carries the holder's PID + a human label so a stale lock
 * (holder crashed without releasing) can be detected and reclaimed: if the
 * recorded PID is no longer alive, the lock is broken and re-acquired.
 *
 * Why this exists: the vitest unit suite provisions a shared Postgres
 * database (`airboss_unit_test`) in `globalSetup`. Two overlapping
 * `bun run test` invocations would each DROP + reseed that DB and
 * `pg_terminate_backend` every connection to it -- including the other
 * run's live worker pools -- producing `57P01 ProcessInterrupts` /
 * `CONNECTION_CLOSED` failures mid-query. Holding this lock for the whole
 * vitest run serialises those invocations instead.
 */

import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

/** Polling interval while waiting for a contended lock. */
const POLL_INTERVAL_MS = 250;

/** Shape persisted inside the lock file (JSON). */
interface LockRecord {
	/** OS process id of the holder. */
	readonly pid: number;
	/** Human-readable label naming the holder (for diagnostics). */
	readonly label: string;
	/** ISO timestamp the lock was acquired. */
	readonly acquiredAt: string;
}

/** Handle returned by {@link acquireLock}; call {@link release} to free it. */
export interface LockHandle {
	/** Absolute path of the lock file. */
	readonly path: string;
	/** Release the lock. Idempotent -- safe to call more than once. */
	release(): void;
}

/** True when a process with `pid` is still alive on this machine. */
function isProcessAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		// Signal 0 performs existence + permission checks without delivering
		// a signal: throws ESRCH when the process is gone.
		process.kill(pid, 0);
		return true;
	} catch (err) {
		// EPERM means the process exists but is owned by another user --
		// still alive, so the lock is NOT stale.
		return (err as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/** Read + parse the lock record, or `undefined` if unreadable / corrupt. */
function readLockRecord(path: string): LockRecord | undefined {
	try {
		const raw = readFileSync(path, 'utf8');
		const parsed = JSON.parse(raw) as Partial<LockRecord>;
		if (typeof parsed.pid !== 'number' || typeof parsed.label !== 'string') return undefined;
		return { pid: parsed.pid, label: parsed.label, acquiredAt: parsed.acquiredAt ?? '' };
	} catch {
		return undefined;
	}
}

/** Write the lock record into an already-opened, exclusively-created fd. */
function writeLockRecord(fd: number, label: string): void {
	const record: LockRecord = { pid: process.pid, label, acquiredAt: new Date().toISOString() };
	writeSync(fd, JSON.stringify(record));
}

/** Build a {@link LockHandle} whose `release` removes the lock file once. */
function makeHandle(path: string): LockHandle {
	let released = false;
	return {
		path,
		release(): void {
			if (released) return;
			released = true;
			rmSync(path, { force: true });
		},
	};
}

/** Atomically create the lock file and seed it with this process's record. */
function createLockFile(path: string, label: string): LockHandle {
	const fd = openSync(path, 'wx');
	try {
		writeLockRecord(fd, label);
	} finally {
		closeSync(fd);
	}
	return makeHandle(path);
}

/**
 * Try once to create the lock file atomically. Returns a handle on success,
 * `undefined` when the lock is held by a live process. A stale lock (holder
 * dead, or the file is corrupt) is removed and one more attempt is made.
 */
function tryAcquire(path: string, label: string): LockHandle | undefined {
	mkdirSync(dirname(path), { recursive: true });
	try {
		return createLockFile(path, label);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
	}

	// Lock file exists -- decide whether the holder is still alive.
	const record = readLockRecord(path);
	if (record !== undefined && isProcessAlive(record.pid)) return undefined;

	// Stale or corrupt lock: reclaim it. `rmSync` then a fresh exclusive
	// create -- if another process reclaims it first our create throws
	// EEXIST and the caller retries.
	try {
		rmSync(path, { force: true });
		return createLockFile(path, label);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'EEXIST') return undefined;
		throw err;
	}
}

/** Sleep helper -- avoids pulling a dependency for one timer. */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acquire an exclusive cross-process lock at `path`, blocking until it is
 * free. `label` is recorded in the lock file so a contended waiter (and
 * anyone inspecting the file) can see which process holds it.
 *
 * `onWait` fires once, the first time the lock is found contended, so the
 * caller can print a "waiting for ..." line instead of hanging silently.
 */
export async function acquireLock(path: string, label: string, onWait?: (holder: string) => void): Promise<LockHandle> {
	let warned = false;
	while (true) {
		const handle = tryAcquire(path, label);
		if (handle !== undefined) return handle;
		if (!warned) {
			warned = true;
			const holder = readLockRecord(path);
			onWait?.(holder ? `${holder.label} (pid ${holder.pid})` : 'another process');
		}
		await sleep(POLL_INTERVAL_MS);
	}
}
