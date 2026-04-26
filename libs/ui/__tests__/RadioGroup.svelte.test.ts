/**
 * RadioGroup DOM contract -- selection state, fieldset disabled, arrow-key nav.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import RadioGroup, { type RadioOption } from '../src/components/RadioGroup.svelte';

const opts: RadioOption[] = [
	{ value: 'a', label: 'Alpha' },
	{ value: 'b', label: 'Bravo' },
	{ value: 'c', label: 'Charlie' },
];

afterEach(() => {
	cleanup();
});

describe('RadioGroup -- rendering', () => {
	it('renders fieldset, legend, and one row per option', () => {
		render(RadioGroup, { name: 'kind', options: opts, legend: 'Kind' });
		expect(screen.getByTestId('radiogroup-root').tagName).toBe('FIELDSET');
		expect(screen.getByTestId('radiogroup-legend').textContent).toBe('Kind');
		for (const opt of opts) {
			expect(screen.getByTestId(`radiogroup-item-${opt.value}`)).toBeTruthy();
			expect(screen.getByTestId(`radiogroup-input-${opt.value}`).tagName).toBe('INPUT');
		}
	});

	it('list has role=radiogroup', () => {
		render(RadioGroup, { name: 'kind', options: opts });
		expect(screen.getByTestId('radiogroup-list').getAttribute('role')).toBe('radiogroup');
	});
});

describe('RadioGroup -- selection state', () => {
	it('initial value reflected as checked input + state=selected', () => {
		render(RadioGroup, { name: 'kind', options: opts, value: 'b' });
		expect((screen.getByTestId('radiogroup-input-b') as HTMLInputElement).checked).toBe(true);
		expect(screen.getByTestId('radiogroup-item-b').getAttribute('data-state')).toBe('selected');
		expect(screen.getByTestId('radiogroup-item-a').getAttribute('data-state')).toBe('idle');
	});

	it('clicking an unselected radio marks it checked', async () => {
		const user = userEvent.setup();
		render(RadioGroup, { name: 'kind', options: opts, value: 'a' });
		await user.click(screen.getByTestId('radiogroup-input-c'));
		expect((screen.getByTestId('radiogroup-input-c') as HTMLInputElement).checked).toBe(true);
		expect((screen.getByTestId('radiogroup-input-a') as HTMLInputElement).checked).toBe(false);
	});
});

describe('RadioGroup -- disabled', () => {
	it('group-level disabled reflects state=disabled and disables every input', () => {
		render(RadioGroup, { name: 'kind', options: opts, disabled: true });
		expect(screen.getByTestId('radiogroup-root').getAttribute('data-state')).toBe('disabled');
		for (const opt of opts) {
			expect((screen.getByTestId(`radiogroup-input-${opt.value}`) as HTMLInputElement).disabled).toBe(true);
		}
	});

	it('per-option disabled disables only that input', () => {
		const optsWithDisabled: RadioOption[] = [...opts.slice(0, 2), { value: 'c', label: 'Charlie', disabled: true }];
		render(RadioGroup, { name: 'kind', options: optsWithDisabled });
		expect((screen.getByTestId('radiogroup-input-c') as HTMLInputElement).disabled).toBe(true);
		expect((screen.getByTestId('radiogroup-input-a') as HTMLInputElement).disabled).toBe(false);
	});
});

describe('RadioGroup -- keyboard navigation', () => {
	it('ArrowDown moves selection from current to next', async () => {
		const user = userEvent.setup();
		render(RadioGroup, { name: 'kind', options: opts, value: 'a' });
		const a = screen.getByTestId('radiogroup-input-a') as HTMLInputElement;
		a.focus();
		await user.keyboard('{ArrowDown}');
		expect(document.activeElement?.getAttribute('data-testid')).toBe('radiogroup-input-b');
		expect((screen.getByTestId('radiogroup-input-b') as HTMLInputElement).checked).toBe(true);
	});

	it('ArrowUp from first wraps to last', async () => {
		const user = userEvent.setup();
		render(RadioGroup, { name: 'kind', options: opts, value: 'a' });
		(screen.getByTestId('radiogroup-input-a') as HTMLInputElement).focus();
		await user.keyboard('{ArrowUp}');
		expect(document.activeElement?.getAttribute('data-testid')).toBe('radiogroup-input-c');
	});

	it('Home focuses first, End focuses last', async () => {
		const user = userEvent.setup();
		render(RadioGroup, { name: 'kind', options: opts, value: 'b' });
		(screen.getByTestId('radiogroup-input-b') as HTMLInputElement).focus();
		await user.keyboard('{End}');
		expect(document.activeElement?.getAttribute('data-testid')).toBe('radiogroup-input-c');
		await user.keyboard('{Home}');
		expect(document.activeElement?.getAttribute('data-testid')).toBe('radiogroup-input-a');
	});
});
