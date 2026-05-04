/**
 * ScoreMeta DOM contract -- a `<dl>` of (label, value) pairs rendered with
 * the label on top and a large weighty tabular value below. Used as the
 * meta line under headline scores (e.g. the calibration page's ScoreCard).
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScoreMetaItem } from '../src/components/ScoreMeta.svelte';
import ScoreMetaHarness from './harnesses/ScoreMetaHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('ScoreMeta -- rendering', () => {
	it('renders a dl root with one cell per item', () => {
		const items: ScoreMetaItem[] = [
			{ label: 'Data points', value: 42 },
			{ label: 'Domains with data', value: 7 },
		];
		render(ScoreMetaHarness, { items });
		const root = screen.getByTestId('scoremeta-root');
		expect(root).toBeInTheDocument();
		expect(root.tagName.toLowerCase()).toBe('dl');
		// Two cells, one per item.
		expect(root.querySelectorAll('[data-testid^="scoremeta-item-"]').length).toBe(2);
	});

	it('renders each item label inside a <dt> and value inside a <dd>', () => {
		const items: ScoreMetaItem[] = [{ label: 'Streak', value: '5 days' }];
		render(ScoreMetaHarness, { items });
		const root = screen.getByTestId('scoremeta-root');
		const dt = root.querySelector('dt');
		const dd = root.querySelector('dd');
		expect(dt?.textContent).toBe('Streak');
		expect(dd?.textContent).toBe('5 days');
	});

	it('renders numeric values', () => {
		const items: ScoreMetaItem[] = [{ label: 'Count', value: 13 }];
		render(ScoreMetaHarness, { items });
		expect(screen.getByTestId('scoremeta-root').querySelector('dd')?.textContent).toBe('13');
	});

	it('uses item.testId as the suffix on the cell data-testid when provided', () => {
		const items: ScoreMetaItem[] = [
			{ label: 'Points', value: 10, testId: 'points' },
			{ label: 'Domains', value: 3, testId: 'domains' },
		];
		render(ScoreMetaHarness, { items });
		expect(screen.getByTestId('scoremeta-item-points')).toBeInTheDocument();
		expect(screen.getByTestId('scoremeta-item-domains')).toBeInTheDocument();
	});

	it('falls back to the index when item.testId is omitted', () => {
		const items: ScoreMetaItem[] = [
			{ label: 'A', value: 1 },
			{ label: 'B', value: 2 },
		];
		render(ScoreMetaHarness, { items });
		expect(screen.getByTestId('scoremeta-item-0')).toBeInTheDocument();
		expect(screen.getByTestId('scoremeta-item-1')).toBeInTheDocument();
	});

	it('passes ariaLabel through to the dl root', () => {
		const items: ScoreMetaItem[] = [{ label: 'X', value: 1 }];
		render(ScoreMetaHarness, { items, ariaLabel: 'Calibration metadata' });
		expect(screen.getByTestId('scoremeta-root').getAttribute('aria-label')).toBe('Calibration metadata');
	});

	it('renders an empty dl for an empty items array', () => {
		render(ScoreMetaHarness, { items: [] });
		const root = screen.getByTestId('scoremeta-root');
		expect(root).toBeInTheDocument();
		expect(root.querySelectorAll('[data-testid^="scoremeta-item-"]').length).toBe(0);
	});
});
