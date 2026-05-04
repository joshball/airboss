/**
 * ReadSuggestionPanel a11y contract -- pins the labelled-group fix landed
 * in the 2026-05-04 chunk-1 a11y CRITICAL close-out.
 *
 * Pre-fix the read-suggestion banner used `role="status"
 * aria-live="polite"` with no preamble: SR users heard "Mark this section
 * as read?" appear out of nowhere with no context for why the question
 * arrived. The chunk-1 a11y review (CRITICAL #3) called for a labelled
 * group with an explanatory descriptor.
 *
 * Post-fix:
 *
 *   - The banner is a `role="group"` with `aria-labelledby` pointing at a
 *     visible preamble paragraph.
 *   - The preamble text reads "Based on your reading time:" before the
 *     prompt so AT users hear the context first.
 *   - The dismiss button still calls back to the parent's dismiss handler.
 *
 * Runs under happy-dom via the `unit-dom` vitest project.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReadSuggestionPanel from './ReadSuggestionPanel.svelte';

afterEach(() => {
	cleanup();
});

describe('ReadSuggestionPanel -- labelled group', () => {
	it('renders a role="group" wrapper around the preamble + actions', () => {
		render(ReadSuggestionPanel, { onDismiss: vi.fn() });
		const group = screen.getByTestId('read-suggestion');
		expect(group.getAttribute('role')).toBe('group');
	});

	it('aria-labelledby on the group points at the preamble paragraph', () => {
		render(ReadSuggestionPanel, { onDismiss: vi.fn() });
		const group = screen.getByTestId('read-suggestion');
		const labelledBy = group.getAttribute('aria-labelledby');
		expect(labelledBy).toBe('read-suggestion-preamble');
		const preamble = document.getElementById(labelledBy ?? '');
		expect(preamble).not.toBeNull();
		expect(preamble?.textContent ?? '').toContain('Based on your reading time:');
		expect(preamble?.textContent ?? '').toContain('Mark this section as read?');
	});

	it('does not announce as a flat live-region: role=status should be gone', () => {
		// Pre-fix the wrapper carried `role="status" aria-live="polite"`,
		// which made the banner appear with no preamble in the SR's flow.
		// The fix replaces the live region with a labelled group; assert
		// we did not regress.
		render(ReadSuggestionPanel, { onDismiss: vi.fn() });
		const group = screen.getByTestId('read-suggestion');
		expect(group.getAttribute('role')).not.toBe('status');
		expect(group.getAttribute('aria-live')).toBeNull();
	});
});

describe('ReadSuggestionPanel -- preamble structure', () => {
	it('preamble announces context first, prompt second (DOM order)', () => {
		render(ReadSuggestionPanel, { onDismiss: vi.fn() });
		const preamble = document.getElementById('read-suggestion-preamble');
		expect(preamble).not.toBeNull();
		const spans = preamble?.querySelectorAll('span') ?? [];
		expect(spans[0]?.textContent).toBe('Based on your reading time:');
		expect(spans[1]?.textContent).toBe('Mark this section as read?');
	});
});

describe('ReadSuggestionPanel -- actions', () => {
	it('"Mark as read" form posts to the set-status action with READ status', () => {
		render(ReadSuggestionPanel, { onDismiss: vi.fn() });
		const form = document.querySelector<HTMLFormElement>('form');
		expect(form).not.toBeNull();
		expect(form?.method.toLowerCase()).toBe('post');
		expect(form?.getAttribute('action')).toBe('?/set-status');
		const hidden = form?.querySelector<HTMLInputElement>('input[type="hidden"][name="status"]');
		expect(hidden?.value).toBe('read');
	});

	it('"Not yet" button calls onDismiss', async () => {
		const user = userEvent.setup();
		const onDismiss = vi.fn();
		render(ReadSuggestionPanel, { onDismiss });
		const dismiss = screen.getByRole('button', { name: 'Not yet' });
		await user.click(dismiss);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
