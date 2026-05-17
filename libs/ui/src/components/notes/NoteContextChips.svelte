<script lang="ts">
/**
 * `<NoteContextChips>` -- read-only chip strip showing which context FKs
 * a note has. Color-coded per spec: orange (reference / section), blue
 * (goal), green (course), info-blue (knowledge node), grey (syllabus node).
 *
 * Each chip is optionally a link when an `href` is provided. The label
 * resolution is the parent's job -- this component only renders what
 * it's given.
 */

import type { NoteContextChip, NoteContextKind } from './note-context-types';

let {
	chips,
	freestanding = 'freestanding',
	emptyClass = '',
}: {
	chips: NoteContextChip[];
	/** Label to render when `chips` is empty. Pass `null` to render nothing. */
	freestanding?: string | null;
	/** Optional override class for the empty-state span (e.g. for muted styling). */
	emptyClass?: string;
} = $props();

const TONE_BY_KIND: Record<NoteContextKind, string> = {
	reference: 'tone-reference',
	section: 'tone-reference',
	goal: 'tone-goal',
	course: 'tone-course',
	knowledge: 'tone-knowledge',
	syllabus: 'tone-syllabus',
};
</script>

{#if chips.length === 0 && freestanding !== null}
	<span class="empty {emptyClass}" data-testid="note-context-empty">{freestanding}</span>
{:else}
	<div class="strip" data-testid="note-context-chips">
		{#each chips as chip (chip.kind + ':' + chip.id)}
			{#if chip.href}
				<a class="chip {TONE_BY_KIND[chip.kind]}" href={chip.href} data-testid={`note-context-chip-${chip.kind}`}>
					{chip.label}
				</a>
			{:else}
				<span class="chip {TONE_BY_KIND[chip.kind]}" data-testid={`note-context-chip-${chip.kind}`}>
					{chip.label}
				</span>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.strip {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
		align-items: center;
	}
	.empty {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		padding: var(--space-3xs) var(--space-xs);
		font-size: var(--type-ui-label-size);
		font-weight: 500;
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--ink-body);
		border: 1px solid currentColor;
	}
	.tone-reference {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}
	.tone-goal {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}
	.tone-course {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}
	.tone-knowledge {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}
	.tone-syllabus {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}
</style>
