<script lang="ts">
/**
 * `<NoteDetail>` -- full note view + edit-in-place. Renders title,
 * body, quoted excerpt, follow-up section, context chips, and the
 * action row (Edit / Archive | Restore / Delete / Promote to card).
 *
 * The "Promote to card draft" button renders disabled with a "coming
 * soon" tooltip until wp-flightbag-rich-reader ships card_draft.
 *
 * Edit mode swaps the read-only view for `<NoteComposer>`. Form
 * actions live on the parent: this component just emits the chosen
 * intent through native form submits.
 */

import { ROUTES } from '@ab/constants';
import ConfirmAction from '../ConfirmAction.svelte';
import FollowUpBadge from './FollowUpBadge.svelte';
import NoteComposer from './NoteComposer.svelte';
import NoteContextChips from './NoteContextChips.svelte';
import type { NoteContext, NoteContextChip, NoteContextOptions } from './note-context-types';

interface NoteDetailRow {
	id: string;
	title: string;
	bodyMd: string;
	bodyHtml?: string;
	tags: string[];
	followUpMd: string;
	followUpDoneAt: Date | null;
	archivedAt: Date | null;
	quotedExcerpt: string;
	createdAt: Date;
	updatedAt: Date;
}

let {
	note,
	context,
	contextOptions,
	contextChips,
	editing,
	bodyError,
	titleError,
	followUpError,
	formAction = '',
	tagSuggestionsEndpoint = null,
	tagSuggestions = null,
}: {
	note: NoteDetailRow;
	context: NoteContext;
	contextOptions: NoteContextOptions;
	contextChips: NoteContextChip[];
	editing: boolean;
	bodyError?: string | null;
	titleError?: string | null;
	followUpError?: string | null;
	/** Page-relative form action, e.g. `''` for default `?/update`. */
	formAction?: string;
	/** Tag-autocomplete endpoint, forwarded to the inner composer. */
	tagSuggestionsEndpoint?: string | null;
	/** Synchronous tag suggestions, forwarded to the inner composer. */
	tagSuggestions?: string[] | null;
} = $props();

const isArchived = $derived(note.archivedAt !== null);
const editHref = $derived(ROUTES.NOTE_EDIT(note.id));
const detailHref = $derived(ROUTES.NOTE_DETAIL(note.id));
</script>

<article class="detail" data-testid="note-detail">
	{#if isArchived}
		<div class="banner" role="status" data-testid="note-archived-banner">
			This note is archived; restore it to edit.
		</div>
	{/if}

	{#if editing && !isArchived}
		<NoteComposer
			mode="edit"
			initial={{
				bodyMd: note.bodyMd,
				title: note.title,
				context,
				tags: note.tags,
				followUpMd: note.followUpMd,
				quotedExcerpt: note.quotedExcerpt,
			}}
			contextOptions={contextOptions}
			oncancel={() => {}}
			formAction="{formAction}?/update"
			intentName="update"
			submitLabel="Save changes"
			cancelLabel="Cancel"
			{bodyError}
			{titleError}
			{followUpError}
			autofocusBody={false}
			{tagSuggestionsEndpoint}
			{tagSuggestions}
		/>
		<form method="GET" action={detailHref}>
			<button type="submit" class="ghost-btn" data-testid="note-detail-cancel-edit">Cancel</button>
		</form>
	{:else}
		<header class="head">
			<div class="title-block">
				<h2 class="title" data-testid="note-detail-title">
					{note.title.length > 0 ? note.title : 'Untitled note'}
				</h2>
				{#if note.followUpMd.length > 0}
					<FollowUpBadge variant={note.followUpDoneAt !== null ? 'done' : 'open'} />
				{/if}
			</div>
			<div class="actions">
				{#if !isArchived}
					<a class="btn ghost" href={editHref} data-testid="note-detail-edit">Edit</a>
				{/if}
				{#if isArchived}
					<form method="POST" action="{formAction}?/restore">
						<button type="submit" class="btn ghost" data-testid="note-detail-restore">Restore</button>
					</form>
				{:else}
					<form method="POST" action="{formAction}?/archive">
						<button type="submit" class="btn ghost" data-testid="note-detail-archive">Archive</button>
					</form>
				{/if}
				<ConfirmAction
					label="Delete"
					confirmLabel="Delete note"
					cancelLabel="Keep"
					formAction="{formAction}?/delete"
					triggerVariant="ghost"
					confirmVariant="danger"
				/>
				<button type="button" class="btn ghost" disabled title="Coming soon" data-testid="note-detail-promote">
					Promote to card draft
				</button>
			</div>
		</header>

		<NoteContextChips chips={contextChips} />

		{#if note.quotedExcerpt.length > 0}
			<blockquote class="excerpt" data-testid="note-detail-excerpt">
				{note.quotedExcerpt}
			</blockquote>
		{/if}

		<section class="body" data-testid="note-detail-body">
			{#if note.bodyHtml}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html note.bodyHtml}
			{:else}
				<pre class="body-md">{note.bodyMd}</pre>
			{/if}
		</section>

		{#if note.tags.length > 0}
			<div class="tags" data-testid="note-detail-tags">
				{#each note.tags as tag (tag)}
					<span class="tag">#{tag}</span>
				{/each}
			</div>
		{/if}

		{#if note.followUpMd.length > 0}
			<section class="followup" data-testid="note-detail-followup">
				<h3>Follow-up</h3>
				<pre>{note.followUpMd}</pre>
				<div class="followup-actions">
					{#if note.followUpDoneAt === null}
						<form method="POST" action="{formAction}?/mark-followup-done">
							<button type="submit" class="btn primary" data-testid="note-detail-mark-followup-done">
								Mark done
							</button>
						</form>
					{/if}
					<form method="POST" action="{formAction}?/clear-followup">
						<button type="submit" class="btn ghost" data-testid="note-detail-clear-followup">
							Clear follow-up
						</button>
					</form>
				</div>
			</section>
		{/if}
	{/if}
</article>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.banner {
		padding: var(--space-sm) var(--space-md);
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
		border-radius: var(--radius-sm);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-md);
		flex-wrap: wrap;
	}
	.title-block {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}
	.title {
		margin: 0;
		font-size: var(--font-size-xl);
		font-weight: 600;
		color: var(--ink-strong);
	}
	.actions {
		display: flex;
		gap: var(--space-2xs);
		flex-wrap: wrap;
	}
	.actions form {
		display: contents;
	}
	.btn {
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-label-size);
		font-weight: 500;
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-default);
		background: var(--surface-sunken);
		color: var(--ink-body);
		text-decoration: none;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
		border-color: transparent;
	}
	.btn.ghost {
		background: transparent;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.excerpt {
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		border-left: var(--space-2xs) solid var(--edge-strong);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		font-style: italic;
	}
	.body {
		min-width: 0;
	}
	.body-md {
		white-space: pre-wrap;
		font-family: inherit;
		font-size: inherit;
		margin: 0;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}
	.tag {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}
	.followup {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--signal-warning-wash);
	}
	.followup h3 {
		margin: 0;
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		color: var(--ink-strong);
	}
	.followup pre {
		margin: 0;
		white-space: pre-wrap;
		font-family: inherit;
	}
	.followup-actions {
		display: flex;
		gap: var(--space-2xs);
	}
	.ghost-btn {
		background: transparent;
		border: 1px solid var(--edge-default);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		color: var(--ink-muted);
		cursor: pointer;
	}
</style>
