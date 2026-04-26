<script lang="ts">
import TableCell from '../../src/components/TableCell.svelte';

let { align = 'left', body = 'cell' }: { align?: 'left' | 'center' | 'right'; body?: string } = $props();
</script>

<table>
	<tbody>
		<tr>
			<TableCell {align}>
				<span data-testid="harness-cell-body">{body}</span>
			</TableCell>
		</tr>
	</tbody>
</table>
