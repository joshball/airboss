<script lang="ts">
import type { Snippet } from 'svelte';
import Button, { type ButtonSize, type ButtonVariant } from './Button.svelte';

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

function openConfirm() {
	if (disabled) return;
	confirming = true;
}

function cancel() {
	confirming = false;
}

function runCallback() {
	if (disabled) return;
	onConfirm?.();
	confirming = false;
}
</script>

{#if !confirming}
	<Button variant={triggerVariant} {size} {disabled} onclick={openConfirm}>
		{#if children}
			{@render children()}
		{:else if label}
			{label}
		{/if}
	</Button>
{:else}
	<div class="confirm">
		{#if formAction}
			<form method={formMethod} action={formAction} class="form">
				{#if hiddenFields}
					{#each Object.entries(hiddenFields) as [k, v] (k)}
						<input type="hidden" name={k} value={v} />
					{/each}
				{/if}
				<Button variant={confirmVariant} {size} type="submit">{confirmLabel}</Button>
			</form>
		{:else}
			<Button variant={confirmVariant} {size} onclick={runCallback}>{confirmLabel}</Button>
		{/if}
		<Button variant="ghost" {size} onclick={cancel}>{cancelLabel}</Button>
	</div>
{/if}

<style>
	.confirm {
		display: inline-flex;
		gap: var(--ab-space-xs);
		align-items: center;
	}

	.form {
		display: inline-flex;
	}
</style>
