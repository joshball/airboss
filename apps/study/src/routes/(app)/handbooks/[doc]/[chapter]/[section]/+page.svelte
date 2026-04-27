<script lang="ts">
import {
	HANDBOOK_HEARTBEAT_BUFFER,
	HANDBOOK_HEARTBEAT_INTERVAL_SEC,
	HANDBOOK_READ_STATUSES,
	type HandbookReadStatus,
	ROUTES,
} from '@ab/constants';
import HandbookCitingNodesPanel from '@ab/ui/handbooks/HandbookCitingNodesPanel.svelte';
import HandbookEditionBadge from '@ab/ui/handbooks/HandbookEditionBadge.svelte';
import HandbookReadProgressControl from '@ab/ui/handbooks/HandbookReadProgressControl.svelte';
import HandbookSectionNotes from '@ab/ui/handbooks/HandbookSectionNotes.svelte';
import { renderMarkdown } from '@ab/utils';
import type { PageData } from './$types';
import { shouldShowReadSuggestion } from './read-suggestion';

let { data }: { data: PageData } = $props();

const bodyMd = $derived(stripFrontmatter(data.section.contentMd));
const bodyHtml = $derived(renderMarkdown(bodyMd));

// Read-tracking state for the heartbeat tick + suggestion banner. Local-only;
// the server's authoritative `total_seconds_visible` is the persisted truth.
// `accumulatedSecondsThisLoad` counts ticks the client has fired this page-
// load; it adds onto the server's snapshot so cumulative time stays accurate
// across visits without re-loading the page.
let openedSecondsInSession = $state(0);
let accumulatedSecondsThisLoad = $state(0);
let scrolledToBottom = $state(false);
let suggestionDismissed = $state(false);
const totalSecondsVisible = $derived(data.readState.totalSecondsVisible + accumulatedSecondsThisLoad);
const status = $derived(data.readState.status as HandbookReadStatus);
const showSuggestion = $derived(
	shouldShowReadSuggestion({
		openedSecondsInSession,
		totalSecondsVisible,
		scrolledToBottom,
		status,
		dismissedThisSession: suggestionDismissed,
	}),
);

const heartbeatUrl = $derived(
	ROUTES.HANDBOOK_SECTION_HEARTBEAT(
		data.reference.documentSlug,
		data.chapter.code,
		data.section.code.split('.').slice(1).join('.'),
	),
);

// Buffer of heartbeat deltas the network failed to deliver. The next
// successful POST drains the buffer in FIFO order; the cap matches
// HANDBOOK_HEARTBEAT_BUFFER so a long offline stretch doesn't grow
// unbounded -- the oldest entries are dropped past the cap.
const pendingDeltas: number[] = [];

async function postHeartbeat(delta: number): Promise<void> {
	const queue = [...pendingDeltas, delta];
	pendingDeltas.length = 0;
	while (queue.length > 0) {
		const next = queue[0];
		if (next === undefined) break;
		try {
			const response = await fetch(heartbeatUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ delta: next }),
			});
			if (!response.ok) throw new Error(`heartbeat failed: ${response.status}`);
			queue.shift();
		} catch {
			// Network or server rejected: re-buffer the unsent tail and bail.
			// Trim from the front (drop oldest) to honor the cap.
			const overflow = queue.length - HANDBOOK_HEARTBEAT_BUFFER;
			const tail = overflow > 0 ? queue.slice(overflow) : queue;
			pendingDeltas.push(...tail);
			return;
		}
	}
}

$effect(() => {
	// Server-rendered page; client tick only runs in the browser.
	if (typeof window === 'undefined') return;

	function checkScroll(): void {
		const tolerance = 24;
		if (window.scrollY + window.innerHeight >= document.body.scrollHeight - tolerance) {
			scrolledToBottom = true;
		}
	}
	checkScroll();
	window.addEventListener('scroll', checkScroll, { passive: true });

	function tick(): void {
		if (document.visibilityState !== 'visible') return;
		const delta = HANDBOOK_HEARTBEAT_INTERVAL_SEC;
		openedSecondsInSession += delta;
		accumulatedSecondsThisLoad += delta;
		void postHeartbeat(delta);
	}
	const interval = window.setInterval(tick, HANDBOOK_HEARTBEAT_INTERVAL_SEC * 1000);

	return () => {
		window.clearInterval(interval);
		window.removeEventListener('scroll', checkScroll);
	};
});

function stripFrontmatter(md: string): string {
	if (!md.startsWith('---')) return md;
	const end = md.indexOf('\n---', 3);
	if (end < 0) return md;
	return md.slice(end + 4).replace(/^\n+/, '');
}

function figureUrl(assetPath: string): string {
	const stripped = assetPath.startsWith('handbooks/') ? assetPath.slice('handbooks/'.length) : assetPath;
	return `/handbook-asset/${stripped}`;
}

function dismissSuggestion(): void {
	suggestionDismissed = true;
}
</script>

<svelte:head>
	<title>{data.section.title} -- {data.reference.title}</title>
</svelte:head>

