/**
 * `PaletteScopedView` -- I-1 scoped intent shape.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '../src/schema/result-types';
import PaletteScopedView from '../src/ui/PaletteScopedView.svelte';

afterEach(() => {
	cleanup();
});

function makeResult(
	overrides: Partial<SearchResult> & { id: string; type: SearchResult['type']; title: string },
): SearchResult {
	return {
		href: `/x/${overrides.id}`,
		rankBucket: 2,
		...overrides,
	};
}

const headline: SearchResult = makeResult({
	id: 'doc-faah808328b',
	type: 'faa.handbook',
	title: 'Aviation Weather Handbook',
	docCode: 'FAA-H-8083-28B',
});

const references: readonly SearchResult[] = [
	makeResult({ id: 'k1', type: 'airboss.knode', title: 'Air Masses and Fronts' }),
	makeResult({ id: 'k2', type: 'airboss.knode', title: 'Freezing Level' }),
	makeResult({ id: 'c1', type: 'mine.card', title: 'METAR practice card' }),
	makeResult({ id: 'l1', type: 'airboss.lesson', title: 'Weather Theory Lesson' }),
];

describe('PaletteScopedView', () => {
	it('renders the headline doc title and code', () => {
		render(PaletteScopedView, {
			headline,
			references,
			docCode: 'FAA-H-8083-28B',
			onActivate: vi.fn(),
		});
		const headlineEl = screen.getByTestId('palette-scoped-headline');
		expect(headlineEl.textContent ?? '').toMatch(/Aviation Weather Handbook/);
		expect(headlineEl.textContent ?? '').toMatch(/FAA-H-8083-28B/);
	});

	it('groups references by bucket', () => {
		render(PaletteScopedView, {
			headline,
			references,
			docCode: 'FAA-H-8083-28B',
			onActivate: vi.fn(),
		});
		const view = screen.getByTestId('palette-scoped-view');
		const groups = view.querySelectorAll('[data-bucket]');
		// 3 distinct buckets: knowledge, mine, courses (lesson -> courses).
		const buckets = Array.from(groups).map((g) => g.getAttribute('data-bucket'));
		expect(new Set(buckets).size).toBeGreaterThanOrEqual(3);
	});

	it('renders an empty state when no references match', () => {
		render(PaletteScopedView, {
			headline,
			references: [],
			docCode: 'FAA-H-8083-28B',
			onActivate: vi.fn(),
		});
		expect(screen.getByTestId('palette-scoped-empty')).toBeInTheDocument();
	});

	it('falls back to the docCode in the headline when headline result is null', () => {
		render(PaletteScopedView, {
			headline: null,
			references,
			docCode: 'FAA-H-8083-28B',
			onActivate: vi.fn(),
		});
		const headlineEl = screen.getByTestId('palette-scoped-headline');
		expect(headlineEl.textContent ?? '').toMatch(/FAA-H-8083-28B/);
	});
});
