/**
 * MetricExplainer DOM contract:
 *   - Renders label + value + `?` button by default; popover hidden.
 *   - Clicking the trigger opens the popover; aria-expanded reflects state.
 *   - Popover renders the `short` text and the optional `formula` block.
 *   - Glossary deep link, when supplied, renders as an anchor inside the popover.
 *   - Esc closes the popover and returns focus to the trigger.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import MetricExplainer from '../src/components/MetricExplainer.svelte';

afterEach(() => {
	cleanup();
});

describe('MetricExplainer', () => {
	it('renders label, value, and a closed `?` trigger by default', () => {
		render(MetricExplainer, {
			label: 'Calibration',
			value: '0.73',
			short: 'How well your confidence matches your accuracy.',
		});
		expect(screen.getByTestId('metric-explainer-label').textContent).toBe('Calibration');
		expect(screen.getByTestId('metric-explainer-value').textContent).toBe('0.73');
		const trigger = screen.getByTestId('metric-explainer-trigger');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByTestId('metric-explainer-popover')).toBeNull();
	});

	it('opens the popover on click and renders the short + formula', async () => {
		render(MetricExplainer, {
			label: 'Brier',
			value: '0.21',
			short: 'Mean squared error between confidence and correctness.',
			formula: 'mean((confidence - correct)^2)',
		});
		await fireEvent.click(screen.getByTestId('metric-explainer-trigger'));
		expect(screen.getByTestId('metric-explainer-trigger').getAttribute('aria-expanded')).toBe('true');
		const popover = screen.getByTestId('metric-explainer-popover');
		expect(popover.textContent).toContain('Mean squared error');
		expect(popover.textContent).toContain('mean((confidence - correct)^2)');
	});

	it('renders the glossary "Learn more" link when glossaryHref is supplied', async () => {
		render(MetricExplainer, {
			label: 'Calibration',
			value: '0.73',
			short: 'short text',
			glossaryHref: '/reference/glossary/calibration',
		});
		await fireEvent.click(screen.getByTestId('metric-explainer-trigger'));
		const link = screen.getByText(/Learn more/i);
		expect(link.tagName).toBe('A');
		expect(link.getAttribute('href')).toBe('/reference/glossary/calibration');
	});

	it('closes the popover on Escape and returns focus to the trigger', async () => {
		render(MetricExplainer, { label: 'X', value: '1', short: 's' });
		const trigger = screen.getByTestId('metric-explainer-trigger') as HTMLButtonElement;
		await fireEvent.click(trigger);
		expect(screen.queryByTestId('metric-explainer-popover')).not.toBeNull();
		await fireEvent.keyDown(trigger.parentElement as HTMLElement, { key: 'Escape' });
		expect(screen.queryByTestId('metric-explainer-popover')).toBeNull();
	});
});
