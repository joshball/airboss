import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeIfChanged } from './write-if-changed.ts';

let tmpRoot: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'write-if-changed-'));
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
});

describe('writeIfChanged', () => {
	it('writes when the file does not exist', () => {
		const path = join(tmpRoot, 'sub', 'file.txt');
		const result = writeIfChanged(path, 'hello\n');
		expect(result.wrote).toBe(true);
		expect(existsSync(path)).toBe(true);
		expect(readFileSync(path, 'utf-8')).toBe('hello\n');
	});

	it('skips the write when the existing bytes match', () => {
		const path = join(tmpRoot, 'file.txt');
		writeIfChanged(path, 'hello\n');

		// Force a measurable mtime gap so the no-op assertion can detect a no-op
		// even on platforms with second-resolution mtime.
		const past = new Date(Date.now() - 5000);
		utimesSync(path, past, past);
		const beforeMtime = statSync(path).mtimeMs;

		const result = writeIfChanged(path, 'hello\n');
		expect(result.wrote).toBe(false);

		const afterMtime = statSync(path).mtimeMs;
		expect(afterMtime).toBe(beforeMtime);
	});

	it('writes when the existing bytes differ', () => {
		const path = join(tmpRoot, 'file.txt');
		writeIfChanged(path, 'hello\n');
		const result = writeIfChanged(path, 'world\n');
		expect(result.wrote).toBe(true);
		expect(readFileSync(path, 'utf-8')).toBe('world\n');
	});

	it('creates intermediate directories', () => {
		const path = join(tmpRoot, 'a', 'b', 'c', 'file.txt');
		const result = writeIfChanged(path, 'x\n');
		expect(result.wrote).toBe(true);
		expect(existsSync(path)).toBe(true);
	});

	it('does not touch a pre-existing matching file', () => {
		const path = join(tmpRoot, 'file.txt');
		writeFileSync(path, 'matching content\n', 'utf-8');

		const past = new Date(Date.now() - 5000);
		utimesSync(path, past, past);
		const stableMtime = statSync(path).mtimeMs;

		const result = writeIfChanged(path, 'matching content\n');
		expect(result.wrote).toBe(false);
		expect(statSync(path).mtimeMs).toBe(stableMtime);
	});
});
