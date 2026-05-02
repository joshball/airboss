<script lang="ts">
/**
 * Mirrors the destructive-action wiring on
 * `apps/hangar/src/routes/(app)/sources/[id]/files/+page.svelte`.
 *
 * Kept in a sibling test directory so the dialog contract can be exercised
 * without mounting the full SvelteKit page (which depends on $lib preview
 * components and ./$types). When the page contract changes, update both.
 */

import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';

let { fileName }: { fileName: string } = $props();

let pendingDeleteName = $state<string | null>(null);
</script>

<Button variant="danger" size="sm" onclick={() => (pendingDeleteName = fileName)}>
	Delete
</Button>

<ConfirmDialog
	open={pendingDeleteName !== null}
	oncancel={() => (pendingDeleteName = null)}
	title="Delete archived file?"
	confirmLabel="Delete archive"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_SOURCE_FILE_DELETE_ACTION}
	hiddenFields={{ name: pendingDeleteName ?? '' }}
	typedConfirmation={{
		label: `Type the file name to confirm: ${pendingDeleteName ?? ''}`,
		expected: pendingDeleteName ?? '',
	}}
>
	<p>
		Permanently removes <code>{pendingDeleteName}</code>.
	</p>
</ConfirmDialog>
