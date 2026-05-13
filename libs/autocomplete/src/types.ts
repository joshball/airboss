/**
 * Public types for the generic `@ab/autocomplete` library.
 *
 * The library ships an orthogonal text-input affordance: any host wraps an
 * input with `<Autocomplete>` and plugs in zero or more `AutocompleteSource`
 * implementations. The component handles trigger / highlight / commit; the
 * source decides WHAT matches.
 *
 * The library is intentionally agnostic of the command palette. The palette
 * is one consumer; future surfaces (header search bar, /library filter,
 * command palette Phase 4) plug in the same component with different
 * sources.
 *
 * Source of truth: `design/mockups/search/mockup-03-autocomplete.md` +
 * `docs/work-packages/command-palette/design.md` ("AutocompleteSource"
 * contract).
 */

/**
 * One row in the dropdown. `display` is the primary text, `secondary` is
 * an optional second column (e.g. doc code). `canonicalForm` is what
 * replaces the input on commit.
 */
export interface AutocompleteEntry {
	/** Stable id used for keyed iteration + a11y `aria-activedescendant`. */
	readonly id: string;
	/** Primary text -- the most prominent label in the dropdown row. */
	readonly display: string;
	/** Secondary text -- e.g. a doc code rendered to the right (R14). */
	readonly secondary?: string;
	/** What replaces the input's `value` when the user commits this entry. */
	readonly canonicalForm: string;
	/** Arbitrary host-specific payload passed back via `onCommit`. */
	readonly payload?: unknown;
	/**
	 * Stable kind identifier for the source that produced the entry. Used
	 * for analytics + grouping but not required for rendering. The source
	 * supplies its own `id`; this field lets a host filter or style by
	 * source without inspecting `payload`.
	 */
	readonly sourceId?: string;
}

/**
 * Pluggable suggestion provider. Given the current input, returns either
 * a non-empty list of matches (the dropdown opens), an empty list (the
 * source had no matches), or `null` (the input doesn't fit this source's
 * trigger -- a different source might claim it).
 *
 * Sources are pure functions of the input. They MUST NOT do I/O on the
 * critical path -- the component calls `match()` on every keystroke.
 */
export interface AutocompleteSource {
	/** Stable id (e.g. `doc-code`, `title-prefix`, `command`). */
	readonly id: string;
	/**
	 * Inspect the input. Return matches when the source applies. Return
	 * `null` to defer to the next source; return `[]` when the source
	 * applies but has zero rows so the dropdown can render an empty
	 * state instead of silently switching to a peer source.
	 */
	match(input: string): readonly AutocompleteEntry[] | null;
}

/**
 * Component props for `<Autocomplete>`. Bindable `value` so the host can
 * read the input value back without prop-drilling listeners.
 */
export interface AutocompleteProps {
	/** Bindable input value. */
	value: string;
	/** Pluggable suggestion sources, evaluated in order. */
	readonly sources: readonly AutocompleteSource[];
	/**
	 * Called when the user commits an entry via Tab / Enter (dropdown
	 * open). Replaces `value` with the entry's `canonicalForm` already;
	 * the callback only needs to surface side-effects (analytics, host
	 * state updates).
	 */
	onCommit: (entry: AutocompleteEntry) => void;
	/**
	 * Called when the user commits with the meta/ctrl modifier held.
	 * Hosts use this to apply an entry as a filter chip (e.g.
	 * `doc:<code>`) rather than just replacing the input value.
	 * Defaults to `onCommit` when omitted.
	 */
	onCommitMeta?: (entry: AutocompleteEntry) => void;
	/** Called when the user dismisses the dropdown with Esc. */
	onDismiss?: () => void;
	/**
	 * Called when the input fires Enter while the dropdown is CLOSED.
	 * Lets the host run a search / submit; the component never opens or
	 * closes the host modal itself.
	 */
	onEnter?: () => void;
	/** Input placeholder text. */
	placeholder?: string;
	/** Accessible label for the input. */
	ariaLabel?: string;
	/** Optional id for the input itself (a11y + form association). */
	inputId?: string;
	/**
	 * Optional `data-testid` stamped on the root element so host tests
	 * can scope queries to a specific autocomplete instance.
	 */
	testId?: string;
	/**
	 * Whether the input is initially focused on mount. Defaults to false
	 * so multiple instances on a page don't race for focus.
	 */
	autofocus?: boolean;
}
