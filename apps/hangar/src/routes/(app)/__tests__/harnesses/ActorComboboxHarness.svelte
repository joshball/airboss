<script lang="ts">
/**
 * Mirrors the audit-page actor combobox wiring on
 * `apps/hangar/src/routes/(app)/admin/audit/+page.svelte`.
 *
 * Kept in a sibling test directory so the ARIA-combobox contract can be
 * exercised without mounting the full SvelteKit page (which depends on
 * load data and $types). When the page combobox changes, update both.
 *
 * Closes critical #5 in the chunk-6 hangar review: keyboard-only users
 * must be able to navigate, see the active descendant, hear result
 * counts, and commit a selection without a mouse.
 */

interface ActorOption {
	id: string;
	name: string;
	email: string;
}

let { options }: { options: ActorOption[] } = $props();

let actorSearch = $state('');
let actorOptions = $state<ActorOption[]>([]);
let actorMenuOpen = $state(false);
let actorActiveIndex = $state(-1);
let actorAnnouncement = $state('');
let actorWrapEl = $state<HTMLDivElement | null>(null);
let pickedId = $state<string | null>(null);

const ACTOR_MENU_ID = 'audit-actor-menu';
const ACTOR_LIVE_ID = 'audit-actor-live';
function actorOptionId(index: number): string {
	return `audit-actor-option-${index}`;
}

function runSearch(): void {
	const term = actorSearch.trim().toLowerCase();
	if (!term) {
		actorOptions = [];
		actorMenuOpen = false;
		actorActiveIndex = -1;
		actorAnnouncement = '';
		return;
	}
	const results = options.filter((o) => o.name.toLowerCase().includes(term) || o.email.toLowerCase().includes(term));
	actorOptions = results;
	actorMenuOpen = results.length > 0;
	actorActiveIndex = results.length > 0 ? 0 : -1;
	actorAnnouncement =
		results.length === 0
			? 'No actors found.'
			: `${results.length} actor${results.length === 1 ? '' : 's'} found. Use arrow keys to navigate.`;
}

function pickActor(option: ActorOption): void {
	pickedId = option.id;
	actorSearch = option.name;
	actorOptions = [];
	actorMenuOpen = false;
	actorActiveIndex = -1;
}

function handleActorKeydown(event: KeyboardEvent): void {
	switch (event.key) {
		case 'ArrowDown': {
			event.preventDefault();
			if (actorOptions.length === 0) return;
			if (!actorMenuOpen) actorMenuOpen = true;
			actorActiveIndex = actorActiveIndex < 0 ? 0 : (actorActiveIndex + 1) % actorOptions.length;
			break;
		}
		case 'ArrowUp': {
			event.preventDefault();
			if (actorOptions.length === 0) return;
			if (!actorMenuOpen) actorMenuOpen = true;
			actorActiveIndex = actorActiveIndex <= 0 ? actorOptions.length - 1 : actorActiveIndex - 1;
			break;
		}
		case 'Home': {
			if (!actorMenuOpen || actorOptions.length === 0) return;
			event.preventDefault();
			actorActiveIndex = 0;
			break;
		}
		case 'End': {
			if (!actorMenuOpen || actorOptions.length === 0) return;
			event.preventDefault();
			actorActiveIndex = actorOptions.length - 1;
			break;
		}
		case 'Enter': {
			if (!actorMenuOpen || actorActiveIndex < 0) return;
			const option = actorOptions[actorActiveIndex];
			if (!option) return;
			event.preventDefault();
			pickActor(option);
			break;
		}
		case 'Escape': {
			if (!actorMenuOpen) return;
			event.preventDefault();
			actorMenuOpen = false;
			actorActiveIndex = -1;
			break;
		}
	}
}
</script>

<div class="actor-input-wrap" bind:this={actorWrapEl}>
	<label for="audit-actor">Actor</label>
	<input
		id="audit-actor"
		type="text"
		role="combobox"
		bind:value={actorSearch}
		oninput={runSearch}
		onkeydown={handleActorKeydown}
		autocomplete="off"
		aria-expanded={actorMenuOpen}
		aria-controls={ACTOR_MENU_ID}
		aria-autocomplete="list"
		aria-activedescendant={actorMenuOpen && actorActiveIndex >= 0 ? actorOptionId(actorActiveIndex) : undefined}
	/>
	{#if actorMenuOpen}
		<ul id={ACTOR_MENU_ID} role="listbox" aria-label="Actor results">
			{#each actorOptions as option, index (option.id)}
				{@const active = index === actorActiveIndex}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<li
					id={actorOptionId(index)}
					role="option"
					aria-selected={active}
					tabindex="-1"
					data-active={active}
					onclick={() => pickActor(option)}
				>
					{option.name} &lt;{option.email}&gt;
				</li>
			{/each}
		</ul>
	{/if}
</div>
<span id={ACTOR_LIVE_ID} aria-live="polite" aria-atomic="true">{actorAnnouncement}</span>
<output data-testid="picked-id">{pickedId ?? ''}</output>
