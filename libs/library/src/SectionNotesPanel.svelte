<script lang="ts" module>
/**
 * `<SectionNotesPanel>` -- right-column "notes on this section" list
 * (wp-flightbag-rich-reader Phase 5).
 *
 * Mounts in the layout's right column when the composer state is null
 * (no inline composer is open). Renders a simple list of the section's
 * notes plus a "+ Note" button that opens the inline note composer.
 *
 * Pure component: notes come in via prop, the "+ Note" click fires
 * `onAddNote` which the host wires to the toolbar's note flow but
 * without a captured anchor (the user gets a freestanding-on-this-
 * section note).
 */

export interface SectionNoteListItem {
	readonly id: string;
	readonly title: string;
	readonly bodyMd: string;
	readonly quotedExcerpt: string;
	readonly tags: ReadonlyArray<string>;
	readonly followUpMd: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface SectionNotesPanelProps {
	readonly notes: ReadonlyArray<SectionNoteListItem>;
	readonly onAddNote: () => void;
	readonly onOpenNote: (noteId: string) => void;
}
</script>

<script lang="ts">
let { notes, onAddNote, onOpenNote }: SectionNotesPanelProps = $props();

function deriveTitle(item: SectionNoteListItem): string {
	if (item.title.trim().length > 0) return item.title;
	const firstLine = item.bodyMd.split('\n').find((line) => line.trim().length > 0) ?? '';
	const trimmed = firstLine.trim();
	if (trimmed.length === 0) return '(empty note)';
	if (trimmed.length <= 64) return trimmed;
	return `${trimmed.slice(0, 63)}…`;
}

function formatDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
</script>

<section class="panel" data-testid="section-notes-panel">
	<header class="panel-head">
		<h2>
			Notes on this section
			<span class="count">({notes.length})</span>
		</h2>
		<button type="button" class="add" onclick={onAddNote} data-testid="section-notes-add">+ Note</button>
	</header>

	{#if notes.length === 0}
		<p class="empty">Nothing yet. Highlight a passage and pick "Note" to capture a thought.</p>
	{:else}
		<ul class="list">
			{#each notes as note (note.id)}
				<li class="item">
					<button
						type="button"
						class="open"
						onclick={() => onOpenNote(note.id)}
						data-testid="section-note-item-{note.id}"
					>
						<span class="item-title">{deriveTitle(note)}</span>
						<span class="item-meta">
							{formatDate(note.updatedAt)}
							{#if note.tags.length > 0}
								<span class="tags">
									{#each note.tags.slice(0, 3) as tag (tag)}
										<span class="tag">{tag}</span>
									{/each}
									{#if note.tags.length > 3}
										<span class="tag more">+{note.tags.length - 3}</span>
									{/if}
								</span>
							{/if}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}
	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.panel-head h2 {
		margin: 0;
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
	}
	.count {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.add {
		appearance: none;
		font: inherit;
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-default);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.empty {
		margin: 0;
		color: var(--ink-muted);
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
	.item {
		display: flex;
	}
	.open {
		appearance: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		flex: 1 1 auto;
		text-align: left;
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-page);
		color: inherit;
		cursor: pointer;
		font: inherit;
	}
	.open:hover,
	.open:focus-visible {
		background: var(--surface-sunken);
	}
	.item-title {
		font-weight: var(--font-weight-semibold);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-meta {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}
	.tags {
		display: inline-flex;
		gap: var(--space-3xs);
	}
	.tag {
		display: inline-block;
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}
	.tag.more {
		background: transparent;
	}
</style>
