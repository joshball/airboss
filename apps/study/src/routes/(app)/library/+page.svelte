<script lang="ts">
import {
	AVIATION_TOPIC_LABELS,
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	LIBRARY_EXPANDED_SUBJECTS_KEY,
	LIBRARY_STATE_LABELS,
	LIBRARY_STATE_VALUES,
	LIBRARY_STATES,
	type LibraryState,
	QUERY_PARAMS,
	REFERENCE_KIND_LABELS,
	REFERENCE_KIND_VALUES,
	type ReferenceKind,
	ROUTES,
} from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import LibraryCard from '@ab/ui/library/LibraryCard.svelte';
import { dev } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const OTHER_SUBJECT_KEY = '__other__';

function parseStateParam(raw: string | null): LibraryState {
	if (raw === null) return LIBRARY_STATES.ALL;
	return (LIBRARY_STATE_VALUES as readonly string[]).includes(raw) ? (raw as LibraryState) : LIBRARY_STATES.ALL;
}

function parseKindsParam(raw: string | null): readonly ReferenceKind[] {
	if (raw === null || raw === '') return REFERENCE_KIND_VALUES;
	const requested = raw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	const allowed = new Set<string>(REFERENCE_KIND_VALUES);
	const filtered = requested.filter((s) => allowed.has(s)) as ReferenceKind[];
	return filtered.length === 0 ? REFERENCE_KIND_VALUES : filtered;
}

const stateFilter = $derived(parseStateParam(page.url.searchParams.get(QUERY_PARAMS.LIBRARY_STATE)));
const kindFilter = $derived(parseKindsParam(page.url.searchParams.get(QUERY_PARAMS.KIND)));
const kindFilterSet = $derived(new Set<ReferenceKind>(kindFilter));
const allKindsActive = $derived(kindFilter.length === REFERENCE_KIND_VALUES.length);

function matchesState(card: PageData['cards'][number]): boolean {
	if (stateFilter === LIBRARY_STATES.ALL) return true;
	if (stateFilter === LIBRARY_STATES.IN_APP) return card.isReadable;
	return !card.isReadable;
}

function matchesKind(card: PageData['cards'][number]): boolean {
	return kindFilterSet.has(card.kind);
}

const filteredCards = $derived(data.cards.filter((c) => matchesState(c) && matchesKind(c)));

interface SubjectGroup {
	key: string;
	label: string;
	cards: PageData['cards'];
}

const groups = $derived<SubjectGroup[]>(
	(() => {
		const buckets = new Map<string, PageData['cards']>();
		for (const topic of AVIATION_TOPIC_VALUES) buckets.set(topic, []);
		buckets.set(OTHER_SUBJECT_KEY, []);
		for (const card of filteredCards) {
			if (card.subjects.length === 0) {
				buckets.get(OTHER_SUBJECT_KEY)?.push(card);
				continue;
			}
			for (const subject of card.subjects) {
				const bucket = buckets.get(subject);
				if (bucket) bucket.push(card);
				else buckets.get(OTHER_SUBJECT_KEY)?.push(card);
			}
		}
		const result: SubjectGroup[] = [];
		for (const topic of AVIATION_TOPIC_VALUES) {
			const cards = buckets.get(topic) ?? [];
			if (cards.length === 0) continue;
			result.push({ key: topic, label: AVIATION_TOPIC_LABELS[topic as AviationTopic], cards });
		}
		const otherCards = buckets.get(OTHER_SUBJECT_KEY) ?? [];
		if (otherCards.length > 0) result.push({ key: OTHER_SUBJECT_KEY, label: 'Other', cards: otherCards });
		return result;
	})(),
);

// Default-expanded subjects: the ones containing at least one in-app readable
// reference. Persisted to localStorage on toggle so the learner's preference
// survives reloads.
const defaultExpanded = $derived(new Set(groups.filter((g) => g.cards.some((c) => c.isReadable)).map((g) => g.key)));
let expandedSubjects: Set<string> = $state(new Set());
let hydrated = $state(false);

$effect(() => {
	if (typeof window === 'undefined') return;
	if (hydrated) return;
	const raw = window.localStorage.getItem(LIBRARY_EXPANDED_SUBJECTS_KEY);
	if (raw === null) {
		expandedSubjects = new Set(defaultExpanded);
	} else {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
				expandedSubjects = new Set(parsed);
			} else {
				expandedSubjects = new Set(defaultExpanded);
			}
		} catch {
			expandedSubjects = new Set(defaultExpanded);
		}
	}
	hydrated = true;
});

function persistExpanded(): void {
	if (typeof window === 'undefined') return;
	window.localStorage.setItem(LIBRARY_EXPANDED_SUBJECTS_KEY, JSON.stringify([...expandedSubjects]));
}

function isExpanded(key: string): boolean {
	if (!hydrated) return defaultExpanded.has(key);
	return expandedSubjects.has(key);
}

function handleToggle(key: string, event: Event): void {
	const target = event.currentTarget as HTMLDetailsElement;
	const nextOpen = target.open;
	const next = new Set(expandedSubjects);
	if (nextOpen) next.add(key);
	else next.delete(key);
	expandedSubjects = next;
	persistExpanded();
}

