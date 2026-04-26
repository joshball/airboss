/**
 * Select DOM contract -- label association, options, state, hint/error swap.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import Select, { type SelectOption } from '../src/components/Select.svelte';

const opts: SelectOption[] = [
	{ value: 'a', label: 'Alpha' },
	{ value: 'b', label: 'Bravo' },
	{ value: 'c', label: 'Charlie', disabled: true },
];

afterEach(() => {
	cleanup();
});

describe('Select -- rendering', () => {
	it('renders label and a <select> control', () => {
		render(Select, { label: 'Pick one', options: opts });
		expect(screen.getByTestId('select-label').textContent?.trim().startsWith('Pick one')).toBe(true);
		expect(screen.getByTestId('select-control').tagName).toBe('SELECT');
	});

	it('renders all options including a disabled one', () => {
		render(Select, { label: 'Pick', options: opts });
		const ctrl = screen.getByTestId('select-control') as HTMLSelectElement;
		expect(ctrl.options.length).toBe(3);
		expect(ctrl.options[2].disabled).toBe(true);
	});

	it('renders placeholder option when placeholder prop is set', () => {
		render(Select, { label: 'Pick', options: opts, placeholder: '-- choose --' });
		const ctrl = screen.getByTestId('select-control') as HTMLSelectElement;
		expect(ctrl.options.length).toBe(4);
		expect(ctrl.options[0].textContent).toBe('-- choose --');
		expect(ctrl.options[0].disabled).toBe(true);
	});
});

describe('Select -- a11y plumbing', () => {
	it('label for matches select id', () => {
		render(Select, { label: 'Type', name: 'kind', options: opts });
		const root = screen.getByTestId('select-root') as HTMLLabelElement;
		const ctrl = screen.getByTestId('select-control') as HTMLSelectElement;
		expect(root.getAttribute('for')).toBe(ctrl.id);
		expect(ctrl.id).toBe('sel-kind');
	});

	it('marks required with a visible asterisk', () => {
		render(Select, { label: 'Pick', options: opts, required: true });
		expect(screen.getByTestId('select-label').querySelector('.req')).not.toBeNull();
	});
});

describe('Select -- state', () => {
	it('default state is idle', () => {
		render(Select, { label: 'Pick', options: opts });
		expect(screen.getByTestId('select-root').getAttribute('data-state')).toBe('idle');
	});

	it('disabled=true reflects state=disabled', () => {
		render(Select, { label: 'Pick', options: opts, disabled: true });
		expect(screen.getByTestId('select-root').getAttribute('data-state')).toBe('disabled');
		expect((screen.getByTestId('select-control') as HTMLSelectElement).disabled).toBe(true);
	});

	it('error="message" reflects state=error, renders error region with role=alert, aria-invalid=true', () => {
		render(Select, { label: 'Pick', options: opts, error: 'Required' });
		expect(screen.getByTestId('select-root').getAttribute('data-state')).toBe('error');
		expect(screen.getByTestId('select-control').getAttribute('aria-invalid')).toBe('true');
		const err = screen.getByTestId('select-error');
		expect(err.textContent).toBe('Required');
		expect(err.getAttribute('role')).toBe('alert');
	});

	it('hint shows when there is no error; hidden when error is present', () => {
		const { rerender } = render(Select, { label: 'Pick', options: opts, hint: 'pick a thing' });
		expect(screen.getByTestId('select-hint').textContent).toBe('pick a thing');
		rerender({ label: 'Pick', options: opts, hint: 'pick', error: 'Required' });
		expect(screen.queryByTestId('select-hint')).toBeNull();
	});
});

describe('Select -- interaction', () => {
	it('user can change the selection', async () => {
		const user = userEvent.setup();
		render(Select, { label: 'Pick', options: opts, value: 'a' });
		const ctrl = screen.getByTestId('select-control') as HTMLSelectElement;
		expect(ctrl.value).toBe('a');
		await user.selectOptions(ctrl, 'b');
		// happy-dom + Svelte 5 binding flow: assert via the change reflecting
		// on the DOM control's value, which is what user code observes.
		expect(ctrl.value).toBe('b');
	});
});
