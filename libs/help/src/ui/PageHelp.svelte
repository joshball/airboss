<script lang="ts">
/**
 * Per-page help affordance. Renders a chicklet button in the page header
 * that opens a slide-over drawer containing the help page body. If the
 * page id doesn't exist in the registry, renders nothing (with a dev-only
 * warning) so authors notice during development without silently shipping
 * broken help links.
 *
 * The drawer reuses the same markdown renderer as `/help/[id]` so content
 * authors only maintain one pipeline. State survives reload and deep-link
 * via `?help=<id>` -- clicking the chicklet writes the query param via
 * `replaceState`; mounting a page with the param already set auto-opens
 * the drawer.
 *
 * Variants:
 *   - `icon+text` (default): renders `[? Help]` inside a pill-shaped chicklet.
 *   - `icon`: renders `[?]` glyph inside the same chicklet. Reserved for
 *     tight contexts; a bare unframed `?` is not permitted anywhere.
 */

import { HELP_TRIGGER_LABELS, QUERY_PARAMS } from '@ab/constants';
import Drawer from '@ab/ui/components/Drawer.svelte';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import { parseMarkdown } from '../markdown';
import type { MdNode } from '../markdown/ast';
import { helpRegistry } from '../registry';
import ExternalRefsFooter from './ExternalRefsFooter.svelte';
import HelpSection from './HelpSection.svelte';
import { isHelpTargetMatch, withHelpParam } from './page-help-url';

let {
	pageId,
	label = HELP_TRIGGER_LABELS.PAGE,
	variant = 'icon+text',
}: {
	pageId: string;
	label?: string;
	variant?: 'icon' | 'icon+text';
} = $props();

const helpPage = $derived(helpRegistry.getById(pageId));
const exists = $derived(helpPage !== undefined);
const accessibleLabel = $derived(label ? `Help: ${label}` : 'Help for this page');
const titleId = $derived(`pagehelp-title-${pageId}`);

let open = $state(false);
let sectionNodes = $state<Record<string, MdNode[]> | null>(null);
let loading = $state(false);
let parseError = $state<string | null>(null);

$effect(() => {
	if (!exists && import.meta.env.DEV) {
		// biome-ignore lint/suspicious/noConsole: dev-only authoring guard
		console.warn(`PageHelp: no help page registered for id '${pageId}'.`);
	}
});

// Auto-open on mount / nav if `?help=<id>` matches this PageHelp instance.
// Reading `page.url` keeps the effect reactive to navigation; we only
// open (never close) from the URL so manual close doesn't fight an
// external param that hasn't been cleared yet.
$effect(() => {
	if (!exists) return;
	if (isHelpTargetMatch(page.url, pageId) && !open) {
		openDrawer();
	}
});

async function loadContent(): Promise<void> {
	if (!helpPage || sectionNodes !== null) return;
	loading = true;
	parseError = null;
	try {
		const next: Record<string, MdNode[]> = {};
		for (const section of helpPage.sections) {
			next[section.id] = await parseMarkdown(section.body);
		}
		sectionNodes = next;
	} catch (err) {
		parseError = err instanceof Error ? err.message : 'Failed to render help content.';
	} finally {
		loading = false;
	}
}

function writeHelpParam(id: string | null): void {
	const current = page.url.searchParams.get(QUERY_PARAMS.HELP);
	if ((id ?? null) === (current ?? null)) return;
	const nextUrl = withHelpParam(page.url, id);
	replaceState(nextUrl, page.state);
}

function openDrawer(): void {
	open = true;
	writeHelpParam(pageId);
	void loadContent();
}

function handleClose(): void {
	writeHelpParam(null);
}

function handleTriggerClick(event: MouseEvent): void {
	event.preventDefault();
	openDrawer();
}
</script>

{#if exists && helpPage}
	<button
		type="button"
		class="pagehelp"
		class:icon-only={variant === 'icon'}
		aria-label={accessibleLabel}
		aria-haspopup="dialog"
		aria-expanded={open}
		title={accessibleLabel}
		data-testid="pagehelp-trigger"
		data-state={open ? 'open' : 'closed'}
		data-variant={variant}
		onclick={handleTriggerClick}
	>
		<span class="glyph" aria-hidden="true">?</span>
		{#if variant === 'icon+text' && label}
			<span class="label">{label}</span>
		{/if}
	</button>

	<Drawer
		bind:open
		side="end"
		size="lg"
		ariaLabelledby={titleId}
		onClose={handleClose}
	>
		{#snippet header()}
			<div class="drawer-head">
				<p class="eyebrow">Help</p>
				<h2 id={titleId} class="drawer-title">{helpPage.title}</h2>
				{#if helpPage.summary}
					<p class="drawer-summary">{helpPage.summary}</p>
				{/if}
			</div>
		{/snippet}
		{#snippet body()}
			{#if loading && sectionNodes === null}
				<p class="state" role="status">Loading help content...</p>
			{:else if parseError}
				<p class="state error" role="alert">{parseError}</p>
			{:else if sectionNodes}
				<div class="sections">
					{#each helpPage.sections as section, index (section.id)}
						<HelpSection {section} showHeading={index !== 0} nodes={sectionNodes[section.id]} />
					{/each}
					<ExternalRefsFooter refs={helpPage.externalRefs} />
				</div>
			{/if}
		{/snippet}
	</Drawer>
{/if}

<style>
	.pagehelp {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		height: 1.75rem;
		padding: 0 var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink-subtle);
		font-family: inherit;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		line-height: 1;
		cursor: pointer;
		transition:
			color var(--motion-fast),
			border-color var(--motion-fast),
			background var(--motion-fast);
	}

	.pagehelp.icon-only {
		width: 1.75rem;
		padding: 0;
	}

	.glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: var(--radius-pill);
	}

	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
	}

	.pagehelp:hover {
		color: var(--action-default);
		border-color: var(--edge-strong);
		background: var(--surface-sunken);
	}

	.pagehelp:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.drawer-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.eyebrow {
		margin: 0;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-subtle);
	}

	.drawer-title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.drawer-summary {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		line-height: var(--line-height-normal);
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.state {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.state.error {
		color: var(--signal-danger-ink);
	}
</style>
