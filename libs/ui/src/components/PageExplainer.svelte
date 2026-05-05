<script lang="ts">
/**
 * "Why am I here?" page explainer.
 *
 * A collapsible 2-3 sentence block that opens at the top of a page to
 * tell the learner what they're looking at, who it's for, and what they
 * should do. Open by default; the user can collapse it per-page (the
 * dismissal sticks across reloads / devices) or hide all explainers
 * globally via Settings.
 *
 * Persistence: the parent route's server `load` reads the dismissal map
 * from `study.user_pref` (`study.page_explainer.dismissed`) and passes
 * the boolean for this `pageKey` in via the `dismissed` prop. Collapse
 * / un-collapse posts to `ROUTES.API_PAGE_EXPLAINER`, which upserts the
 * row through `setPageExplainerDismissal` and emits an audit entry.
 *
 * The local `dismissed` state mirrors the server value so the UI
 * responds instantly; on a network failure we revert and surface no
 * inline error UI (the action is non-load-bearing -- the user can just
 * click again).
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
 *     the user re-opens for this visit only ("peek").
 */

import { ROUTES } from '@ab/constants';
import { type Snippet, untrack } from 'svelte';

interface Props {
	/** Stable key for this page's explainer (e.g. `home`, `program-goal`). Used as the dismissal map key. */
	pageKey: string;
	/** Heading shown above the body when expanded. Default: "Why am I here?" */
	title?: string;
	/** Body content. 2-3 sentences. */
	children: Snippet;
	/** Initial dismissal state for this `pageKey`, sourced from the server load. */
	dismissed?: boolean;
	/** When true (read from Settings), all explainers default to collapsed. The per-page `?` still re-opens. */
	globallyHidden?: boolean;
}

const {
	pageKey,
	title = 'Why am I here?',
	children,
	dismissed: initialDismissed = false,
	globallyHidden = false,
}: Props = $props();

/**
 * Optimistic local mirror of the dismissal flag. Seeded from the
 * server-rendered prop and then driven by `persistDismissal` / peek
 * state. `untrack` keeps Svelte 5 from warning about a one-shot read
 * of a reactive prop into a `$state` initializer. Do not inline the
 * call back to `$state(initialDismissed)` -- the warning will resurface
 * and the seed will start tracking the prop, which we don't want
 * (subsequent updates flow through fetch + our own writes).
 */
let dismissed = $state(untrack(() => initialDismissed));
/** Set true when the user clicks the `?` to peek even though dismissal is sticky. Resets on next mount. */
let peek = $state(false);

// `expanded` rolls global toggle + per-page dismissal + peek into the
// effective open/closed state.
const collapsed = $derived(globallyHidden || dismissed);
const expanded = $derived(peek || !collapsed);

async function persistDismissal(value: boolean): Promise<boolean> {
	try {
		const response = await fetch(ROUTES.API_PAGE_EXPLAINER, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pageKey, dismissed: value }),
		});
		return response.ok;
	} catch {
		return false;
	}
}

async function handleCollapse() {
	const previous = dismissed;
	dismissed = true;
	peek = false;
	const ok = await persistDismissal(true);
	if (!ok) {
		// Roll back optimistic UI on failure. Action is non-load-bearing,
		// so we surface no inline error -- the user can click again.
		// We log the failure so it's visible in dev / DevTools; a future
		// toast subsystem can subscribe (see TEMP_FIXES.md
		// "PageExplainer dismissal failure toast").
		// biome-ignore lint/suspicious/noConsole: failure-path observability
		console.warn('PageExplainer: dismissal POST failed; reverting optimistic state.');
		dismissed = previous;
	}
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
					aria-label={peek ? 'Hide page explainer' : "Don't show this page explainer again"}
					onclick={peek ? handleHidePeek : handleCollapse}
					data-testid="page-explainer-collapse"
				>
					{peek ? 'Hide' : "Don't show again"}
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
		border-left: 3px solid var(--action-default);
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
		font-size: var(--font-size-base);
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
