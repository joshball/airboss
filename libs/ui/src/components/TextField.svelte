<script lang="ts" module>
export type TextFieldType = 'text' | 'email' | 'password' | 'textarea' | 'number' | 'search' | 'tel' | 'url';
</script>

<script lang="ts">
/**
 * Label + input + hint + error text field. Handles `type='textarea'` via
 * a branch so callers don't juggle two components. Binds `value` so the
 * parent can drive it with `bind:value={...}`.
 *
 * `required` flips a visual marker next to the label; callers are still
 * responsible for setting `required` on the actual input (defaulted true
 * when `required` is true, overridable via `inputRequired`).
 */

type AutoComplete = HTMLInputElement['autocomplete'];

let {
	id,
	name,
	label,
	type = 'text',
	value = $bindable(''),
	placeholder,
	hint,
	error,
	required = false,
	disabled = false,
	autocomplete,
	rows = 4,
	inputmode,
}: {
	id?: string;
	name?: string;
	label: string;
	type?: TextFieldType;
	value?: string;
	placeholder?: string;
	hint?: string;
	error?: string;
	required?: boolean;
	disabled?: boolean;
	autocomplete?: AutoComplete;
	rows?: number;
	inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search';
} = $props();

const autoId = $derived(id ?? (name ? `tf-${name}` : `tf-${label.replace(/\s+/g, '-').toLowerCase()}`));
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

	{#if type === 'textarea'}
		<textarea
			id={autoId}
			name={name}
			bind:value
			{placeholder}
			{required}
			{disabled}
			{autocomplete}
			{rows}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
		></textarea>
	{:else}
		<input
			id={autoId}
			name={name}
			{type}
			bind:value
			{placeholder}
			{required}
			{disabled}
			{autocomplete}
			{inputmode}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
	{/if}

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

	input,
	textarea {
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

	textarea {
		resize: vertical;
		line-height: var(--ab-line-height-normal);
	}

	input:focus-visible,
	textarea:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
		border-color: var(--ab-color-primary);
	}

	input:disabled,
	textarea:disabled {
		background: var(--ab-color-surface-sunken);
		cursor: not-allowed;
	}

	input[aria-invalid='true'],
	textarea[aria-invalid='true'] {
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
