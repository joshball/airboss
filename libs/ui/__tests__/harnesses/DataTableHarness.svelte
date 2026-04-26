<script lang="ts">
import DataTable, { type DataTableColumn, type SortState } from '../../src/components/DataTable.svelte';

interface Row {
	id: string;
	name: string;
	rank: number;
}

let {
	rows,
	columns,
	initialSort,
	onSortChange,
}: {
	rows: Row[];
	columns: DataTableColumn<Row>[];
	initialSort?: SortState;
	onSortChange?: (s: SortState) => void;
} = $props();
</script>

<DataTable {columns} {rows} {initialSort} {onSortChange}>
	{#snippet row(r: Row)}
		<tr data-testid={`harness-row-${r.id}`}>
			<td data-testid={`harness-name-${r.id}`}>{r.name}</td>
			<td data-testid={`harness-rank-${r.id}`}>{r.rank}</td>
		</tr>
	{/snippet}
</DataTable>
