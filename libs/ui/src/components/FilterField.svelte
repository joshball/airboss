<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Vertical label + control stack for use inside `FilterBar`.
 *
 * Renders a small uppercase label associated with the wrapped input via
 * `htmlFor`. The control itself comes from the `children` snippet (any
 * `<input>` / `<select>` / themed control), so the consumer keeps full
 * control over the input element and binding.
 *
 * Pair with `FilterBar`. Replaces the per-route `.field` class +
 * uppercase-caption CSS duplicated across hangar filter bars.
 */

let {
	id,
	label,
	children,
}: {
	id: string;
	label: string;
	children: Snippet;
} = $props();
</script>

<div class="field" data-testid="filter-field-root">
	<label for={id}>{label}</label>
	{@render children()}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.field label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.field :global(input),
	.field :global(select) {
		background: var(--input-default-bg);
		color: var(--input-default-ink);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		font: inherit;
	}

	.field :global(input:focus-visible),
	.field :global(select:focus-visible) {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--input-default-hover-border);
	}
</style>
