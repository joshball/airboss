/**
 * ThemePicker component tests -- a11y behaviors landed in PR #195.
 *
 * Runs under happy-dom via the `unit-dom` vitest project. Each test is
 * named for the behavior it pins so a regression points at the contract
 * the component is supposed to honor, not at an opaque step number.
 *
 * Scope is deliberately narrow: only `ThemePicker.svelte`. Other
 * components stay uncovered until we decide they're worth proving on
 * top of this infra.
 */

import { cleanup, render } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Theme registry is populated as a side effect of importing each theme
// module, mirroring the production wiring in `libs/themes/index.ts`.
import '../core/defaults/airboss-default/index';
import '../sim/glass/index';
import '../study/flightdeck/index';
import '../study/sectional/index';
import ThemePicker from '../picker/ThemePicker.svelte';
import { listThemes } from '../registry';
import { THEMES } from '../resolve';

const allThemes = listThemes();
const themeName = (id: string): string => {
	const match = allThemes.find((t) => t.id === id);
	if (!match) throw new Error(`Test setup: theme '${id}' not registered`);
	return match.name;
};

function getOptions(): HTMLButtonElement[] {
	return Array.from(document.querySelectorAll<HTMLButtonElement>('[data-theme-option]'));
}

function getTrigger(): HTMLElement {
	const summary = document.querySelector('summary');
	if (!(summary instanceof HTMLElement)) throw new Error('Test setup: trigger summary not found');
	return summary;
}

function getDetails(): HTMLDetailsElement {
	const details = document.querySelector('details.theme-picker');
	if (!(details instanceof HTMLDetailsElement)) throw new Error('Test setup: details element not found');
	return details;
}

afterEach(() => {
	cleanup();
});

describe('ThemePicker -- environment', () => {
	it('runs in a DOM environment (happy-dom) so component tests can mount', () => {
		expect(typeof document).toBe('object');
		expect(typeof window).toBe('object');
	});
});

describe('ThemePicker -- rendering', () => {
	it('renders the current theme name as the trigger label', () => {
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		const trigger = getTrigger();
		expect(trigger.textContent).toContain(themeName(THEMES.STUDY_SECTIONAL));
	});
});

describe('ThemePicker -- open/close behavior', () => {
	it('opens panel on trigger click and reflects state via aria-expanded', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		const trigger = getTrigger();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');

		await user.click(trigger);

		expect(getDetails().open).toBe(true);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
	});

	it('opens panel and focuses active option on ArrowDown when closed', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_FLIGHTDECK, onSelect });
		const trigger = getTrigger();
		trigger.focus();

		await user.keyboard('{ArrowDown}');

		expect(getDetails().open).toBe(true);
		const options = getOptions();
		const activeIdx = allThemes.findIndex((t) => t.id === THEMES.STUDY_FLIGHTDECK);
		expect(activeIdx).toBeGreaterThanOrEqual(0);
		expect(document.activeElement).toBe(options[activeIdx]);
	});
});

describe('ThemePicker -- keyboard navigation', () => {
	it('ArrowDown moves focus to next option, ArrowUp to previous, with wrap', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		// Pick the first registered theme so the active option is index 0
		// and ArrowUp wraps cleanly to the last.
		const firstId = allThemes[0]?.id;
		if (!firstId) throw new Error('Test setup: registry empty');
		render(ThemePicker, { currentThemeId: firstId, onSelect });
		const trigger = getTrigger();
		trigger.focus();
		await user.keyboard('{ArrowDown}');

		const options = getOptions();
		expect(options.length).toBe(allThemes.length);
		expect(document.activeElement).toBe(options[0]);

		await user.keyboard('{ArrowDown}');
		expect(document.activeElement).toBe(options[1]);

		await user.keyboard('{ArrowUp}');
		expect(document.activeElement).toBe(options[0]);

		// Wrap: ArrowUp from index 0 -> last option.
		await user.keyboard('{ArrowUp}');
		expect(document.activeElement).toBe(options[options.length - 1]);

		// Wrap forward: ArrowDown from last -> first.
		await user.keyboard('{ArrowDown}');
		expect(document.activeElement).toBe(options[0]);
	});

	it('Home focuses first option, End focuses last', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		const trigger = getTrigger();
		trigger.focus();
		await user.keyboard('{ArrowDown}');

		const options = getOptions();
		await user.keyboard('{End}');
		expect(document.activeElement).toBe(options[options.length - 1]);

		await user.keyboard('{Home}');
		expect(document.activeElement).toBe(options[0]);
	});
});

