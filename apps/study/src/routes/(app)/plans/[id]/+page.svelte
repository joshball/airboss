<script lang="ts">
import {
	CERT_LABELS,
	CERT_VALUES,
	type Cert,
	DEPTH_PREFERENCE_LABELS,
	DEPTH_PREFERENCE_VALUES,
	type DepthPreference,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	type Domain,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	PLAN_STATUS_LABELS,
	PLAN_STATUSES,
	type PlanStatus,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODE_LABELS,
	SESSION_MODE_VALUES,
	type SessionMode,
} from '@ab/constants';
import type { ActionFailure } from '@ab/types';
import Banner from '@ab/ui/components/Banner.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
import { enhance } from '$app/forms';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const plan = $derived(data.plan);
const isActive = $derived(plan.status === PLAN_STATUSES.ACTIVE);

// Pull form-level error from any action on the page. The route exposes
// update / archive / activate / removeSkipNode / addSkipNode actions and
// any of them may return a `{ error: string }` ActionFailure. The previous
// implementation only rendered errors scoped to `?/update`, which made
// archive / activate / skip-node failures silently disappear. Render
// `form?.error` once at the top of the page so every action surfaces.
const formError = $derived<string | null>(
	form && 'error' in form && typeof (form as ActionFailure).error === 'string'
		? ((form as ActionFailure).error ?? null)
		: null,
);

// `?created=1` lands here straight from /plans/new. Show a one-shot creation
// banner -- keep it dismissible so the user can clear it without navigating.
// See DESIGN_PRINCIPLES.md #7.
let createdBannerShown = $state(page.url.searchParams.get(QUERY_PARAMS.CREATED) === '1');

// Edit-success toast: auto-dismisses after ~3s so it never lingers into the
// next interaction. The effect reruns whenever `form` changes; on each
// successful update, restart the visibility window.
let editToastVisible = $state(false);

$effect(() => {
	const success = Boolean(form && 'success' in form && form.success);
	if (!success) return;
	editToastVisible = true;
	const timer = setTimeout(() => {
		editToastVisible = false;
	}, 3000);
	return () => clearTimeout(timer);
});

// svelte-ignore state_referenced_locally -- seeding initial slider from data; treat as independent thereafter
let sessionLength = $state<number>(data.plan.sessionLength);
let submitting = $state(false);

const certSet = $derived(new Set<string>(plan.certGoals));
const focusSet = $derived(new Set<string>(plan.focusDomains));
const skipSet = $derived(new Set<string>(plan.skipDomains));

const focusableDomains = $derived(DOMAIN_VALUES.filter((d: Domain) => !skipSet.has(d)));
const skippableDomains = $derived(DOMAIN_VALUES.filter((d: Domain) => !focusSet.has(d)));
</script>

