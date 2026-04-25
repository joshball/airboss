<script lang="ts">
/**
 * Dev demo page -- exercises every UI primitive across every variant.
 * Not wired into navigation; reach it manually via /primitives. Used
 * during the package #4 primitive build to visually verify the themed
 * surface before page-level migration (#5).
 */

import { TONES } from '@ab/ui';
import Badge from '@ab/ui/components/Badge.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Checkbox from '@ab/ui/components/Checkbox.svelte';
import Dialog from '@ab/ui/components/Dialog.svelte';
import Divider from '@ab/ui/components/Divider.svelte';
import FormField from '@ab/ui/components/FormField.svelte';
import KbdHint from '@ab/ui/components/KbdHint.svelte';
import RadioGroup from '@ab/ui/components/RadioGroup.svelte';
import Select from '@ab/ui/components/Select.svelte';
import Spinner from '@ab/ui/components/Spinner.svelte';
import StatTile from '@ab/ui/components/StatTile.svelte';
import Table from '@ab/ui/components/Table.svelte';
import TableCell from '@ab/ui/components/TableCell.svelte';
import TableHeader from '@ab/ui/components/TableHeader.svelte';
import TableHeaderCell from '@ab/ui/components/TableHeaderCell.svelte';
import TableRow from '@ab/ui/components/TableRow.svelte';
import Tabs from '@ab/ui/components/Tabs.svelte';
import TextField from '@ab/ui/components/TextField.svelte';

let dialogOpen = $state(false);
let checked = $state(false);
let indeterminate = $state(true);
let radio = $state('b');
let textValue = $state('');
let selectValue = $state('x');
let activeTab = $state('one');
</script>

<svelte:head>
	<title>Primitives</title>
</svelte:head>

<main class="wrap">
	<h1>UI primitives demo</h1>

	<section>
		<h2>Button</h2>
		<div class="row">
			<Button variant="primary">Primary</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="danger">Danger</Button>
			<Button variant="primary" disabled>Disabled</Button>
			<Button variant="primary" loading loadingLabel="Saving...">Save</Button>
		</div>
		<div class="row">
			<Button size="sm">sm</Button>
			<Button size="md">md</Button>
			<Button size="lg">lg</Button>
		</div>
	</section>

	<section>
		<h2>Badge</h2>
		<div class="row">
			{#each TONES as t (t)}
				<Badge tone={t}>{t}</Badge>
			{/each}
		</div>
		<div class="row">
			<Badge size="sm">sm</Badge>
			<Badge size="md">md</Badge>
			<Badge size="lg">lg</Badge>
		</div>
	</section>

	<section>
		<h2>Banner</h2>
		<div class="col">
			{#each TONES as t (t)}
				<Banner tone={t} title="{t} banner">
					Body copy for {t}.
				</Banner>
			{/each}
		</div>
	</section>

	<section>
		<h2>StatTile</h2>
		<div class="row">
			{#each TONES as t (t)}
				<StatTile label={t} value="42" sub="sub" tone={t} />
			{/each}
		</div>
	</section>

	<section>
		<h2>TextField</h2>
		<div class="col">
			<TextField label="Small" size="sm" bind:value={textValue} />
			<TextField label="Medium" size="md" bind:value={textValue} />
			<TextField label="Large" size="lg" bind:value={textValue} />
			<TextField label="With error" error="Required" bind:value={textValue} />
		</div>
	</section>

	<section>
		<h2>Select</h2>
		<Select label="Choice" bind:value={selectValue} options={[{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]} />
	</section>

	<section>
		<h2>Checkbox</h2>
		<div class="col">
			<Checkbox label="Checked" bind:checked />
			<Checkbox label="Indeterminate" bind:checked={indeterminate} indeterminate />
			<Checkbox label="Disabled" disabled checked />
			<Checkbox label="Error" error />
		</div>
	</section>

	<section>
		<h2>RadioGroup</h2>
		<RadioGroup
			name="demo"
			bind:value={radio}
			legend="Pick one"
			options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]}
		/>
	</section>

	<section>
		<h2>FormField</h2>
		<FormField label="Email" help="We'll never share it." required for="ff-email">
			{#snippet control({ describedBy, invalid })}
				<input id="ff-email" type="email" aria-describedby={describedBy} aria-invalid={invalid} />
			{/snippet}
		</FormField>
	</section>

	<section>
		<h2>Tabs</h2>
		<Tabs
			bind:active={activeTab}
			tabs={[{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }, { id: 'three', label: 'Three', disabled: true }]}
		>
			{#snippet panel(id)}
				<p>Panel for tab: {id}</p>
			{/snippet}
		</Tabs>
	</section>

	<section>
		<h2>Table</h2>
		<Table ariaLabel="Demo table">
			<TableHeader>
				<TableHeaderCell>Name</TableHeaderCell>
				<TableHeaderCell>Score</TableHeaderCell>
			</TableHeader>
			<tbody>
				<TableRow>
					<TableCell>Alpha</TableCell>
					<TableCell>90</TableCell>
				</TableRow>
				<TableRow selected>
					<TableCell>Bravo</TableCell>
					<TableCell>88</TableCell>
				</TableRow>
			</tbody>
		</Table>
	</section>

	<section>
		<h2>Spinner</h2>
		<div class="row">
			<Spinner size="sm" />
			<Spinner size="md" />
			<Spinner size="lg" />
		</div>
	</section>

	<section>
		<h2>Divider</h2>
		<Divider />
		<div class="row">
			text<Divider orientation="vertical" />more text
		</div>
	</section>

	<section>
		<h2>KbdHint</h2>
		<KbdHint>Space</KbdHint>
		<KbdHint>Enter</KbdHint>
	</section>

	<section>
		<h2>Dialog</h2>
		<Button onclick={() => (dialogOpen = true)}>Open dialog</Button>
		<Dialog bind:open={dialogOpen} ariaLabel="Demo dialog">
			{#snippet header()}Dialog header{/snippet}
			{#snippet body()}<p>Dialog body content.</p>{/snippet}
			{#snippet footer()}
				<Button variant="ghost" onclick={() => (dialogOpen = false)}>Cancel</Button>
				<Button variant="primary" onclick={() => (dialogOpen = false)}>OK</Button>
			{/snippet}
		</Dialog>
	</section>
</main>

<style>
	.wrap {
		max-width: 60rem;
		margin: 0 auto;
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
</style>
