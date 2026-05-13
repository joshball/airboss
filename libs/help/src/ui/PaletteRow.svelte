<script lang="ts">
import type { SearchResult } from '../schema/result-types';
import { BUCKET_BY_TYPE, SHOWS_DOC_CODE_ROW } from '../schema/type-buckets';
import { accentFor } from './palette-accent';

/**
 * Shared row template for the palette result column + top-hits strip.
 *
 * Per WP decisions R8 + R14, published-reference rows ALWAYS show the
 * doc code in the leading slot (monospace, prominent) followed by the
 * title and a type chip. Non-published rows (knowledge, glossary, mine,
 * tools, app-help) skip the doc-code slot.
 *
 * The row carries collapse semantics via `children.length` -- handbook
 * roots with collapsed chapters render a small "+N chapters" indicator.
 *
 * Source of truth: `design/mockups/search/mockup-02-new-layout.md`
 * ("Row template").
 */

interface Props {
	result: SearchResult;
	/** Whether this row is currently highlighted (keyboard focus). */
	focused?: boolean;
	/** Optional click handler. The shape is the host's choice. */
	onActivate?: (result: SearchResult) => void;
	onHover?: (result: SearchResult) => void;
	/** Override for the type chip label. Defaults to a derived label. */
	chipLabel?: string;
}

let { result, focused = false, onActivate, onHover, chipLabel }: Props = $props();

const bucket = $derived(BUCKET_BY_TYPE[result.type]);
const accent = $derived(accentFor(result.type));
const showsCode = $derived(SHOWS_DOC_CODE_ROW.has(bucket));
const code = $derived<string>(result.docCode ?? '');
const hasCollapsedChildren = $derived<number>(result.children?.length ?? 0);

const label = $derived<string>(chipLabel ?? defaultChipLabel(result.type));

function defaultChipLabel(type: SearchResult['type']): string {
	if (type === 'faa.handbook') return 'Handbook';
	if (type === 'faa.handbook.chapter') return 'Chapter';
	if (type === 'faa.cfr.part') return 'CFR Part';
	if (type === 'faa.cfr.sect') return 'CFR';
	if (type === 'faa.aim') return 'AIM';
	if (type === 'faa.ac') return 'AC';
	if (type === 'faa.acs') return 'ACS';
	if (type === 'airboss.knode') return 'Knowledge';
	if (type === 'airboss.glossary') return 'Glossary';
	if (type === 'airboss.course') return 'Course';
	if (type === 'airboss.lesson') return 'Lesson';
	if (type === 'airboss.help') return 'App Help';
	if (type === 'mine.card') return 'Card';
	if (type === 'mine.rep') return 'Rep';
	if (type === 'mine.plan') return 'Plan';
	if (type === 'mine.note') return 'Note';
	if (type === 'web.tool') return 'Tool';
	if (type === 'cmd.action') return 'Action';
	if (type === 'cmd.goto') return 'Go to';
	return type;
}

function activate(): void {
	onActivate?.(result);
}

function hover(): void {
	onHover?.(result);
}
</script>

<button
	type="button"
	class="row"
	class:focused
	class:has-children={hasCollapsedChildren > 0}
	data-result-id={result.id}
	data-result-type={result.type}
	data-bucket={bucket}
	data-accent={accent}
	aria-current={focused ? 'true' : undefined}
	onclick={activate}
	onmouseenter={hover}
	data-testid="palette-row"
>
	{#if showsCode}
		<span class="code" data-testid="palette-row-code">{code}</span>
	{/if}
	<span class="title">{result.title}</span>
	{#if hasCollapsedChildren > 0}
		<span class="children-hint">+{hasCollapsedChildren}</span>
	{/if}
	<span class="chip" data-testid="palette-row-chip">{label}</span>
	{#if result.snippet}
		<span class="snippet">{result.snippet}</span>
	{/if}
</button>

<style>
	.row {
		display: grid;
		grid-template-columns: minmax(7rem, auto) 1fr auto auto;
		align-items: baseline;
		gap: var(--space-sm);
		width: 100%;
		text-align: left;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		cursor: pointer;
		color: inherit;
		font: inherit;
		font-size: var(--font-size-sm);
		transition: background var(--palette-motion-duration-xs) var(--palette-motion-ease-out),
			border-color var(--palette-motion-duration-xs) var(--palette-motion-ease-out);
		border-left-width: 3px;
	}

	/* Rows without a doc-code column become 3-col so the title takes the slot. */
	.row:not([data-bucket='handbooks']):not([data-bucket='cfrs']):not([data-bucket='aim']):not([data-bucket='ac']):not([data-bucket='acs']) {
		grid-template-columns: 1fr auto auto;
	}

	.row[data-accent='amber'] { border-left-color: var(--palette-accent-amber-edge); }
	.row[data-accent='violet'] { border-left-color: var(--palette-accent-violet-edge); }
	.row[data-accent='cyan'] { border-left-color: var(--palette-accent-cyan-edge); }
	.row[data-accent='green'] { border-left-color: var(--palette-accent-green-edge); }
	.row[data-accent='rose'] { border-left-color: var(--palette-accent-rose-edge); }
	.row[data-accent='cmd'] { border-left-color: var(--palette-accent-cmd-edge); }

	.row:hover {
		background: var(--surface-sunken);
	}

	.row.focused[data-accent='amber'] { background: var(--palette-accent-amber-wash); }
	.row.focused[data-accent='violet'] { background: var(--palette-accent-violet-wash); }
	.row.focused[data-accent='cyan'] { background: var(--palette-accent-cyan-wash); }
	.row.focused[data-accent='green'] { background: var(--palette-accent-green-wash); }
	.row.focused[data-accent='rose'] { background: var(--palette-accent-rose-wash); }
	.row.focused { border-color: var(--edge-strong); }

	.row:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.code {
		font-family: var(--font-family-mono);
		color: var(--palette-accent-amber);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-xs);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: var(--font-weight-semibold);
	}

	.chip {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		padding: var(--space-3xs) var(--space-xs);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-subtle);
	}

	.row[data-accent='amber'] .chip {
		color: var(--palette-accent-amber);
		background: var(--palette-accent-amber-wash);
		border-color: var(--palette-accent-amber-edge);
	}

	.children-hint {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		font-variant-numeric: tabular-nums;
	}

	.snippet {
		grid-column: 1 / -1;
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
