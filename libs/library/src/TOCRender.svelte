<script lang="ts" module>
import type { TOCDrawerEntry, TOCDrawerProps } from './TOCDrawer.svelte';

/**
 * `<TOCRender>` -- the unified TOC renderer (WP-FLIGHTBAG-READER-UX
 * Phase 4). Three modes share the same data shape (`TOCDrawerEntry[]`):
 *
 * - `mode="overview"` -- multi-column grid of `<ChapterTile>`. Used on
 *   handbook landings as the body content. Each tile shows chapter
 *   title, code, sub-section list (collapsed), progress ring, reading
 *   time, and an optional "Continue here" button when this chapter
 *   contains the user's last-read section.
 * - `mode="rail"` -- the original `<TOCDrawer>` shape. Sticky 280px
 *   column, suitable for a `<ReaderLayout>` `tocSidebar` snippet.
 * - `mode="compact"` -- a slimmer rail that only expands the current
 *   chapter. Useful on small viewports between mobile (collapsed
 *   disclosure) and full desktop (everything expanded).
 *
 * The existing `<TOCDrawer>` becomes a thin wrapper that mounts
 * `<TOCRender mode="rail">` -- preserves backward compat for callers
 * that import `TOCDrawer.svelte` directly.
 */

export type TOCRenderMode = 'overview' | 'rail' | 'compact';

export interface TOCRenderEntry extends TOCDrawerEntry {
	/**
	 * Optional last-read marker -- when true, this entry is the user's
	 * most-recently-read section. Used by the overview mode to surface
	 * the "Continue here" pin and to highlight the matching ChapterTile.
	 */
	readonly isLastRead?: boolean;
}

export interface TOCRenderProps extends Omit<TOCDrawerProps, 'entries'> {
	readonly entries: ReadonlyArray<TOCRenderEntry>;
	readonly mode: TOCRenderMode;
}
</script>

<script lang="ts">
import { goto } from '$app/navigation';
import { withViewTransition } from '@ab/utils';
import ChapterTile from './ChapterTile.svelte';
import TOCDrawer from './TOCDrawer.svelte';

let {
	entries,
	mode,
	readSet,
	heading,
	summary,
	headingHref,
	initiallyOpenOnMobile = false,
	collapsibleGroups = false,
	defaultExpandedGroupIds,
}: TOCRenderProps = $props();

const reads = $derived(readSet ?? new Set<string>());

// Group entries by chapter for the overview mode. Top-level entries
// (depth === 0) are chapters; their children (any entry with the
// chapter's section-id segment in its code prefix) are sub-sections.
interface ChapterGroup {
	chapter: TOCRenderEntry;
	children: TOCRenderEntry[];
}
const chapterGroups = $derived.by<ChapterGroup[]>(() => {
	const groups: ChapterGroup[] = [];
	let current: ChapterGroup | null = null;
	for (const entry of entries) {
		if (entry.depth === 0) {
			current = { chapter: entry, children: [] };
			groups.push(current);
		} else if (current) {
			current.children.push(entry);
		}
	}
	return groups;
});

// `compact` mode: only the active chapter is expanded; everything else
// renders as a collapsed group header. Wires through TOCDrawer's
// existing `collapsibleGroups` machinery.
const activeChapterCode = $derived.by<string | null>(() => {
	const active = entries.find((e) => e.isActive);
	if (!active) return null;
	if (active.depth === 0) return active.sectionId;
	for (const group of chapterGroups) {
		if (group.children.some((c) => c.sectionId === active.sectionId)) {
			return group.chapter.sectionId;
		}
	}
	return null;
});

const compactGroupedEntries = $derived.by<TOCRenderEntry[]>(() => {
	if (mode !== 'compact') return [...entries];
	const result: TOCRenderEntry[] = [];
	for (const group of chapterGroups) {
		// Top-level row stays without a `groupId` so TOCDrawer treats it as
		// a group header.
		result.push(group.chapter);
		// Children carry the chapter's sectionId as their groupId so the
		// collapsible-groups machinery can hide them when collapsed.
		for (const child of group.children) {
			result.push({ ...child, groupId: group.chapter.sectionId });
		}
	}
	return result;
});

async function handleNav(event: MouseEvent, href: string) {
	// Plain-click only; let middle-click / cmd-click open in a new tab.
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
	event.preventDefault();
	await withViewTransition(() => goto(href));
}
</script>

{#if mode === 'overview'}
	<section class="overview" aria-label={heading}>
		<header class="overview-head">
			<h2>{heading}</h2>
			{#if summary}
				<p class="summary">{summary}</p>
			{/if}
		</header>
		<div class="tile-grid">
			{#each chapterGroups as group (group.chapter.sectionId)}
				<ChapterTile
					chapter={group.chapter}
					children={group.children}
					readSet={reads}
					containsLastRead={group.chapter.isLastRead === true ||
						group.children.some((c) => c.isLastRead === true)}
				/>
			{/each}
		</div>
	</section>
{:else if mode === 'rail'}
	<div class="rail-wrapper" onclickcapture={(event) => {
		const target = event.target as HTMLElement | null;
		const link = target?.closest('a');
		if (!link) return;
		const href = link.getAttribute('href');
		if (!href) return;
		handleNav(event, href);
	}}>
		<TOCDrawer
			entries={[...entries]}
			readSet={reads}
			{heading}
			{summary}
			{headingHref}
			{initiallyOpenOnMobile}
			{collapsibleGroups}
			{defaultExpandedGroupIds}
		/>
	</div>
{:else}
	<div class="rail-wrapper" onclickcapture={(event) => {
		const target = event.target as HTMLElement | null;
		const link = target?.closest('a');
		if (!link) return;
		const href = link.getAttribute('href');
		if (!href) return;
		handleNav(event, href);
	}}>
		<TOCDrawer
			entries={compactGroupedEntries}
			readSet={reads}
			{heading}
			{summary}
			{headingHref}
			{initiallyOpenOnMobile}
			collapsibleGroups
			defaultExpandedGroupIds={activeChapterCode ? [activeChapterCode] : []}
		/>
	</div>
{/if}

<style>
	.overview {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.overview-head h2 {
		margin: 0;
		font-size: var(--font-size-xl);
		color: var(--ink-strong);
	}

	.overview-head .summary {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.tile-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: var(--space-md);
	}

	.rail-wrapper {
		display: contents;
	}
</style>
