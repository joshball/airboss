<script lang="ts">
/**
 * Modal confirmation dialog for destructive actions that need more weight than
 * the inline `ConfirmAction` two-step. Uses the shared `Dialog` primitive for
 * focus-trap / escape / scrim semantics.
 *
 * Snippet-based body; no hardcoded prose. Supports JS-callback mode
 * (`onconfirm`) and form-action mode (`formAction`). Form action mode is
 * preferred when the confirm triggers a server mutation because it degrades
 * without JS.
 *
 * Optional `typedConfirmation` gates Confirm behind the user typing an exact
 * string (e.g. the target user's email). Used by hangar admin-write surfaces
 * to bind the action to its target -- the admin reads the identity into
 * working memory before submitting. Pattern from GitHub repo-delete.
 *
 * `dangerLevel` is the contract for callers that think in admin-write terms
 * (`caution` = recoverable, `danger` = destructive). It maps to the lower-
 * level `variant` prop. Either prop can drive the styling; `dangerLevel`
 * wins when both are set.
 */

import type { Snippet } from 'svelte';
import Button from './Button.svelte';
import Dialog from './Dialog.svelte';

interface Props {
	open: boolean;
	onconfirm?: () => void;
	oncancel: () => void;
	title?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: 'primary' | 'danger';
	/**
	 * Action severity, used by hangar admin-write surfaces. Maps to `variant`
	 * (`caution` -> `primary`, `danger` -> `danger`). When set, takes
	 * precedence over `variant`.
	 */
	dangerLevel?: 'caution' | 'danger';
	/**
	 * When set, the Confirm button is disabled until the user types `expected`
	 * exactly. Use to bind ban / revoke-style actions to their target user.
	 */
	typedConfirmation?: { label: string; expected: string };
	/** Optional form-action to POST when Confirm is clicked. */
	formAction?: string;
	formMethod?: 'GET' | 'POST';
	hiddenFields?: Record<string, string>;
	children: Snippet;
}

let {
	open = $bindable(false),
	onconfirm,
	oncancel,
	title = 'Confirm',
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	variant = 'primary',
	dangerLevel,
	typedConfirmation,
	formAction,
	formMethod = 'POST',
	hiddenFields,
	children,
}: Props = $props();

let typedValue = $state('');
// Unique ids for the typed-confirmation input + the gate description so AT
// users hear "Type X to confirm" both as the input's accessible
// description and as the explanation for why Confirm is disabled.
const typedInputId = `confirm-typed-${Math.random().toString(36).slice(2, 10)}`;
const typedHintId = `${typedInputId}-hint`;

const effectiveVariant = $derived<'primary' | 'danger'>(
	dangerLevel === 'danger' ? 'danger' : dangerLevel === 'caution' ? 'primary' : variant,
);

const confirmDisabled = $derived(typedConfirmation !== undefined && typedValue !== typedConfirmation.expected);

function handleConfirmClick() {
	if (confirmDisabled) return;
	onconfirm?.();
}

function handleFormSubmit(event: SubmitEvent) {
	if (confirmDisabled) {
		event.preventDefault();
	}
}

$effect(() => {
	if (!open) typedValue = '';
});

// Note: when both `dangerLevel` and `variant` are passed, `dangerLevel` wins
// silently. We accept the silent override because the practical migration
// trigger -- "every admin-write surface in hangar/* uses `dangerLevel`
// exclusively" -- is the right moment to drop the `variant` prop entirely
// rather than ship a runtime warning that has to be removed at the same
// time. See hangar/users/[id] and hangar/sources/[id] for current callers.
</script>

<Dialog bind:open onClose={oncancel} size="sm" ariaLabel={title}>
	{#snippet header()}
		<span class="title">{title}</span>
	{/snippet}

	{#snippet body()}
		<div class="content">
			{@render children()}
			{#if typedConfirmation}
				<div class="typed-gate">
					<label class="typed-gate-label" for={typedInputId}>{typedConfirmation.label}</label>
					<input
						id={typedInputId}
						type="text"
						class="typed-gate-input"
						bind:value={typedValue}
						autocomplete="off"
						spellcheck="false"
						aria-describedby={typedHintId}
					/>
					<!--
						Hint sits outside the <label> wrapper so the label's
						accessible-text remains exactly `typedConfirmation.label`.
						aria-describedby on the input + on the disabled Confirm
						button still surfaces the hint to AT.
					-->
					<span id={typedHintId} class="typed-gate-hint">
						Type <code>{typedConfirmation.expected}</code> to enable Confirm.
					</span>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" size="sm" onclick={oncancel}>
			{cancelLabel}
		</Button>
		{#if formAction}
			<form
				method={formMethod}
				action={formAction}
				class="confirm-form"
				onsubmit={handleFormSubmit}
			>
				{#if hiddenFields}
					{#each Object.entries(hiddenFields) as [k, v] (k)}
						<input type="hidden" name={k} value={v} />
					{/each}
				{/if}
				{#if typedConfirmation}
					<input type="hidden" name="confirmedTarget" value={typedValue} />
				{/if}
				<Button
					type="submit"
					variant={effectiveVariant}
					size="sm"
					disabled={confirmDisabled}
					ariaDescribedby={typedConfirmation && confirmDisabled ? typedHintId : undefined}
				>
					{confirmLabel}
				</Button>
			</form>
		{:else}
			<Button
				variant={effectiveVariant}
				size="sm"
				onclick={handleConfirmClick}
				disabled={confirmDisabled}
				ariaDescribedby={typedConfirmation && confirmDisabled ? typedHintId : undefined}
			>
				{confirmLabel}
			</Button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.title {
		color: var(--ink-body);
		font-size: var(--type-ui-control-size);
	}

	.content {
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		line-height: var(--line-height-relaxed);
	}

	.confirm-form {
		margin: 0;
		display: inline-flex;
	}

	.typed-gate {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		margin-top: var(--space-md);
	}

	.typed-gate-label {
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		font-weight: var(--font-weight-medium);
		display: block;
	}

	.typed-gate-input {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		background: var(--input-default-bg);
		color: var(--ink-body);
		font: inherit;
	}

	.typed-gate-input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.typed-gate-hint {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.typed-gate-hint code {
		font-family: var(--font-family-mono);
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		color: var(--ink-body);
	}
</style>
