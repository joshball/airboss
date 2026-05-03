<script lang="ts">
import { ROUTES } from '@ab/constants';

const sampleLinks: ReadonlyArray<{ readonly label: string; readonly href: string }> = [
	{
		label: 'PHAK / Edition 8083-25C',
		href: ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C'),
	},
	{
		label: 'PHAK Chapter 2',
		href: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '2'),
	},
	{
		label: 'PHAK 2.3 (section)',
		href: ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '2', '3'),
	},
	{
		label: 'AIM 5-1-7 (paragraph)',
		href: ROUTES.FLIGHTBAG_AIM_PARAGRAPH('5', '1', '7'),
	},
	{
		label: '14 CFR 91.103',
		href: ROUTES.FLIGHTBAG_CFR_SECTION('14', '91', '103'),
	},
	{
		label: 'AC 61-65J',
		href: ROUTES.FLIGHTBAG_AC('61-65', 'j'),
	},
	{
		label: 'ACS PPL Airplane / Area I / Task A',
		href: ROUTES.FLIGHTBAG_ACS_TASK('ppl-airplane-6c', '01', 'a'),
	},
];
</script>

<section>
	<h1>Flightbag</h1>
	<p>Public reader for FAA reference documents. Deep-link any handbook, AIM paragraph, CFR section, AC, or ACS task.</p>
	<h2>Sample references</h2>
	<ul>
		{#each sampleLinks as link (link.href)}
			<li><a href={link.href}>{link.label}</a></li>
		{/each}
	</ul>
</section>

<style>
	section {
		max-width: 72ch;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding-left: var(--space-lg);
	}

	a {
		color: var(--ink-strong);
	}
</style>
