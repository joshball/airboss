<script lang="ts">
/**
 * `<NotesList>` -- list of `<NoteCard>` rows with empty-state and
 * "load more" affordance. Pure component; the parent supplies the
 * cards and the cursor-pagination link.
 */

import type { Snippet } from 'svelte';
import NoteCard from './NoteCard.svelte';
import type { NoteContextChip } from './note-context-types';

interface NoteListRow {
	id: string;
	title: string;
	bodyMd: string;
	tags: string[];
	followUpMd: string;
	followUpDoneAt: Date | null;
	archivedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

let {
	notes,
	contextChipsByNoteId = {},
	showContextChips = true,
	emptyTitle = 'No notes yet',
	emptyBody = 'Create your first note to capture a thought.',
	emptyAction,
	loadMoreHref,
}: {
	notes: NoteListRow[];
	/** Optional map of noteId -> chips for the per-card context strip. */
	contextChipsByNoteId?: Record<string, NoteContextChip[]>;
	showContextChips?: boolean;
	emptyTitle?: string;
	emptyBody?: string;
	emptyAction?: Snippet;
	/** When set, renders a "Load more" link at the foot of the list. */
	loadMoreHref?: string | null;
} = $props();
</script>

{#if notes.length === 0}
	<div class="empty" data-testid="notes-list-empty">
		<h3>{emptyTitle}</h3>
		<p>{emptyBody}</p>
		{#if emptyAction}
			{@render emptyAction()}
		{/if}
	</div>
{:else}
	<ul class="list" data-testid="notes-list">
		{#each notes as note (note.id)}
			<li>
				<NoteCard
					{note}
					{showContextChips}
					contextChips={contextChipsByNoteId[note.id] ?? []}
				/>
			</li>
		{/each}
	</ul>
	{#if loadMoreHref}
		<div class="load-more">
			<a class="load-more-link" href={loadMoreHref} data-testid="notes-load-more">Load more</a>
		</div>
	{/if}
{/if}

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.empty {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		align-items: center;
		text-align: center;
		padding: var(--space-2xl) var(--space-md);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		color: var(--ink-muted);
	}
	.empty h3 {
		margin: 0;
		color: var(--ink-strong);
	}
	.empty p {
		margin: 0;
	}
	.load-more {
		margin-top: var(--space-md);
		text-align: center;
	}
	.load-more-link {
		color: var(--link-default);
	}
</style>
