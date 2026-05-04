/**
 * Tests for `<ReadingTime>` -- the "≈ N min read" badge.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ReadingTime from '../src/ReadingTime.svelte';

afterEach(() => {
	cleanup();
});

describe('<ReadingTime>', () => {
	it('renders the badge for a positive minutes value', () => {
		render(ReadingTime, { minutes: 4 });
		const badge = screen.getByTestId('reading-time');
		expect(badge).toBeInTheDocument();
		expect(badge.textContent).toMatch(/≈ 4 min read/);
	});

	it('exposes a screen-reader friendly aria-label', () => {
		render(ReadingTime, { minutes: 4 });
		const badge = screen.getByTestId('reading-time');
		expect(badge.getAttribute('aria-label')).toBe('Approximately 4 minutes to read');
	});

	it('uses singular "minute" in the aria-label for 1 min', () => {
		render(ReadingTime, { minutes: 1 });
		const badge = screen.getByTestId('reading-time');
		expect(badge.getAttribute('aria-label')).toBe('Approximately 1 minute to read');
	});

	it('renders nothing for zero minutes', () => {
		render(ReadingTime, { minutes: 0 });
		expect(screen.queryByTestId('reading-time')).toBeNull();
	});

	it('renders nothing for negative minutes', () => {
		render(ReadingTime, { minutes: -1 });
		expect(screen.queryByTestId('reading-time')).toBeNull();
	});

	it('honors a caller-supplied aria-label', () => {
		render(ReadingTime, { minutes: 12, ariaLabel: 'Approximately 12 minutes to read this chapter' });
		const badge = screen.getByTestId('reading-time');
		expect(badge.getAttribute('aria-label')).toBe('Approximately 12 minutes to read this chapter');
	});
});
