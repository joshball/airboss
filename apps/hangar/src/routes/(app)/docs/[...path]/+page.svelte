<script lang="ts">
import { DOCS_SEARCH_ROOTS, ROUTES } from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import MarkdownArticle from '@ab/ui/components/MarkdownArticle.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const crumbs = $derived<readonly BreadcrumbItem[]>(buildCrumbs(data.repoRelPath, data.title));
const railEntries = $derived(filterRailEntries(data.entries));
const statusValue = $derived(getEntryValue(data.entries, 'status'));
const reviewStatusValue = $derived(getEntryValue(data.entries, 'review_status'));

/**
 * Build a clean breadcrumb chain. Drops the redundant first segment when it
 * equals one of `DOCS_SEARCH_ROOTS` (the `Docs` crumb already covers it),
 * and uses the doc's authored title (frontmatter `title:` or first H1) for
 * the last crumb instead of the bare filename. This fixes the
 * `Docs / docs / work-packages / hangar-review-queue / spec` stutter and
 * makes every WP whose final crumb is `spec` distinguishable.
 */
function buildCrumbs(path: string, title: string): readonly BreadcrumbItem[] {
	const parts = path.split('/');
	const out: BreadcrumbItem[] = [{ label: 'Docs', href: ROUTES.HANGAR_DOCS }];
	let acc = '';
	const startIdx = parts[0] !== undefined && (DOCS_SEARCH_ROOTS as readonly string[]).includes(parts[0]) ? 1 : 0;
	if (startIdx === 1 && parts[0] !== undefined) acc = parts[0];
	for (let i = startIdx; i < parts.length; i++) {
		const part = parts[i] ?? '';
		acc = acc === '' ? part : `${acc}/${part}`;
		const isLast = i === parts.length - 1;
		const label = isLast ? title : part;
		out.push(isLast ? { label } : { label, href: ROUTES.HANGAR_DOCS_PATH(acc) });
	}
	return out;
}

/**
 * Frontmatter rail filter -- only show keys that earn a sidebar. A doc
 * with a single `last-updated` line shouldn't trigger 14-18rem of empty
 * real estate.
 */
const RAIL_KEYS: ReadonlyArray<string> = [
	'title',
	'status',
	'review_status',
	'type',
	'category',
	'feature',
	'tags',
	'reviewer',
	'date',
];

function filterRailEntries(
	entries: ReadonlyArray<{ key: string; value: string }>,
): ReadonlyArray<{ key: string; value: string }> {
	const set = new Set(RAIL_KEYS);
	return entries.filter((e) => set.has(e.key));
}

function getEntryValue(entries: ReadonlyArray<{ key: string; value: string }>, key: string): string | null {
	const found = entries.find((e) => e.key === key);
	return found ? found.value : null;
}

function statusPillClass(value: string | null): string {
	if (!value) return 'pill';
	const lc = value.toLowerCase();
	if (lc === 'done') return 'pill pill-done';
	if (lc === 'reading' || lc === 'in-progress') return 'pill pill-progress';
	if (lc === 'pending' || lc === 'unread') return 'pill pill-pending';
	return 'pill';
}
</script>

<div class="docs-page">
	<Breadcrumbs items={crumbs} />

	<div class="grid">
		<MarkdownArticle bodyHtml={data.bodyHtml} ariaLabel={data.title} />

		{#if railEntries.length > 0}
			<aside class="frontmatter" aria-label="Frontmatter">
				<h2>Frontmatter</h2>
				{#if statusValue || reviewStatusValue}
					<dl class="status-row">
						{#if statusValue}
							<dt>status</dt>
							<dd><span class={statusPillClass(statusValue)}>{statusValue}</span></dd>
						{/if}
						{#if reviewStatusValue}
							<dt>review_status</dt>
							<dd><span class={statusPillClass(reviewStatusValue)}>{reviewStatusValue}</span></dd>
						{/if}
					</dl>
				{/if}
				<dl class="rail-rows">
					{#each railEntries as entry (entry.key)}
						{#if entry.key !== 'status' && entry.key !== 'review_status'}
							<dt>{entry.key}</dt>
							<dd>{entry.value}</dd>
						{/if}
					{/each}
				</dl>
			</aside>
		{/if}
	</div>
</div>

<style>
	.docs-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem);
		gap: var(--space-xl);
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	.frontmatter {
		border-left: 1px solid var(--edge-default);
		padding-left: var(--space-md);
	}

	.frontmatter h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--type-ui-label-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.frontmatter dl {
		margin: 0 0 var(--space-md);
		display: grid;
		grid-template-columns: max-content 1fr;
		column-gap: var(--space-sm);
		row-gap: var(--space-2xs);
	}

	.frontmatter dl:last-child {
		margin-bottom: 0;
	}

	.frontmatter dt {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}

	.frontmatter dd {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
		overflow-wrap: anywhere;
	}

	.pill {
		display: inline-block;
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}

	.pill-done {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	.pill-progress {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}

	.pill-pending {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}
</style>
