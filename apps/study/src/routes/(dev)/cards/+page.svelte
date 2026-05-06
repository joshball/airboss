<script lang="ts">
import AcCard from '@ab/aviation/ui/cards/AcCard.svelte';
import AcsCard from '@ab/aviation/ui/cards/AcsCard.svelte';
import AimCorpusCard from '@ab/aviation/ui/cards/AimCorpusCard.svelte';
import CfrPartCard from '@ab/aviation/ui/cards/CfrPartCard.svelte';
import CfrSectionCard from '@ab/aviation/ui/cards/CfrSectionCard.svelte';
import CfrTitleCard from '@ab/aviation/ui/cards/CfrTitleCard.svelte';
import HandbookCard from '@ab/aviation/ui/cards/HandbookCard.svelte';
import InfoCard from '@ab/aviation/ui/cards/InfoCard.svelte';
import NtsbCard from '@ab/aviation/ui/cards/NtsbCard.svelte';
import PohCard from '@ab/aviation/ui/cards/PohCard.svelte';
import PtsCard from '@ab/aviation/ui/cards/PtsCard.svelte';
import SafoCard from '@ab/aviation/ui/cards/SafoCard.svelte';
import UmbrellaCard from '@ab/aviation/ui/cards/UmbrellaCard.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const totalRequiredGaps = $derived(data.summary.reduce((acc, s) => acc + s.missingRequiredCount, 0));
const totalRecommendedGaps = $derived(data.summary.reduce((acc, s) => acc + s.missingRecommendedCount, 0));
</script>

<svelte:head>
	<title>Card audit -- airboss dev</title>
</svelte:head>

<header class="page-header">
	<h1>Library card audit</h1>
	<p class="lede">
		Variant gallery + live data audit. Required fields throw at render in dev; recommended fields surface here so
		Wave 1 authoring has a punch list.
	</p>
	<dl class="totals">
		<div>
			<dt>Variants</dt>
			<dd>{data.summary.length}</dd>
		</div>
		<div class:bad={totalRequiredGaps > 0}>
			<dt>Subjects missing REQUIRED fields</dt>
			<dd>{totalRequiredGaps}</dd>
		</div>
		<div class:warn={totalRecommendedGaps > 0}>
			<dt>Subjects missing recommended fields</dt>
			<dd>{totalRecommendedGaps}</dd>
		</div>
	</dl>
</header>

