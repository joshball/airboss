<script lang="ts">
import DataTable, { type DataTableColumn } from '@ab/ui/components/DataTable.svelte';
import { parseCsv } from './parse-csv';

/**
 * CSV preview backed by `<DataTable>`. The on-disk file is parsed once on
 * mount-time props (no streaming) since the load function caps `previewText`
 * at 256 KiB; this keeps the table a static snapshot for inspection.
 *
 * Comma vs tab is auto-selected from the file extension to keep the call
 * site (`+page.svelte`) free of CSV/TSV branching.
 *
 * See docs/work-packages/hangar-sources-v1/spec.md sources-v1 polish
 * (deferred #2: full-fidelity preview components).
 */

let {
	fileName,
	fileSizeBytes,
	previewText,
	maxRows = 500,
}: {
	fileName: string;
	fileSizeBytes: number;
	previewText: string;
	maxRows?: number;
} = $props();

interface CsvRow {
	id: string;
	cells: readonly string[];
}

function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || bytes <= 0) return '--';
	const units = ['B', 'KiB', 'MiB', 'GiB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const delimiter = $derived(fileName.toLowerCase().endsWith('.tsv') ? '\t' : ',');
const parsed = $derived(parseCsv(previewText, delimiter));
const truncated = $derived(parsed.rows.length > maxRows);
const rows = $derived<CsvRow[]>(parsed.rows.slice(0, maxRows).map((cells, index) => ({ id: `row-${index}`, cells })));
const columns = $derived<readonly DataTableColumn<CsvRow>[]>(
	parsed.header.length > 0
		? parsed.header.map((header, index) => ({
				id: `col-${index}`,
				header,
				sortBy: (row) => row.cells[index] ?? '',
			}))
		: [],
);
</script>

<section class="preview-csv" aria-label="CSV preview">
	<header class="hd">
		<span class="mono name">{fileName}</span>
		<span class="size mono">{formatBytes(fileSizeBytes)}</span>
		<span class="count">
			{rows.length}
			{rows.length === 1 ? 'row' : 'rows'}
			{#if truncated}
				<span class="truncated">(showing first {maxRows} of {parsed.rows.length})</span>
			{/if}
		</span>
	</header>
	{#if columns.length === 0}
		<p class="empty">CSV is empty or could not be parsed.</p>
	{:else}
		<div class="table-frame">
			<DataTable {columns} {rows} ariaLabel={`${fileName} contents`}>
				{#snippet row(item: CsvRow)}
					<tr>
						{#each columns as col, idx (col.id)}
							<td class="cell">{item.cells[idx] ?? ''}</td>
						{/each}
					</tr>
				{/snippet}
			</DataTable>
		</div>
	{/if}
</section>

<style>
	.preview-csv {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-md);
	}

	.hd {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		align-items: baseline;
		padding-bottom: var(--space-xs);
		border-bottom: 1px solid var(--edge-subtle);
	}

	.name {
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		flex: 1;
		min-width: 0;
		word-break: break-all;
	}

	.size {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.count {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.truncated {
		margin-left: var(--space-2xs);
		color: var(--signal-warning);
	}

	.table-frame {
		max-height: 36rem;
		overflow: auto;
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
	}

	.cell {
		padding: var(--space-2xs) var(--space-sm);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-body);
		border-bottom: 1px solid var(--edge-subtle);
		word-break: break-word;
		vertical-align: top;
	}

	.empty {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		padding: var(--space-md);
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>
