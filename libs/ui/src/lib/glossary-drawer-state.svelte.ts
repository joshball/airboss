/**
 * Glossary drawer state machine (study-app-ia-cleanup Phase 3).
 *
 * Lives in `.svelte.ts` so the runes work outside a component, which
 * keeps the open/close + selection logic unit-testable without a DOM
 * harness. The drawer component (`GlossaryDrawer.svelte`) constructs an
 * instance per mount; consumers can also construct an instance and pass
 * it in to drive the drawer from a global keyboard shortcut.
 *
 * The state is intentionally narrow:
 *
 *   - `open`: whether the drawer is visible.
 *   - `query`: search field contents (case-insensitive substring filter
 *     over `term`, `short`, and `long`).
 *   - `selected`: glossary key whose long-form body is expanded inline,
 *     or `null` when only the search list is shown.
 *
 * Helpers (`open()`, `close()`, `toggle()`, `select()`, `clearSelection()`,
 * `setQuery()`) keep transitions explicit so the unit tests can read like
 * a flow.
 */

export class GlossaryDrawerState {
	open = $state(false);
	query = $state('');
	selected = $state<string | null>(null);

	openDrawer(): void {
		this.open = true;
	}

	closeDrawer(): void {
		this.open = false;
		// Reset selection on close so the next open shows the index, not
		// whatever entry the user expanded last visit. Query is kept so a
		// user who half-typed and got distracted resumes where they left
		// off; clearing on close was a real footgun in the v1 InfoTip
		// drawer.
		this.selected = null;
	}

	toggle(): void {
		if (this.open) {
			this.closeDrawer();
		} else {
			this.openDrawer();
		}
	}

	setQuery(value: string): void {
		this.query = value;
		// Typing into the search clears any expanded entry so the list
		// re-filters live; the user can re-select after.
		this.selected = null;
	}

	select(key: string): void {
		this.selected = key;
	}

	clearSelection(): void {
		this.selected = null;
	}
}
