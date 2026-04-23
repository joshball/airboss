<script lang="ts" module>
export interface RadioOption {
	value: string;
	label: string;
	disabled?: boolean;
}
export type RadioGroupOrientation = 'horizontal' | 'vertical';
</script>

<script lang="ts">
/**
 * RadioGroup -- accessible radio list with arrow-key navigation.
 *
 * Pass `options` (value + label) and bind `value`. The group owns the
 * shared `name` + selection; arrow keys cycle the radios in DOM order.
 */

let {
	name,
	value = $bindable(''),
	options,
	legend,
	orientation = 'vertical',
	disabled = false,
	ariaLabel,
}: {
	name: string;
	value?: string;
	options: RadioOption[];
	legend?: string;
	orientation?: RadioGroupOrientation;
	disabled?: boolean;
	ariaLabel?: string;
} = $props();

function focusByOffset(current: HTMLInputElement, delta: number): void {
	const root = current.closest('[role="radiogroup"]');
	if (!root) return;
	const radios = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]:not([disabled])'));
	const idx = radios.indexOf(current);
	if (idx === -1) return;
	const next = radios[(idx + delta + radios.length) % radios.length];
	next.focus();
	next.click();
}

function handleKeyDown(event: KeyboardEvent): void {
	const target = event.currentTarget as HTMLInputElement;
	switch (event.key) {
		case 'ArrowDown':
		case 'ArrowRight':
			event.preventDefault();
			focusByOffset(target, 1);
			break;
		case 'ArrowUp':
		case 'ArrowLeft':
			event.preventDefault();
			focusByOffset(target, -1);
			break;
		case 'Home': {
			event.preventDefault();
			const root = target.closest('[role="radiogroup"]');
			const first = root?.querySelector<HTMLInputElement>('input[type="radio"]:not([disabled])');
			first?.focus();
			first?.click();
			break;
		}
		case 'End': {
			event.preventDefault();
			const root = target.closest('[role="radiogroup"]');
			const all = root?.querySelectorAll<HTMLInputElement>('input[type="radio"]:not([disabled])');
			const last = all?.[all.length - 1];
			last?.focus();
			last?.click();
			break;
		}
	}
}
</script>

<fieldset class="rg o-{orientation}" aria-label={ariaLabel} {disabled}>
	{#if legend}
		<legend class="legend">{legend}</legend>
	{/if}
	<div class="list" role="radiogroup" aria-label={legend ?? ariaLabel}>
		{#each options as opt (opt.value)}
			<label class="row" class:is-disabled={opt.disabled || disabled}>
				<input
					type="radio"
					{name}
					value={opt.value}
					checked={value === opt.value}
					disabled={opt.disabled || disabled}
					onchange={() => (value = opt.value)}
					onkeydown={handleKeyDown}
				/>
				<span>{opt.label}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.rg {
		border: none;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	.legend {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--ink-muted);
		margin-bottom: var(--space-xs);
	}

	.list {
		display: flex;
		gap: var(--space-sm);
	}
	.o-vertical .list { flex-direction: column; }
	.o-horizontal .list { flex-direction: row; flex-wrap: wrap; }

	.row {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		cursor: pointer;
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	.row.is-disabled {
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
