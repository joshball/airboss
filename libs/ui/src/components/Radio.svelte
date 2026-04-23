<script lang="ts">
/**
 * Single radio option. Most callers should use `RadioGroup` for arrow-
 * key navigation + shared name; this primitive exists for ad-hoc
 * composition where a caller assembles radios inline.
 */

let {
	id,
	name,
	label,
	value,
	checked = false,
	disabled = false,
	onchange,
}: {
	id?: string;
	name: string;
	label: string;
	value: string;
	checked?: boolean;
	disabled?: boolean;
	onchange?: (value: string) => void;
} = $props();

const autoId = $derived(id ?? `r-${name}-${value}`);
</script>

<label class="r" class:is-disabled={disabled} for={autoId}>
	<input
		type="radio"
		id={autoId}
		{name}
		{value}
		{checked}
		{disabled}
		onchange={(e) => onchange?.((e.currentTarget as HTMLInputElement).value)}
	/>
	<span>{label}</span>
</label>

<style>
	.r {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		cursor: pointer;
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	.r.is-disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	input[type='radio'] {
		accent-color: var(--action-default);
		cursor: inherit;
	}

	input[type='radio']:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
