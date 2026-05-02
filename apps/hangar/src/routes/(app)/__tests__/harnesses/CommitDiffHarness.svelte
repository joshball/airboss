<script lang="ts">
/**
 * Mirrors the Commit-diff wiring on
 * `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte`.
 *
 * Keep `LARGE_DIFF_LINE_THRESHOLD` in sync with the page's local constant.
 */

import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';

const LARGE_DIFF_LINE_THRESHOLD = 500;

let { sourceId, diffLines }: { sourceId: string; diffLines: number } = $props();

let commitDialogOpen = $state(false);
const isLargeDiff = $derived(diffLines >= LARGE_DIFF_LINE_THRESHOLD);
</script>

<Button variant="secondary" size="sm" onclick={() => (commitDialogOpen = true)}>
	Commit this diff
</Button>

<ConfirmDialog
	open={commitDialogOpen}
	oncancel={() => (commitDialogOpen = false)}
	title="Commit diff for {sourceId}?"
	confirmLabel="Commit"
	dangerLevel={isLargeDiff ? 'danger' : 'caution'}
	formAction={ROUTES.HANGAR_SOURCE_DIFF_COMMIT_ACTION}
	typedConfirmation={isLargeDiff
		? { label: `Type the source id to confirm: ${sourceId}`, expected: sourceId }
		: undefined}
>
	<p>
		Commit promotes <strong>{diffLines} line{diffLines === 1 ? '' : 's'}</strong> of staged changes to the
		canonical source for <code>{sourceId}</code>.
	</p>
</ConfirmDialog>
