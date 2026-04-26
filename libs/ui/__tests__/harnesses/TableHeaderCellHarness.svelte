<script lang="ts">
import TableHeaderCell from '../../src/components/TableHeaderCell.svelte';

let { scope = 'col', body = 'Name' }: { scope?: 'col' | 'row'; body?: string } = $props();
</script>

<table>
	<thead>
		<tr>
			<TableHeaderCell {scope}>
				<span data-testid="harness-th-body">{body}</span>
			</TableHeaderCell>
		</tr>
	</thead>
</table>