describe('ThemePicker -- selection', () => {
	it('Enter selects focused option, calls onSelect with theme id, returns focus to trigger', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		const trigger = getTrigger();
		trigger.focus();
		await user.keyboard('{ArrowDown}');

		// Walk to a different option than the active one.
		const activeIdx = allThemes.findIndex((t) => t.id === THEMES.STUDY_SECTIONAL);
		const targetIdx = activeIdx === 0 ? 1 : 0;
		const steps = (targetIdx - activeIdx + allThemes.length) % allThemes.length;
		for (let i = 0; i < steps; i += 1) {
			await user.keyboard('{ArrowDown}');
		}
		const targetId = allThemes[targetIdx]?.id;
		if (!targetId) throw new Error('Test setup: target theme missing');

		await user.keyboard('{Enter}');

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(targetId);
		expect(document.activeElement).toBe(trigger);
	});

	it('Space selects focused option', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		const trigger = getTrigger();
		trigger.focus();
		await user.keyboard('{ArrowDown}');

		const activeIdx = allThemes.findIndex((t) => t.id === THEMES.STUDY_SECTIONAL);
		const targetIdx = activeIdx === 0 ? 1 : 0;
		const steps = (targetIdx - activeIdx + allThemes.length) % allThemes.length;
		for (let i = 0; i < steps; i += 1) {
			await user.keyboard('{ArrowDown}');
		}
		const targetId = allThemes[targetIdx]?.id;
		if (!targetId) throw new Error('Test setup: target theme missing');

		await user.keyboard(' ');

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(targetId);
	});

	it('Escape closes panel and returns focus to trigger without calling onSelect', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		const trigger = getTrigger();
		trigger.focus();
		await user.keyboard('{ArrowDown}');
		expect(getDetails().open).toBe(true);

		await user.keyboard('{Escape}');

		expect(getDetails().open).toBe(false);
		expect(document.activeElement).toBe(trigger);
		expect(onSelect).not.toHaveBeenCalled();
	});
});

describe('ThemePicker -- ARIA', () => {
	it('renders role="listbox" with role="option" children, single-selection ARIA', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		await user.click(getTrigger());

		const listbox = document.querySelector('[role="listbox"]');
		expect(listbox).not.toBeNull();
		const options = Array.from(document.querySelectorAll('[role="option"]'));
		expect(options.length).toBe(allThemes.length);
		for (const option of options) {
			const id = option.id;
			const expectedSelected = id.endsWith(`-opt-${THEMES.STUDY_SECTIONAL}`);
			expect(option.getAttribute('aria-selected')).toBe(String(expectedSelected));
		}
	});

	it('aria-controls on trigger matches panel id', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		const trigger = getTrigger();
		await user.click(trigger);

		const panelId = trigger.getAttribute('aria-controls');
		expect(panelId).toBeTruthy();
		const panel = document.getElementById(panelId ?? '');
		expect(panel).not.toBeNull();
		expect(panel?.getAttribute('role')).toBe('listbox');
	});
});

