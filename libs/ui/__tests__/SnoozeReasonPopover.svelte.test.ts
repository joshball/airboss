/**
 * SnoozeReasonPopover DOM contract -- dialog gating, reason selection,
 * comment validation, submit payload shape.
 */

import { SNOOZE_REASONS } from '@ab/constants';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SnoozeReasonPopover from '../src/components/SnoozeReasonPopover.svelte';

afterEach(() => {
	cleanup();
});

describe('SnoozeReasonPopover -- closed', () => {
	it('renders nothing when open=false', () => {
		const { container } = render(SnoozeReasonPopover, {
			open: false,
			onSubmit: vi.fn(),
		});
		expect(container.querySelector('[data-testid="snoozereasonpopover-root"]')).toBeNull();
	});
});

describe('SnoozeReasonPopover -- open', () => {
	it('renders dialog with role=dialog', () => {
		render(SnoozeReasonPopover, { open: true, onSubmit: vi.fn() });
		// role=dialog + aria-modal come from the shared Dialog primitive's
		// panel; the per-popover root marker still carries the
		// `data-selected-reason` state used by the rest of these tests.
		const panel = screen.getByTestId('dialog-panel');
		expect(panel.getAttribute('role')).toBe('dialog');
		expect(panel.getAttribute('aria-modal')).toBe('true');
		expect(screen.getByTestId('snoozereasonpopover-root')).toBeInTheDocument();
	});

	it('reflects the default reason on data-selected-reason', () => {
		render(SnoozeReasonPopover, { open: true, onSubmit: vi.fn() });
		expect(screen.getByTestId('snoozereasonpopover-root').getAttribute('data-selected-reason')).toBe(
			SNOOZE_REASONS.KNOW_IT_BORED,
		);
	});

	it('honors initialReason when set', () => {
		render(SnoozeReasonPopover, {
			open: true,
			initialReason: SNOOZE_REASONS.BAD_QUESTION,
			onSubmit: vi.fn(),
		});
		expect(screen.getByTestId('snoozereasonpopover-root').getAttribute('data-selected-reason')).toBe(
			SNOOZE_REASONS.BAD_QUESTION,
		);
	});
});

describe('SnoozeReasonPopover -- reason selection', () => {
	it('changing the radio input updates the selected state', async () => {
		render(SnoozeReasonPopover, { open: true, onSubmit: vi.fn() });
		const target = screen.getByTestId(
			`snoozereasonpopover-reason-input-${SNOOZE_REASONS.WRONG_DOMAIN}`,
		) as HTMLInputElement;
		target.checked = true;
		target.dispatchEvent(new Event('change', { bubbles: true }));
		// Await a microtask so Svelte's reactive flush propagates the new
		// `selectedReason` to data-selected-reason.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.getByTestId('snoozereasonpopover-root').getAttribute('data-selected-reason')).toBe(
			SNOOZE_REASONS.WRONG_DOMAIN,
		);
	});
});

describe('SnoozeReasonPopover -- close', () => {
	it('clicking the shared Dialog close button calls onClose', () => {
		const onClose = vi.fn();
		render(SnoozeReasonPopover, { open: true, onSubmit: vi.fn(), onClose });
		(screen.getByTestId('dialog-close') as HTMLButtonElement).click();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('clicking cancel calls onClose', () => {
		const onClose = vi.fn();
		render(SnoozeReasonPopover, { open: true, onSubmit: vi.fn(), onClose });
		(screen.getByTestId('snoozereasonpopover-cancel') as HTMLButtonElement).click();
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});

describe('SnoozeReasonPopover -- submit payload + comment validation', () => {
	it('submits the selected reason and the typed comment to onSubmit', async () => {
		const onSubmit = vi.fn();
		render(SnoozeReasonPopover, { open: true, onSubmit });
		const textarea = screen.getByTestId('snoozereasonpopover-comment-input') as HTMLTextAreaElement;
		textarea.value = 'My comment';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		(screen.getByTestId('snoozereasonpopover-submit') as HTMLButtonElement).click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		const payload = onSubmit.mock.calls[0]?.[0];
		expect(payload).toMatchObject({ comment: 'My comment' });
		expect(typeof payload.reason).toBe('string');
	});

	it('marks textarea aria-required when the selected reason needs a comment', () => {
		render(SnoozeReasonPopover, {
			open: true,
			initialReason: SNOOZE_REASONS.BAD_QUESTION,
			onSubmit: vi.fn(),
		});
		const textarea = screen.getByTestId('snoozereasonpopover-comment-input') as HTMLTextAreaElement;
		// BAD_QUESTION is one of the reasons that requires a comment (the
		// component derives `requiresComment` from the selected reason). The
		// aria-required reflects that to AT.
		expect(textarea.getAttribute('aria-required')).toBe('true');
		expect(textarea.required).toBe(true);
	});

	it('blocks submit when comment is required but empty', async () => {
		const onSubmit = vi.fn();
		render(SnoozeReasonPopover, {
			open: true,
			initialReason: SNOOZE_REASONS.BAD_QUESTION,
			onSubmit,
		});
		(screen.getByTestId('snoozereasonpopover-submit') as HTMLButtonElement).click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		// onSubmit must not fire. Native form validation also blocks via the
		// `required={requiresComment}` attribute, so the inline error path
		// only appears for non-native bypasses (Enter from elsewhere); the
		// guarantee asserted here is the absence of submission, not the
		// specific message path.
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
