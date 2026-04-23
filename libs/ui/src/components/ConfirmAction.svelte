<script lang="ts">
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import type { ButtonSize, ButtonVariant } from './Button.svelte';

/**
 * CSS selector for all focusable descendants inside the confirm panel. The
 * trap cycles between every match in DOM order; the hardcoded two-button
 * cycle previously shipped broke the instant a caller rendered extra
 * controls (hidden fields + a text input, etc).
 */
const FOCUSABLE_SELECTOR =
	'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

function getFocusables(): HTMLElement[] {
	if (!panelEl) return [];
	return Array.from(panelEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
	);
}

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
	// Focus trap across every focusable in the panel. Falls back to
	// {confirm, cancel} when the panel only renders those two, matching the
	// previous behavior exactly.
	const focusables = getFocusables();
	if (focusables.length === 0) return;
	const first = focusables[0];
	const last = focusables[focusables.length - 1];
	const target = event.target as HTMLElement | null;
	if (event.shiftKey) {
		if (target === first || !target || !focusables.includes(target)) {
			event.preventDefault();
			last.focus();
		}
	} else {
		if (target === last || !target || !focusables.includes(target)) {
			event.preventDefault();
			first.focus();
		}
	}
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
		onkeydown={onPanelKeydown}
	>
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
		gap: var(--ab-space-xs);
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
		gap: var(--ab-space-xs);
		font-family: inherit;
		font-weight: var(--ab-font-weight-semibold);
		letter-spacing: var(--ab-letter-spacing-normal);
		border: 1px solid transparent;
		border-radius: var(--ab-control-radius);
		cursor: pointer;
		text-decoration: none;
		font-variant-numeric: tabular-nums;
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast),
			color var(--ab-transition-fast);
	}

	.trigger:focus-visible,
	.btn:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
	}

	.trigger:disabled,
	.btn:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Sizes */
	.s-sm {
		padding: var(--ab-control-padding-y-sm) var(--ab-control-padding-x-sm);
		font-size: var(--ab-control-font-size-sm);
	}
	.s-md {
		padding: var(--ab-control-padding-y-md) var(--ab-control-padding-x-md);
		font-size: var(--ab-control-font-size-md);
	}
	.s-lg {
		padding: var(--ab-control-padding-y-lg) var(--ab-control-padding-x-lg);
		font-size: var(--ab-control-font-size-lg);
	}

	.v-primary {
		background: var(--ab-color-primary);
		color: var(--ab-color-primary-fg);
	}
	.v-primary:not(:disabled):hover { background: var(--ab-color-primary-hover); }
	.v-primary:not(:disabled):active { background: var(--ab-color-primary-active); }

	.v-secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}
	.v-secondary:not(:disabled):hover { background: var(--ab-color-border); }
	.v-secondary:not(:disabled):active { background: var(--ab-color-border-strong); }

	.v-ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}
	.v-ghost:not(:disabled):hover {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
	}
	.v-ghost:not(:disabled):active { background: var(--ab-color-border); }

	.v-danger {
		background: var(--ab-color-danger);
		color: var(--ab-color-danger-fg);
	}
	.v-danger:not(:disabled):hover { background: var(--ab-color-danger-hover); }
	.v-danger:not(:disabled):active { background: var(--ab-color-danger-active); }
</style>
