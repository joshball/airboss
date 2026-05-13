/**
 * `PaletteRow` -- shared row template (R8 + R14).
 *
 * Asserts that published rows ALWAYS surface the doc code (R14) and that
 * non-published rows skip the code column, plus the collapsed-children
 * indicator and the click contract.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '../src/schema/result-types';
import PaletteRow from '../src/ui/PaletteRow.svelte';

afterEach(() => {
	cleanup();
});

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
	return {
		id: 'r1',
		type: 'faa.handbook',
		title: 'Aviation Weather Handbook',
		docCode: 'FAA-H-8083-28',
		href: '/handbook/avwx',
		rankBucket: 1,
		score: 200,
		...overrides,
	};
}

describe('PaletteRow -- published row (R14)', () => {
	it('renders the doc code for a handbook row', () => {
		render(PaletteRow, { result: makeResult() });
		const code = screen.getByTestId('palette-row-code');
		expect(code.textContent).toBe('FAA-H-8083-28');
	});

	it('renders the title', () => {
		render(PaletteRow, { result: makeResult() });
		expect(screen.getByTestId('palette-row').textContent ?? '').toMatch(/Aviation Weather Handbook/);
	});

	it('renders the chip with the bucket label', () => {
		render(PaletteRow, { result: makeResult() });
		expect(screen.getByTestId('palette-row-chip').textContent).toBe('Handbook');
	});

	it('stamps a bucket attribute', () => {
		render(PaletteRow, { result: makeResult({ type: 'faa.cfr.part', docCode: '14 CFR 91', title: 'Part 91' }) });
		expect(screen.getByTestId('palette-row').getAttribute('data-bucket')).toBe('cfrs');
	});
});

describe('PaletteRow -- non-published row', () => {
	it('omits the doc code slot for a knowledge node', () => {
		render(PaletteRow, {
			result: makeResult({
				id: 'k1',
				type: 'airboss.knode',
				title: 'Air Masses and Fronts',
				docCode: undefined,
			}),
		});
		expect(screen.queryByTestId('palette-row-code')).toBeNull();
	});

	it('omits the doc code slot for a tool', () => {
		render(PaletteRow, {
			result: makeResult({
				id: 't1',
				type: 'web.tool',
				title: 'aviationweather.gov',
				docCode: undefined,
			}),
		});
		expect(screen.queryByTestId('palette-row-code')).toBeNull();
	});
});

describe('PaletteRow -- children indicator (book-level collapse)', () => {
	it('renders a "+N" indicator when children are present', () => {
		const result = makeResult({
			children: [makeResult({ id: 'c1', type: 'faa.handbook.chapter' })],
		});
		render(PaletteRow, { result });
		const row = screen.getByTestId('palette-row');
		expect(row.classList.contains('has-children')).toBe(true);
		expect(row.textContent ?? '').toMatch(/\+1/);
	});

	it('omits the indicator when there are no children', () => {
		render(PaletteRow, { result: makeResult() });
		const row = screen.getByTestId('palette-row');
		expect(row.classList.contains('has-children')).toBe(false);
	});
});

describe('PaletteRow -- click contract', () => {
	it('invokes onActivate with the result', async () => {
		const onActivate = vi.fn();
		render(PaletteRow, { result: makeResult(), onActivate });
		await fireEvent.click(screen.getByTestId('palette-row'));
		expect(onActivate).toHaveBeenCalledTimes(1);
		expect(onActivate.mock.calls[0]?.[0]?.id).toBe('r1');
	});

	it('invokes onHover with the result on mouseenter', async () => {
		const onHover = vi.fn();
		render(PaletteRow, { result: makeResult(), onHover });
		await fireEvent.mouseEnter(screen.getByTestId('palette-row'));
		expect(onHover).toHaveBeenCalledTimes(1);
	});
});
