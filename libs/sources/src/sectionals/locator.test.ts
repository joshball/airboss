import { describe, expect, it } from 'vitest';
import type { ParsedSectionalsLocator } from '../types.ts';
import { formatSectionalsLocator, parseSectionalsLocator } from './locator.ts';

describe('parseSectionalsLocator', () => {
	it('parses a single-word chart name', () => {
		const result = parseSectionalsLocator('denver');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.sectionals).toEqual({ chartName: 'denver' });
	});

	it('parses a multi-word chart name', () => {
		const result = parseSectionalsLocator('los-angeles');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.sectionals?.chartName).toBe('los-angeles');
	});

	it('parses a chart name with digits', () => {
		const result = parseSectionalsLocator('cape-cod-2');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.sectionals?.chartName).toBe('cape-cod-2');
	});

	it('rejects empty locator', () => {
		const result = parseSectionalsLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects multi-segment locator', () => {
		const result = parseSectionalsLocator('denver/north');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects uppercase chart name', () => {
		const result = parseSectionalsLocator('Denver');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects chart name with spaces', () => {
		const result = parseSectionalsLocator('los angeles');
		expect(result.kind).toBe('error');
	});

	it('rejects chart name starting with hyphen', () => {
		const result = parseSectionalsLocator('-denver');
		expect(result.kind).toBe('error');
	});

	it('rejects chart name starting with digit', () => {
		const result = parseSectionalsLocator('1-denver');
		expect(result.kind).toBe('error');
	});

	it('rejects chart name with underscores', () => {
		const result = parseSectionalsLocator('los_angeles');
		expect(result.kind).toBe('error');
	});
});

describe('formatSectionalsLocator round-trip', () => {
	it('round-trips a chart name', () => {
		const parsed: ParsedSectionalsLocator = { chartName: 'denver' };
		expect(formatSectionalsLocator(parsed)).toBe('denver');
	});

	it('round-trips a multi-word chart name', () => {
		const parsed: ParsedSectionalsLocator = { chartName: 'los-angeles' };
		expect(formatSectionalsLocator(parsed)).toBe('los-angeles');
	});
});
