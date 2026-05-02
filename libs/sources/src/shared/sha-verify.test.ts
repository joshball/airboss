import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { hashFileSync, ShaMismatchError, verifyCachedSha } from './sha-verify.ts';

let workDir: string;

beforeEach(() => {
	workDir = `${tmpdir()}/airboss-sha-verify-${process.pid}-${Date.now()}-${Math.random()}`;
	mkdirSync(workDir, { recursive: true });
});

afterEach(() => {
	rmSync(workDir, { recursive: true, force: true });
});

describe('hashFileSync', () => {
	test('SHA-01: hashes file bytes deterministically', () => {
		const path = join(workDir, 'a.txt');
		writeFileSync(path, 'hello world', 'utf-8');
		const hash = hashFileSync(path);
		// sha256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
		expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
	});
});

describe('verifyCachedSha', () => {
	test('SHA-02: passes when actual matches expected', () => {
		const path = join(workDir, 'a.txt');
		writeFileSync(path, 'hello world', 'utf-8');
		expect(() =>
			verifyCachedSha(path, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'),
		).not.toThrow();
	});

	test('SHA-03: throws ShaMismatchError on mismatch (cache poisoning)', () => {
		const path = join(workDir, 'a.txt');
		writeFileSync(path, 'tampered content', 'utf-8');
		const expected = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'; // sha of "hello world"
		expect(() => verifyCachedSha(path, expected)).toThrow(ShaMismatchError);
		try {
			verifyCachedSha(path, expected);
			expect.fail('expected throw');
		} catch (e) {
			const err = e as ShaMismatchError;
			expect(err.expectedSha).toBe(expected);
			expect(err.actualSha).not.toBe(expected);
			expect(err.cachedPath).toBe(path);
			expect(err.message).toMatch(/SHA mismatch/);
			expect(err.message).toMatch(/cache is poisoned/);
		}
	});

	test('SHA-04: skip=true bypasses verification (test escape hatch)', () => {
		const path = join(workDir, 'a.txt');
		writeFileSync(path, 'tampered', 'utf-8');
		expect(() => verifyCachedSha(path, 'wrong-hash', true)).not.toThrow();
	});
});
