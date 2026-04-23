<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Wraps a label + control + help + error. The caller supplies the
 * control element (input, select, etc.) via the `control` snippet and
 * uses the provided `describedBy` id on it for a11y plumbing.
 *
 * Useful for composing forms without re-implementing label/error layout
 * around a Checkbox, RadioGroup, or custom control.
 */

let {
	label,
	help,
	error,
	required = false,
	for: forId,
	control,
}: {
	label: string;
	help?: string;
	error?: string;
	required?: boolean;
	for?: string;
	control: Snippet<[{ describedBy: string | undefined; invalid: boolean }]>;
} = $props();

const idBase = $derived(forId ?? `ff-${label.replace(/\s+/g, '-').toLowerCase()}`);
const helpId = $derived(help ? `${idBase}-help` : undefined);
const errorId = $derived(error ? `${idBase}-error` : undefined);
const describedBy = $derived([helpId, errorId].filter(Boolean).join(' ') || undefined);
const invalid = $derived(Boolean(error));
</script>

<div class="form-field">
	<label class="label" for={forId}>
		<span>
			{label}
			{#if required}
				<span class="req" aria-hidden="true">*</span>
			{/if}
		</span>
	</label>
	<div class="control">
		{@render control({ describedBy, invalid })}
	</div>
	{#if help && !error}
		<span id={helpId} class="help">{help}</span>
	{/if}
	{#if error}
		<span id={errorId} class="error" role="alert">{error}</span>
	{/if}
</div>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		min-width: 0;
	}

	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--ink-muted);
	}

	.req {
		color: var(--input-error-border);
	}

	.help {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
	}

	.error {
		color: var(--input-error-border);
		font-size: var(--font-size-xs);
	}
</style>
