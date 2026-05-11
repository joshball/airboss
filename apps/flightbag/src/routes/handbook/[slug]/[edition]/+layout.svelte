<script lang="ts">
import { ROUTES } from '@ab/constants';
import { useComposerState } from '@ab/library';
import Breadcrumbs from '@ab/library/Breadcrumbs.svelte';
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import SourceLinks from '@ab/library/SourceLinks.svelte';
import TOCRender, { type TOCRenderEntry } from '@ab/library/TOCRender.svelte';
import KeyboardCheatsheet, { type KeyboardShortcutGroup } from '@ab/ui/components/KeyboardCheatsheet.svelte';
import { withViewTransition } from '@ab/utils';
import type { Snippet } from 'svelte';
import { goto, onNavigate } from '$app/navigation';
import { page } from '$app/state';
import RichReaderComposerPanel from '../../../../lib/RichReaderComposerPanel.svelte';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

const composerState = useComposerState();
const composerOpen = $derived(Boolean(composerState && composerState.kind !== null));

// Resolve the active section id from the URL. The route segments
// `[chapter]` and `[section]` map onto the reading-order codes.
const activeSectionId = $derived.by<string | null>(() => {
	const chapter = page.params.chapter;
	const section = page.params.section;
	if (!chapter && !section) return null;
	for (const entry of data.readingOrder) {
		if (section && entry.code === `${chapter}.${section}`) return entry.sectionId;
		if (!section && chapter && entry.code === chapter) return entry.sectionId;
	}
	return null;
});

const readSet = $derived(new Set(data.readSectionIds));

// Compute the entries `<TOCRender>` consumes from the layout-loaded
// reading order. The active flag, last-read flag, and reading-time come
// from per-page data; the structural shape lives at the layout level so
// the rail doesn't remount on in-doc navigation.
const tocEntries = $derived.by<TOCRenderEntry[]>(() => {
	const entries: TOCRenderEntry[] = [];
	for (const entry of data.readingOrder) {
		// Only top-level chapter rows + their `chapter.section`-coded direct
		// children are clickable; deeper subsection rows are skipped from the
		// rail (they don't have dedicated reader routes today).
		const href = (() => {
			if (entry.parentId === null) {
				return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(data.handbook.documentSlug, data.handbook.shortEdition, entry.code);
			}
			const parts = entry.code.split('.');
			if (parts.length !== 2) return null;
			const [ch, sec] = parts;
			if (!ch || !sec) return null;
			return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(data.handbook.documentSlug, data.handbook.shortEdition, ch, sec);
		})();
		entries.push({
			sectionId: entry.sectionId,
			code: entry.code,
			title: entry.title,
			depth: entry.depth,
			href,
			minutesToRead: Math.max(1, Math.round(entry.wordCount / 250)),
			isActive: entry.sectionId === activeSectionId,
		});
	}
	return entries;
});

const tocSummary = $derived.by(() => {
	const total = tocEntries.length;
	const read = tocEntries.filter((e) => readSet.has(e.sectionId)).length;
	const totalMinutes = tocEntries.reduce((acc, e) => acc + e.minutesToRead, 0);
	const parts: string[] = [];
	if (total > 0) parts.push(`${total} entries`);
	if (totalMinutes > 0) parts.push(`≈ ${totalMinutes} min`);
	if (read > 0) parts.push(`${read} read`);
	return parts.length > 0 ? parts.join(' · ') : undefined;
});

// Keyboard navigation: j/k cycle reading-order; o jumps to overview;
// ? opens the cheatsheet. Skip when an input/textarea/contenteditable
// has focus so a search box doesn't get hijacked.
let cheatsheetOpen = $state(false);

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName.toLowerCase();
	if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
	if (target.isContentEditable) return true;
	return false;
}

function findActiveIndex(): number {
	if (!activeSectionId) return -1;
	return tocEntries.findIndex((e) => e.sectionId === activeSectionId);
}

async function navigateTo(href: string) {
	await withViewTransition(() => goto(href));
}

function handleKeydown(event: KeyboardEvent) {
	if (event.altKey || event.ctrlKey || event.metaKey) return;
	if (isEditableTarget(event.target)) return;
	if (event.key === '?') {
		event.preventDefault();
		cheatsheetOpen = true;
		return;
	}
	if (event.key === 'Escape' && cheatsheetOpen) {
		event.preventDefault();
		cheatsheetOpen = false;
		return;
	}
	if (event.key === 'o' || event.key === 'O') {
		event.preventDefault();
		navigateTo(data.handbook.href);
		return;
	}
	const navigable = tocEntries.filter((e) => e.href !== null);
	if (navigable.length === 0) return;
	const activeIdx = navigable.findIndex((e) => e.sectionId === activeSectionId);
	if (event.key === 'j' || event.key === 'ArrowDown') {
		event.preventDefault();
		const nextIdx = activeIdx < 0 ? 0 : Math.min(activeIdx + 1, navigable.length - 1);
		const target = navigable[nextIdx];
		if (target?.href) navigateTo(target.href);
		return;
	}
	if (event.key === 'k' || event.key === 'ArrowUp') {
		event.preventDefault();
		const prevIdx = activeIdx <= 0 ? 0 : activeIdx - 1;
		const target = navigable[prevIdx];
		if (target?.href) navigateTo(target.href);
		return;
	}
	// Surface the activeIdx so the linter doesn't flag it as unused; the
	// branch-scoped uses above shadow this otherwise.
	void activeIdx;
}

onNavigate(() => {
	// Close the cheatsheet on any navigation so it doesn't linger.
	cheatsheetOpen = false;
});

const cheatsheetGroups: ReadonlyArray<KeyboardShortcutGroup> = [
	{
		title: 'Reading',
		entries: [
			{ key: 'j / ↓', description: 'Next section' },
			{ key: 'k / ↑', description: 'Previous section' },
			{ key: 'o', description: 'Overview (handbook landing)' },
		],
	},
	{
		title: 'Help',
		entries: [
			{ key: '?', description: 'Open this cheatsheet' },
			{ key: 'Esc', description: 'Close cheatsheet' },
		],
	},
];
</script>

<svelte:window onkeydown={handleKeydown} />

<ReaderLayout composerOpen={composerOpen}>
	{#snippet tocSidebar()}
		<TOCRender
			mode="rail"
			entries={tocEntries}
			{readSet}
			heading={data.handbook.title}
			headingHref={data.handbook.href}
			summary={tocSummary}
		/>
	{/snippet}

	{#snippet breadcrumb()}
		<Breadcrumbs
			segments={[
				{ label: 'Flightbag', href: ROUTES.FLIGHTBAG_HOME },
				{ label: data.handbook.title, href: data.handbook.href },
			]}
		/>
	{/snippet}

	{#snippet sourceLinks()}
		<SourceLinks
			localPdfHref={data.sourceLinks.localPdfHref}
			onlineUrl={data.sourceLinks.onlineUrl}
			localPdfMissing={data.sourceLinks.localPdfMissing}
		/>
	{/snippet}

	{#snippet composer()}
		<RichReaderComposerPanel />
	{/snippet}

	{@render children()}
</ReaderLayout>

<KeyboardCheatsheet open={cheatsheetOpen} onClose={() => (cheatsheetOpen = false)} groups={cheatsheetGroups} />
