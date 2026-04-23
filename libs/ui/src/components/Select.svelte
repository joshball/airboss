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
		gap: var(--space-2xs);
		font-size: var(--font-size-sm);
		color: var(--ink-body);
		min-width: 0;
	}

	.label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		font-weight: var(--font-weight-medium);
		color: var(--ink-muted);
	}

	.req {
		color: var(--action-hazard);
	}

	select {
		font: inherit;
		font-family: inherit;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
		color: var(--ink-body);
		transition:
			border-color var(--motion-fast),
			box-shadow var(--motion-fast);
		min-width: 0;
	}

	select:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	select:disabled {
		background: var(--surface-sunken);
		cursor: not-allowed;
	}

	select[aria-invalid='true'] {
		border-color: var(--action-hazard);
	}

	.hint {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}

	.error {
		color: var(--action-hazard);
		font-size: var(--font-size-xs);
	}
</style>
