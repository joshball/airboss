/**
 * Pager DOM contract -- prev/next presence, page number text, pageHref usage.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Pager from '../src/components/Pager.svelte';

const pageHref = (n: number): string => `/cards?page=${n}`;

afterEach(() => {
	cleanup();
});

describe('Pager', () => {
	it('renders nav with the default aria-label', () => {
		render(Pager, { currentPage: 1, totalPages: 3, hasMore: true, pageHref });
		const root = screen.getByTestId('pager-root');
		expect(root.tagName).toBe('NAV');
		expect(root.getAttribute('aria-label')).toBe('Pagination');
	});

	it('shows status text with current and total', () => {
		render(Pager, { currentPage: 2, totalPages: 5, hasMore: true, pageHref });
		expect(screen.getByTestId('pager-status').textContent?.trim()).toBe('Page 2 of 5');
	});

	it('hides Previous when on the first page', () => {
		render(Pager, { currentPage: 1, totalPages: 3, hasMore: true, pageHref });
		expect(screen.queryByTestId('pager-prev')).toBeNull();
		expect(screen.getByTestId('pager-prev-empty')).toBeTruthy();
	});

	it('hides Next when hasMore is false', () => {
		render(Pager, { currentPage: 3, totalPages: 3, hasMore: false, pageHref });
		expect(screen.queryByTestId('pager-next')).toBeNull();
		expect(screen.getByTestId('pager-next-empty')).toBeTruthy();
	});

	it('Previous links to currentPage - 1, Next to currentPage + 1', () => {
		render(Pager, { currentPage: 2, totalPages: 5, hasMore: true, pageHref });
		const prev = screen.getByTestId('pager-prev').querySelector('a');
		const next = screen.getByTestId('pager-next').querySelector('a');
		expect(prev?.getAttribute('href')).toBe('/cards?page=1');
		expect(next?.getAttribute('href')).toBe('/cards?page=3');
	});
});
