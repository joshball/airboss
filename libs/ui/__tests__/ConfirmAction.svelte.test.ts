/**
 * ConfirmAction DOM contract -- two-step confirm, cancel returns to trigger,
 * dangerous action only runs after confirm click.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfirmActionHarness from './harnesses/ConfirmActionHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('ConfirmAction -- closed (initial)', () => {
	it('renders the trigger button only', () => {
		render(ConfirmActionHarness, { label: 'Delete' });
		expect(screen.getByTestId('confirmaction-trigger')).toBeTruthy();
		expect(screen.queryByTestId('confirmaction-panel')).toBeNull();
	});

	it('disabled trigger does not open the confirm row', async () => {
		const onConfirm = vi.fn();
		const user = userEvent.setup();
		render(ConfirmActionHarness, { label: 'Delete', disabled: true, onConfirm });
		await user.click(screen.getByTestId('confirmaction-trigger'));
		expect(screen.queryByTestId('confirmaction-panel')).toBeNull();
		expect(onConfirm).not.toHaveBeenCalled();
	});
});

describe('ConfirmAction -- open', () => {
	it('clicking trigger reveals the confirm + cancel buttons', async () => {
		const user = userEvent.setup();
		render(ConfirmActionHarness, { label: 'Delete' });
		await user.click(screen.getByTestId('confirmaction-trigger'));
		expect(screen.getByTestId('confirmaction-panel')).toBeTruthy();
		expect(screen.getByTestId('confirmaction-confirm')).toBeTruthy();
		expect(screen.getByTestId('confirmaction-cancel')).toBeTruthy();
	});

	it('cancelling closes the panel without firing onConfirm', async () => {
		const onConfirm = vi.fn();
		const user = userEvent.setup();
		render(ConfirmActionHarness, { label: 'Delete', onConfirm });
		await user.click(screen.getByTestId('confirmaction-trigger'));
		await user.click(screen.getByTestId('confirmaction-cancel'));
		expect(onConfirm).not.toHaveBeenCalled();
		expect(screen.queryByTestId('confirmaction-panel')).toBeNull();
		expect(screen.getByTestId('confirmaction-trigger')).toBeTruthy();
	});

	it('confirming fires onConfirm exactly once and closes the panel', async () => {
		const onConfirm = vi.fn();
		const user = userEvent.setup();
		render(ConfirmActionHarness, { label: 'Delete', onConfirm });
		await user.click(screen.getByTestId('confirmaction-trigger'));
		await user.click(screen.getByTestId('confirmaction-confirm'));
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId('confirmaction-panel')).toBeNull();
	});
});

describe('ConfirmAction -- form mode', () => {
	it('renders a <form> with the action when formAction is set', async () => {
		const user = userEvent.setup();
		render(ConfirmActionHarness, { label: 'Delete', formAction: '?/archive' });
		await user.click(screen.getByTestId('confirmaction-trigger'));
		const form = screen.getByTestId('confirmaction-form') as HTMLFormElement;
		expect(form.tagName).toBe('FORM');
		expect(form.getAttribute('action')).toBe('?/archive');
		expect(screen.getByTestId('confirmaction-confirm').getAttribute('type')).toBe('submit');
	});
});

describe('ConfirmAction -- loading state', () => {
	it('reflects loading on the Confirm button: disabled, data-state=loading, loadingLabel rendered', async () => {
		const user = userEvent.setup();
		render(ConfirmActionHarness, { label: 'Delete', confirmLabel: 'Delete it', loading: true });
		await user.click(screen.getByTestId('confirmaction-trigger'));
		const confirm = screen.getByTestId('confirmaction-confirm') as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		expect(confirm.getAttribute('data-state')).toBe('loading');
		// Default loading label is `${confirmLabel}...`.
		expect(confirm.textContent).toContain('Delete it...');
	});

	it('disables Cancel while loading so users cannot back out mid-submit', async () => {
		const user = userEvent.setup();
		render(ConfirmActionHarness, { label: 'Delete', loading: true });
		await user.click(screen.getByTestId('confirmaction-trigger'));
		const cancel = screen.getByTestId('confirmaction-cancel') as HTMLButtonElement;
		expect(cancel.disabled).toBe(true);
	});

	it('loadingLabel overrides the default loading copy', async () => {
		const user = userEvent.setup();
		render(ConfirmActionHarness, { label: 'Delete', loading: true, loadingLabel: 'Deleting' });
		await user.click(screen.getByTestId('confirmaction-trigger'));
		expect(screen.getByTestId('confirmaction-confirm').textContent).toContain('Deleting');
	});
});
