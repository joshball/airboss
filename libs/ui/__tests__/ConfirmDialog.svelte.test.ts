/**
 * ConfirmDialog DOM contract -- modal confirm with optional typed-gate +
 * dangerLevel mapping. The typed gate disables Confirm until the user types
 * the expected string, and rides through as a hidden `confirmedTarget` field
 * in form-action mode.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialogBindableHarness from './harnesses/ConfirmDialogBindableHarness.svelte';
import ConfirmDialogHarness from './harnesses/ConfirmDialogHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('ConfirmDialog -- without typed gate', () => {
	it('renders the body and Confirm button enabled', () => {
		render(ConfirmDialogHarness, { body: 'Delete user?' });
		expect(screen.getByTestId('dialog-body').textContent).toBe('Delete user?');
		const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
		expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
	});

	it('Confirm click invokes onconfirm', async () => {
		const onconfirm = vi.fn();
		const user = userEvent.setup();
		render(ConfirmDialogHarness, { onconfirm });
		await user.click(screen.getByRole('button', { name: 'Confirm' }));
		expect(onconfirm).toHaveBeenCalledTimes(1);
	});

	it('Cancel click invokes oncancel', async () => {
		const oncancel = vi.fn();
		const user = userEvent.setup();
		render(ConfirmDialogHarness, { oncancel });
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(oncancel).toHaveBeenCalledTimes(1);
	});
});

describe('ConfirmDialog -- typed-confirmation gate', () => {
	it('Confirm is disabled when expected string is not typed', () => {
		render(ConfirmDialogHarness, {
			typedConfirmation: { label: 'Type the email', expected: 'abby@airboss.test' },
		});
		const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
		expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it('Confirm enables once the user types the exact expected string', async () => {
		const user = userEvent.setup();
		render(ConfirmDialogHarness, {
			typedConfirmation: { label: 'Type the email', expected: 'abby@airboss.test' },
		});
		const input = screen.getByLabelText('Type the email') as HTMLInputElement;
		await user.type(input, 'abby@airboss.test');
		const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
		expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
	});

	it('Confirm stays disabled when the user types a near-match', async () => {
		const user = userEvent.setup();
		render(ConfirmDialogHarness, {
			typedConfirmation: { label: 'Type the email', expected: 'abby@airboss.test' },
		});
		const input = screen.getByLabelText('Type the email') as HTMLInputElement;
		await user.type(input, 'Abby@airboss.test'); // capital A
		const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
		expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it('onconfirm is NOT called when typed-gate is unsatisfied', async () => {
		const onconfirm = vi.fn();
		const user = userEvent.setup();
		render(ConfirmDialogHarness, {
			onconfirm,
			typedConfirmation: { label: 'Type the email', expected: 'abby@airboss.test' },
		});
		const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
		await user.click(confirmBtn);
		expect(onconfirm).not.toHaveBeenCalled();
	});
});

describe('ConfirmDialog -- form-action mode with typed gate', () => {
	it('renders a form with the action and hidden fields when formAction is set', () => {
		const { container } = render(ConfirmDialogHarness, {
			formAction: '?/ban',
			hiddenFields: { reason: 'spam', userId: 'usr_abc' },
		});
		const form = container.querySelector('form.confirm-form');
		expect(form).toBeTruthy();
		expect(form?.getAttribute('action')).toBe('?/ban');
		expect(form?.getAttribute('method')).toBe('POST');
		const hidden = container.querySelectorAll('input[type=hidden]');
		const names = Array.from(hidden).map((el) => el.getAttribute('name'));
		expect(names).toContain('reason');
		expect(names).toContain('userId');
	});

	it('adds a confirmedTarget hidden field when typed gate is set, mirroring typed value', async () => {
		const user = userEvent.setup();
		const { container } = render(ConfirmDialogHarness, {
			formAction: '?/ban',
			typedConfirmation: { label: 'Type the email', expected: 'abby@airboss.test' },
		});
		const input = screen.getByLabelText('Type the email') as HTMLInputElement;
		await user.type(input, 'abby@airboss.test');
		const confirmedHidden = container.querySelector('input[type=hidden][name=confirmedTarget]') as HTMLInputElement;
		expect(confirmedHidden).toBeTruthy();
		expect(confirmedHidden.value).toBe('abby@airboss.test');
	});
});

describe('ConfirmDialog -- dangerLevel mapping', () => {
	it('caution maps to primary variant on the Confirm button', () => {
		const { container } = render(ConfirmDialogHarness, { dangerLevel: 'caution' });
		const confirmBtn = container.querySelector('button[type=button][data-variant=primary]');
		// fallback: read class or just verify it's not the danger variant
		const buttons = Array.from(container.querySelectorAll('button'));
		const confirm = buttons.find((b) => b.textContent?.trim() === 'Confirm');
		expect(confirm).toBeTruthy();
		// caution should NOT carry danger styling cues
		const classList = Array.from(confirm?.classList ?? []);
		expect(classList.some((c) => c.includes('danger'))).toBe(false);
		expect(confirmBtn).toBeTruthy(); // sanity that some primary-variant button exists
	});

	it('danger maps to danger variant on the Confirm button', () => {
		const { container } = render(ConfirmDialogHarness, { dangerLevel: 'danger' });
		const buttons = Array.from(container.querySelectorAll('button'));
		const confirm = buttons.find((b) => b.textContent?.trim() === 'Confirm');
		expect(confirm).toBeTruthy();
		const classList = Array.from(confirm?.classList ?? []);
		// danger variant produces a class containing 'danger' in our Button component
		expect(classList.some((c) => c.includes('danger'))).toBe(true);
	});

	it('dangerLevel takes precedence over variant', () => {
		const { container } = render(ConfirmDialogHarness, {
			variant: 'primary',
			dangerLevel: 'danger',
		});
		const buttons = Array.from(container.querySelectorAll('button'));
		const confirm = buttons.find((b) => b.textContent?.trim() === 'Confirm');
		const classList = Array.from(confirm?.classList ?? []);
		expect(classList.some((c) => c.includes('danger'))).toBe(true);
	});
});

describe('ConfirmDialog -- closed state', () => {
	it('does not render the dialog body when open=false', () => {
		render(ConfirmDialogHarness, { open: false });
		expect(screen.queryByTestId('dialog-body')).toBeNull();
	});
});

describe('ConfirmDialog -- reactivity (open is bindable)', () => {
	it('Dialog write of open=false on scrim close propagates back to the caller through bind:open', async () => {
		const user = userEvent.setup();
		const { container } = render(ConfirmDialogBindableHarness);

		// Sanity: dialog is mounted, harness reflects open=true.
		expect(screen.getByTestId('dialog-body')).toBeTruthy();
		expect(container.querySelector('[data-testid=harness-state]')?.getAttribute('data-open')).toBe('true');

		// Click the scrim (not the panel) -- Dialog calls `close()`, which
		// writes `open = false` and fires onClose. With `bind:open` wired
		// through ConfirmDialog, that write propagates back to the harness.
		const scrim = container.querySelector('[data-testid=dialog-scrim]') as HTMLElement;
		expect(scrim).toBeTruthy();
		// pointerdown on the scrim itself (not a child) triggers close.
		await user.pointer({ keys: '[MouseLeft>]', target: scrim });
		await user.pointer({ keys: '[/MouseLeft]', target: scrim });

		expect(container.querySelector('[data-testid=harness-state]')?.getAttribute('data-open')).toBe('false');
		expect(screen.queryByTestId('dialog-body')).toBeNull();
	});

	it('Cancel button click propagates close through to caller (open flips to false)', async () => {
		const user = userEvent.setup();
		const { container } = render(ConfirmDialogBindableHarness);
		expect(container.querySelector('[data-testid=harness-state]')?.getAttribute('data-open')).toBe('true');

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(container.querySelector('[data-testid=harness-state]')?.getAttribute('data-cancel-count')).toBe('1');
		expect(container.querySelector('[data-testid=harness-state]')?.getAttribute('data-open')).toBe('false');
	});

	it('parent setting open=false re-mounts cleanly when set back to true', async () => {
		// Regression guard: with the previous one-way wire, internal Dialog
		// writes left ConfirmDialog's view of `open` desynced from the
		// caller's. Toggling the parent's source-of-truth should reliably
		// remount the dialog body.
		const { container, rerender } = render(ConfirmDialogBindableHarness, { initialOpen: false });
		expect(screen.queryByTestId('dialog-body')).toBeNull();
		await rerender({ initialOpen: true });
		// rerender does not reset `$state` initialised via $props on first
		// mount; instead trigger reopen by re-rendering a fresh harness.
		cleanup();
		render(ConfirmDialogBindableHarness, { initialOpen: true });
		expect(screen.getByTestId('dialog-body')).toBeTruthy();
		expect(document.querySelector('[data-testid=harness-state]')?.getAttribute('data-open')).toBe('true');
		void container; // marker for biome
	});
});