describe('ThemePicker -- live region', () => {
	it('live region announces theme change after a selection', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		await user.click(getTrigger());

		// Click a different option directly so we don't depend on focus order.
		const targetId = allThemes.find((t) => t.id !== THEMES.STUDY_SECTIONAL)?.id ?? allThemes[0]?.id;
		if (!targetId) throw new Error('Test setup: no alternative theme');
		const option = document.querySelector<HTMLButtonElement>(`[id$="-opt-${targetId}"]`);
		if (!option) throw new Error('Test setup: target option not rendered');
		await user.click(option);

		const live = document.querySelector('[aria-live="polite"]');
		expect(live).not.toBeNull();
		expect(live?.textContent ?? '').toContain(`Theme changed to ${themeName(targetId)}`);
	});
});

describe('ThemePicker -- locked state', () => {
	it('trigger has aria-disabled and aria-describedby points to a non-empty description', () => {
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.SIM_GLASS, onSelect, locked: true });
		const trigger = getTrigger();

		expect(trigger.getAttribute('aria-disabled')).toBe('true');
		const describedBy = trigger.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		const desc = document.getElementById(describedBy ?? '');
		expect(desc).not.toBeNull();
		expect((desc?.textContent ?? '').trim().length).toBeGreaterThan(0);
	});

	it('locked panel reports the locked state via its aria-label', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.SIM_GLASS, onSelect, locked: true });
		// Force-open the panel via the details element so we can read the
		// listbox label even though click-to-open is suppressed by the
		// locked behavior tested elsewhere.
		const details = getDetails();
		details.open = true;
		details.dispatchEvent(new Event('toggle'));

		const listbox = document.querySelector('[role="listbox"]');
		expect(listbox?.getAttribute('aria-label')).toBe('Theme (locked on this route)');

		// All options are disabled when locked.
		for (const option of getOptions()) {
			expect(option.disabled).toBe(true);
		}
		// Re-reference user to keep the linter happy if userEvent setup
		// short-circuits in some happy-dom paths.
		void user;
	});

	it('locked state: clicking a disabled option does not call onSelect', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.SIM_GLASS, onSelect, locked: true });
		const details = getDetails();
		details.open = true;
		details.dispatchEvent(new Event('toggle'));

		const options = getOptions();
		const target = options.find((o) => o.id.endsWith(`-opt-${THEMES.STUDY_SECTIONAL}`));
		if (!target) throw new Error('Test setup: target option missing');
		await user.click(target);

		expect(onSelect).not.toHaveBeenCalled();
	});
});

describe('ThemePicker -- prefers-reduced-motion', () => {
	const originalMatchMedia = globalThis.matchMedia;

	beforeEach(() => {
		// happy-dom doesn't compute styles, so we cannot read
		// `getComputedStyle(chevron).transition`. We therefore verify the
		// component itself does not regress the CSS contract -- the
		// chevron is rendered with the documented class, and the
		// stylesheet (asserted by the source-of-truth read below) gates
		// its transition under `prefers-reduced-motion: reduce`.
		Object.defineProperty(globalThis, 'matchMedia', {
			configurable: true,
			value: (query: string) => ({
				matches: query.includes('prefers-reduced-motion: reduce'),
				media: query,
				onchange: null,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
				addListener: () => undefined,
				removeListener: () => undefined,
				dispatchEvent: () => false,
			}),
		});
	});

	afterEach(() => {
		if (originalMatchMedia) {
			Object.defineProperty(globalThis, 'matchMedia', {
				configurable: true,
				value: originalMatchMedia,
			});
		}
	});

	it('renders the chevron with the .chevron class so the reduced-motion @media rule can target it', () => {
		const onSelect = vi.fn();
		render(ThemePicker, { currentThemeId: THEMES.STUDY_SECTIONAL, onSelect });
		const chevron = document.querySelector('.chevron');
		expect(chevron).not.toBeNull();
		// happy-dom does not implement style computation for `@media`
		// queries, so we cannot directly assert `transition: none`. The
		// source-of-truth assertion lives in the stylesheet inside the
		// component (`@media (prefers-reduced-motion: reduce) .chevron
		// { transition: none }`); this test pins that the targeting class
		// is still rendered so the rule keeps applying. Skipping a
		// computed-style read with this comment instead of pretending to
		// test it.
	});
});
