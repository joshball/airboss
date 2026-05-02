<script lang="ts">
import {
	AVIATION_TOPIC_LABELS,
	type AviationTopic,
	REFERENCE_KIND_LABELS,
	type ReferenceKind,
	ROUTES,
} from '@ab/constants';

interface Progress {
	totalSections: number;
	readSections: number;
	readingSections: number;
	unreadSections: number;
}

let {
	documentSlug,
	edition,
	title,
	publisher,
	kind,
	subjects,
	externalUrl,
	isReadable,
	progress,
}: {
	documentSlug: string;
	edition: string;
	title: string;
	publisher: string;
	kind: ReferenceKind;
	subjects: readonly string[];
	externalUrl: string | null;
	isReadable: boolean;
	progress: Progress | null;
} = $props();

const kindLabel = $derived(REFERENCE_KIND_LABELS[kind]);
const subjectChips = $derived(
	subjects.map((s) => ({ value: s, label: AVIATION_TOPIC_LABELS[s as AviationTopic] ?? s })),
);
const percentRead = $derived(
	progress === null || progress.totalSections === 0
		? 0
		: Math.round((progress.readSections / progress.totalSections) * 100),
);
const readerHref = $derived(isReadable ? ROUTES.LIBRARY_HANDBOOK(documentSlug) : null);
</script>

{#if isReadable && readerHref !== null && progress !== null}
	<a class="library-card readable" href={readerHref}>
		<div class="header">
			<div class="title-block">
				<span class="kind-chip kind-handbook" aria-label={`Kind: ${kindLabel}`}>{kindLabel}</span>
				<h3>{title}</h3>
			</div>
			<span class="edition" title="Edition">{edition}</span>
		</div>
		{#if subjectChips.length > 0}
			<ul class="subjects" aria-label="Subjects">
				{#each subjectChips as chip (chip.value)}
					<li>{chip.label}</li>
				{/each}
			</ul>
		{/if}
		<div class="progress" aria-label="Reading progress">
			<div class="bar">
				<div class="fill" style="width: {percentRead}%" aria-hidden="true"></div>
			</div>
			<div class="counts">
				<span>{progress.readSections} read</span>
				<span class="dot" aria-hidden="true">·</span>
				<span>{progress.readingSections} reading</span>
				<span class="dot" aria-hidden="true">·</span>
				<span>{progress.unreadSections} unread</span>
			</div>
		</div>
		<p class="publisher" aria-label="Publisher">{publisher}</p>
	</a>
{:else if externalUrl !== null}
	<a class="library-card external" href={externalUrl} target="_blank" rel="noopener noreferrer">
		<div class="header">
			<div class="title-block">
				<span class="kind-chip" aria-label={`Kind: ${kindLabel}`}>{kindLabel}</span>
				<h3>{title}</h3>
			</div>
			<span class="edition" title="Edition">{edition}</span>
		</div>
		{#if subjectChips.length > 0}
			<ul class="subjects" aria-label="Subjects">
				{#each subjectChips as chip (chip.value)}
					<li>{chip.label}</li>
				{/each}
			</ul>
		{/if}
		<p class="publisher" aria-label="Publisher">
			<span class="external-icon" aria-hidden="true">↗</span>
			{publisher}
		</p>
	</a>
{:else}
	<div class="library-card unlinked" aria-disabled="true">
		<div class="header">
			<div class="title-block">
				<span class="kind-chip" aria-label={`Kind: ${kindLabel}`}>{kindLabel}</span>
				<h3>{title}</h3>
			</div>
			<span class="edition" title="Edition">{edition}</span>
		</div>
		{#if subjectChips.length > 0}
			<ul class="subjects" aria-label="Subjects">
				{#each subjectChips as chip (chip.value)}
					<li>{chip.label}</li>
				{/each}
			</ul>
		{/if}
		<p class="publisher muted">{publisher} -- no link available</p>
	</div>
{/if}

<style>
	.library-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}
	.library-card.readable:hover,
	.library-card.external:hover {
		border-color: var(--action-default-edge);
	}
	.library-card.readable:focus-visible,
	.library-card.external:focus-visible {
		border-color: var(--action-default-edge);
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.library-card.unlinked {
		opacity: 0.7;
	}
	.header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-sm);
	}
	.title-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.edition {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		white-space: nowrap;
		font-size: var(--font-size-sm);
	}
	.kind-chip {
		display: inline-block;
		align-self: flex-start;
		padding: 0 var(--space-xs);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}
	.kind-chip.kind-handbook {
		background: var(--signal-info-wash);
		color: var(--signal-info-edge);
	}
	.subjects {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}
	.subjects li {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
	}
	.bar {
		height: var(--space-2xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		overflow: hidden;
		margin-bottom: var(--space-2xs);
	}
	.fill {
		height: 100%;
		background: var(--action-default);
		transition: width var(--motion-normal) ease;
	}
	.counts {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.dot {
		color: var(--edge-subtle);
	}
	.publisher {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.publisher.muted {
		font-style: italic;
	}
	.external-icon {
		font-size: var(--font-size-xs);
		margin-right: var(--space-2xs);
	}
</style>