<svelte:head>
	<title>{plan.title} -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>{plan.title}</h1>
			<p class="sub">
				<span class="badge" class:active={isActive}>{PLAN_STATUS_LABELS[plan.status as PlanStatus]}</span>
				{#if isActive}<a class="link" href={ROUTES.SESSION_START}>Start a session</a>{/if}
			</p>
		</div>
		<nav class="quick">
			<a class="btn ghost" href={ROUTES.PLANS}>Back to plans</a>
		</nav>
	</header>

	{#if createdBannerShown}
		<Banner tone="info" dismissible onDismiss={() => (createdBannerShown = false)}>
			Plan saved.
			{isActive ? '' : 'Activate it to start a session.'}
			{#if isActive}
				<a class="banner-action" href={ROUTES.SESSION_START}>Start a session</a>
			{/if}
		</Banner>
	{/if}
	{#if editToastVisible}
		<Banner tone="success">Plan updated.</Banner>
	{/if}
	{#if formError}
		<Banner tone="danger">{formError}</Banner>
	{/if}

	<form
		method="post"
		action="?/update"
		class="wizard"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<fieldset>
			<legend>Plan name</legend>
			<input type="text" name="title" value={plan.title} maxlength="200" />
		</fieldset>

		<fieldset>
			<legend>Certifications</legend>
			<p class="muted">Leave all unchecked for a cert-agnostic plan (general practice, no cert filter).</p>
			<div class="choice-row">
				{#each CERT_VALUES as cert (cert)}
					<label class="choice">
						<input type="checkbox" name="certGoals" value={cert} checked={certSet.has(cert)} />
						<span>{CERT_LABELS[cert as Cert]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Focus domains</legend>
			<div class="choice-grid">
				{#each focusableDomains as d (d)}
					<label class="choice">
						<input type="checkbox" name="focusDomains" value={d} checked={focusSet.has(d)} />
						<span>{DOMAIN_LABELS[d as Domain]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Skip domains</legend>
			<div class="choice-grid">
				{#each skippableDomains as d (d)}
					<label class="choice">
						<input type="checkbox" name="skipDomains" value={d} checked={skipSet.has(d)} />
						<span>{DOMAIN_LABELS[d as Domain]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Depth preference</legend>
			<div class="choice-row">
				{#each DEPTH_PREFERENCE_VALUES as d (d)}
					<label class="choice radio">
						<input
							type="radio"
							name="depthPreference"
							value={d}
							checked={plan.depthPreference === d}
						/>
						<span>{DEPTH_PREFERENCE_LABELS[d as DepthPreference]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Default session mode</legend>
			<div class="choice-row">
				{#each SESSION_MODE_VALUES as m (m)}
					<label class="choice radio">
						<input type="radio" name="defaultMode" value={m} checked={plan.defaultMode === m} />
						<span>{SESSION_MODE_LABELS[m as SessionMode]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Items per session: {sessionLength}</legend>
			<input
				type="range"
				name="sessionLength"
				min={MIN_SESSION_LENGTH}
				max={MAX_SESSION_LENGTH}
				bind:value={sessionLength}
			/>
		</fieldset>

		<div class="actions">
			<button type="submit" class="btn primary" disabled={submitting}>
				{submitting ? 'Saving…' : 'Save changes'}
			</button>
		</div>
	</form>

	<article class="card skip-list">
		<h2>Skipped nodes</h2>
		{#if plan.skipNodes.length === 0}
			<p class="muted">You haven't skipped any individual nodes yet.</p>
		{:else}
			<ul class="pills">
				{#each plan.skipNodes as id (id)}
					<li>
						<span class="pill-label">{id}</span>
						<form method="post" action="?/removeSkipNode" use:enhance>
							<input type="hidden" name="nodeId" value={id} />
							<button type="submit" class="pill-btn">Reactivate</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</article>

	<article class="card danger-zone">
		<h2>Lifecycle</h2>
		<div class="row">
			{#if isActive}
				<ConfirmAction
					formAction="?/archive"
					triggerVariant="secondary"
					confirmVariant="danger"
					size="md"
					label="Archive plan"
					confirmLabel="Archive this plan"
				/>
			{:else}
				<form method="post" action="?/activate" use:enhance>
					<button type="submit" class="btn primary">Make this plan active</button>
				</form>
			{/if}
		</div>
		<p class="muted">Activating this plan archives any other active plan for you.</p>
	</article>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--type-definition-body-size);
		display: flex;
		gap: var(--space-md);
		align-items: center;
	}

	.badge {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		background: var(--edge-default);
		color: var(--ink-muted);
	}

	.badge.active {
		background: var(--action-default-hover);
		color: var(--ink-inverse);
	}

	.link {
		color: var(--action-default-hover);
		font-weight: 500;
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.wizard,
	.card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	fieldset {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	legend {
		font-weight: 600;
	}

	input[type='text'] {
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
	}

	.choice-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.choice-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-xs);
	}

	.choice {
		display: inline-flex;
		gap: var(--space-xs);
		align-items: center;
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: var(--type-ui-label-size);
	}

	.choice input {
		accent-color: var(--action-default);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	.banner-action {
		margin-left: var(--space-sm);
		color: var(--action-default-hover);
		font-weight: 600;
		text-decoration: none;
	}

	.banner-action:hover {
		text-decoration: underline;
	}

	h2 {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.pills {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.pills li {
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		padding: var(--space-2xs) var(--space-sm) var(--space-2xs) var(--space-md);
		font-size: var(--type-ui-label-size);
	}

	.pill-btn {
		background: transparent;
		border: none;
		color: var(--action-default-hover);
		cursor: pointer;
		font-size: var(--type-ui-caption-size);
		padding: var(--space-2xs) var(--space-sm);
	}

	.pill-btn:hover {
		text-decoration: underline;
	}

	.row {
		display: flex;
		gap: var(--space-sm);
	}

	.muted {
		color: var(--ink-faint);
		margin: 0;
		font-size: var(--type-ui-label-size);
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--action-default-hover);
	}

	.btn.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}
</style>
