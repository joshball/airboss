import { describe, expect, it } from 'vitest';
import type { ParsedFormsLocator } from '../types.ts';
import { formatFormsLocator, parseFormsLocator } from './locator.ts';

describe('parseFormsLocator', () => {
	it('parses a typical form number', () => {
		const result = parseFormsLocator('8710-1');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.forms).toEqual({ formNumber: '8710-1' });
	});

	it('parses a form number with revision letter', () => {
		const result = parseFormsLocator('8060-4A');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.forms?.formNumber).toBe('8060-4A');
	});

	it('parses a single-segment form number', () => {
		const result = parseFormsLocator('8500-9');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.forms?.formNumber).toBe('8500-9');
	});

	it('rejects empty locator', () => {
		const result = parseFormsLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects multi-segment locator', () => {
		const result = parseFormsLocator('8710-1/draft');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects non-numeric form number', () => {
		const result = parseFormsLocator('AC-100');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects form number with lowercase suffix', () => {
		const result = parseFormsLocator('8710-1a');
		expect(result.kind).toBe('error');
	});

	it('rejects form number starting with dash', () => {
		const result = parseFormsLocator('-8710-1');
		expect(result.kind).toBe('error');
	});

	it('rejects form number with double dash', () => {
		const result = parseFormsLocator('8710--1');
		expect(result.kind).toBe('error');
	});

	it('rejects form number with whitespace', () => {
		const result = parseFormsLocator('8710 1');
		expect(result.kind).toBe('error');
	});
});

describe('formatFormsLocator round-trip', () => {
	it('round-trips a basic form locator', () => {
		const parsed: ParsedFormsLocator = { formNumber: '8710-1' };
		expect(formatFormsLocator(parsed)).toBe('8710-1');
	});

	it('round-trips a revision-letter form locator', () => {
		const parsed: ParsedFormsLocator = { formNumber: '8060-4A' };
		expect(formatFormsLocator(parsed)).toBe('8060-4A');
	});
});
