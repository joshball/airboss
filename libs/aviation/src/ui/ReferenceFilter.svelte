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
		gap: 0.5rem;
		align-items: center;
	}

	.label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ab-color-fg-muted, #475569);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.input {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--ab-color-border, #cbd5e1);
		border-radius: 6px;
		background: var(--ab-color-surface, white);
		color: var(--ab-color-fg, #0f172a);
	}

	.input:focus-visible {
		outline: none;
		border-color: var(--ab-color-primary, #2563eb);
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	.go {
		font: inherit;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--ab-color-border, #cbd5e1);
		background: var(--ab-color-surface-sunken, #f1f5f9);
		cursor: pointer;
	}
</style>
