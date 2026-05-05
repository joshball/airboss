<script lang="ts">
import AmendmentPanel from '@ab/aviation/ui/handbooks/AmendmentPanel.svelte';
import HandbookCitingNodesPanel from '@ab/aviation/ui/handbooks/HandbookCitingNodesPanel.svelte';
import HandbookEditionBadge from '@ab/aviation/ui/handbooks/HandbookEditionBadge.svelte';
import HandbookReadProgressControl from '@ab/aviation/ui/handbooks/HandbookReadProgressControl.svelte';
import HandbookSectionNotes from '@ab/aviation/ui/handbooks/HandbookSectionNotes.svelte';
import {
	HANDBOOK_HEARTBEAT_INTERVAL_SEC,
	HANDBOOK_HEARTBEAT_MIN_DELTA_SEC,
	type HandbookReadStatus,
	ROUTES,
} from '@ab/constants';
import { extractImageUrls, normalizeHandbookAssetPath, renderMarkdown } from '@ab/utils';
import type { PageData } from './$types';
import { createHeartbeatQueue, fetchHeartbeatPost } from './heartbeat-client';
import ReadSuggestionPanel from './ReadSuggestionPanel.svelte';
import { shouldShowReadSuggestion } from './read-suggestion';

let { data }: { data: PageData } = $props();

const bodyMd = $derived(stripFrontmatter(data.section.contentMd));
const bodyHtml = $derived(renderMarkdown(bodyMd));

// Dedup the manifest's figure list against figures already embedded inline in
// the body markdown. Without this, sections whose markdown contains
// `![alt](url)` images render the figure both in the body and again under the
// "figures" tail block.
const inlineAssetPaths = $derived(new Set(extractImageUrls(bodyMd).map((url) => normalizeHandbookAssetPath(url))));
const orphanFigures = $derived(
	data.figures.filter((fig) => !inlineAssetPaths.has(normalizeHandbookAssetPath(fig.assetPath))),
);

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
	ROUTES.LIBRARY_HANDBOOK_SECTION_HEARTBEAT(
		data.reference.documentSlug,
		data.chapter.code,
		data.section.code.split('.').slice(1).join('.'),
	),
);

$effect(() => {
	// Server-rendered page; client tick only runs in the browser.
	if (typeof window === 'undefined') return;

	// Single-flight FIFO queue over heartbeat deltas. The queue is
	// single-flight (concurrent `enqueue` calls collapse onto one in-
	// flight POST chain) so a tick that fires while a previous POST is
	// still in flight (slow network, paused dev backend) cannot race
	// the buffer. The local `accumulatedSecondsThisLoad` only advances
	// when the queue confirms delivery via `onCredit`, so
	// `totalSecondsVisible` cannot drift above the server's
	// authoritative count when the network is degraded.
	const heartbeatQueue = createHeartbeatQueue(heartbeatUrl, {
		post: fetchHeartbeatPost,
		onCredit: (deltaSec) => {
			accumulatedSecondsThisLoad += deltaSec;
		},
	});

	function checkScroll(): void {
		const tolerance = 24;
		if (window.scrollY + window.innerHeight >= document.body.scrollHeight - tolerance) {
			scrolledToBottom = true;
		}
	}
	checkScroll();
	window.addEventListener('scroll', checkScroll, { passive: true });

	let lastTickTs = Date.now();
	function tick(): void {
		if (document.visibilityState !== 'visible') return;
		const delta = HANDBOOK_HEARTBEAT_INTERVAL_SEC;
		openedSecondsInSession += delta;
		lastTickTs = Date.now();
		heartbeatQueue.enqueue(delta);
	}
	const interval = window.setInterval(tick, HANDBOOK_HEARTBEAT_INTERVAL_SEC * 1000);

	// Flush partial deltas on tab hide / page unload so the read-time spent
	// since the last tick isn't silently dropped. `sendBeacon` keeps the
	// payload in flight after the document is torn down (whereas fetch can
	// be aborted by the unload). Falls back to fetch when the API is
	// unavailable.
	//
	// The local accumulator is only credited when delivery is confirmed: a
	// `sendBeacon` `true` return (the OS queued the request) or a fetch
	// 2xx. A `false` / 4xx / 5xx leaves `accumulatedSecondsThisLoad`
	// alone so the local mirror cannot drift above the server's
	// authoritative count when the network is degraded or the request
	// is rejected (e.g. the anti-flood floor or the per-route cap).
	function flushPartial(): void {
		if (typeof document === 'undefined') return;
		if (document.visibilityState === 'visible') return;
		const elapsedSec = Math.floor((Date.now() - lastTickTs) / 1000);
		if (elapsedSec < HANDBOOK_HEARTBEAT_MIN_DELTA_SEC) return;
		lastTickTs = Date.now();
		const body = JSON.stringify({ delta: elapsedSec });
		if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
			const blob = new Blob([body], { type: 'application/json' });
			const queued = navigator.sendBeacon(heartbeatUrl, blob);
			// `sendBeacon` returns `true` only when the user agent queued the
			// request for delivery; a `false` (size limits, queue full,
			// off-network) means the bytes were dropped and the local
			// mirror must not advance.
			if (queued) accumulatedSecondsThisLoad += elapsedSec;
		} else {
			void fetch(heartbeatUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body,
				keepalive: true,
			})
				.then((response) => {
					if (response.ok) accumulatedSecondsThisLoad += elapsedSec;
				})
				.catch(() => {
					/* best-effort on unload */
				});
		}
	}
	document.addEventListener('visibilitychange', flushPartial);
	window.addEventListener('pagehide', flushPartial);

	return () => {
		window.clearInterval(interval);
		window.removeEventListener('scroll', checkScroll);
		document.removeEventListener('visibilitychange', flushPartial);
		window.removeEventListener('pagehide', flushPartial);
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
	return ROUTES.HANDBOOK_ASSET(stripped);
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
		<a href={ROUTES.LIBRARY}>Library</a> &raquo;
		<a href={ROUTES.LIBRARY_HANDBOOK(data.reference.documentSlug)}>{data.reference.title}</a> &raquo;
		<a href={ROUTES.LIBRARY_HANDBOOK_CHAPTER(data.reference.documentSlug, data.chapter.code)}
			>Ch {data.chapter.code}</a
		>
		&raquo; <span>§{data.section.code}</span>
	</nav>
	<h1 data-testid="page-anchor">
		{data.section.title}
		<HandbookEditionBadge edition={data.reference.edition} />
	</h1>
	<p class="locator">{data.section.sourceLocator}</p>
	<AmendmentPanel entries={data.errata} />
</header>

<div class="reader">
	<article class="section-body">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html bodyHtml}

		{#each orphanFigures as fig (fig.id)}
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
							href={ROUTES.LIBRARY_HANDBOOK_SECTION(
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
	<ReadSuggestionPanel onDismiss={dismissSuggestion} />
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
	.page-header nav a:hover,
	.page-header nav a:focus-visible {
		text-decoration: underline;
	}
	.page-header nav a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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

</style>
