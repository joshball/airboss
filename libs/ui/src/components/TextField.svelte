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

	input,
	textarea {
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

	textarea {
		resize: vertical;
		line-height: var(--line-height-normal);
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	input:disabled,
	textarea:disabled {
		background: var(--surface-sunken);
		cursor: not-allowed;
	}

	input[aria-invalid='true'],
	textarea[aria-invalid='true'] {
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
