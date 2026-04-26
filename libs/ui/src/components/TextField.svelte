<script lang="ts" module>
export type TextFieldType = 'text' | 'email' | 'password' | 'textarea' | 'number' | 'search' | 'tel' | 'url';
export type TextFieldSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
/**
 * Label + input + hint + error text field. Handles `type='textarea'` via
 * a branch so callers don't juggle two components. Binds `value` so the
 * parent can drive it with `bind:value={...}`.
 *
 * Reads colors/borders from `--input-{default,error}-*` role tokens;
 * size variants dispatch height via `--input-height-*`.
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
	size = 'md',
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
	size?: TextFieldSize;
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

<label
	class="field s-{size}"
	for={autoId}
	data-testid="textfield-root"
	data-size={size}
	data-state={disabled ? 'disabled' : error ? 'error' : 'idle'}
	data-type={type}
>
	<span class="label" data-testid="textfield-label">
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
			data-testid="textfield-control"
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
			data-testid="textfield-control"
		/>
	{/if}

	{#if hint && !error}
		<span id={hintId} class="hint" data-testid="textfield-hint">{hint}</span>
	{/if}
	{#if error}
		<span id={errorId} class="error" role="alert" data-testid="textfield-error">{error}</span>
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

	input,
	textarea {
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

	.s-sm input {
		min-height: var(--input-height-sm);
		padding: var(--control-padding-y-sm) var(--control-padding-x-sm);
		font-size: var(--control-font-size-sm);
	}
	.s-md input {
		min-height: var(--input-height-md);
	}
	.s-lg input {
		min-height: var(--input-height-lg);
		padding: var(--control-padding-y-lg) var(--control-padding-x-lg);
		font-size: var(--control-font-size-lg);
	}

	textarea {
		resize: vertical;
		line-height: var(--line-height-normal);
	}

	input:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--input-default-ring);
		outline-offset: 2px;
		border-color: var(--action-default);
	}

	input:disabled,
	textarea:disabled {
		background: var(--input-default-disabled-bg);
		color: var(--input-default-disabled-ink);
		cursor: not-allowed;
	}

	input[aria-invalid='true'],
	textarea[aria-invalid='true'] {
		border-color: var(--input-error-border);
	}
	input[aria-invalid='true']:focus-visible,
	textarea[aria-invalid='true']:focus-visible {
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
