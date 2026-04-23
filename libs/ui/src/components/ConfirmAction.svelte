<script lang="ts">
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import type { ButtonSize, ButtonVariant } from './Button.svelte';

/**
 * Two-step confirm control for destructive actions ("Archive", "Skip
 * permanently"). First click reveals a confirm row with Confirm + Cancel;
 * second click (Confirm) runs the action.
 *
 * Supports two modes:
 *   - Callback mode: pass `onConfirm`. Runs on Confirm click.
 *   - Form mode: pass `formAction` (plus optional `formMethod`, default POST).
 *     The Confirm button renders as a submit inside a scoped form so
 *     SvelteKit `enhance` / standard form submission works.
 *
 * Only one of `onConfirm` / `formAction` should be set. When both are
 * present, `formAction` wins (form semantics beat JS callbacks for
 * destructive operations because they degrade without JS).
 *
 * A11y:
 *   - When the confirm row opens, focus moves to the Confirm button.
 *   - Tab / Shift+Tab cycles between Confirm and Cancel.
 *   - Escape cancels and returns focus to the re-rendered trigger.
 */

let {
	label,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	size = 'sm',
	triggerVariant = 'ghost',
	confirmVariant = 'danger',
	disabled = false,
	onConfirm,
	formAction,
	formMethod = 'POST',
	hiddenFields,
	children,
}: {
	label?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	size?: ButtonSize;
	triggerVariant?: ButtonVariant;
	confirmVariant?: ButtonVariant;
	disabled?: boolean;
	onConfirm?: () => void;
	formAction?: string;
	formMethod?: 'GET' | 'POST';
	hiddenFields?: Record<string, string>;
	children?: Snippet;
} = $props();

let confirming = $state(false);
let triggerEl = $state<HTMLButtonElement | null>(null);
let confirmEl = $state<HTMLButtonElement | null>(null);
let cancelEl = $state<HTMLButtonElement | null>(null);

async function openConfirm() {
	if (disabled) return;
	confirming = true;
	await tick();
	confirmEl?.focus();
}

async function cancel() {
	confirming = false;
	// Wait for the trigger to re-render, then restore focus to it.
	await tick();
	triggerEl?.focus();
}

function runCallback() {
	if (disabled) return;
	onConfirm?.();
	confirming = false;
}

function onPanelKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		void cancel();
		return;
	}
	if (event.key !== 'Tab') return;
	// Focus trap between Confirm and Cancel.
	const target = event.target as HTMLElement | null;
	if (event.shiftKey) {
		if (target === confirmEl) {
			event.preventDefault();
			cancelEl?.focus();
		}
	} else {
		if (target === cancelEl) {
			event.preventDefault();
			confirmEl?.focus();
		}
	}
}
</script>

{#if !confirming}
	<button
		bind:this={triggerEl}
		type="button"
		class="trigger v-{triggerVariant} s-{size}"
		{disabled}
		onclick={openConfirm}
	>
		{#if children}
			{@render children()}
		{:else if label}
			{label}
		{/if}
	</button>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="confirm" role="group" aria-label={label ?? confirmLabel} onkeydown={onPanelKeydown}>
		{#if formAction}
			<form method={formMethod} action={formAction} class="form">
				{#if hiddenFields}
					{#each Object.entries(hiddenFields) as [k, v] (k)}
						<input type="hidden" name={k} value={v} />
					{/each}
				{/if}
				<button
					bind:this={confirmEl}
					type="submit"
					class="btn v-{confirmVariant} s-{size}"
				>
					{confirmLabel}
				</button>
			</form>
		{:else}
			<button
				bind:this={confirmEl}
				type="button"
				class="btn v-{confirmVariant} s-{size}"
				onclick={runCallback}
			>
				{confirmLabel}
			</button>
		{/if}
		<button
			bind:this={cancelEl}
			type="button"
			class="btn v-ghost s-{size}"
			onclick={cancel}
		>
			{cancelLabel}
		</button>
	</div>
{/if}

<style>
	.confirm {
		display: inline-flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.form {
		display: inline-flex;
	}

	/* Local copy of Button primitive styling -- we render raw <button> so we can
	   bind the DOM ref for focus management. Variants / sizes mirror
	   libs/ui/src/components/Button.svelte exactly. */
	.trigger,
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		font-family: inherit;
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-normal);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		cursor: pointer;
		text-decoration: none;
		font-variant-numeric: tabular-nums;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast),
			color var(--motion-fast);
	}

	.trigger:focus-visible,
	.btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.trigger:disabled,
	.btn:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Sizes */
	.s-sm {
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-sm);
	}
	.s-md {
		padding: var(--space-sm) var(--space-md);
		font-size: var(--font-size-base);
	}
	.s-lg {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-lg);
	}

	.v-primary {
		background: var(--action-default);
		color: var(--action-default-ink);
	}
	.v-primary:not(:disabled):hover { background: var(--action-default-hover); }
	.v-primary:not(:disabled):active { background: var(--action-default-active); }

	.v-secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}
	.v-secondary:not(:disabled):hover { background: var(--edge-default); }
	.v-secondary:not(:disabled):active { background: var(--edge-strong); }

	.v-ghost {
		background: transparent;
		color: var(--ink-muted);
	}
	.v-ghost:not(:disabled):hover {
		background: var(--surface-sunken);
		color: var(--ink-body);
	}
	.v-ghost:not(:disabled):active { background: var(--edge-default); }

	.v-danger {
		background: var(--action-hazard);
		color: var(--action-hazard-ink);
	}
	.v-danger:not(:disabled):hover { background: var(--action-hazard-hover); }
	.v-danger:not(:disabled):active { background: var(--action-hazard-active); }
</style>
