<script lang="ts">
import { type Cert, type Domain, QUERY_PARAMS, type SessionMode } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import { enhance } from '$app/forms';
import { goto } from '$app/navigation';
import { page } from '$app/state';

/**
 * Shuffle (URL-rewriting random seed) + Start (POST -> ?/start). Hidden
 * inputs carry mode/focus/cert/seed forward so the server action sees the
 * same shape the previewed run was generated from. Owns its own pending
 * state for the Start button so the parent stays declarative.
 */

let {
	mode,
	focus,
	cert,
	seed,
}: {
	mode: SessionMode;
	focus: Domain | null;
	cert: Cert | null;
	seed: string;
} = $props();

let shuffling = $state(false);
let starting = $state(false);

async function shuffle() {
	shuffling = true;
	const next = new URL(page.url);
	next.searchParams.set(QUERY_PARAMS.SESSION_SEED, Math.random().toString(36).slice(2));
	await goto(next, { replaceState: true, invalidateAll: true });
	shuffling = false;
}
</script>

<form
	method="post"
	action="?/start"
	class="start-row"
	use:enhance={() => {
		starting = true;
		return async ({ update }) => {
			await update();
			starting = false;
		};
	}}
>
	<input type="hidden" name="mode" value={mode} />
	{#if focus}<input type="hidden" name="focus" value={focus} />{/if}
	{#if cert}<input type="hidden" name="cert" value={cert} />{/if}
	<input type="hidden" name="seed" value={seed} />
	<Button variant="secondary" onclick={shuffle} disabled={shuffling} loading={shuffling} loadingLabel="Shuffling…">
		Shuffle
	</Button>
	<Button type="submit" variant="primary" disabled={starting} loading={starting} loadingLabel="Starting…">
		Start session
	</Button>
</form>

<style>
	.start-row {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
	}
</style>
