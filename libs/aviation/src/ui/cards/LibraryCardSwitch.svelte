<!--
	LibraryCardSwitch -- single dispatch from a `LibraryCardPayload`
	(discriminated union, projected server-side by
	`projectReferenceToLibraryCard`) to the matching typed wrapper.

	Used by the cert + topic spine pages so .svelte files stay thin
	renderers; all per-kind logic lives in the projection helper. New
	wrapper kinds extend the projection's union; this switch then has to
	add a single `{:else if}` branch -- the discriminated union forces
	the addition through the type checker.
-->

<script lang="ts">
import type { LibraryCardPayload } from '@ab/bc-study';
import AcCard from './AcCard.svelte';
import AcsCard from './AcsCard.svelte';
import AimCorpusCard from './AimCorpusCard.svelte';
import CfrPartCard from './CfrPartCard.svelte';
import HandbookCard from './HandbookCard.svelte';
import InfoCard from './InfoCard.svelte';
import NtsbCard from './NtsbCard.svelte';
import PohCard from './PohCard.svelte';
import PtsCard from './PtsCard.svelte';
import SafoCard from './SafoCard.svelte';
import UmbrellaCard from './UmbrellaCard.svelte';

let { payload }: { payload: LibraryCardPayload } = $props();
</script>

{#if payload.variant === 'HandbookCard'}
	<HandbookCard {...payload.props} />
{:else if payload.variant === 'CfrPartCard'}
	<CfrPartCard {...payload.props} />
{:else if payload.variant === 'AcCard'}
	<AcCard {...payload.props} />
{:else if payload.variant === 'AcsCard'}
	<AcsCard {...payload.props} />
{:else if payload.variant === 'PtsCard'}
	<PtsCard {...payload.props} />
{:else if payload.variant === 'AimCorpusCard'}
	<AimCorpusCard {...payload.props} />
{:else if payload.variant === 'NtsbCard'}
	<NtsbCard {...payload.props} />
{:else if payload.variant === 'PohCard'}
	<PohCard {...payload.props} />
{:else if payload.variant === 'SafoCard'}
	<SafoCard {...payload.props} />
{:else if payload.variant === 'InfoCard'}
	<InfoCard {...payload.props} />
{:else}
	<UmbrellaCard {...payload.props} />
{/if}
