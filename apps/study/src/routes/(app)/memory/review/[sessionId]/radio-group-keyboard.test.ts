/**
 * Unit tests for the roving-focus + tab-index helpers used by the
 * memory-review confidence and feedback radio groups.
 *
 * Pre-fix the page used `role="radio"` buttons inside a `role="radiogroup"`
 * with every button as its own tab stop and no arrow-key handling. Post-
 * fix these helpers implement the WAI-ARIA radio-group keyboard contract.
 *
 * Test runs in node (no DOM globals) and constructs a minimal fixture by
 * driving event handlers directly with handcrafted DOM-like objects -- the
 * helper only needs `currentTarget`, `closest`, `querySelectorAll`,
 * `dataset.radioValue`, and `focus()`. Where the helper expects an
 * `HTMLElement` we use happy-dom via the unit-dom project, but for the
 * pure tabindex-rule unit we keep it node-friendly.
 *
 * happy-dom DOM tests live in `radio-group-keyboard.svelte.test.ts` so
 * the keyboard interaction is exercised end-to-end against real elements.
 */

import { describe, expect, it } from 'vitest';
import { rovingTabIndex } from './radio-group-keyboard';

describe('rovingTabIndex -- selected value present', () => {
	it('returns 0 only on the selected item', () => {
		const values = [1, 2, 3, 4, 5] as const;
		expect(rovingTabIndex(values, 3, 1)).toBe(-1);
		expect(rovingTabIndex(values, 3, 3)).toBe(0);
		expect(rovingTabIndex(values, 3, 5)).toBe(-1);
	});
});

describe('rovingTabIndex -- nothing selected', () => {
	it('returns 0 on the first item, -1 on the rest, so keyboard users can enter the group', () => {
		const values = ['a', 'b', 'c'] as const;
		expect(rovingTabIndex(values, null, 'a')).toBe(0);
		expect(rovingTabIndex(values, null, 'b')).toBe(-1);
		expect(rovingTabIndex(values, null, 'c')).toBe(-1);
	});

	it('handles a single-item group: that one item is the tab stop', () => {
		const values = ['only'] as const;
		expect(rovingTabIndex(values, null, 'only')).toBe(0);
		expect(rovingTabIndex(values, 'only', 'only')).toBe(0);
	});

	it('returns -1 when an item is not in the values list (defensive)', () => {
		const values = [1, 2, 3];
		expect(rovingTabIndex(values, null, 99)).toBe(-1);
	});
});
