<script lang="ts">
/**
 * Lightweight glossary tooltip.
 *
 * One-liner definition revealed on hover, keyboard focus, or tap (touch).
 * Used to disambiguate terms used in nav, page titles, and dashboard
 * tile labels (Quals / Goal / Plan / Cards / Reps / Calibration / ...).
 *
 * Two modes:
 *
 *   1. Literal: pass `term` + `definition` directly. `<Tooltip term="Quals"
 *      definition="Qualifications -- the certs you're working toward.">
 *      <span>Quals</span></Tooltip>`. The trigger inherits its visual style
 *      from the wrapping context; the component only adds an underline cue.
 *
 *   2. Glossary key: pass `for="qual"`. The component consults the
 *      registered glossary resolver (see `lib/tooltip-glossary-resolver.ts`)
 *      and reads the entry's `term` + `short`. Apps register the resolver
 *      at boot via `setTooltipGlossaryResolver(...)`. When no resolver is
 *      set (libs without a glossary, tests) the tooltip degrades silently
 *      to no-op rendering of the trigger.
 *
 * A11y:
 *
 *   - Hover and keyboard focus both open. Blur and Esc dismiss.
 *   - Tap opens on touch devices; tap outside dismisses.
 *   - `role="tooltip"` on the popover with a generated `id`. The trigger
 *     wraps its child in a `span` with `aria-describedby` pointing at the
 *     tooltip id.
 *   - The popover is purely descriptive -- no interactive content. (For
 *     interactive content with a "learn more" link, use `<InfoTip>`.)
 */

import { type Snippet, untrack } from 'svelte';
import { getTooltipGlossaryResolver } from '../lib/tooltip-glossary-resolver';

interface Props {
	/** Glossary key. Reads `term` + `short` via the registered resolver. Mutually exclusive with `term + definition`. */
	for?: string;
	/** Literal display term. Required when `for` is not set. */
	term?: string;
	/** Literal one-line definition. Required when `for` is not set. */
	definition?: string;
	/** The trigger element (text, label, etc.). The tooltip wraps it. */
	children: Snippet;
	/** Preferred placement. Default `top`. */
	placement?: 'top' | 'bottom' | 'left' | 'right';
}

const {
	for: glossaryKey,
	term: literalTerm,
	definition: literalDefinition,
	children,
	placement = 'top',
}: Props = $props();

let open = $state(false);
let triggerEl = $state<HTMLSpanElement | null>(null);

const resolved = $derived.by<{ term: string; short: string } | null>(() => {
	if (literalTerm !== undefined && literalDefinition !== undefined) {
		return { term: literalTerm, short: literalDefinition };
	}
	if (glossaryKey === undefined) return null;
	const resolver = getTooltipGlossaryResolver();
	if (resolver === null) return null;
	return resolver(glossaryKey);
});

const tooltipId = $derived(`tooltip-${(glossaryKey ?? literalTerm ?? 'unknown').replace(/\s+/g, '-').toLowerCase()}`);

// Dev-only warning when neither literal nor glossary key resolved. Untrack
// so the warning doesn't fire reactively during prop transitions.
$effect(() => {
	if (!import.meta.env.DEV) return;
	const r = resolved;
	untrack(() => {
		if (r === null && glossaryKey !== undefined) {
			// biome-ignore lint/suspicious/noConsole: dev-only authoring guard
			console.warn(`Tooltip: glossary key "${glossaryKey}" did not resolve. Is the resolver registered?`);
		}
	});
});

function handleOpen() {
	if (resolved !== null) open = true;
}

function handleClose() {
	open = false;
}

function handleKey(event: KeyboardEvent) {
	if (event.key === 'Escape' && open) {
		open = false;
		triggerEl?.focus();
	}
}
</script>

<svelte:window onkeydown={handleKey} />

<!--
	Svelte's a11y heuristic doesn't model the tooltip pattern well: the host
	is a non-interactive descriptor, but it must accept hover/focus/touch to
	surface the definition. WAI's tooltip pattern uses the trigger's existing
	focusability (whatever the child is) + aria-describedby. We add tabindex
	to keep keyboard parity when consumers wrap a non-focusable child like
	plain text. role="group" advertises "this contains related content" and
	is honored by screen readers without implying activation.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
	class="tooltip-host"
	bind:this={triggerEl}
	role="group"
	tabindex="0"
	onmouseenter={handleOpen}
	onmouseleave={handleClose}
	onfocusin={handleOpen}
	onfocusout={handleClose}
	ontouchstart={handleOpen}
	aria-describedby={open && resolved !== null ? tooltipId : undefined}
>
	{@render children()}
	{#if open && resolved !== null}
		<span id={tooltipId} role="tooltip" class="tooltip-bubble" data-placement={placement}>
			<span class="term">{resolved.term}</span>
			<span class="def">{resolved.short}</span>
		</span>
	{/if}
</span>

<style>
	.tooltip-host {
		position: relative;
		display: inline;
		text-decoration: underline dotted;
		text-underline-offset: 0.2em;
		text-decoration-color: var(--ink-muted);
		cursor: help;
	}

	.tooltip-bubble {
		position: absolute;
		z-index: var(--z-popover);
		max-width: 24rem;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-md);
		font-size: var(--font-size-sm);
		font-weight: normal;
		line-height: 1.4;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		text-decoration: none;
	}

	.tooltip-bubble[data-placement='top'] {
		bottom: calc(100% + var(--space-2xs));
		left: 50%;
		transform: translateX(-50%);
	}

	.tooltip-bubble[data-placement='bottom'] {
		top: calc(100% + var(--space-2xs));
		left: 50%;
		transform: translateX(-50%);
	}

	.tooltip-bubble[data-placement='left'] {
		right: calc(100% + var(--space-2xs));
		top: 50%;
		transform: translateY(-50%);
	}

	.tooltip-bubble[data-placement='right'] {
		left: calc(100% + var(--space-2xs));
		top: 50%;
		transform: translateY(-50%);
	}

	.term {
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-body);
	}

	.def {
		color: var(--ink-muted);
	}
</style>
