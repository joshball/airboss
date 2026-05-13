<script lang="ts" module>
import type { TOCDrawerEntry } from './TOCDrawer.svelte';

/**
 * `<ChapterTile>` -- one card in the overview-mode `<TOCRender>` grid.
 *
 * Shows: chapter code + title, sub-section list (collapsed by default;
 * click to expand), per-chapter progress ring, reading-time estimate,
 * "Continue here" button when this chapter contains the user's most-
 * recently-read section.
 *
 * Pure component -- the parent supplies the chapter row + its children +
 * the readSet; this tile renders the layout.
 */

export interface ChapterTileProps {
	readonly chapter: TOCDrawerEntry;
	readonly children: ReadonlyArray<TOCDrawerEntry>;
	readonly readSet: ReadonlySet<string>;
	readonly containsLastRead: boolean;
}
</script>

<script lang="ts">
let { chapter, children, readSet, containsLastRead }: ChapterTileProps = $props();

let expanded = $state(false);

const totalSections = $derived(children.length || 1);
const readSections = $derived(children.filter((c) => readSet.has(c.sectionId)).length);
const progressFraction = $derived(totalSections === 0 ? 0 : readSections / totalSections);
const progressPct = $derived(Math.round(progressFraction * 100));
const totalMinutes = $derived(
	chapter.minutesToRead + children.reduce((acc, c) => acc + c.minutesToRead, 0),
);
const continueHref = $derived(containsLastRead ? (children.find((c) => readSet.has(c.sectionId))?.href ?? chapter.href) : null);

function toggle() {
	expanded = !expanded;
}
</script>

<article class="tile" class:contains-last-read={containsLastRead}>
	<header class="tile-head">
		<div class="title-block">
			<a class="chapter-link" href={chapter.href ?? '#'} aria-current={chapter.isActive ? 'page' : undefined}>
				<span class="code">{chapter.code}</span>
				<span class="title">{chapter.title}</span>
			</a>
			<p class="meta">
				{#if totalMinutes > 0}
					<span class="meta-item" aria-label={`Approximately ${totalMinutes} minutes to read`}>
						≈ {totalMinutes} min
					</span>
				{/if}
				{#if children.length > 0}
					<span class="meta-item">
						{readSections}/{totalSections} read
					</span>
				{/if}
			</p>
		</div>
		<div
			class="progress"
			role="progressbar"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={progressPct}
			aria-label={`${progressPct}% read`}
			style:--progress-fraction={String(progressFraction)}
		>
			<svg viewBox="0 0 36 36" aria-hidden="true">
				<circle class="progress-track" cx="18" cy="18" r="15.9155" />
				<circle
					class="progress-fill"
					cx="18"
					cy="18"
					r="15.9155"
					stroke-dasharray={`${progressFraction * 100} 100`}
				/>
			</svg>
			<span class="progress-label">{progressPct}%</span>
		</div>
	</header>

	{#if children.length > 0}
		<button
			type="button"
			class="expander"
			aria-expanded={expanded}
			aria-controls={`tile-${chapter.sectionId}-children`}
			onclick={toggle}
		>
			<span class="caret" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
			{expanded ? 'Hide' : 'Show'} sections
		</button>
		{#if expanded}
			<ol class="children" id={`tile-${chapter.sectionId}-children`}>
				{#each children as child (child.sectionId)}
					{@const isRead = readSet.has(child.sectionId)}
					<li class="child" class:read={isRead}>
						{#if child.href}
							<a href={child.href} aria-current={child.isActive ? 'page' : undefined}>
								{#if isRead}
									<span class="check" aria-hidden="true">✓</span>
								{:else}
									<span class="check-spacer" aria-hidden="true"></span>
								{/if}
								<span class="child-code">{child.code}</span>
								<span class="child-title">{child.title}</span>
							</a>
						{:else}
							<span class="non-link">
								<span class="check-spacer" aria-hidden="true"></span>
								<span class="child-code">{child.code}</span>
								<span class="child-title">{child.title}</span>
							</span>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}
	{/if}

	{#if continueHref}
		<a class="continue" href={continueHref}>Continue here →</a>
	{/if}
</article>

<style>
	.tile {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.tile.contains-last-read {
		border-color: var(--action-default-edge, var(--action-default));
		box-shadow: 0 0 0 1px var(--action-default-edge, var(--action-default));
	}

	.tile-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-md);
	}

	.title-block {
		min-width: 0;
		flex: 1 1 auto;
	}

	.chapter-link {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		text-decoration: none;
		color: inherit;
	}

	.chapter-link:hover .title,
	.chapter-link:focus-visible .title {
		color: var(--action-default-hover);
		text-decoration: underline;
	}

	.code {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.title {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-medium);
		color: var(--ink-strong);
		line-height: 1.3;
	}

	.meta {
		margin: var(--space-2xs) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}

	.meta-item {
		font-variant-numeric: tabular-nums;
	}

	.progress {
		position: relative;
		flex: 0 0 auto;
		width: 3rem;
		height: 3rem;
	}

	.progress svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.progress circle {
		fill: none;
		stroke-width: 2.5;
	}

	.progress-track {
		stroke: var(--edge-default);
	}

	.progress-fill {
		stroke: var(--action-default);
		transition: stroke-dasharray var(--motion-fast, 200ms) ease;
	}

	@media (prefers-reduced-motion: reduce) {
		.progress-fill {
			transition: none;
		}
	}

	.progress-label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		font-variant-numeric: tabular-nums;
	}

	.expander {
		background: transparent;
		border: 0;
		padding: var(--space-2xs) 0;
		text-align: left;
		color: var(--ink-muted);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.expander:hover,
	.expander:focus-visible {
		color: var(--ink-body);
	}

	.caret {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 1ch;
	}

	.children {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.child {
		font-size: var(--font-size-sm);
	}

	.child a,
	.child .non-link {
		display: flex;
		align-items: baseline;
		gap: var(--space-2xs);
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
	}

	.child a:hover,
	.child a:focus-visible {
		background: var(--surface-sunken);
		color: var(--ink-strong);
	}

	.check {
		color: var(--signal-success-deep-ink, var(--action-default));
		min-width: 1ch;
		font-family: var(--font-family-mono);
	}

	.check-spacer {
		display: inline-block;
		min-width: 1ch;
	}

	.child-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}

	.child-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--ink-body);
	}

	.continue {
		display: inline-block;
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		text-decoration: none;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		text-align: center;
		border: 1px solid var(--action-default-edge, var(--action-default));
	}

	.continue:hover,
	.continue:focus-visible {
		background: var(--action-default);
		color: var(--action-default-ink, var(--ink-inverse));
	}
</style>
