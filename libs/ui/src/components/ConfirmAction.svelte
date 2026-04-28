<script lang="ts">
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import { createFocusTrap } from '../lib/focus-trap';
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
let panelEl = $state<HTMLDivElement | null>(null);

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
	if (!panelEl) return;
	// Focus trap across every focusable in the panel. Falls back to
	// {confirm, cancel} when the panel only renders those two, matching the
	// previous behavior exactly.
	const trap = createFocusTrap(panelEl, { onEscape: () => void cancel() });
	trap.handleKeyDown(event);
}

/**
 * Click-outside: when the user clicks anywhere outside the confirm panel
 * while it's open, cancel the confirmation and return focus to the trigger.
 * Mirrors the Escape contract so pointer users get the same escape hatch.
 */
function onDocumentPointerDown(event: PointerEvent) {
	if (!confirming) return;
	const target = event.target as Node | null;
	if (!target || !panelEl) return;
	if (panelEl.contains(target)) return;
	void cancel();
}

$effect(() => {
	if (!confirming) return;
	// `pointerdown` fires before `click`, which means a click-outside cancels
	// before any outer handler interprets the click. Capture phase keeps this
	// ahead of app-level listeners that might stopPropagation.
	document.addEventListener('pointerdown', onDocumentPointerDown, true);
	return () => {
		document.removeEventListener('pointerdown', onDocumentPointerDown, true);
	};
});
</script>

{#if !confirming}
	<button
		bind:this={triggerEl}
		type="button"
		class="trigger v-{triggerVariant} s-{size}"
		{disabled}
		data-testid="confirmaction-trigger"
		data-state={disabled ? 'disabled' : 'idle'}
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
	<div
		bind:this={panelEl}
		class="confirm"
		role="group"
		aria-label={label ?? confirmLabel}
		data-testid="confirmaction-panel"
		data-state="confirming"
		onkeydown={onPanelKeydown}
	>
		{#if formAction}
			<form method={formMethod} action={formAction} class="form" data-testid="confirmaction-form">
				{#if hiddenFields}
					{#each Object.entries(hiddenFields) as [k, v] (k)}
						<input type="hidden" name={k} value={v} />
					{/each}
				{/if}
				<button
					bind:this={confirmEl}
					type="submit"
					class="btn v-{confirmVariant} s-{size}"
					data-testid="confirmaction-confirm"
				>
					{confirmLabel}
				</button>
			</form>
		{:else}
			<button
				bind:this={confirmEl}
				type="button"
				class="btn v-{confirmVariant} s-{size}"
				data-testid="confirmaction-confirm"
				onclick={runCallback}
			>
				{confirmLabel}
			</button>
		{/if}
		<button
			type="button"
			class="btn v-ghost s-{size}"
			data-testid="confirmaction-cancel"
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
		border-radius: var(--control-radius);
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
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.trigger:disabled,
	.btn:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Sizes */
	.s-sm {
		padding: var(--control-padding-y-sm) var(--control-padding-x-sm);
		font-size: var(--control-font-size-sm);
	}
	.s-md {
		padding: var(--control-padding-y-md) var(--control-padding-x-md);
		font-size: var(--control-font-size-md);
	}
	.s-lg {
		padding: var(--control-padding-y-lg) var(--control-padding-x-lg);
		font-size: var(--control-font-size-lg);
	}

	.v-primary {
		background: var(--button-primary-bg);
		color: var(--button-primary-ink);
		border-color: var(--button-primary-border);
	}
	.v-primary:not(:disabled):hover { background: var(--button-primary-hover-bg); }
	.v-primary:not(:disabled):active { background: var(--button-primary-active-bg); }

	.v-secondary {
		background: var(--button-default-bg);
		color: var(--button-default-ink);
		border-color: var(--button-default-border);
	}
	.v-secondary:not(:disabled):hover { background: var(--button-default-hover-bg); }
	.v-secondary:not(:disabled):active { background: var(--button-default-active-bg); }

	.v-ghost {
		background: var(--button-ghost-bg);
		color: var(--button-ghost-ink);
		border-color: var(--button-ghost-border);
	}
	.v-ghost:not(:disabled):hover {
		background: var(--button-ghost-hover-bg);
		color: var(--button-ghost-hover-ink);
	}
	.v-ghost:not(:disabled):active { background: var(--button-ghost-active-bg); }

	.v-danger {
		background: var(--button-hazard-bg);
		color: var(--button-hazard-ink);
		border-color: var(--button-hazard-border);
	}
	.v-danger:not(:disabled):hover { background: var(--button-hazard-hover-bg); }
	.v-danger:not(:disabled):active { background: var(--button-hazard-active-bg); }
</style>
