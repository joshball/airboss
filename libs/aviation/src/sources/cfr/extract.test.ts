/**
 * CFR extractor tests. Runs the extractor against the parser fixture end-
 * to-end so the full `SourceExtractor` contract is covered.
 */

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allExtractors, resolveExtractors } from '../extractors';
import { CfrExtractor, cfrExtractor } from './extract';

const FIXTURE = resolve(import.meta.dirname, 'fixtures', '91.155.xml');

describe('CfrExtractor', () => {
	it('canHandle() matches any cfr-* sourceId', () => {
		expect(cfrExtractor.canHandle('cfr-14')).toBe(true);
		expect(cfrExtractor.canHandle('cfr-91-155')).toBe(true);
	});

	it('canHandle() rejects other source types', () => {
		expect(cfrExtractor.canHandle('aim-7-1-1')).toBe(false);
		expect(cfrExtractor.canHandle('poh-c172s-4-5')).toBe(false);
	});

	it('extract() returns a VerbatimBlock with the section text', async () => {
		const extractor = new CfrExtractor();
		const block = await extractor.extract({ title: 14, part: 91, section: '155' }, FIXTURE);
		expect(block.text).toContain('Except as provided');
		expect(block.sourceVersion).toBeTruthy();
		expect(block.extractedAt).toBeTruthy();
		expect(new Date(block.extractedAt).toString()).not.toBe('Invalid Date');
	});

	it('extract() surfaces a clear error for unknown sections', async () => {
		const extractor = new CfrExtractor();
		await expect(extractor.extract({ title: 14, part: 91, section: '404' }, FIXTURE)).rejects.toThrow(
			/Section .*91\.404 not found/,
		);
	});

	it('extract() requires a numeric title and part', async () => {
		const extractor = new CfrExtractor();
		await expect(extractor.extract({ title: 'not-a-number', part: 91, section: '155' }, FIXTURE)).rejects.toThrow(
			/numeric 'title'/,
		);
	});

	it('extract() requires a non-empty section string', async () => {
		const extractor = new CfrExtractor();
		await expect(extractor.extract({ title: 14, part: 91, section: '' }, FIXTURE)).rejects.toThrow(
			/non-empty 'section'/,
		);
	});
});

describe('allExtractors', () => {
	it('includes the CFR extractor', () => {
		expect(allExtractors.length).toBeGreaterThan(0);
		expect(allExtractors.some((e) => e.canHandle('cfr-14'))).toBe(true);
	});

	it('resolveExtractors() returns exactly one extractor for a cfr sourceId', () => {
		const hits = resolveExtractors('cfr-14');
		expect(hits.length).toBe(1);
	});

	it('resolveExtractors() returns empty for an unknown sourceId', () => {
		expect(resolveExtractors('made-up-source')).toEqual([]);
	});
});
