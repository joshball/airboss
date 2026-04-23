<script lang="ts" module>
export type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Label + select + hint + error. Pass options via the `options` array or as
 * children `<option>` elements. When both are provided, `options` wins and
 * `children` is ignored.
 */

let {
	id,
	name,
	label,
	value = $bindable(''),
	options,
	placeholder,
	hint,
	error,
	required = false,
	disabled = false,
	children,
}: {
	id?: string;
	name?: string;
	label: string;
	value?: string;
	options?: SelectOption[];
	placeholder?: string;
	hint?: string;
	error?: string;
	required?: boolean;
	disabled?: boolean;
	children?: Snippet;
} = $props();

const autoId = $derived(id ?? (name ? `sel-${name}` : `sel-${label.replace(/\s+/g, '-').toLowerCase()}`));
const hintId = $derived(hint ? `${autoId}-hint` : undefined);
const errorId = $derived(error ? `${autoId}-error` : undefined);
const describedBy = $derived([hintId, errorId].filter(Boolean).join(' ') || undefined);
</script>

<label class="field" for={autoId}>
	<span class="label">
		{label}
		{#if required}
			<span class="req" aria-hidden="true">*</span>
		{/if}
	</span>

	<select
		id={autoId}
		{name}
		bind:value
		{required}
		{disabled}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
	>
		{#if placeholder !== undefined}
			<option value="" disabled>{placeholder}</option>
		{/if}
		{#if options}
			{#each options as opt (opt.value)}
				<option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
			{/each}
		{:else if children}
			{@render children()}
		{/if}
	</select>

	{#if hint && !error}
		<span id={hintId} class="hint">{hint}</span>
	{/if}
	{#if error}
		<span id={errorId} class="error" role="alert">{error}</span>
	{/if}
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-2xs);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg);
		min-width: 0;
	}

	.label {
		display: inline-flex;
		align-items: center;
		gap: var(--ab-space-2xs);
		font-weight: var(--ab-font-weight-medium);
		color: var(--ab-color-fg-muted);
	}

	.req {
		color: var(--ab-color-danger);
	}

	select {
		font: inherit;
		font-family: inherit;
		padding: var(--ab-control-padding-y-md) var(--ab-control-padding-x-md);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-control-radius);
		background: var(--ab-color-surface);
		color: var(--ab-color-fg);
		transition:
			border-color var(--ab-transition-fast),
			box-shadow var(--ab-transition-fast);
		min-width: 0;
	}

	select:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
		border-color: var(--ab-color-primary);
	}

	select:disabled {
		background: var(--ab-color-surface-sunken);
		cursor: not-allowed;
	}

	select[aria-invalid='true'] {
		border-color: var(--ab-color-danger);
	}

	.hint {
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
	}

	.error {
		color: var(--ab-color-danger);
		font-size: var(--ab-font-size-xs);
	}
</style>
