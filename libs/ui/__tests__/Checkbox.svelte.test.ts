/**
 * Checkbox DOM contract -- label association, state attributes, change events.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Checkbox from '../src/components/Checkbox.svelte';

afterEach(() => {
	cleanup();
});

describe('Checkbox -- rendering', () => {
	it('renders root with label text', () => {
		render(Checkbox, { label: 'Accept terms' });
		expect(screen.getByTestId('checkbox-root')).toBeTruthy();
		expect(screen.getByTestId('checkbox-label').textContent).toBe('Accept terms');
	});

	it('label is associated with input via for/id', () => {
		render(Checkbox, { label: 'Accept', name: 'agree' });
		const root = screen.getByTestId('checkbox-root') as HTMLLabelElement;
		const input = screen.getByTestId('checkbox-input') as HTMLInputElement;
		expect(root.getAttribute('for')).toBe(input.id);
		expect(input.id).toBe('cb-agree');
	});
});

describe('Checkbox -- state attributes', () => {
	it('default state is unchecked', () => {
		render(Checkbox, { label: 'X' });
		expect(screen.getByTestId('checkbox-root').getAttribute('data-state')).toBe('unchecked');
	});

	it('checked=true reflects state=checked', () => {
		render(Checkbox, { label: 'X', checked: true });
		expect(screen.getByTestId('checkbox-root').getAttribute('data-state')).toBe('checked');
		expect((screen.getByTestId('checkbox-input') as HTMLInputElement).checked).toBe(true);
	});

	it('indeterminate=true reflects state=indeterminate and the input is indeterminate', () => {
		render(Checkbox, { label: 'X', indeterminate: true });
		expect(screen.getByTestId('checkbox-root').getAttribute('data-state')).toBe('indeterminate');
		expect((screen.getByTestId('checkbox-input') as HTMLInputElement).indeterminate).toBe(true);
	});

	it('disabled=true reflects state=disabled and disables the input', () => {
		render(Checkbox, { label: 'X', disabled: true });
		expect(screen.getByTestId('checkbox-root').getAttribute('data-state')).toBe('disabled');
		expect((screen.getByTestId('checkbox-input') as HTMLInputElement).disabled).toBe(true);
	});

	it('error=true reflects state=error + aria-invalid=true', () => {
		render(Checkbox, { label: 'X', error: true });
		expect(screen.getByTestId('checkbox-root').getAttribute('data-state')).toBe('error');
		expect(screen.getByTestId('checkbox-input').getAttribute('aria-invalid')).toBe('true');
	});
});

describe('Checkbox -- interaction', () => {
	it('clicking the label toggles checked and fires onchange', async () => {
		const onchange = vi.fn();
		const user = userEvent.setup();
		render(Checkbox, { label: 'Agree', onchange });
		await user.click(screen.getByTestId('checkbox-input'));
		expect(onchange).toHaveBeenCalledTimes(1);
		expect(onchange).toHaveBeenCalledWith(true);
	});

	it('disabled checkbox does not fire onchange on click', async () => {
		const onchange = vi.fn();
		const user = userEvent.setup();
		render(Checkbox, { label: 'X', disabled: true, onchange });
		await user.click(screen.getByTestId('checkbox-input'));
		expect(onchange).not.toHaveBeenCalled();
	});
});