<header class="page-header">
	<nav aria-label="Breadcrumb">
		<a href={ROUTES.HANDBOOKS}>Handbooks</a> &raquo;
		<a href={ROUTES.HANDBOOK(data.reference.documentSlug)}>{data.reference.title}</a> &raquo;
		<a href={ROUTES.HANDBOOK_CHAPTER(data.reference.documentSlug, data.chapter.code)}
			>Ch {data.chapter.code}</a
		>
		&raquo; <span>§{data.section.code}</span>
	</nav>
	<h1>
		{data.section.title}
		<HandbookEditionBadge edition={data.reference.edition} />
	</h1>
	<p class="locator">{data.section.sourceLocator}</p>
</header>

<div class="reader">
	<article class="section-body">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html bodyHtml}

		{#each data.figures as fig (fig.id)}
			<figure class="inline-figure">
				<img src={figureUrl(fig.assetPath)} alt={fig.caption} loading="lazy" />
				<figcaption>{fig.caption}</figcaption>
			</figure>
		{/each}
	</article>

	{#if data.siblings.length > 0}
		<aside class="toc" aria-label="Sections in this chapter">
			<h3>In this chapter</h3>
			<ul>
				{#each data.siblings as sibling (sibling.id)}
					<li class:active={sibling.id === data.section.id}>
						<a
							href={ROUTES.HANDBOOK_SECTION(
								data.reference.documentSlug,
								data.chapter.code,
								sibling.code.split('.').slice(1).join('.'),
							)}
						>
							§{sibling.code} {sibling.title}
						</a>
					</li>
				{/each}
			</ul>
		</aside>
	{/if}
</div>

<HandbookCitingNodesPanel nodes={data.citingNodes} scope="section" />

{#if showSuggestion}
	<aside class="read-suggestion" role="status" aria-live="polite">
		<p class="read-suggestion-prompt">Mark this section as read?</p>
		<div class="read-suggestion-actions">
			<form method="POST" action="?/set-status">
				<input type="hidden" name="status" value={HANDBOOK_READ_STATUSES.READ} />
				<button type="submit" class="read-suggestion-primary">Mark as read</button>
			</form>
			<button type="button" class="read-suggestion-secondary" onclick={dismissSuggestion}>
				Not yet
			</button>
		</div>
	</aside>
{/if}

<HandbookReadProgressControl
	status={data.readState.status as HandbookReadStatus}
	comprehended={data.readState.comprehended}
	formAction="?/"
/>

<HandbookSectionNotes notesMd={data.readState.notesMd} formAction="?/set-notes" />

<style>
	.page-header {
		margin-bottom: var(--space-lg);
	}
	.page-header nav {
		color: var(--ink-muted);
		margin-bottom: var(--space-xs);
	}
	.page-header nav a {
		color: inherit;
	}
	.page-header h1 {
		margin: 0 0 var(--space-xs) 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}
	.locator {
		margin: 0;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}
	.reader {
		display: grid;
		grid-template-columns: 1fr 15rem;
		gap: var(--space-lg);
	}
	@media (max-width: 56rem) {
		.reader {
			grid-template-columns: 1fr;
		}
	}
	.section-body {
		line-height: var(--line-height-relaxed);
	}
	.section-body :global(p) {
		margin: 0 0 var(--space-sm) 0;
	}
	.section-body :global(h1),
	.section-body :global(h2),
	.section-body :global(h3) {
		margin: var(--space-lg) 0 var(--space-xs) 0;
	}
	.toc {
		position: sticky;
		top: var(--space-md);
		align-self: start;
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}
	.toc h3 {
		margin: 0 0 var(--space-xs) 0;
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
	}
	.toc ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.toc li {
		padding: var(--space-2xs) 0;
	}
	.toc li.active a {
		color: var(--action-default);
		font-weight: var(--font-weight-medium);
	}
	.toc a {
		color: inherit;
		text-decoration: none;
	}
	.toc a:hover,
	.toc a:focus-visible {
		text-decoration: underline;
	}
	.inline-figure {
		margin: var(--space-md) 0;
		text-align: center;
	}
	.inline-figure img {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-md);
	}
	.inline-figure figcaption {
		margin-top: var(--space-xs);
		color: var(--ink-muted);
	}
	.read-suggestion {
		margin-top: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}
	.read-suggestion-prompt {
		margin: 0;
		color: var(--ink-body);
		font-weight: var(--font-weight-medium);
	}
	.read-suggestion-actions {
		display: flex;
		gap: var(--space-xs);
	}
	.read-suggestion-actions form {
		margin: 0;
	}
	.read-suggestion-primary {
		background: var(--action-default);
		color: var(--action-default-ink);
		border: 1px solid var(--action-default);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		cursor: pointer;
		font-weight: var(--font-weight-medium);
	}
	.read-suggestion-primary:hover,
	.read-suggestion-primary:focus-visible {
		background: var(--action-default-hover, var(--action-default));
	}
	.read-suggestion-secondary {
		background: none;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		color: var(--ink-muted);
		cursor: pointer;
	}
	.read-suggestion-secondary:hover,
	.read-suggestion-secondary:focus-visible {
		border-color: var(--action-default-edge);
		color: var(--ink-body);
	}
</style>
