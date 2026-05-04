<script lang="ts">
/**
 * Recursive tree renderer for every map projection.
 *
 * Per spec: a single component handles ACS / Handbook / Course since
 * each produces a `MapNode[]` with the same shape. Group + subgroup
 * rows are `<details>` so the expand / collapse behavior is browser-
 * native (keyboard support comes for free). Leaf rows are rendered via
 * `<LeafRow>`.
 */

import type { CitationOrder } from '@ab/constants';
import type { MapNode } from '../_lib/map-types';
import LeafRow from './LeafRow.svelte';
import MapTree from './MapTree.svelte';

interface Props {
	nodes: readonly MapNode[];
	citationOrder: CitationOrder;
	depth?: number;
}

let { nodes, citationOrder, depth = 0 }: Props = $props();

function pct(rollup: MapNode['rollup']): number {
	if (rollup === null || rollup.totalLeaves === 0) return 0;
	return Math.round((rollup.masteredLeaves / rollup.totalLeaves) * 100);
}

function dotbar(rollup: MapNode['rollup'], width = 10): string {
	if (rollup === null || rollup.totalLeaves === 0) return '○'.repeat(width);
	const filled = Math.round((rollup.masteredLeaves / rollup.totalLeaves) * width);
	return '●'.repeat(filled) + '○'.repeat(Math.max(0, width - filled));
}
</script>

<ul class="tree" data-depth={depth}>
	{#each nodes as node (node.id)}
		<li class="row level-{node.level}">
			{#if node.level === 'leaf'}
				<LeafRow {node} {citationOrder} />
			{:else}
				<details open={node.defaultOpen ?? false}>
					<summary>
						<span class="code">{node.code ?? ''}</span>
						<span class="label">{node.label}</span>
						{#if node.badge}
							<span class="badge">{node.badge}</span>
						{/if}
						{#if node.rollup !== null}
							<span class="dotbar" aria-hidden="true">{dotbar(node.rollup)}</span>
							<span class="pct" aria-label="{pct(node.rollup)} percent mastered">{pct(node.rollup)}%</span>
						{/if}
					</summary>
					{#if node.children.length > 0}
						<MapTree nodes={node.children} {citationOrder} depth={depth + 1} />
					{/if}
				</details>
			{/if}
		</li>
	{/each}
</ul>

<style>
.tree {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-2xs);
}

.tree[data-depth='1'],
.tree[data-depth='2'] {
	padding-left: var(--space-md);
}

.row {
	margin: 0;
}

details > summary {
	display: flex;
	align-items: baseline;
	gap: var(--space-sm);
	cursor: pointer;
	padding: var(--space-2xs) 0;
	font-size: var(--font-size-md);
	list-style: none;
}

details > summary::-webkit-details-marker {
	display: none;
}

details > summary::before {
	content: '▸';
	display: inline-block;
	width: 1ch;
	color: var(--ink-muted);
}

details[open] > summary::before {
	content: '▾';
}

.code {
	color: var(--ink-muted);
	font-variant-numeric: tabular-nums;
	min-width: 4ch;
}

.label {
	color: var(--ink-body);
	flex: 1 1 auto;
}

.badge {
	font-size: var(--font-size-sm);
	color: var(--ink-muted);
}

.dotbar {
	font-family: var(--font-family-mono);
	letter-spacing: -1px;
	color: var(--ink-accent);
	font-size: var(--font-size-sm);
}

.pct {
	font-variant-numeric: tabular-nums;
	color: var(--ink-muted);
	min-width: 4ch;
	text-align: right;
}
</style>
