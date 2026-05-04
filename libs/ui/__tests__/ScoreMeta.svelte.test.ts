/**
 * ScoreMeta DOM contract -- a `<dl>` of label/value pairs rendered with the
 * label on top and a tabular-numeric value below. Replaces the inline
 * `.score-meta` block on the calibration page; verifies the structure and
 * the data-testid hooks consumers and tests rely on.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScoreMetaItem } from '../src/components/ScoreMeta.svelte';
import ScoreMetaHarness from './harnesses/ScoreMetaHarness.svelte';

afterEach(() => {
	cleanup();
});

const baseItems: readonly ScoreMetaItem[] = [
	{ label: 'Data points', value: 42 },
	{ label: 'Domains with data', value: 5 },
];

describe('ScoreMeta -- rendering', () => {
	it('renders root as a <dl> element', () => {
		render(ScoreMetaHarness, { items: baseItems });
		const root = screen.getByTestId('scoremeta-root');
		expect(root.tagName).toBe('DL');
	});

	it('renders one cell per item with dt/dd structure', () => {
		render(ScoreMetaHarness, { items: baseItems });
		const cells = screen.getAllByTestId(/^scoremeta-item-/);
		expect(cells).toHaveLength(2);
		expect(cells[0].querySelector('dt')?.textContent).toBe('Data points');
		expect(cells[0].querySelector('dd')?.textContent).toBe('42');
		expect(cells[1].querySelector('dt')?.textContent).toBe('Domains with data');
		expect(cells[1].querySelector('dd')?.textContent).toBe('5');
	});

	it('uses item.testId as data-testid suffix when provided', () => {
		render(ScoreMetaHarness, {
			items: [
				{ label: 'Score', value: '0.78', testId: 'score' },
				{ label: 'Trend', value: '+5%', testId: 'trend' },
			],
		});
		expect(screen.getByTestId('scoremeta-item-score')).toBeInTheDocument();
		expect(screen.getByTestId('scoremeta-item-trend')).toBeInTheDocument();
	});

	it('falls back to index when item.testId is omitted', () => {
		render(ScoreMetaHarness, { items: baseItems });
		expect(screen.getByTestId('scoremeta-item-0')).toBeInTheDocument();
		expect(screen.getByTestId('scoremeta-item-1')).toBeInTheDocument();
	});

	it('renders an empty <dl> when items is empty', () => {
		render(ScoreMetaHarness, { items: [] });
		const root = screen.getByTestId('scoremeta-root');
		expect(root.tagName).toBe('DL');
		expect(screen.queryAllByTestId(/^scoremeta-item-/)).toHaveLength(0);
	});

	it('passes ariaLabel through to the dl element', () => {
		render(ScoreMetaHarness, { items: baseItems, ariaLabel: 'Calibration meta' });
		expect(screen.getByTestId('scoremeta-root').getAttribute('aria-label')).toBe('Calibration meta');
	});

	it('renders numeric and string values without coercion noise', () => {
		render(ScoreMetaHarness, {
			items: [
				{ label: 'Pct', value: '78%' },
				{ label: 'Count', value: 0 },
			],
		});
		const cells = screen.getAllByTestId(/^scoremeta-item-/);
		expect(cells[0].querySelector('dd')?.textContent).toBe('78%');
		expect(cells[1].querySelector('dd')?.textContent).toBe('0');
	});
});
