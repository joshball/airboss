<script lang="ts">
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Help -- airboss flightbag</title>
</svelte:head>

<section class="page">
	<header>
		<h1>Help</h1>
		<p class="subtitle">
			Flightbag-specific help is coming. The platform-wide help index lives on study.
		</p>
	</header>

	<p>
		For now, see the <a href={data.studyHelpUrl}>airboss study help index</a>. It covers spaced
		repetition, calibration, knowledge nodes, and the broader airboss model.
	</p>

	<p class="hint">
		Tip: press <kbd>/</kbd> or <kbd>Cmd+K</kbd> anywhere in the app to search the help and
		aviation reference libraries.
	</p>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		max-width: 56ch;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
	}

	.subtitle {
		margin: 0;
		color: var(--ink-muted);
	}

	.hint {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	a {
		color: var(--action-default-hover);
	}

	kbd {
		border: 1px solid var(--edge-default);
		border-bottom-width: 2px;
		border-radius: var(--radius-xs);
		padding: 0 var(--space-2xs);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
		background: var(--surface-sunken);
	}
</style>
