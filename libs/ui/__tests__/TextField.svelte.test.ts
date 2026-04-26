/**
 * TextField DOM contract -- input/textarea swap, label association, hint/error.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import TextField from '../src/components/TextField.svelte';

afterEach(() => {
	cleanup();
});

describe('TextField -- rendering', () => {
	it('renders <input> for text by default', () => {
		render(TextField, { label: 'Email', name: 'email' });
		const ctrl = screen.getByTestId('textfield-control');
		expect(ctrl.tagName).toBe('INPUT');
		expect(ctrl.getAttribute('type')).toBe('text');
	});

	it('renders <textarea> when type=textarea', () => {
		render(TextField, { label: 'Notes', type: 'textarea' });
		expect(screen.getByTestId('textfield-control').tagName).toBe('TEXTAREA');
		expect(screen.getByTestId('textfield-root').getAttribute('data-type')).toBe('textarea');
	});

	it('label for matches input id', () => {
		render(TextField, { label: 'Email', name: 'email' });
		const root = screen.getByTestId('textfield-root') as HTMLLabelElement;
		const ctrl = screen.getByTestId('textfield-control') as HTMLInputElement;
		expect(root.getAttribute('for')).toBe(ctrl.id);
		expect(ctrl.id).toBe('tf-email');
	});
});

describe('TextField -- state', () => {
	it('default state is idle', () => {
		render(TextField, { label: 'X' });
		expect(screen.getByTestId('textfield-root').getAttribute('data-state')).toBe('idle');
	});

	it('disabled=true reflects state=disabled', () => {
		render(TextField, { label: 'X', disabled: true });
		expect(screen.getByTestId('textfield-root').getAttribute('data-state')).toBe('disabled');
		expect((screen.getByTestId('textfield-control') as HTMLInputElement).disabled).toBe(true);
	});

	it('error="message" reflects state=error and renders alert text', () => {
		render(TextField, { label: 'Email', error: 'Required' });
		expect(screen.getByTestId('textfield-root').getAttribute('data-state')).toBe('error');
		const err = screen.getByTestId('textfield-error');
		expect(err.textContent).toBe('Required');
		expect(err.getAttribute('role')).toBe('alert');
		expect(screen.getByTestId('textfield-control').getAttribute('aria-invalid')).toBe('true');
	});

	it('hint hidden when error is set', () => {
		render(TextField, { label: 'X', hint: 'Help', error: 'Bad' });
		expect(screen.queryByTestId('textfield-hint')).toBeNull();
	});
});

describe('TextField -- interaction', () => {
	it('typing fires input updates and reflects in the control value', async () => {
		const user = userEvent.setup();
		render(TextField, { label: 'Name' });
		const ctrl = screen.getByTestId('textfield-control') as HTMLInputElement;
		await user.type(ctrl, 'Abby');
		expect(ctrl.value).toBe('Abby');
	});

	it('disabled input rejects typing', async () => {
		const user = userEvent.setup();
		render(TextField, { label: 'X', disabled: true });
		const ctrl = screen.getByTestId('textfield-control') as HTMLInputElement;
		await user.type(ctrl, 'nope');
		expect(ctrl.value).toBe('');
	});
});

describe('TextField -- a11y', () => {
	it('marks required with a visible asterisk', () => {
		render(TextField, { label: 'Email', required: true });
		expect(screen.getByTestId('textfield-label').querySelector('.req')).not.toBeNull();
	});

	it('aria-describedby points at hint when hint is set', () => {
		render(TextField, { label: 'Email', name: 'email', hint: 'we never share' });
		const ctrl = screen.getByTestId('textfield-control');
		const describedBy = ctrl.getAttribute('aria-describedby') ?? '';
		expect(describedBy).toContain('tf-email-hint');
		expect(document.getElementById('tf-email-hint')?.textContent).toBe('we never share');
	});
});
