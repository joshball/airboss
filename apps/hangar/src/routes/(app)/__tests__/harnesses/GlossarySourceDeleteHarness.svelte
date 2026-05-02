<script lang="ts">
/**
 * Mirrors the soft-delete wiring on
 * `apps/hangar/src/routes/(app)/glossary/sources/[id]/+page.svelte`.
 */

import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';

let { rev, sourceId }: { rev: number; sourceId: string } = $props();

let deleteDialogOpen = $state(false);
</script>

<Button variant="danger" size="md" onclick={() => (deleteDialogOpen = true)}>
	Soft-delete this source
</Button>

<ConfirmDialog
	open={deleteDialogOpen}
	oncancel={() => (deleteDialogOpen = false)}
	title="Soft-delete?"
	confirmLabel="Soft-delete"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_GLOSSARY_DELETE_ACTION}
	hiddenFields={{ rev: String(rev) }}
	typedConfirmation={{ label: `Type the source id to confirm: ${sourceId}`, expected: sourceId }}
>
	<p>Hides source <code>{sourceId}</code>.</p>
</ConfirmDialog>
