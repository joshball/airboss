/**
 * text-anchors.ts -- capture + reanchor coverage.
 *
 * The matcher has four stages (exact / windowed / global / orphan); each
 * stage gets at least one direct test plus disambiguation cases.
 */

import { describe, expect, it } from 'vitest';
import { captureAnchor, reanchor } from './text-anchors';

describe('captureAnchor', () => {
	it('captures the exact slice plus prefix/suffix context', () => {
		const text = 'The quick brown fox jumps over the lazy dog.';
		const anchor = captureAnchor(text, { start: 16, end: 19 }, 5); // "fox"
		expect(anchor.text).toBe('fox');
		expect(anchor.start).toBe(16);
		expect(anchor.end).toBe(19);
		expect(anchor.prefix).toBe('rown ');
		expect(anchor.suffix).toBe(' jump');
	});

	it('clamps negative starts and overflowing ends', () => {
		const text = 'short body';
		const anchor = captureAnchor(text, { start: -5, end: 999 });
		expect(anchor.start).toBe(0);
		expect(anchor.end).toBe(text.length);
		expect(anchor.text).toBe(text);
	});

	it('normalizes inverted ranges', () => {
		const text = 'abcdefghij';
		const anchor = captureAnchor(text, { start: 7, end: 3 });
		expect(anchor.start).toBe(3);
		expect(anchor.end).toBe(7);
		expect(anchor.text).toBe('defg');
	});

	it('caps anchor.text at the configured maximum', () => {
		const text = 'x'.repeat(2000);
		const anchor = captureAnchor(text, { start: 0, end: 2000 });
		expect(anchor.text.length).toBe(1000);
		expect(anchor.end).toBe(1000);
	});
});

describe('reanchor', () => {
	const body = 'The quick brown fox jumps over the lazy dog. Pilots land at airports.';

	it('hits the exact-offset path on identical text', () => {
		const anchor = captureAnchor(body, { start: 16, end: 19 });
		const range = reanchor(body, anchor);
		expect(range).toEqual({ start: 16, end: 19 });
	});

	it('matches via the windowed search after a small whitespace shift', () => {
		const anchor = captureAnchor(body, { start: 16, end: 19 });
		// Inject "  " (2 spaces) early in the body -- offsets shift by 2.
		const shifted = `An  intro. ${body}`;
		const range = reanchor(shifted, anchor);
		expect(range).not.toBeNull();
		if (range === null) return;
		expect(shifted.slice(range.start, range.end)).toBe('fox');
		// Confirm we landed on the original `fox`, not some accidental other one.
		expect(range.start).toBeGreaterThan(10);
	});

	it('matches after a figure-style paragraph injection between sentences', () => {
		const anchor = captureAnchor(body, { start: 45, end: 51 });
		// Inject a figure block between the two sentences.
		const injected = body.slice(0, 44) + '\n\n![figure](url)\n\n' + body.slice(44);
		const range = reanchor(injected, anchor);
		expect(range).not.toBeNull();
		if (range === null) return;
		expect(injected.slice(range.start, range.end)).toBe('Pilots');
	});

	it('returns null for an orphaned anchor (text deleted)', () => {
		const anchor = captureAnchor(body, { start: 16, end: 19 });
		const trimmed = body.replace('brown fox ', '');
		const range = reanchor(trimmed, anchor);
		expect(range).toBeNull();
	});

	it('disambiguates duplicate anchors using prefix/suffix context', () => {
		const repeated = 'fox alpha fox beta fox gamma';
		// Capture the *middle* `fox` (offsets 10..13). With the default
		// 32-char context the whole rest of the string fits in the
		// prefix/suffix windows.
		const anchor = captureAnchor(repeated, { start: 10, end: 13 });
		expect(anchor.prefix).toBe('fox alpha ');
		expect(anchor.suffix).toBe(' beta fox gamma');
		// Body changes slightly: rename "alpha" to "ALPHA". The middle fox
		// still matches its context best.
		const mutated = repeated.replace('alpha', 'ALPHA');
		const range = reanchor(mutated, anchor);
		expect(range).not.toBeNull();
		if (range === null) return;
		// The middle `fox` still sits at offset 10 because the rename keeps
		// the same character count.
		expect(range.start).toBe(10);
	});

	it('disambiguates duplicates by prefix when the offsets shift', () => {
		const repeated = 'fox alpha fox beta fox gamma';
		const anchor = captureAnchor(repeated, { start: 19, end: 22 }); // third fox
		const shifted = `Intro line. ${repeated}`;
		const range = reanchor(shifted, anchor);
		expect(range).not.toBeNull();
		if (range === null) return;
		// Should land on the *third* fox in the shifted text.
		expect(shifted.slice(range.start, range.end)).toBe('fox');
		expect(range.start).toBe(19 + 'Intro line. '.length);
	});

	it('orphans an empty anchor', () => {
		const anchor = captureAnchor(body, { start: 5, end: 5 });
		expect(reanchor(body, anchor)).toBeNull();
	});
});
