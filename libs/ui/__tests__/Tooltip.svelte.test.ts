/**
 * Tooltip DOM contract:
 *   - Hover / focus opens, leave / blur closes.
 *   - Renders role="tooltip" with the term + definition when open.
 *   - Glossary `for=` lookup goes through the registered resolver; a
 *     literal `term + definition` pair is the fallback.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setTooltipGlossaryResolver } from '../src/lib/tooltip-glossary-resolver';
import TooltipHarness from './harnesses/TooltipHarness.svelte';

afterEach(() => {
	cleanup();
	setTooltipGlossaryResolver(null);
});

describe('Tooltip', () => {
	beforeEach(() => {
		setTooltipGlossaryResolver(null);
	});

	it('does not render the tooltip bubble when closed', () => {
		render(TooltipHarness, { term: 'Quals', definition: 'Definition.' });
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('opens on mouseenter and closes on mouseleave', async () => {
		render(TooltipHarness, { term: 'Quals', definition: 'Quals defined.' });
		const host = screen.getByTestId('tooltip-trigger').parentElement;
		expect(host).not.toBeNull();
		if (host === null) return;

		await fireEvent.mouseEnter(host);
		const bubble = screen.getByRole('tooltip');
		expect(bubble.textContent).toContain('Quals');
		expect(bubble.textContent).toContain('Quals defined.');

		await fireEvent.mouseLeave(host);
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('opens on focusin and closes on focusout', async () => {
		render(TooltipHarness, { term: 'Plan', definition: 'Plan body.' });
		const host = screen.getByTestId('tooltip-trigger').parentElement;
		if (host === null) throw new Error('host missing');

		await fireEvent.focusIn(host);
		expect(screen.getByRole('tooltip')).toBeTruthy();

		await fireEvent.focusOut(host);
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('opens on touchstart', async () => {
		render(TooltipHarness, { term: 'Goal', definition: 'Goal body.' });
		const host = screen.getByTestId('tooltip-trigger').parentElement;
		if (host === null) throw new Error('host missing');

		await fireEvent.touchStart(host);
		expect(screen.getByRole('tooltip')).toBeTruthy();
	});

	it('reads from the glossary resolver when `for=` is set', async () => {
		setTooltipGlossaryResolver((key) => {
			if (key === 'qual') return { term: 'Qual', short: 'From resolver.' };
			return null;
		});
		render(TooltipHarness, { for: 'qual' });
		const host = screen.getByTestId('tooltip-trigger').parentElement;
		if (host === null) throw new Error('host missing');

		await fireEvent.mouseEnter(host);
		const bubble = screen.getByRole('tooltip');
		expect(bubble.textContent).toContain('Qual');
		expect(bubble.textContent).toContain('From resolver.');
	});

	it('does not open when neither literal nor resolver-known key is provided', async () => {
		// No resolver registered, no literal -- nothing to show.
		render(TooltipHarness, { for: 'unknown' });
		const host = screen.getByTestId('tooltip-trigger').parentElement;
		if (host === null) throw new Error('host missing');

		await fireEvent.mouseEnter(host);
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('sets aria-describedby on the host when open', async () => {
		render(TooltipHarness, { term: 'Cards', definition: 'Cards body.' });
		const host = screen.getByTestId('tooltip-trigger').parentElement;
		if (host === null) throw new Error('host missing');

		expect(host.getAttribute('aria-describedby')).toBeNull();
		await fireEvent.mouseEnter(host);
		const describedBy = host.getAttribute('aria-describedby');
		expect(describedBy).not.toBeNull();
		const bubble = screen.getByRole('tooltip');
		expect(bubble.id).toBe(describedBy);
	});
});
