/**
 * `PalettePassageView` -- I-3 phrase-FTS intent shape.
 *
 * The FTS loader lands in PR C; until then the component renders an
 * empty-state hint or fallback substring snippets.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '../src/schema/result-types';
import PalettePassageView from '../src/ui/PalettePassageView.svelte';

afterEach(() => {
	cleanup();
});

function makePassage(
	overrides: Partial<SearchResult> & { id: string; type: SearchResult['type']; title: string },
): SearchResult {
	return {
		href: `/x/${overrides.id}`,
		rankBucket: 3,
		...overrides,
	};
}

describe('PalettePassageView -- empty state', () => {
	it('renders an empty-state hint when no passages', () => {
		render(PalettePassageView, { passages: [], onActivate: vi.fn() });
		expect(screen.getByTestId('palette-passage-empty')).toBeInTheDocument();
	});
});

describe('PalettePassageView -- passage cards', () => {
	it('renders a card per passage', () => {
		const passages = [
			makePassage({
				id: 'p1',
				type: 'faa.cfr.sect',
				title: '14 CFR §1.1 General Definitions',
				docCode: '14 CFR §1.1',
				snippet: 'night means the time between civil twilight...',
			}),
			makePassage({
				id: 'p2',
				type: 'faa.cfr.sect',
				title: '14 CFR §61.57 Recent Flight Experience',
				docCode: '14 CFR §61.57',
				snippet: 'night means the period beginning 1 hour after sunset...',
			}),
		];
		render(PalettePassageView, { passages, onActivate: vi.fn() });
		const cards = screen.getAllByTestId('palette-passage-card');
		expect(cards.length).toBe(2);
	});

	it('renders the doc code and title on each card', () => {
		const passages = [
			makePassage({
				id: 'p1',
				type: 'faa.cfr.sect',
				title: '14 CFR §1.1 General Definitions',
				docCode: '14 CFR §1.1',
				snippet: 'definition snippet',
			}),
		];
		render(PalettePassageView, { passages, onActivate: vi.fn() });
		const card = screen.getByTestId('palette-passage-card');
		expect(card.textContent ?? '').toMatch(/14 CFR/);
		expect(card.textContent ?? '').toMatch(/General Definitions/);
	});

	it('renders passageHighlight as HTML when present', () => {
		const passages = [
			makePassage({
				id: 'p1',
				type: 'faa.cfr.sect',
				title: '14 CFR §1.1',
				docCode: '14 CFR §1.1',
				passageHighlight: 'definition of <mark>night</mark> means the period after <mark>civil twilight</mark>',
			}),
		];
		render(PalettePassageView, { passages, onActivate: vi.fn() });
		const card = screen.getByTestId('palette-passage-card');
		const marks = card.querySelectorAll('mark');
		expect(marks.length).toBe(2);
	});

	it('activates a passage on click', async () => {
		const onActivate = vi.fn();
		const passages = [
			makePassage({
				id: 'p1',
				type: 'faa.cfr.sect',
				title: '14 CFR §1.1',
				docCode: '14 CFR §1.1',
				snippet: 'snippet',
			}),
		];
		render(PalettePassageView, { passages, onActivate });
		await fireEvent.click(screen.getByTestId('palette-passage-card'));
		expect(onActivate).toHaveBeenCalledTimes(1);
		expect(onActivate.mock.calls[0]?.[0]?.id).toBe('p1');
	});
});
