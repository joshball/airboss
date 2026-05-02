/**
 * Unit tests for `isSafeRedirect`.
 *
 * The login flow honours a `?redirectTo=...` parameter so a user landing on
 * `/login?redirectTo=/calibrate` lands back on `/calibrate` after sign-in.
 * The destination is fully user-controlled, so we have to reject anything
 * that resolves off-origin -- otherwise the login page becomes a
 * phish-friendly open redirector.
 *
 * The function relies on three layers (prefix checks, character allowlist,
 * URL-parse-against-placeholder) so the regression matrix below pins each
 * layer independently.
 */

import { describe, expect, it } from 'vitest';
import { isSafeRedirect } from './redirect';

describe('isSafeRedirect', () => {
	it('accepts a simple relative path', () => {
		expect(isSafeRedirect('/calibrate')).toBe(true);
	});

	it('accepts a relative path with query and hash', () => {
		expect(isSafeRedirect('/study/cards?filter=due#anchor')).toBe(true);
	});

	it('accepts root', () => {
		expect(isSafeRedirect('/')).toBe(true);
	});

	it('rejects an empty string', () => {
		expect(isSafeRedirect('')).toBe(false);
	});

	it('rejects a non-leading-slash path', () => {
		expect(isSafeRedirect('calibrate')).toBe(false);
	});

	it('rejects an absolute http URL', () => {
		expect(isSafeRedirect('http://evil.example/calibrate')).toBe(false);
	});

	it('rejects an absolute https URL', () => {
		expect(isSafeRedirect('https://evil.example/calibrate')).toBe(false);
	});

	it('rejects a protocol-relative URL `//host`', () => {
		expect(isSafeRedirect('//evil.example/calibrate')).toBe(false);
	});

	it('rejects a backslash-prefixed scheme-relative `/\\host`', () => {
		// Some browsers normalise `/\evil.example` to `//evil.example`.
		expect(isSafeRedirect('/\\evil.example/calibrate')).toBe(false);
	});

	it('rejects a double-backslash `\\\\host`', () => {
		expect(isSafeRedirect('\\\\evil.example/calibrate')).toBe(false);
	});

	it('rejects a percent-encoded protocol-relative `/%2fhost`', () => {
		// %2f decodes to `/`, so `/%2fevil.example` would normalise to
		// `//evil.example` after a downstream decode pass. The URL-parse
		// guard catches this even though the surface check passes.
		expect(isSafeRedirect('/%2fevil.example/calibrate')).toBe(false);
	});

	it('rejects a Unicode lookalike slash (U+FF0F)', () => {
		// Fullwidth solidus -- visually a slash, structurally not. Caught by
		// the ASCII allowlist so it never reaches the URL parser.
		expect(isSafeRedirect('/／evil.example/calibrate')).toBe(false);
	});

	it('rejects an RTL-override smuggle attempt', () => {
		// U+202E flips display order; the underlying string still has a
		// non-allowlisted character so the regex rejects it.
		expect(isSafeRedirect('/‮evil.example')).toBe(false);
	});

	it('rejects leading whitespace', () => {
		expect(isSafeRedirect(' /calibrate')).toBe(false);
	});

	it('rejects a leading tab', () => {
		expect(isSafeRedirect('\t/calibrate')).toBe(false);
	});

	it('rejects an embedded CR', () => {
		expect(isSafeRedirect('/calibrate\rSet-Cookie: x=1')).toBe(false);
	});

	it('rejects an embedded LF', () => {
		expect(isSafeRedirect('/calibrate\nSet-Cookie: x=1')).toBe(false);
	});

	it('rejects a path with a space character', () => {
		expect(isSafeRedirect('/cali brate')).toBe(false);
	});
});
