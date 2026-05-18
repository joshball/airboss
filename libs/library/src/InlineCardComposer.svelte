<script lang="ts" module>
import type { CardComposerPrefill } from './composer-state.svelte';

/**
 * `<InlineCardComposer>` -- right-column composer for the rich reader
 * (wp-flightbag-rich-reader Phase 4).
 *
 * Renders the same fields as `/memory/new`'s form: front, back, domain,
 * tags. Submit fires the `onSave` callback with the form values; the
 * host wires that to a fetch against the new-card form action so the page
 * doesn't navigate. After save, the form clears (so the user can author
 * another card from the same passage); the composer stays open.
 *
 * Esc / outside-click handling is owned by the host (the host knows the
 * surrounding layout). The composer renders an explicit close button and
 * fires `onClose` -- the host decides whether to confirm.
 */

export interface InlineCardComposerProps {
	/** Prefill from the toolbar capture (front + back + source citation). */
	readonly prefill: CardComposerPrefill;
	/** Domain options for the select. */
	readonly domains: ReadonlyArray<{ value: string; label: string }>;
	/** Called with the user's form values when they hit Save. */
	readonly onSave: (input: { front: string; back: string; domain: string; tags: string[] }) => Promise<void>;
	/** Called when the user explicitly closes the composer. */
	readonly onClose: () => void;
	/** True while a save is in flight; disables the form. */
	readonly busy?: boolean;
	/** "Saved" flash banner message; cleared by the host. */
	readonly flash?: string | null;
	/** Optional inline error from the host (e.g. server validation failure). */
	readonly errorMessage?: string | null;
}
</script>

<script lang="ts">
let { prefill, domains, onSave, onClose, busy = false, flash = null, errorMessage = null }: InlineCardComposerProps =
	$props();

let front = $state(prefill.front);
let back = $state(prefill.back);
let domain = $state(prefill.domain ?? '');
let tagsRaw = $state(prefill.tags?.join(', ') ?? '');
let frontEl = $state<HTMLTextAreaElement | null>(null);

const canSubmit = $derived(
	front.trim().length > 0 && back.trim().length > 0 && domain.length > 0 && !busy,
);

$effect(() => {
	// Sync prefill if the host swaps the anchor without unmounting.
	front = prefill.front;
	back = prefill.back;
	domain = prefill.domain ?? '';
	tagsRaw = prefill.tags?.join(', ') ?? '';
});

$effect(() => {
	if (frontEl !== null && !busy) frontEl.focus();
});

async function submit(event: SubmitEvent) {
	event.preventDefault();
	if (!canSubmit) return;
	const tags = tagsRaw
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
	await onSave({ front, back, domain, tags });
	// Clear front + tags but keep domain so the rhythm-of-capture
	// continues across cards from the same passage.
	front = '';
	back = '';
	tagsRaw = '';
}

function handleKeyDown(event: KeyboardEvent) {
	if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
		const formEl = (event.currentTarget as HTMLFormElement) ?? null;
		formEl?.requestSubmit();
		event.preventDefault();
	}
}

const hasUnsavedContent = $derived(front.trim().length > 0 || back.trim().length > 0);
</script>

<form class="composer" onsubmit={submit} onkeydown={handleKeyDown} data-testid="inline-card-composer">
	<header class="composer-head">
		<h2>Card now</h2>
		<button
			type="button"
			class="close"
			onclick={() => {
				if (!hasUnsavedContent || confirm('Discard this draft?')) {
					onClose();
				}
			}}
			aria-label="Close composer"
			data-testid="inline-card-close"
		>×</button>
	</header>

	{#if flash}
		<p class="flash" role="status" aria-live="polite">{flash}</p>
	{/if}
	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	<label class="field">
		<span class="field-label">Front (question)</span>
		<textarea
			bind:this={frontEl}
			bind:value={front}
			rows="3"
			required
			disabled={busy}
			placeholder="What does this passage establish?"
			data-testid="inline-card-front"
		></textarea>
	</label>

	<label class="field">
		<span class="field-label">Back (answer)</span>
		<textarea
			bind:value={back}
			rows="6"
			required
			disabled={busy}
			data-testid="inline-card-back"
		></textarea>
	</label>

	<div class="row">
		<label class="field">
			<span class="field-label">Domain</span>
			<select bind:value={domain} required disabled={busy} data-testid="inline-card-domain">
				<option value="" disabled>Pick</option>
				{#each domains as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span class="field-label">Tags</span>
			<input
				type="text"
				bind:value={tagsRaw}
				placeholder="comma-separated"
				disabled={busy}
				data-testid="inline-card-tags"
			/>
		</label>
	</div>

	<div class="actions">
		<button type="button" class="btn ghost" onclick={onClose} disabled={busy}>Cancel</button>
		<button
			type="submit"
			class="btn primary"
			disabled={!canSubmit}
			data-testid="inline-card-save"
		>
			{busy ? 'Saving…' : 'Save'}
		</button>
	</div>
</form>

<style>
	.composer {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}

	.composer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.composer-head h2 {
		margin: 0;
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
	}

	.close {
		appearance: none;
		background: transparent;
		border: 0;
		font-size: var(--font-size-lg);
		cursor: pointer;
		color: var(--ink-muted);
		padding: 0 var(--space-2xs);
	}

	.close:hover {
		color: var(--ink-strong);
	}

	.flash {
		margin: 0;
		padding: var(--space-2xs) var(--space-xs);
		background: var(--signal-success-wash);
		border: 1px solid var(--signal-success-edge);
		border-radius: var(--radius-sm);
		color: var(--signal-success-deep-ink);
	}

	.error {
		margin: 0;
		padding: var(--space-2xs) var(--space-xs);
		background: var(--signal-danger-wash);
		border: 1px solid var(--signal-danger-edge);
		border-radius: var(--radius-sm);
		color: var(--signal-danger-deep-ink);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.field-label {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	textarea,
	input[type='text'],
	select {
		font: inherit;
		padding: var(--space-2xs) var(--space-xs);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-page);
		color: inherit;
	}

	textarea {
		resize: vertical;
	}

	.row {
		display: flex;
		gap: var(--space-sm);
	}

	.row .field {
		flex: 1 1 auto;
		min-width: 0;
	}

	.actions {
		display: flex;
		gap: var(--space-xs);
		justify-content: flex-end;
		margin-top: var(--space-xs);
	}

	.btn {
		appearance: none;
		font: inherit;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-default);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--action-default-ink);
		border-color: var(--action-default-edge);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
