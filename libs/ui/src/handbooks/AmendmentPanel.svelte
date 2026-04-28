<script lang="ts">
import { HANDBOOK_AMENDMENT_BADGE_LABEL } from '@ab/constants';
import ErrataEntry, { type ErrataEntryDisplay } from './ErrataEntry.svelte';

/**
 * Amendment panel mounted on a handbook reader section page when one or
 * more errata rows have been applied to that section. The badge ("Amended"
 * by default) is a button that toggles a panel of {@link ErrataEntry}
 * rows, newest first. Panel state is local component state with no
 * persistence -- per ADR 020, learners reach for this only when curious
 * about a specific change.
 *
 * Rendering nothing for an empty entries list is a deliberate quiet path:
 * the reader page may pass `[]` when no errata exist; the component
 * doesn't render the badge in that case so the section header stays
 * uncluttered.
 */

let {
	entries,
	initiallyOpen = false,
}: {
	entries: ErrataEntryDisplay[];
	initiallyOpen?: boolean;
} = $props();

// Capture the initial prop value as the seed and own the open/closed
// state from there. Subsequent prop changes don't re-seed -- the user's
// click is the source of truth once the component mounts. The compiler
// flags this pattern; it's deliberate here.
// svelte-ignore state_referenced_locally
let open = $state(initiallyOpen === true);

function toggle(): void {
	open = !open;
}
</script>

{#if entries.length > 0}
	<div class="amendment-panel" data-testid="amendment-panel" data-open={open ? 'true' : 'false'}>
		<button
			type="button"
			class="badge"
			aria-expanded={open}
			aria-controls="amendment-panel-body"
			onclick={toggle}
			data-testid="amendment-panel-badge"
		>
			<span class="badge-label">{HANDBOOK_AMENDMENT_BADGE_LABEL}</span>
			<span class="badge-count" aria-label="{entries.length} applied errata">
				{entries.length}
			</span>
		</button>

		{#if open}
			<section
				id="amendment-panel-body"
				class="panel-body"
				aria-label="Applied errata"
				data-testid="amendment-panel-body"
			>
				<ul class="entry-list">
					{#each entries as entry (entry.id)}
						<li>
							<ErrataEntry {entry} />
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/if}

<style>
	.amendment-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin: var(--space-sm) 0;
	}

	.badge {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--signal-info-wash, var(--surface-raised));
		border: 1px solid var(--signal-info-edge, var(--edge-default));
		border-radius: var(--radius-pill, var(--radius-md));
		color: var(--signal-info, var(--ink-body));
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		transition: background-color 120ms ease;
	}

	.badge:hover,
	.badge:focus-visible {
		background: var(--signal-info-wash-hover, var(--surface-raised));
		outline: 2px solid transparent;
		outline-offset: 2px;
		box-shadow: 0 0 0 2px var(--action-default-edge, currentColor);
	}

	.badge-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5em;
		padding: 0 var(--space-2xs);
		background: var(--surface-default);
		border-radius: var(--radius-pill, var(--radius-sm));
		color: var(--ink-body);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
	}

	.panel-body {
		padding: var(--space-md);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-md);
	}

	.entry-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
</style>
