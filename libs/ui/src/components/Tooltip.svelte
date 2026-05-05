<script lang="ts" module>
/**
 * Module-scoped instance counter -- one tooltip id per mount, so the
 * same glossary `for=` key on multiple call sites produces unique
 * `id="tooltip-<key>-<n>"` ids. WCAG 4.1.1 (parsing) requires unique
 * ids; previously every `<Tooltip for="goal">` collapsed to
 * `id="tooltip-goal"` which the home page mounts three times.
 */
let nextInstanceId = 0;
function nextTooltipInstance(): number {
	nextInstanceId += 1;
	return nextInstanceId;
}
</script>

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
 *   - Hover and keyboard focus both open. Blur, Esc, and pointer-down
 *     outside the trigger dismiss.
 *   - Tap opens on touch devices; tap outside the trigger dismisses
 *     (document-scoped `pointerdown` listener mounted only while open).
 *   - `role="tooltip"` on the popover with a per-instance unique `id`.
 *     The trigger wraps its child in a `span` with `aria-describedby`
 *     pointing at the id while open.
 *   - `:focus-visible` paints an explicit focus ring so keyboard users
 *     see the trigger has focus.
 *   - The popover is purely descriptive -- no interactive content. (For
 *     interactive content with a "learn more" link, use `<InfoTip>`.)
 *   - `tabindex="0"` is opt-in via the `focusable` prop. Plain-text
 *     wrappers default to non-focusable so a long sentence with multiple
 *     `<Tooltip>`s doesn't litter the tab order.
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
	/**
	 * Add a `tabindex="0"` to the host span. Default `false` -- inline
	 * prose wrappers stay out of the tab order. Set `true` only when the
	 * tooltip wraps content that has no other focusable element (a
	 * standalone label / chip).
	 */
	focusable?: boolean;
}

const {
	for: glossaryKey,
	term: literalTerm,
	definition: literalDefinition,
	children,
	placement = 'top',
	focusable = false,
}: Props = $props();

const instance = nextTooltipInstance();
let open = $state(false);
let triggerEl = $state<HTMLSpanElement | null>(null);

const resolved = $derived<{ term: string; short: string } | null>(
	literalTerm !== undefined && literalDefinition !== undefined
		? { term: literalTerm, short: literalDefinition }
		: glossaryKey === undefined
			? null
			: (getTooltipGlossaryResolver()?.(glossaryKey) ?? null),
);

const tooltipId = $derived(
	`tooltip-${(glossaryKey ?? literalTerm ?? 'unknown').replace(/\s+/g, '-').toLowerCase()}-${instance}`,
);

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

// Document-scoped pointerdown listener: mount only while the bubble is
// open, unmount on close. Closes the bubble when the pointer goes down
// outside the trigger -- the missing "tap-outside dismisses" branch on
// touch devices, which `onmouseleave` does not cover.
$effect(() => {
	if (!open) return;
	function handleOutside(event: PointerEvent) {
		if (triggerEl !== null && event.target instanceof Node && triggerEl.contains(event.target)) return;
		open = false;
	}
	document.addEventListener('pointerdown', handleOutside, true);
	return () => document.removeEventListener('pointerdown', handleOutside, true);
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

<!--
	Svelte's a11y heuristic doesn't model the tooltip pattern well: the host
	is a non-interactive descriptor, but it must accept hover/focus/touch to
	surface the definition. WAI's tooltip pattern uses the trigger's existing
	focusability + aria-describedby. We default to NOT adding tabindex so
	a paragraph with many tooltips stays readable; consumers wrapping a
	standalone non-focusable label can opt in via `focusable`.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<span
	class="tooltip-host"
	bind:this={triggerEl}
	role="group"
	tabindex={focusable ? 0 : undefined}
	onmouseenter={handleOpen}
	onmouseleave={handleClose}
	onfocusin={handleOpen}
	onfocusout={handleClose}
	ontouchstart={handleOpen}
	onkeydown={handleKey}
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

	.tooltip-host:focus-visible {
		outline: 2px solid var(--action-default);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
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
