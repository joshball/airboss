<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { Reference } from '../schema/reference';

/**
 * Inline reference term. Three render modes line up with the three
 * wiki-link parser modes:
 *
 *   reference + display  -- full tooltip (hover/focus/tap)
 *   reference, no display -- uses reference.displayName as text
 *   display only, no reference -- dev-mode yellow underline ("needs link")
 *
 * Interactions:
 *   Desktop: hover opens popover; click navigates
 *   Touch:   first tap opens popover; second tap navigates
 *   Keyboard: focus shows popover; Enter navigates
 *
 * Popover is role="tooltip" with aria-describedby linkage for screen
 * readers.
 */

const MAX_POPOVER_PREVIEW = 280;

let {
	reference,
	display,
	devMode = false,
}: {
	reference?: Reference;
	display?: string | null;
	devMode?: boolean;
} = $props();

let hovered = $state(false);
let focused = $state(false);
let tapOpened = $state(false);
let tooltipId = $state(`ref-tt-${Math.random().toString(36).slice(2)}`);

const text = $derived(display ?? reference?.displayName ?? '(missing reference)');
const open = $derived(Boolean(reference && (hovered || focused || tapOpened)));

function onTap(event: MouseEvent) {
	if (!reference) return;
	if (!tapOpened) {
		event.preventDefault();
		tapOpened = true;
	}
}

function onKey(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		tapOpened = false;
		hovered = false;
	}
}

function truncate(text: string, max: number): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= max) return collapsed;
	return `${collapsed.slice(0, max).trimEnd()}...`;
}
</script>

{#if reference}
	<span class="term" onkeydown={onKey} role="presentation">
		<a
			class="link"
			href={ROUTES.GLOSSARY_ID(reference.id)}
			aria-describedby={open ? tooltipId : undefined}
			onmouseenter={() => (hovered = true)}
			onmouseleave={() => (hovered = false)}
			onfocus={() => (focused = true)}
			onblur={() => (focused = false)}
			onclick={onTap}
		>
			{text}
		</a>
		{#if open}
			<span class="popover" id={tooltipId} role="tooltip">
				<span class="pop-title">{reference.displayName}</span>
				<span class="pop-body">{truncate(reference.paraphrase, MAX_POPOVER_PREVIEW)}</span>
				<span class="pop-tags">
					<span class="chip">{reference.tags.sourceType}</span>
					<span class="chip">{reference.tags.flightRules}</span>
					{#each reference.tags.aviationTopic as topic (topic)}
						<span class="chip">{topic}</span>
					{/each}
				</span>
				<span class="pop-hint">Press Enter to open full reference</span>
			</span>
		{/if}
	</span>
{:else}
	<span class="term unresolved" class:dev={devMode}>
		{text}
	</span>
{/if}

<style>
	.term {
		position: relative;
		display: inline;
	}

	.link {
		color: var(--action-default);
		text-decoration: none;
		border-bottom: 1px dotted currentColor;
	}

	.link:hover,
	.link:focus-visible {
		text-decoration: underline;
		outline: none;
	}

	.link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}

	.unresolved {
		color: var(--ink-body);
	}

	.unresolved.dev {
		background: var(--action-caution-wash);
		border-bottom: 1px dashed var(--action-caution);
	}

	.popover {
		position: absolute;
		left: 0;
		top: calc(100% + 4px);
		z-index: var(--z-popover);
		min-width: 18rem;
		max-width: 24rem;
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: 0.625rem 0.75rem;
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: 0.875rem;
		font-weight: 400;
		white-space: normal;
	}

	.pop-title {
		font-weight: 600;
		color: var(--ink-body);
	}

	.pop-body {
		color: var(--ink-muted);
		line-height: 1.4;
	}

	.pop-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.chip {
		font-size: 0.6875rem;
		padding: 0.0625rem 0.375rem;
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.pop-hint {
		font-size: 0.6875rem;
		color: var(--ink-subtle);
	}
</style>
