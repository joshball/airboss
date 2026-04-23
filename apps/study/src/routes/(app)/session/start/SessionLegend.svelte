<script lang="ts">
/**
 * Collapsible "What am I looking at?" legend for the session preview.
 *
 * The first time a user hits `/session/start` (no localStorage key set)
 * the legend opens so they can get oriented. After that, open/closed
 * state is persisted under `airboss:session-start-legend-open`, so
 * returning users get the slimmer preview they already know.
 *
 * Uses a `<details>` element so the expand/collapse is browser-native,
 * keyboard-accessible, and respects reduced-motion without custom work.
 * The `bind:open` directive is authoritative for state; the effect that
 * writes localStorage is a one-way sync (state -> storage).
 */

import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';

const STORAGE_KEY = 'airboss:session-start-legend-open';

function readInitialOpen(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		// First visit: no key yet -> default open so users get the guided
		// explanation. After they toggle once, respect the stored choice.
		if (raw === null) return true;
		return raw === '1';
	} catch {
		return false;
	}
}

// svelte-ignore state_referenced_locally -- seed once on mount; $effect keeps storage in sync
let open = $state(readInitialOpen());

$effect(() => {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
	} catch {
		// Storage disabled, quota full, private browsing -- silently degrade.
	}
});
</script>

<details class="legend" bind:open>
	<summary class="legend-summary">
		<span class="summary-text">What am I looking at?</span>
		<span class="summary-chev" aria-hidden="true">▾</span>
	</summary>
	<div class="legend-body">
		<p class="lede">
			Each row in the preview is one item the engine wants you to work on. Every row carries four pieces of
			information that explain why it's there.
		</p>

		<div class="example" aria-label="Annotated example row">
			<div class="example-row">
				<span class="ex-kind">Card</span>
				<span class="ex-reason">Overdue</span>
				<span class="ex-id">card_01HZ...</span>
			</div>

			<dl class="callouts">
				<div class="callout">
					<dt>Slice</dt>
					<dd>Heading above the row (Continue / Strengthen / Expand / Diversify). Tells you the strategy driving the pick.</dd>
				</div>
				<div class="callout">
					<dt>Kind</dt>
					<dd>Badge showing whether the row is a Card, Rep, or Node. Determines the experience when you reach it.</dd>
				</div>
				<div class="callout">
					<dt>Reason</dt>
					<dd>Short label like "Overdue" or "Core topic, unstarted" that names the signal the engine used.</dd>
				</div>
				<div class="callout">
					<dt>ID</dt>
					<dd>Click to open the underlying card, scenario, or node detail page before starting.</dd>
				</div>
			</dl>
		</div>

		<Button variant="secondary" href={ROUTES.HELP_ID('session-start')}>Read the full guide</Button>
	</div>
</details>

<style>
	.legend {
		background: var(--ab-color-surface-sunken);
		border: 1px dashed var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-md) var(--ab-space-lg);
	}

	.legend[open] {
		background: var(--ab-color-surface-raised);
		border-style: solid;
		border-color: var(--ab-color-border);
	}

	.legend-summary {
		list-style: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--ab-space-sm);
		font-weight: var(--ab-font-weight-semibold);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg);
	}

	.legend-summary::-webkit-details-marker {
		display: none;
	}

	.legend-summary:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
		border-radius: var(--ab-radius-sm);
	}

	.summary-chev {
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
		transition: transform var(--ab-transition-fast);
	}

	.legend[open] .summary-chev {
		transform: rotate(180deg);
	}

	.legend-body {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
		margin-top: var(--ab-space-md);
	}

	.lede {
		margin: 0;
		color: var(--ab-color-fg-muted);
		font-size: var(--ab-font-size-sm);
		line-height: var(--ab-line-height-normal);
	}

	.example {
		background: var(--ab-color-surface);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-sm);
		padding: var(--ab-space-md);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
	}

	.example-row {
		display: flex;
		gap: var(--ab-space-sm);
		align-items: baseline;
		padding: var(--ab-space-xs) var(--ab-space-md);
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-sm);
		font-size: var(--ab-font-size-sm);
	}

	.ex-kind {
		display: inline-block;
		font-weight: var(--ab-font-weight-bold);
		font-size: var(--ab-font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: var(--ab-space-2xs) var(--ab-space-xs);
		border-radius: var(--ab-radius-sm);
		background: var(--ab-color-border);
		color: var(--ab-color-fg-muted);
	}

	.ex-reason {
		color: var(--ab-color-fg);
		font-weight: var(--ab-font-weight-medium);
	}

	.ex-id {
		margin-left: auto;
		color: var(--ab-color-fg-faint);
		font-family: var(--ab-font-family-mono, ui-monospace, monospace);
		font-size: var(--ab-font-size-xs);
	}

	.callouts {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--ab-space-xs) var(--ab-space-md);
		font-size: var(--ab-font-size-sm);
	}

	.callout {
		display: contents;
	}

	.callouts dt {
		font-weight: var(--ab-font-weight-semibold);
		color: var(--ab-color-fg);
	}

	.callouts dd {
		margin: 0;
		color: var(--ab-color-fg-muted);
		line-height: var(--ab-line-height-normal);
	}
</style>
