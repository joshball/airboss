<script lang="ts">
/**
 * Share popover for the review screen. Two actions:
 *
 *   1. Copy card link  -> writes the public card URL to the clipboard
 *      (`ROUTES.CARD_PUBLIC(cardId)` resolved to an absolute URL by the
 *      parent for testability).
 *   2. Report this card -> hands off to the snooze-and-flag `bad-question`
 *      flow. The parent decides whether to open `SnoozeReasonPopover`
 *      with the reason pre-selected or POST directly to the snooze action.
 *
 * Controlled component: parent owns `open` and renders the snooze popover
 * (or routes the report) on `onReport`. Component does no I/O beyond the
 * clipboard write.
 *
 * Chrome / a11y: built on the shared `Dialog` primitive (canonical close
 * glyph, focus trap, ESC + scrim close, focus return).
 */

import Dialog from './Dialog.svelte';

let {
	open = $bindable(false),
	cardId,
	cardPublicUrl,
	onCopy,
	onReport,
	onClose,
}: {
	open?: boolean;
	/** Card id for the report hand-off; the parent uses it on the snooze form. */
	cardId: string;
	/** Pre-computed absolute URL to copy. Parent builds it from `ROUTES.CARD_PUBLIC`. */
	cardPublicUrl: string;
	/** Called on a successful clipboard write so the parent can toast. */
	onCopy?: (url: string) => void;
	/** Called when the user picks Report; parent routes the snooze flow. */
	onReport: (cardId: string) => void;
	onClose?: () => void;
} = $props();

let copied = $state(false);
let copyError = $state<string | null>(null);
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

const COPY_FEEDBACK_MS = 2000;

function close(): void {
	open = false;
	onClose?.();
}

async function copy(): Promise<void> {
	copyError = null;
	try {
		await navigator.clipboard.writeText(cardPublicUrl);
		copied = true;
		onCopy?.(cardPublicUrl);
		if (copyResetTimer !== null) clearTimeout(copyResetTimer);
		copyResetTimer = setTimeout(() => {
			copied = false;
			copyResetTimer = null;
		}, COPY_FEEDBACK_MS);
	} catch {
		copyError = 'Could not copy. Select the link manually.';
	}
}

function report(): void {
	onReport(cardId);
	close();
}

$effect(() => {
	if (!open) return;
	copied = false;
	copyError = null;
});

$effect(() => {
	return () => {
		if (copyResetTimer !== null) {
			clearTimeout(copyResetTimer);
			copyResetTimer = null;
		}
	};
});
</script>

<Dialog
	bind:open
	ariaLabel="Share this card"
	size="md"
	onClose={close}
>
	{#snippet header()}
		<h2 data-testid="sharepopover-title">Share this card</h2>
	{/snippet}

	{#snippet body()}
		<span
			data-testid="sharepopover-root"
			data-state={copied ? 'copied' : copyError ? 'error' : 'idle'}
			class="visually-hidden"
		></span>
		<div class="actions">
			<button type="button" class="action" onclick={copy} aria-live="polite" data-testid="sharepopover-copy">
				<span class="action-label">{copied ? 'Copied!' : 'Copy card link'}</span>
				<span class="action-desc">
					{copied ? 'The public card URL is on your clipboard.' : 'Public link to this card.'}
				</span>
			</button>

			<button type="button" class="action" onclick={report} data-testid="sharepopover-report">
				<span class="action-label">Report this card</span>
				<span class="action-desc">Flag a problem; we'll ask you for a comment.</span>
			</button>
		</div>

		{#if copyError}
			<p class="error" role="alert" data-testid="sharepopover-error">{copyError}</p>
		{/if}

		<p class="url" aria-label="Card link preview" data-testid="sharepopover-url">{cardPublicUrl}</p>
	{/snippet}
</Dialog>

<style>
	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.action {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
		color: var(--ink-body);
		cursor: pointer;
	}

	.action:hover {
		border-color: var(--action-default-edge);
		background: var(--action-default-wash);
	}

	.action:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.action-label {
		font-weight: 600;
		font-size: var(--font-size-body);
		color: var(--ink-body);
	}

	.action-desc {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
	}

	h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--ink-body);
	}

	.url {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
		background: var(--surface-sunken);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		overflow-wrap: anywhere;
		margin: 0;
	}

	.error {
		color: var(--signal-danger, var(--action-hazard-hover));
		font-size: var(--font-size-sm);
		margin: 0;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
