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
		background: var(--surface-sunken);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
	}

	.legend[open] {
		background: var(--surface-raised);
		border-style: solid;
		border-color: var(--edge-default);
	}

	.legend-summary {
		list-style: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		font-weight: var(--type-heading-3-weight);
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	.legend-summary::-webkit-details-marker {
		display: none;
	}

	.legend-summary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.summary-chev {
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
		transition: transform var(--motion-fast);
	}

	.legend[open] .summary-chev {
		transform: rotate(180deg);
	}

	.legend-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin-top: var(--space-md);
	}

	.lede {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		line-height: var(--type-ui-label-line-height);
	}

	.example {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.example-row {
		display: flex;
		gap: var(--space-sm);
		align-items: baseline;
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-label-size);
	}

	.ex-kind {
		display: inline-block;
		font-weight: var(--type-heading-1-weight);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-sm);
		background: var(--edge-default);
		color: var(--ink-muted);
	}

	.ex-reason {
		color: var(--ink-body);
		font-weight: var(--type-ui-control-weight);
	}

	.ex-id {
		margin-left: auto;
		color: var(--ink-faint);
		font-family: var(--font-family-mono, ui-monospace, monospace);
		font-size: var(--type-ui-caption-size);
	}

	.callouts {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-xs) var(--space-md);
		font-size: var(--type-ui-label-size);
	}

	.callout {
		display: contents;
	}

	.callouts dt {
		font-weight: var(--type-heading-3-weight);
		color: var(--ink-body);
	}

	.callouts dd {
		margin: 0;
		color: var(--ink-muted);
		line-height: var(--type-ui-label-line-height);
	}
</style>
