<script lang="ts">
/**
 * "Why am I here?" page explainer.
 *
 * A collapsible 2-3 sentence block that opens at the top of a page to
 * tell the learner what they're looking at, who it's for, and what they
 * should do. Open by default; the user can collapse it per-page (the
 * dismissal sticks across reloads) or hide all explainers globally
 * via Settings.
 *
 * Persistence (Phase 1): per-page dismissal lives in `localStorage`.
 * Single-device persistence is acceptable -- this is not load-bearing
 * data. When the prefs schema gains a `page_explainer_dismissal` table
 * (or JSONB column) the storage seam below is the only thing that
 * needs to move.
 *
 * The global "Hide page explainers" toggle is read from Settings via
 * the `globallyHidden` prop; the layout that mounts the explainer is
 * responsible for sourcing that flag.
 *
 * A11y:
 *
 *   - The collapse / re-open control is a real `<button>` with an
 *     `aria-expanded` reflecting current state.
 *   - When collapsed, a small `?` button stays visible to re-open the
 *     explainer; opening it does NOT delete the persisted dismissal --
 *     the user re-opens for this visit only.
 */

import { type Snippet, untrack } from 'svelte';

interface Props {
	/** Stable key for this page's explainer (e.g. `home`, `program-goal`). Used for the localStorage key. */
	pageKey: string;
	/** Heading shown above the body when expanded. Default: "Why am I here?" */
	title?: string;
	/** Body content. 2-3 sentences. */
	children: Snippet;
	/** When true (read from Settings), all explainers default to collapsed. The per-page `?` still re-opens. */
	globallyHidden?: boolean;
}

const { pageKey, title = 'Why am I here?', children, globallyHidden = false }: Props = $props();

const STORAGE_PREFIX = 'airboss.page-explainer.dismissed.';

function readDismissal(key: string): boolean {
	if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false;
	try {
		return window.localStorage.getItem(STORAGE_PREFIX + key) === '1';
	} catch {
		return false;
	}
}

function writeDismissal(key: string, dismissed: boolean): void {
	if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
	try {
		if (dismissed) window.localStorage.setItem(STORAGE_PREFIX + key, '1');
		else window.localStorage.removeItem(STORAGE_PREFIX + key);
	} catch {
		// Quota / private mode -- non-fatal. Falls back to per-tab state.
	}
}

let dismissed = $state(false);
/** Set true when the user clicks the `?` to peek even though dismissal is sticky. Resets on next mount. */
let peek = $state(false);

// Read the persisted state once on mount. Untracked so it doesn't loop
// on subsequent state writes.
$effect(() => {
	const k = pageKey;
	untrack(() => {
		dismissed = readDismissal(k);
	});
});

// `expanded` rolls global toggle + per-page dismissal + peek into the
// effective open/closed state.
const collapsed = $derived(globallyHidden || dismissed);
const expanded = $derived(peek || !collapsed);

function handleCollapse() {
	dismissed = true;
	peek = false;
	writeDismissal(pageKey, true);
}

function handlePeek() {
	peek = true;
}

function handleHidePeek() {
	peek = false;
}
</script>

<aside class="page-explainer" data-testid="page-explainer-root" data-page-key={pageKey}>
	{#if expanded}
		<div class="body" data-testid="page-explainer-body">
			<div class="header">
				<h2 class="title">{title}</h2>
				<button
					type="button"
					class="control"
					aria-expanded="true"
					aria-controls="page-explainer-{pageKey}-body"
					onclick={peek ? handleHidePeek : handleCollapse}
					data-testid="page-explainer-collapse"
				>
					Hide
				</button>
			</div>
			<div id="page-explainer-{pageKey}-body" class="copy">
				{@render children()}
			</div>
		</div>
	{:else}
		<button
			type="button"
			class="reopen"
			aria-expanded="false"
			aria-label="Show page explainer"
			onclick={handlePeek}
			data-testid="page-explainer-reopen"
		>
			?
		</button>
	{/if}
</aside>

<style>
	.page-explainer {
		display: block;
	}

	.body {
		border: 1px solid var(--edge-default);
		border-left: 3px solid var(--action-default-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		padding: var(--space-md) var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
	}

	.title {
		margin: 0;
		font-size: var(--font-size-md);
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-body);
	}

	.copy {
		color: var(--ink-muted);
		line-height: 1.5;
	}

	.control {
		font: inherit;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		cursor: pointer;
	}

	.control:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.reopen {
		font: inherit;
		font-weight: bold;
		font-size: var(--font-size-sm);
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: var(--ink-muted);
		cursor: pointer;
	}

	.reopen:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}
</style>
