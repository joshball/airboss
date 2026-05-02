<script lang="ts">
/**
 * Mirrors the job-detail log stream filter on
 * `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte`.
 *
 * Closes critical #6 in the chunk-6 hangar review: the four log-stream
 * filters were declared as `role="tablist"` / `role="tab"` but shipped
 * none of the ARIA tabs contract. Downgraded here (and on the page) to
 * a `role="group"` toggle group with `aria-pressed`, matching the
 * audit-page chip-group pattern.
 */

import { JOB_LOG_STREAMS, type JobLogStream } from '@ab/constants';

let activeStream = $state<'all' | JobLogStream>('all');
</script>

<div role="group" aria-label="Filter log stream">
	<button type="button" aria-pressed={activeStream === 'all'} onclick={() => (activeStream = 'all')}>All</button>
	<button
		type="button"
		aria-pressed={activeStream === JOB_LOG_STREAMS.STDOUT}
		onclick={() => (activeStream = JOB_LOG_STREAMS.STDOUT)}
	>stdout</button>
	<button
		type="button"
		aria-pressed={activeStream === JOB_LOG_STREAMS.STDERR}
		onclick={() => (activeStream = JOB_LOG_STREAMS.STDERR)}
	>stderr</button>
	<button
		type="button"
		aria-pressed={activeStream === JOB_LOG_STREAMS.EVENT}
		onclick={() => (activeStream = JOB_LOG_STREAMS.EVENT)}
	>event</button>
</div>
<output data-testid="active-stream">{activeStream}</output>
