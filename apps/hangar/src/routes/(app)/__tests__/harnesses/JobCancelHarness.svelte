<script lang="ts">
/**
 * Mirrors the Cancel-job wiring on
 * `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte`.
 */

import { ROUTES } from '@ab/constants';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';

let {
	kind,
	targetType,
	targetId,
	startedAt,
}: {
	kind: string;
	targetType: string | null;
	targetId: string | null;
	startedAt: string | null;
} = $props();

let cancelDialogOpen = $state(false);

const targetLabel = $derived(`${targetType ?? '-'}${targetId ? `:${targetId}` : ''}`);

const elapsedSinceStart = $derived.by(() => {
	if (!startedAt) return null;
	const startedMs = new Date(startedAt).getTime();
	if (Number.isNaN(startedMs)) return null;
	const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
	if (elapsedSeconds < 60) return `${elapsedSeconds}s`;
	const minutes = Math.floor(elapsedSeconds / 60);
	const seconds = elapsedSeconds % 60;
	return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
});
</script>

<button type="button" onclick={() => (cancelDialogOpen = true)}>Cancel job</button>

<ConfirmDialog
	open={cancelDialogOpen}
	oncancel={() => (cancelDialogOpen = false)}
	title="Cancel job?"
	confirmLabel="Cancel job"
	cancelLabel="Keep running"
	dangerLevel="caution"
	formAction={ROUTES.HANGAR_JOB_CANCEL_ACTION}
>
	<p>
		Cancel <code>{kind}</code> on <code>{targetLabel}</code>?
	</p>
	<p>
		Any partial work will be discarded.
		{#if elapsedSinceStart}Elapsed: <strong>{elapsedSinceStart}</strong>.{/if}
	</p>
</ConfirmDialog>
