<script lang="ts">
import { QUERY_PARAMS } from '@ab/constants';

/**
 * Free-text search input + power-user query syntax.
 *
 * Plain text matches displayName + aliases + keywords (server-side).
 * Power-user query syntax extracted here and sent as structured
 * query-string params (server re-validates). For Phase 1 the input emits
 * a plain GET form -- filter chips live in ReferenceSidebar.
 */

let {
	initial = '',
}: {
	initial?: string;
} = $props();
</script>

<form role="search" method="GET" class="search">
	<label class="label" for="ref-search">Search</label>
	<input
		id="ref-search"
		class="input"
		type="search"
		name={QUERY_PARAMS.SEARCH}
		value={initial}
		placeholder="term, alias, or tag:weather rules:ifr"
		autocomplete="off"
	/>
	<button class="go" type="submit">Search</button>
</form>

<style>
	.search {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-sm);
		align-items: center;
	}

	.label {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.input {
		font: inherit;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
	}

	.input:focus-visible {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}

	.go {
		font: inherit;
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-default);
		background: var(--surface-sunken);
		cursor: pointer;
	}
</style>
