<script lang="ts">
/**
 * `<NoteCard>` -- one-row preview of a note. Renders title (derived
 * when empty), body preview (3-line clamp), tag chips, follow-up
 * badge, and optional context chips. Click-through prop lets the
 * parent decide what tapping the card does (usually navigate to
 * `/notes/[id]`).
 *
 * Pure component: no fetch, no DB. Title derivation matches the BC
 * helper `deriveNoteTitle`.
 */

import { NOTE_CARD_PREVIEW_LENGTH, NOTE_TITLE_MAX_LENGTH, ROUTES } from '@ab/constants';
import FollowUpBadge from './FollowUpBadge.svelte';
import NoteContextChips from './NoteContextChips.svelte';
import type { NoteContextChip } from './note-context-types';

interface NoteCardRow {
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
	note,
	contextChips = [],
	showContextChips = true,
	href,
}: {
	note: NoteCardRow;
	contextChips?: NoteContextChip[];
	showContextChips?: boolean;
	/** Optional click-through href. Defaults to `/notes/[id]`. */
	href?: string;
} = $props();

function deriveTitle(row: { title: string; bodyMd: string }): string {
	if (row.title.length > 0) return row.title;
	const firstLine = row.bodyMd
		.split('\n')
		.map((l) => l.trim())
		.find((l) => l.length > 0);
	if (firstLine === undefined) return 'Untitled note';
	const stripped = firstLine.replace(/^#+\s*/, '').trim();
	const truncated =
		stripped.length > NOTE_TITLE_MAX_LENGTH ? `${stripped.slice(0, NOTE_TITLE_MAX_LENGTH - 1)}…` : stripped;
	return truncated.length > 0 ? truncated : 'Untitled note';
}

const title = $derived(deriveTitle(note));
const preview = $derived(
	note.bodyMd.length > NOTE_CARD_PREVIEW_LENGTH
		? `${note.bodyMd.slice(0, NOTE_CARD_PREVIEW_LENGTH - 1)}…`
		: note.bodyMd,
);
const detailHref = $derived(href ?? ROUTES.NOTE_DETAIL(note.id));
const hasFollowUp = $derived(note.followUpMd.length > 0);
const isArchived = $derived(note.archivedAt !== null);
</script>

<a class="card" href={detailHref} data-testid="note-card" data-archived={isArchived}>
	<div class="head">
		<h3 class="title">{title}</h3>
		<div class="badges">
			{#if hasFollowUp}
				<FollowUpBadge variant={note.followUpDoneAt !== null ? 'done' : 'open'} />
			{/if}
			{#if isArchived}
				<span class="archived-badge" data-testid="note-archived-badge">Archived</span>
			{/if}
		</div>
	</div>
	<p class="preview">{preview}</p>
	{#if showContextChips}
		<div class="meta">
			<NoteContextChips chips={contextChips} />
		</div>
	{/if}
	{#if note.tags.length > 0}
		<div class="tags" data-testid="note-card-tags">
			{#each note.tags as tag (tag)}
				<span class="tag">#{tag}</span>
			{/each}
		</div>
	{/if}
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--ink-body);
		transition: border-color var(--motion-fast), background var(--motion-fast);
	}
	.card:hover {
		border-color: var(--action-default);
		background: var(--surface-sunken);
	}
	.card[data-archived='true'] {
		opacity: 0.7;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-sm);
	}
	.title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--ink-strong);
	}
	.badges {
		display: flex;
		gap: var(--space-2xs);
		flex-wrap: wrap;
	}
	.archived-badge {
		display: inline-flex;
		padding: var(--space-3xs) var(--space-xs);
		font-size: var(--type-ui-label-size);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
	}
	.preview {
		margin: 0;
		color: var(--ink-body);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		white-space: pre-wrap;
	}
	.meta {
		margin-top: var(--space-2xs);
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
</style>
