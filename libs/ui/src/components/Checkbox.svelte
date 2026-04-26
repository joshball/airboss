<script lang="ts" module>
export type CheckboxSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
/**
 * Label-associated checkbox with default/checked/indeterminate/disabled/
 * error states. Spacebar and click toggle; keyboard handling is native.
 */

let {
	id,
	name,
	label,
	checked = $bindable(false),
	indeterminate = false,
	disabled = false,
	error = false,
	size = 'md',
	ariaDescribedby,
	onchange,
}: {
	id?: string;
	name?: string;
	label: string;
	checked?: boolean;
	indeterminate?: boolean;
	disabled?: boolean;
	error?: boolean;
	size?: CheckboxSize;
	ariaDescribedby?: string;
	onchange?: (value: boolean) => void;
} = $props();

let inputEl = $state<HTMLInputElement | null>(null);
const autoId = $derived(id ?? (name ? `cb-${name}` : `cb-${label.replace(/\s+/g, '-').toLowerCase()}`));

$effect(() => {
	if (inputEl) inputEl.indeterminate = indeterminate;
});
</script>

<label
	class="cb s-{size}"
	class:is-error={error}
	class:is-disabled={disabled}
	for={autoId}
	data-testid="checkbox-root"
	data-size={size}
	data-state={disabled ? 'disabled' : error ? 'error' : indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
>
	<input
		bind:this={inputEl}
		type="checkbox"
		id={autoId}
		{name}
		bind:checked
		{disabled}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={ariaDescribedby}
		data-testid="checkbox-input"
		onchange={(e) => onchange?.((e.currentTarget as HTMLInputElement).checked)}
	/>
	<span class="text" data-testid="checkbox-label">{label}</span>
</label>

<style>
	.cb {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		cursor: pointer;
		font-size: var(--font-size-sm);
		color: var(--ink-body);
		user-select: none;
	}

	.cb.is-disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	input[type='checkbox'] {
		accent-color: var(--action-default);
		cursor: inherit;
	}

	.s-sm input[type='checkbox'] { width: 0.875rem; height: 0.875rem; }
	.s-md input[type='checkbox'] { width: 1rem; height: 1rem; }
	.s-lg input[type='checkbox'] { width: 1.25rem; height: 1.25rem; }

	input[type='checkbox']:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.cb.is-error input[type='checkbox'] {
		accent-color: var(--input-error-border);
		outline: 1px solid var(--input-error-border);
	}
</style>
