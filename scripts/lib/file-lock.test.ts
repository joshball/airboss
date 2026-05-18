/**
 * Unit tests for the cross-process exclusive file lock.
 *
 * Why this matters: `vitest.globalSetup.ts` relies on this lock to
 * serialise overlapping `bun run test` invocations against the shared
 * `airboss_unit_test` database. If the lock stopped being exclusive, two
 * runs would reseed the DB under each other and the `57P01` connection
 * terminations this lock was built to prevent would come straight back.
 * The guarantees under test: exclusivity (second acquire blocks), release
 * frees the lock, a stale lock (dead PID) is reclaimed, idempotent
 * release.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquireLock } from './file-lock';

let dir: string;
let lockPath: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'airboss-file-lock-test-'));
	lockPath = join(dir, 'test.lock');
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe('acquireLock', () => {
	it('creates the lock file and records the holding pid', async () => {
		const handle = await acquireLock(lockPath, 'first');
		try {
			expect(existsSync(lockPath)).toBe(true);
			const record = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid: number; label: string };
			expect(record.pid).toBe(process.pid);
			expect(record.label).toBe('first');
		} finally {
			handle.release();
		}
	});

	it('release removes the lock file', async () => {
		const handle = await acquireLock(lockPath, 'first');
		handle.release();
		expect(existsSync(lockPath)).toBe(false);
	});

	it('release is idempotent', async () => {
		const handle = await acquireLock(lockPath, 'first');
		handle.release();
		expect(() => handle.release()).not.toThrow();
	});

	it('blocks a second acquire until the first releases', async () => {
		const first = await acquireLock(lockPath, 'first');

		let secondAcquired = false;
		const secondPromise = acquireLock(lockPath, 'second').then((h) => {
			secondAcquired = true;
			return h;
		});

		// The second acquire must still be pending while the first is held.
		await new Promise((r) => setTimeout(r, 300));
		expect(secondAcquired).toBe(false);

		first.release();
		const second = await secondPromise;
		expect(secondAcquired).toBe(true);
		second.release();
	});

	it('fires onWait once when the lock is contended', async () => {
		const first = await acquireLock(lockPath, 'holder');

		const waitMessages: string[] = [];
		const secondPromise = acquireLock(lockPath, 'waiter', (holder) => waitMessages.push(holder));

		await new Promise((r) => setTimeout(r, 300));
		first.release();
		const second = await secondPromise;
		second.release();

		expect(waitMessages).toHaveLength(1);
		expect(waitMessages[0]).toContain('holder');
	});

	it('reclaims a stale lock left by a dead process', async () => {
		// A pid that is essentially guaranteed not to be alive.
		const deadPid = 2_147_483_646;
		writeFileSync(lockPath, JSON.stringify({ pid: deadPid, label: 'crashed', acquiredAt: '' }));

		const handle = await acquireLock(lockPath, 'reclaimer');
		try {
			const record = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid: number; label: string };
			expect(record.pid).toBe(process.pid);
			expect(record.label).toBe('reclaimer');
		} finally {
			handle.release();
		}
	});

	it('reclaims a corrupt lock file', async () => {
		writeFileSync(lockPath, 'not json at all');
		const handle = await acquireLock(lockPath, 'reclaimer');
		try {
			const record = JSON.parse(readFileSync(lockPath, 'utf8')) as { label: string };
			expect(record.label).toBe('reclaimer');
		} finally {
			handle.release();
		}
	});
});
