<script lang="ts" module>
export type SelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};
export type SelectSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Label + select + hint + error. Pass options via the `options` array or as
 * children `<option>` elements. When both are provided, `options` wins and
 * `children` is ignored.
 *
 * Reads colors/borders from `--input-{default,error}-*` role tokens.
 */

let {
	id,
	name,
	label,
	size = 'md',
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
	size?: SelectSize;
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

<label class="field s-{size}" for={autoId}>
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
		color: var(--input-error-border);
	}

	select {
		font: inherit;
		font-family: inherit;
		padding: var(--control-padding-y-md) var(--control-padding-x-md);
		border: 1px solid var(--input-default-border);
		border-radius: var(--control-radius);
		background: var(--input-default-bg);
		color: var(--input-default-ink);
		transition:
			border-color var(--motion-fast),
			box-shadow var(--motion-fast);
		min-width: 0;
	}

	.s-sm select {
		min-height: var(--input-height-sm);
		padding: var(--control-padding-y-sm) var(--control-padding-x-sm);
		font-size: var(--control-font-size-sm);
	}
	.s-md select {
		min-height: var(--input-height-md);
	}
	.s-lg select {
		min-height: var(--input-height-lg);
		padding: var(--control-padding-y-lg) var(--control-padding-x-lg);
		font-size: var(--control-font-size-lg);
	}

	select:focus-visible {
		outline: 2px solid var(--input-default-ring);
		outline-offset: 2px;
		border-color: var(--action-default);
	}

	select:disabled {
		background: var(--input-default-disabled-bg);
		color: var(--input-default-disabled-ink);
		cursor: not-allowed;
	}

	select[aria-invalid='true'] {
		border-color: var(--input-error-border);
	}
	select[aria-invalid='true']:focus-visible {
		outline-color: var(--input-error-ring);
	}

	.hint {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}

	.error {
		color: var(--input-error-border);
		font-size: var(--font-size-xs);
	}
</style>
