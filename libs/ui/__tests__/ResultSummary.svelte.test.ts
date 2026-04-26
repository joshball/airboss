/**
 * ResultSummary DOM contract -- copy switches by total/pageSize, plural rules,
 * filtersActive suffix; renders nothing when total is 0.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ResultSummary from '../src/components/ResultSummary.svelte';

afterEach(() => {
	cleanup();
});

describe('ResultSummary', () => {
	it('renders nothing when total is 0', () => {
		const { container } = render(ResultSummary, {
			total: 0,
			pageCount: 0,
			currentPage: 1,
			pageSize: 10,
			noun: 'card',
		});
		expect(container.querySelector('[data-testid="resultsummary-root"]')).toBeNull();
	});

	it('singular noun for total of 1', () => {
		render(ResultSummary, { total: 1, pageCount: 1, currentPage: 1, pageSize: 10, noun: 'card' });
		expect(screen.getByTestId('resultsummary-root').textContent).toContain('Showing 1 card');
	});

	it('plural noun (default `${noun}s`) for total > 1', () => {
		render(ResultSummary, { total: 3, pageCount: 3, currentPage: 1, pageSize: 10, noun: 'card' });
		expect(screen.getByTestId('resultsummary-root').textContent).toContain('Showing 3 cards');
	});

	it('range form when total exceeds pageSize', () => {
		render(ResultSummary, { total: 25, pageCount: 10, currentPage: 2, pageSize: 10, noun: 'card' });
		const text = screen.getByTestId('resultsummary-root').textContent ?? '';
		expect(text).toContain('11');
		expect(text).toContain('20');
		expect(text).toContain('25');
	});

	it('filtersActive=true appends the matching-filters suffix', () => {
		render(ResultSummary, {
			total: 3,
			pageCount: 3,
			currentPage: 1,
			pageSize: 10,
			noun: 'card',
			filtersActive: true,
		});
		expect(screen.getByTestId('resultsummary-root').textContent).toContain('matching your filters');
	});

	it('honors a custom plural form', () => {
		render(ResultSummary, {
			total: 2,
			pageCount: 2,
			currentPage: 1,
			pageSize: 10,
			noun: 'criterion',
			nounPlural: 'criteria',
		});
		expect(screen.getByTestId('resultsummary-root').textContent).toContain('Showing 2 criteria');
	});
});