async function setStateFilter(value: LibraryState): Promise<void> {
	const url = new URL(page.url);
	if (value === LIBRARY_STATES.ALL) url.searchParams.delete(QUERY_PARAMS.LIBRARY_STATE);
	else url.searchParams.set(QUERY_PARAMS.LIBRARY_STATE, value);
	await goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
}

async function toggleKind(kind: ReferenceKind): Promise<void> {
	const url = new URL(page.url);
	const next = new Set(kindFilterSet);
	if (allKindsActive) {
		// Switching from "all" to a single-kind selection clears the rest.
		next.clear();
		next.add(kind);
	} else if (next.has(kind)) {
		next.delete(kind);
	} else {
		next.add(kind);
	}
	if (next.size === 0 || next.size === REFERENCE_KIND_VALUES.length) {
		url.searchParams.delete(QUERY_PARAMS.KIND);
	} else {
		const ordered = REFERENCE_KIND_VALUES.filter((k) => next.has(k));
		url.searchParams.set(QUERY_PARAMS.KIND, ordered.join(','));
	}
	await goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
}

async function clearKindFilter(): Promise<void> {
	const url = new URL(page.url);
	url.searchParams.delete(QUERY_PARAMS.KIND);
	await goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
}
</script>

<svelte:head>
	<title>Library -- airboss</title>
</svelte:head>

<PageHeader
	title="Library"
	subtitle="Browse references by topic. Read FAA handbooks in-app; external references open in a new tab."
/>

{#if data.cards.length === 0}
	<EmptyState title="No references yet">
		{#snippet bodySnippet()}
			<p>
				References are added by your administrator -- check back, or browse
				<a href={ROUTES.KNOWLEDGE}>the knowledge graph</a> in the meantime.
			</p>
			{#if dev}
				<p class="dev-hint">
					Dev: run <code>bun run sources extract handbooks phak</code> then <code>bun run db seed</code>.
				</p>
			{/if}
		{/snippet}
	</EmptyState>
{:else}
	<section class="filters" aria-label="Filters">
		<div class="filter-group" role="radiogroup" aria-label="State filter">
			{#each LIBRARY_STATE_VALUES as value (value)}
				<button
					type="button"
					class="chip"
					class:active={stateFilter === value}
					role="radio"
					aria-checked={stateFilter === value}
					onclick={() => setStateFilter(value)}
				>
					{LIBRARY_STATE_LABELS[value]}
				</button>
			{/each}
		</div>
		<div class="filter-group" aria-label="Kind filter">
			<button
				type="button"
				class="chip"
				class:active={allKindsActive}
				aria-pressed={allKindsActive}
				onclick={() => clearKindFilter()}
			>
				All kinds
			</button>
			{#each REFERENCE_KIND_VALUES as value (value)}
				<button
					type="button"
					class="chip"
					class:active={!allKindsActive && kindFilterSet.has(value)}
					aria-pressed={!allKindsActive && kindFilterSet.has(value)}
					onclick={() => toggleKind(value)}
				>
					{REFERENCE_KIND_LABELS[value]}
				</button>
			{/each}
		</div>
	</section>

	{#if filteredCards.length === 0}
		<EmptyState title="No references match these filters" body="Try clearing one of the chips above." />
	{:else}
		<div class="groups">
			{#each groups as group (group.key)}
				<details
					class="group"
					open={isExpanded(group.key)}
					ontoggle={(event) => handleToggle(group.key, event)}
				>
					<summary>
						<span class="group-label">{group.label}</span>
						<span class="group-count" aria-label={`${group.cards.length} references`}>
							{group.cards.length}
						</span>
					</summary>
					<ul class="grid">
						{#each group.cards as card (`${group.key}:${card.id}`)}
							<li>
								<LibraryCard
									documentSlug={card.documentSlug}
									edition={card.edition}
									title={card.title}
									publisher={card.publisher}
									kind={card.kind}
									subjects={card.subjects}
									externalUrl={card.externalUrl}
									isReadable={card.isReadable}
									progress={card.progress}
								/>
							</li>
						{/each}
					</ul>
				</details>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.filters {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
	}
	.filter-group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}
	.chip {
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill, var(--radius-md));
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition:
			border-color var(--motion-fast) ease,
			background var(--motion-fast) ease,
			color var(--motion-fast) ease;
	}
	.chip:hover,
	.chip:focus-visible {
		border-color: var(--action-default-edge);
		outline: none;
	}
	.chip.active {
		background: var(--action-default);
		color: var(--action-default-ink);
		border-color: var(--action-default-edge);
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.group {
		border-radius: var(--radius-md);
		background: var(--surface-panel);
	}
	.group summary {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		cursor: pointer;
		list-style: none;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.group summary::-webkit-details-marker {
		display: none;
	}
	.group summary::before {
		content: '▸';
		display: inline-block;
		color: var(--ink-muted);
		transition: transform var(--motion-fast) ease;
	}
	.group[open] summary::before {
		transform: rotate(90deg);
	}
	.group-label {
		flex: 1;
	}
	.group-count {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-regular, normal);
	}
	.grid {
		list-style: none;
		padding: var(--space-xs) 0 var(--space-sm);
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
	.dev-hint code {
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
	}
</style>