<section class="block">
	<h2>Variant inventory</h2>
	<table>
		<thead>
			<tr>
				<th>Variant</th>
				<th>Required</th>
				<th>Recommended</th>
				<th class="num">Checked</th>
				<th class="num">Missing required</th>
				<th class="num">Missing recommended</th>
			</tr>
		</thead>
		<tbody>
			{#each data.summary as row (row.variant)}
				<tr>
					<td><code>{row.variant}</code></td>
					<td><code>{row.requiredFields.join(', ') || '--'}</code></td>
					<td><code>{row.recommendedFields.join(', ') || '--'}</code></td>
					<td class="num">{row.totalChecked}</td>
					<td class="num" class:bad={row.missingRequiredCount > 0}>{row.missingRequiredCount}</td>
					<td class="num" class:warn={row.missingRecommendedCount > 0}>{row.missingRecommendedCount}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="block">
	<h2>Variant gallery (complete fixtures)</h2>
	<p class="muted">Every wrapper rendered with a full fixture so the design stays consistent.</p>
	<div class="gallery">
		<CfrTitleCard
			shortLabel="14 CFR"
			topic="Aeronautics and Space"
			description="The federal aviation regulations. Codifies airman certification, aircraft airworthiness, flight operations, air traffic, schools, and the FAA itself."
			whyItMatters="This is the rulebook every pilot operates under. Knowing 14 CFR is the difference between airmanship and ramp-check anxiety."
			href="#"
			external={{ url: 'https://www.ecfr.gov/current/title-14', label: 'eCFR' }}
		/>
		<CfrPartCard
			titleNumber={14}
			partNumber="91"
			partTitle="General Operating and Flight Rules"
			description="The core operating rules for civil aviation -- preflight, takeoff, en route, weather minima, equipment requirements, communication, emergencies."
			whyItMatters="If you fly under Part 91, you live in this Part. It defines almost every decision a non-commercial pilot makes."
			href="#"
			external={{ url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91', label: 'eCFR' }}
			sectionCount={286}
		/>
		<CfrSectionCard
			partNumber="91"
			sectionCode="91.103"
			sectionTitle="Preflight action"
			href="#"
			external={{
				url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/section-91.103',
				label: 'eCFR',
			}}
		/>
		<AimCorpusCard
			title="Aeronautical Information Manual"
			description="The FAA's pilot guide to operating in the National Airspace System."
			whyItMatters="14 CFR says what is required; the AIM says what is expected."
			edition="2026-04"
			external={{ url: 'https://www.faa.gov/air_traffic/publications/', label: 'FAA' }}
		/>
		<AcCard
			acNumber="91-21.1D"
			acTitle="Use of Portable Electronic Devices Aboard Aircraft"
			edition="D"
			description="FAA guidance on operator policies for passenger use of PEDs in flight."
			external={{ url: 'https://www.faa.gov/regulations_policies/advisory_circulars/', label: 'FAA' }}
		/>
		<NtsbCard
			reportNumber="ANC22FA014"
			reportTitle="Loss of control on landing -- Cessna 208B"
			date="2022-03-14"
			summary="VFR-into-IMC followed by spatial disorientation. Pilot was operating Part 135 cargo on an IFR flight plan."
			external={{ url: 'https://www.ntsb.gov/', label: 'NTSB' }}
		/>
		<HandbookCard
			shortSlug="phak"
			fullTitle="Pilot's Handbook of Aeronautical Knowledge"
			edition="FAA-H-8083-25C"
			publisher="FAA"
			description="The FAA's foundational pilot handbook. Aerodynamics, weather, navigation, decision-making, the regulatory framework."
			whyItMatters="Read once cover-to-cover early in primary training, then return to the chapter that matches whatever you are about to fly."
			href="#"
		/>
		<AcsCard
			slug="faa-s-acs-6b"
			title="Private Pilot - Airplane Airman Certification Standards"
			edition="FAA-S-ACS-6B"
			description="FAA test guide for the private pilot airplane practical test."
			whyItMatters="Exactly what your DPE expects you to know on checkride day -- knowledge, risk management, and skill criteria."
			href="#"
			external={{ url: 'https://www.faa.gov/training_testing/testing/acs', label: 'FAA' }}
		/>
		<PtsCard
			slug="faa-s-8081-6d"
			title="Flight Instructor Practical Test Standards (Airplane)"
			edition="FAA-S-8081-6D"
			description="Predecessor to the ACS, still the active checkride standard for some certificate categories."
			external={{ url: 'https://www.faa.gov/training_testing/testing/test_standards', label: 'FAA' }}
		/>
		<SafoCard
			safoNumber="SAFO 23001"
			title="Helicopter Pilot Decision-Making in Whiteout Conditions"
			date="2023-01-12"
			summary="Recommended whiteout-recognition procedures and recovery techniques for rotorcraft operators."
			audience="Air carriers and rotorcraft operators"
			external={{ url: 'https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/safo', label: 'FAA' }}
		/>
		<InfoCard
			infoNumber="InFO 22008"
			title="Operational Use of Flight Path Management Systems"
			date="2022-08-15"
			summary="Best practices for autopilot, autothrottle, and FMS mode awareness in commercial operations."
			audience="Air carriers"
			external={{ url: 'https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/info', label: 'FAA' }}
		/>
		<PohCard
			aircraftModel="Cessna 172S"
			title="Cessna 172S Pilot Operating Handbook"
			revision="13"
			description="Manufacturer POH for the Cessna 172S Skyhawk -- limitations, normal/emergency procedures, performance, weight & balance."
			external={{ url: 'https://www.cessna.com/', label: 'Cessna' }}
		/>
		<UmbrellaCard
			title="Some unfamiliar corpus"
			description="A description if available."
			whyItMatters="Pilot relevance if available."
			kindBadge="OTHER"
			identifier="2026"
			external={{ url: 'https://example.com', label: 'Publisher' }}
		/>
	</div>
</section>

<section class="block">
	<h2>Variant gallery (minimum-required fixtures)</h2>
	<p class="muted">Each wrapper with only its required fields populated -- recommended fields blank.</p>
	<div class="gallery">
		<CfrPartCard
			titleNumber={14}
			partNumber="999"
			partTitle="Test Part Title"
			href="#"
			external={{ url: 'https://www.ecfr.gov/current/title-14/part-999', label: 'eCFR' }}
		/>
		<CfrSectionCard
			partNumber="999"
			sectionCode="999.1"
			sectionTitle="Test Section"
			href="#"
			external={{ url: 'https://www.ecfr.gov/current/title-14/part-999/section-999.1', label: 'eCFR' }}
		/>
		<AcCard acNumber="00-0" acTitle="Test AC" edition="-" />
		<AcsCard slug="test-acs" title="Test ACS" edition="-" />
		<PtsCard slug="test-pts" title="Test PTS" edition="-" />
		<SafoCard safoNumber="SAFO 00000" title="Test SAFO" />
		<InfoCard infoNumber="InFO 00000" title="Test InFO" />
		<PohCard aircraftModel="Test Model" title="Test POH" revision="1" />
		<NtsbCard reportNumber="TEST00" reportTitle="Test NTSB" />
		<HandbookCard shortSlug="test" fullTitle="Test Handbook" edition="-" publisher="FAA" href="#" />
		<UmbrellaCard title="Bare umbrella" />
	</div>
</section>

<section class="block">
	<h2>Live audit ({data.audit.length} subjects)</h2>
	<p class="muted">Real reference rows + kind-copy registry entries. Sorted: missing-required first.</p>
	<table>
		<thead>
			<tr>
				<th>Subject</th>
				<th>Variant</th>
				<th>Missing required</th>
				<th>Missing recommended</th>
			</tr>
		</thead>
		<tbody>
			{#each data.audit
				.slice()
				.sort((a, b) => b.missingRequired.length - a.missingRequired.length || b.missingRecommended.length - a.missingRecommended.length) as row (`${row.variant}/${row.subject}`)}
				<tr class:bad={row.missingRequired.length > 0}>
					<td><code>{row.subject}</code></td>
					<td><code>{row.variant}</code></td>
					<td><code class="missing">{row.missingRequired.join(', ') || '--'}</code></td>
					<td><code class="missing-rec">{row.missingRecommended.join(', ') || '--'}</code></td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.page-header {
		margin-bottom: var(--space-lg);
	}
	.lede {
		max-width: 60ch;
		color: var(--ink-muted);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.totals {
		display: flex;
		gap: var(--space-md);
		margin: var(--space-md) 0 0;
	}
	.totals div {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
	}
	.totals dt {
		margin: 0;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.totals dd {
		margin: var(--space-3xs) 0 0;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-semibold);
	}
	.totals div.bad dd {
		color: var(--signal-warning, var(--signal-danger));
	}
	.totals div.warn dd {
		color: var(--signal-info, var(--ink-body));
	}
	.block {
		margin-bottom: var(--space-xl);
	}
	.block h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.muted {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.gallery {
		display: grid;
		gap: var(--space-md);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
		margin-top: var(--space-md);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
		margin-top: var(--space-sm);
	}
	th,
	td {
		text-align: left;
		padding: var(--space-2xs) var(--space-xs);
		border-bottom: 1px solid var(--edge-subtle);
	}
	th {
		font-weight: var(--font-weight-semibold);
		color: var(--ink-muted);
	}
	td.num,
	th.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	td.num.bad {
		color: var(--signal-warning, var(--signal-danger));
		font-weight: var(--font-weight-semibold);
	}
	td.num.warn {
		color: var(--signal-info, var(--ink-body));
	}
	tr.bad td {
		background: var(--surface-sunken);
	}
	code {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
	}
	code.missing {
		color: var(--signal-warning, var(--signal-danger));
	}
	code.missing-rec {
		color: var(--ink-muted);
	}
</style>
