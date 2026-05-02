<script lang="ts">
import ConfirmDialog from '../../src/components/ConfirmDialog.svelte';

/**
 * Bindable harness for the ConfirmDialog reactivity contract.
 *
 * When the shared `Dialog` primitive writes `open = false` on close (ESC,
 * scrim click), that write must propagate through ConfirmDialog back to the
 * caller's bound state. Before the fix, ConfirmDialog received `{open}`
 * one-way and forwarded `{open}` one-way, so Dialog's write was a non-
 * reactive prop write that the caller never observed -- the dialog could
 * "flicker" reopen on the next reactive pass.
 *
 * The harness renders the current `open` value into a `data-testid`
 * element so the test can assert via DOM rather than component-instance
 * APIs (Svelte 5 runes-mode does not export script-scope helpers the way
 * Svelte 4 did).
 */

import { untrack } from 'svelte';

let {
	initialOpen = true,
	cancelClosesOpen = true,
}: {
	initialOpen?: boolean;
	cancelClosesOpen?: boolean;
} = $props();

// `open` mirrors `initialOpen` only at mount; runtime updates flow through
// the bound prop on ConfirmDialog. `untrack` silences the harmless "captures
// only the initial value" hint -- that is exactly the intent.
let open = $state(untrack(() => initialOpen));
let cancelCount = $state(0);
</script>

<div data-testid="harness-state" data-open={String(open)} data-cancel-count={cancelCount}></div>

<ConfirmDialog
	bind:open
	oncancel={() => {
		cancelCount += 1;
		if (cancelClosesOpen) open = false;
	}}
>
	<p data-testid="dialog-body">Are you sure?</p>
</ConfirmDialog>
