<script lang="ts">
/**
 * Modal confirmation dialog for destructive actions that need more weight than
 * the inline `ConfirmAction` two-step. Uses the shared `Dialog` primitive for
 * focus-trap / escape / scrim semantics.
 *
 * Ported from airboss-firc. Snippet-based body; no hardcoded prose. Supports
 * JS-callback mode (`onconfirm`) and form-action mode (`formAction`). Form
 * action mode is preferred when the confirm triggers a server mutation because
 * it degrades without JS.
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
	/** Optional form-action to POST when Confirm is clicked. */
	formAction?: string;
	formMethod?: 'GET' | 'POST';
	hiddenFields?: Record<string, string>;
	children: Snippet;
}

const {
	open,
	onconfirm,
	oncancel,
	title = 'Confirm',
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	variant = 'primary',
	formAction,
	formMethod = 'POST',
	hiddenFields,
	children,
}: Props = $props();

function handleConfirmClick() {
	onconfirm?.();
}
</script>

<Dialog {open} onClose={oncancel} size="sm" ariaLabel={title}>
	{#snippet header()}
		<span class="title">{title}</span>
	{/snippet}

	{#snippet body()}
		<div class="content">
			{@render children()}
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" size="sm" onclick={oncancel}>
			{cancelLabel}
		</Button>
		{#if formAction}
			<form method={formMethod} action={formAction} class="confirm-form">
				{#if hiddenFields}
					{#each Object.entries(hiddenFields) as [k, v] (k)}
						<input type="hidden" name={k} value={v} />
					{/each}
				{/if}
				<Button type="submit" variant={variant === 'danger' ? 'danger' : 'primary'} size="sm">
					{confirmLabel}
				</Button>
			</form>
		{:else}
			<Button
				variant={variant === 'danger' ? 'danger' : 'primary'}
				size="sm"
				onclick={handleConfirmClick}
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
</style>
