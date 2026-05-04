<script lang="ts">
/**
 * One leaf row in the cert map. Renders the status glyph (✓ / ⊙ / ○),
 * the leaf code + title, the U / M / P pills (per-method gates), and a
 * folded citation panel that expands to two stacks (handbook +
 * regulation).
 *
 * The pills are computed from `node.pills` (per-method
 * `NodeEvidenceState`) intersected with `node.requiredKinds`. A method
 * not in the required set renders as `--` (not applicable for this
 * leaf). Any-passes semantics: a method gates `●` on `pass`, `○` on
 * any other non-NA gate.
 */

import { type AssessmentMethod, type CitationOrder, NODE_MASTERY_GATES } from '@ab/constants';
import type { MapNode } from '../_lib/map-types';
import CitationStacks from './CitationStacks.svelte';

interface Props {
	node: MapNode;
	citationOrder: CitationOrder;
}

let { node, citationOrder }: Props = $props();

type Pill = '●' | '○' | '--';

function pillFor(node: MapNode, method: AssessmentMethod): Pill {
	const required = node.requiredKinds ?? [];
	if (!(required as readonly string[]).includes(method)) return '--';
	const state = node.pills?.[method];
	if (state === undefined || state === NODE_MASTERY_GATES.NOT_APPLICABLE) return '--';
	if (state === NODE_MASTERY_GATES.PASS) return '●';
	return '○';
}

function statusGlyph(node: MapNode): '✓' | '⊙' | '○' {
	const required = node.requiredKinds ?? [];
	if (required.length === 0) return '○';
	let allMastered = true;
	let anyAttempted = false;
	for (const method of required) {
		const state = node.pills?.[method];
		if (state === NODE_MASTERY_GATES.PASS) {
			anyAttempted = true;
		} else if (state === NODE_MASTERY_GATES.FAIL || state === NODE_MASTERY_GATES.INSUFFICIENT_DATA) {
			anyAttempted = true;
			allMastered = false;
		} else {
			allMastered = false;
		}
	}
	if (allMastered) return '✓';
	return anyAttempted ? '⊙' : '○';
}

const recallPill = $derived(pillFor(node, 'recall'));
const calcPill = $derived(pillFor(node, 'calculation'));
const scenarioPill = $derived(pillFor(node, 'scenario'));
const glyph = $derived(statusGlyph(node));
const hasCitations = $derived((node.citations?.handbook.length ?? 0) + (node.citations?.regulation.length ?? 0) > 0);
</script>

<details class="leaf">
	<summary>
		<span class="glyph" aria-label={`status ${glyph}`}>{glyph}</span>
		<span class="code">{node.code ?? ''}</span>
		<span class="title">{node.label}</span>
		<span class="pills" aria-label="U {recallPill} M {calcPill} P {scenarioPill}">
			<span class="pill">U:{recallPill}</span>
			<span class="pill">M:{calcPill}</span>
			<span class="pill">P:{scenarioPill}</span>
		</span>
	</summary>
	{#if hasCitations && node.citations !== undefined}
		<CitationStacks stacks={node.citations} {citationOrder} />
	{:else}
		<p class="empty">No citations on this leaf yet.</p>
	{/if}
</details>

<style>
.leaf {
	border-bottom: 1px solid var(--edge-default);
	padding: var(--space-2xs) 0;
}

.leaf > summary {
	display: flex;
	align-items: baseline;
	gap: var(--space-sm);
	cursor: pointer;
	list-style: none;
}

.leaf > summary::-webkit-details-marker {
	display: none;
}

.glyph {
	width: 1ch;
	font-family: var(--font-family-mono);
	color: var(--link-default);
}

.code {
	color: var(--ink-muted);
	font-variant-numeric: tabular-nums;
	min-width: 6ch;
}

.title {
	flex: 1 1 auto;
	color: var(--ink-body);
}

.pills {
	display: flex;
	gap: var(--space-sm);
	font-family: var(--font-family-mono);
	font-size: var(--font-size-sm);
	color: var(--ink-body);
}

.pill {
	display: inline-block;
	min-width: 4ch;
	text-align: center;
}

.empty {
	color: var(--ink-muted);
	font-size: var(--font-size-sm);
	margin: var(--space-2xs) 0 0 calc(1ch + var(--space-sm));
}

@media (max-width: 700px) {
	.leaf > summary {
		flex-wrap: wrap;
	}
	.pills {
		flex-basis: 100%;
		padding-left: calc(1ch + var(--space-sm));
	}
}
</style>
