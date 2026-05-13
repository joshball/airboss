<script lang="ts" module>
import type { NoteComposerPrefill } from './composer-state.svelte';

/**
 * `<InlineNoteComposer>` -- right-column wrapper around the
 * `<NoteComposer>` from `@ab/ui` (wp-flightbag-rich-reader Phase 5).
 *
 * Auto-fills the body / quoted-excerpt from the toolbar capture. On
 * save, the host POSTs to `/api/notes` (which calls
 * `createNoteWithAnchor`) so the note + anchor land in one
 * transaction.
 *
 * The wrapper exists so `@ab/library` (browser-safe) doesn't import
 * `@ab/ui/components/notes/NoteComposer.svelte` -- which lives in
 * `@ab/ui` and pulls in the chip input + context picker + tag
 * autocomplete machinery. Hosting here keeps the right-column
 * composition stack self-contained: layout pulls the panel, panel
 * picks the inline composer based on `composerState.kind`, the
 * inline composer drives the network call.
 */

export interface InlineNoteComposerProps {
	readonly prefill: NoteComposerPrefill;
	readonly onSave: (input: { bodyMd: string; title: string; quotedExcerpt: string; tags: string[] }) => Promise<void>;
	readonly onClose: () => void;
	readonly busy?: boolean;
	readonly flash?: string | null;
	readonly errorMessage?: string | null;
}
</script>

<script lang="ts">
import { NOTE_BODY_MAX_LENGTH, NOTE_FOLLOW_UP_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '@ab/constants';

let { prefill, onSave, onClose, busy = false, flash = null, errorMessage = null }: InlineNoteComposerProps = $props();

let bodyMd = $state(prefill.bodyMd ?? '');
let title = $state(prefill.title ?? '');
let quotedExcerpt = $state(prefill.quotedExcerpt ?? '');
let tagsRaw = $state('');
let bodyEl = $state<HTMLTextAreaElement | null>(null);

const canSubmit = $derived(bodyMd.trim().length > 0 && !busy);
const hasUnsavedContent = $derived(bodyMd.trim().length > 0);

$effect(() => {
	bodyMd = prefill.bodyMd ?? '';
	title = prefill.title ?? '';
	quotedExcerpt = prefill.quotedExcerpt ?? '';
});

$effect(() => {
	if (bodyEl !== null && !busy) bodyEl.focus();
});

async function submit(event: SubmitEvent) {
	event.preventDefault();
	if (!canSubmit) return;
	const tags = tagsRaw
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
	await onSave({ bodyMd, title, quotedExcerpt, tags });
	bodyMd = '';
	title = '';
	tagsRaw = '';
}

function handleKeyDown(event: KeyboardEvent) {
	if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
		const formEl = (event.currentTarget as HTMLFormElement) ?? null;
		formEl?.requestSubmit();
		event.preventDefault();
	}
}

function close() {
	if (!hasUnsavedContent || confirm('Discard this note?')) {
		onClose();
	}
}

void NOTE_FOLLOW_UP_MAX_LENGTH;
</script>

<form class="composer" onsubmit={submit} onkeydown={handleKeyDown} data-testid="inline-note-composer">
	<header class="composer-head">
		<h2>Note</h2>
		<button type="button" class="close" onclick={close} aria-label="Close composer" data-testid="inline-note-close">×</button>
	</header>

	{#if flash}
		<p class="flash" role="status" aria-live="polite">{flash}</p>
	{/if}
	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	{#if quotedExcerpt}
		<aside class="quote" aria-label="Quoted passage">
			<span class="field-label">Quoted passage</span>
			<blockquote>{quotedExcerpt}</blockquote>
		</aside>
	{/if}

	<label class="field">
		<span class="field-label">Title (optional)</span>
		<input type="text" bind:value={title} maxlength={NOTE_TITLE_MAX_LENGTH} disabled={busy} placeholder="Stall recovery" data-testid="inline-note-title" />
	</label>

	<label class="field">
		<span class="field-label">Note (markdown)</span>
		<textarea
			bind:this={bodyEl}
			bind:value={bodyMd}
			rows="8"
			maxlength={NOTE_BODY_MAX_LENGTH}
			required
			disabled={busy}
			placeholder="What's on your mind about this passage?"
			data-testid="inline-note-body"
		></textarea>
	</label>

	<label class="field">
		<span class="field-label">Tags (comma-separated)</span>
		<input type="text" bind:value={tagsRaw} disabled={busy} placeholder="far-91, airspace" data-testid="inline-note-tags" />
	</label>

	<div class="actions">
		<button type="button" class="btn ghost" onclick={onClose} disabled={busy}>Cancel</button>
		<button type="submit" class="btn primary" disabled={!canSubmit} data-testid="inline-note-save">
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
	.quote {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}
	blockquote {
		margin: 0;
		padding: var(--space-2xs) var(--space-sm);
		border-left: 3px solid var(--edge-strong);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		font-style: italic;
		font-size: var(--font-size-sm);
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
	input[type='text'] {
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
