<script lang="ts">
import { detectDocCodeIntent, lookupDocsByCode } from '@ab/aviation';
import type { DocCodeFamily } from '@ab/aviation';

/**
 * VSCode-style doc-code dropdown rendered under the palette input.
 *
 * Trigger: `detectDocCodeIntent(query)`. When the intent is confident OR
 * looks like a partial known family pattern (bare digits, `FAA-H-`, ...),
 * the dropdown surfaces matching documents from the aviation registry.
 *
 * Key model (forwarded by the parent palette via `handleKey`):
 *   - ↑ / ↓                 move highlight inside the dropdown
 *   - Enter                 open the highlighted doc (full navigation)
 *   - Cmd/Ctrl + Enter      set `doc:<code>` filter chip and dismiss
 *   - Esc                   dismiss the dropdown (palette stays open)
 *
 * A11y: APG combobox pattern. Parent input carries `aria-controls`,
 * `aria-expanded`, `aria-activedescendant`; this component is the
 * `role=listbox` and entries are `role=option`.
 */

interface Props {
	/** Current raw query from the input (parent owns the input state). */
	query: string;
	/**
	 * True if the parent considers the dropdown "visible" (used so the
	 * parent can dismiss-but-not-unmount on Esc and re-show on the next
	 * keystroke without losing highlight if we wanted that; today the
	 * dropdown derives its visibility from `query` alone).
	 */
	open?: boolean;
	/** Stable id so the parent input can wire `aria-controls`. */
	id?: string;
	/** Called when the user picks a doc with Enter -- opens the doc directly. */
	onPick: (doc: DocEntry) => void;
	/** Called when the user picks a doc with Cmd+Enter -- set filter chip. */
	onFilter: (doc: DocEntry) => void;
	/** Called when the user dismisses with Esc (parent typically refocuses input). */
	onDismiss: () => void;
}

export interface DocEntry {
	readonly id: string;
	readonly displayName: string;
	readonly code: string;
	readonly abbreviation: string | null;
}

let { query, open = true, id = 'palette-doc-autocomplete', onPick, onFilter, onDismiss }: Props = $props();

const intent = $derived(detectDocCodeIntent(query));

/** Visible matches; empty if intent doesn't fire. */
const matches = $derived<readonly DocEntry[]>(buildMatches(query, intent));

let highlighted = $state(0);

// Reset highlight when the match set changes shape so the user always starts
// at the top of the dropdown after a fresh keystroke.
$effect(() => {
	void matches.length;
	highlighted = 0;
});

function buildMatches(q: string, _intent: ReturnType<typeof detectDocCodeIntent>): readonly DocEntry[] {
	void _intent;
	const trimmed = q.trim();
	if (!trimmed) return [];
	const intentOnFragment = detectDocCodeIntent(trimmed);
	if (!intentOnFragment) return [];
	const family: DocCodeFamily = intentOnFragment.family;
	const fragment = intentOnFragment.fragment;
	const result = lookupDocsByCode(fragment, { family, limit: 12 });
	if (result.length > 0) return result;
	// Trigger fired but no matches -- fall back to a family listing so
	// "FAA-H-" alone still shows the handbook family alphabetically (per
	// Decision #6 in spec.md: empty doc-picker order is alphabetical).
	const all = lookupDocsByCode('', { family, limit: 24 });
	return [...all].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** True when there is at least one match the dropdown should render. */
export function hasMatches(): boolean {
	return matches.length > 0;
}

/**
 * Forwarded key handler. Returns true if the event was consumed by the
 * dropdown (the parent must NOT advance its own selection in that case).
 * Returns false for keys we don't claim so the parent's input keymap
 * still runs.
 */
export function handleKey(event: KeyboardEvent): boolean {
	if (!open || matches.length === 0) return false;
	if (event.key === 'ArrowDown') {
		event.preventDefault();
		highlighted = (highlighted + 1) % matches.length;
		return true;
	}
	if (event.key === 'ArrowUp') {
		event.preventDefault();
		highlighted = (highlighted - 1 + matches.length) % matches.length;
		return true;
	}
	if (event.key === 'Escape') {
		event.preventDefault();
		onDismiss();
		return true;
	}
	if (event.key === 'Enter') {
		const meta = event.metaKey || event.ctrlKey;
		const chosen = matches[highlighted];
		if (!chosen) return false;
		event.preventDefault();
		if (meta) {
			onFilter(chosen);
		} else {
			onPick(chosen);
		}
		return true;
	}
	return false;
}

function clickPick(doc: DocEntry, ev: MouseEvent): void {
	if (ev.metaKey || ev.ctrlKey) {
		ev.preventDefault();
		onFilter(doc);
		return;
	}
	onPick(doc);
}
</script>

{#if open && matches.length > 0}
	<ul
		class="dropdown"
		role="listbox"
		aria-label="Matching documents"
		{id}
		data-testid="palette-doc-autocomplete"
	>
		{#each matches as doc, index (doc.id)}
			<li
				role="option"
				aria-selected={index === highlighted}
				id="palette-doc-autocomplete-{index}"
				class:highlighted={index === highlighted}
			>
				<!-- svelte-ignore a11y_click_events_have_key_events -- keyboard
					navigation lives on the parent input via handleKey() (APG combobox
					pattern); the listbox itself is mouse-only. -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<button
					type="button"
					class="entry"
					onclick={(ev) => clickPick(doc, ev)}
					data-testid="palette-doc-autocomplete-entry"
					data-doc-code={doc.code}
				>
					<span class="code">{doc.code}</span>
					<span class="name">{doc.displayName}</span>
					{#if doc.abbreviation}
						<span class="abbrev">{doc.abbreviation}</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.dropdown {
		list-style: none;
		margin: 0;
		padding: var(--space-2xs);
		max-height: 18rem;
		overflow-y: auto;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-top: 0;
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	li {
		list-style: none;
	}

	.entry {
		display: grid;
		grid-template-columns: 9rem 1fr auto;
		align-items: baseline;
		gap: var(--space-sm);
		width: 100%;
		text-align: left;
		font: inherit;
		font-size: var(--font-size-sm);
		padding: var(--space-2xs) var(--space-sm);
		border: 0;
		background: transparent;
		color: inherit;
		border-radius: var(--radius-xs);
		cursor: pointer;
		transition: background var(--palette-motion-duration-xs) var(--palette-motion-ease-out);
	}

	.entry:hover,
	li.highlighted .entry {
		background: var(--palette-accent-amber-wash);
		color: var(--ink-body);
	}

	.code {
		font-family: var(--font-family-mono);
		color: var(--palette-accent-amber);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-xs);
	}

	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.abbrev {
		font-size: var(--font-size-xs);
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}
</style>
