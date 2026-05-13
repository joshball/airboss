/**
 * `PaletteTopHits` -- 3-row compact strip rendered in I-2 broad mode.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '../src/schema/result-types';
import PaletteTopHits from '../src/ui/PaletteTopHits.svelte';

afterEach(() => {
	cleanup();
});

function makeResult(id: string, type: SearchResult['type'], title: string): SearchResult {
	return {
		id,
		type,
		title,
		docCode: type.startsWith('faa.') ? `${id.toUpperCase()}-CODE` : undefined,
		href: `/h/${id}`,
		rankBucket: 1,
	};
}

describe('PaletteTopHits', () => {
	it('renders nothing when hits is empty', () => {
		render(PaletteTopHits, { hits: [], onActivate: vi.fn() });
		expect(screen.queryByTestId('palette-top-hits')).toBeNull();
	});

	it('renders a row per hit', () => {
		const hits = [
			makeResult('h1', 'faa.handbook', 'AvWX'),
			makeResult('h2', 'faa.ac', 'AC 00-6'),
			makeResult('h3', 'airboss.course', 'Weather Course'),
		];
		render(PaletteTopHits, { hits, onActivate: vi.fn() });
		const rows = screen.getAllByTestId('palette-row');
		expect(rows.length).toBe(3);
	});

	it('renders the section heading', () => {
		render(PaletteTopHits, { hits: [makeResult('h1', 'faa.handbook', 'AvWX')], onActivate: vi.fn() });
		const section = screen.getByTestId('palette-top-hits');
		expect(section.querySelector('h3')?.textContent ?? '').toMatch(/Top hits/i);
	});

	it('marks the focused row when the strip owns focus', () => {
		const hits = [
			makeResult('h1', 'faa.handbook', 'AvWX'),
			makeResult('h2', 'faa.ac', 'AC 00-6'),
		];
		render(PaletteTopHits, { hits, focused: true, focusedIndex: 1, onActivate: vi.fn() });
		const rows = screen.getAllByTestId('palette-row');
		expect(rows[0]?.classList.contains('focused')).toBe(false);
		expect(rows[1]?.classList.contains('focused')).toBe(true);
	});
});
