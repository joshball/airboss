/**
 * Tabs DOM contract -- ARIA tablist semantics + arrow key nav + Home/End.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import TabsHarness from './harnesses/TabsHarness.svelte';

const tabs = [
	{ id: 'one', label: 'One' },
	{ id: 'two', label: 'Two' },
	{ id: 'three', label: 'Three' },
];

afterEach(() => {
	cleanup();
});

describe('Tabs -- rendering', () => {
	it('renders each tab as a button with role=tab and a tablist wrapper', () => {
		render(TabsHarness, { tabs });
		expect(screen.getByTestId('tabs-list').getAttribute('role')).toBe('tablist');
		for (const t of tabs) {
			const btn = screen.getByTestId(`tabs-item-${t.id}`);
			expect(btn.tagName).toBe('BUTTON');
			expect(btn.getAttribute('role')).toBe('tab');
			expect(btn.textContent?.trim()).toBe(t.label);
		}
	});

	it('first tab is selected by default and panel renders for it', () => {
		render(TabsHarness, { tabs });
		expect(screen.getByTestId('tabs-item-one').getAttribute('aria-selected')).toBe('true');
		expect(screen.getByTestId('tabs-item-one').getAttribute('data-state')).toBe('active');
		expect(screen.getByTestId('harness-panel-one')).toBeTruthy();
	});
});

describe('Tabs -- selection', () => {
	it('clicking a tab activates it and renders its panel', async () => {
		const user = userEvent.setup();
		render(TabsHarness, { tabs });
		await user.click(screen.getByTestId('tabs-item-two'));
		expect(screen.getByTestId('tabs-item-two').getAttribute('aria-selected')).toBe('true');
		expect(screen.getByTestId('tabs-item-one').getAttribute('aria-selected')).toBe('false');
		expect(screen.getByTestId('harness-panel-two')).toBeTruthy();
	});

	it('disabled tabs are skipped on click and have data-state=disabled', () => {
		const tabsWithDisabled = [tabs[0], { id: 'two', label: 'Two', disabled: true }, tabs[2]];
		render(TabsHarness, { tabs: tabsWithDisabled });
		expect(screen.getByTestId('tabs-item-two').getAttribute('data-state')).toBe('disabled');
		expect((screen.getByTestId('tabs-item-two') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('Tabs -- keyboard navigation', () => {
	it('ArrowRight moves to next tab; ArrowLeft to previous (with wrap)', async () => {
		const user = userEvent.setup();
		render(TabsHarness, { tabs });
		(screen.getByTestId('tabs-item-one') as HTMLButtonElement).focus();
		await user.keyboard('{ArrowRight}');
		expect(screen.getByTestId('tabs-item-two').getAttribute('aria-selected')).toBe('true');
		await user.keyboard('{ArrowLeft}');
		expect(screen.getByTestId('tabs-item-one').getAttribute('aria-selected')).toBe('true');
		await user.keyboard('{ArrowLeft}');
		expect(screen.getByTestId('tabs-item-three').getAttribute('aria-selected')).toBe('true');
	});

	it('Home jumps to first; End jumps to last', async () => {
		const user = userEvent.setup();
		render(TabsHarness, { tabs });
		(screen.getByTestId('tabs-item-one') as HTMLButtonElement).focus();
		await user.keyboard('{End}');
		expect(screen.getByTestId('tabs-item-three').getAttribute('aria-selected')).toBe('true');
		await user.keyboard('{Home}');
		expect(screen.getByTestId('tabs-item-one').getAttribute('aria-selected')).toBe('true');
	});
});

describe('Tabs -- panel a11y', () => {
	it('panel has role=tabpanel and aria-labelledby points at the active tab id', () => {
		render(TabsHarness, { tabs });
		const panel = screen.getByTestId('tabs-panel');
		expect(panel.getAttribute('role')).toBe('tabpanel');
		expect(panel.getAttribute('aria-labelledby')).toBe('tab-one');
	});
});
