<script lang="ts" module>
/**
 * `<HeartbeatTicker>` -- mounts on a section page and POSTs a reading-time
 * tick every `HANDBOOK_HEARTBEAT_INTERVAL_SEC` while the page is visible.
 *
 * Visibility is gated on the Page Visibility API: hidden tabs, minimised
 * browsers, and locked-screen contexts all pause the tick. Window blur is
 * deliberately NOT a pause condition -- a CFI watching the screen while
 * Slack has focus is still reading.
 *
 * Each tick posts `{ delta: <interval-seconds> }` and ignores the response;
 * the server caps at `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4` so a stale tab
 * resumed after sleep doesn't credit unbounded time. The first failed POST
 * stops the ticker -- the user is anonymous, the section vanished, or the
 * server is unreachable. None of those are recoverable mid-session, so
 * silent backoff is right.
 *
 * No throttle on top of the natural interval is needed: the interval is the
 * throttle. The endpoint also enforces `delta >= HANDBOOK_HEARTBEAT_MIN_DELTA_SEC`
 * which protects against scripted callers; the natural interval is well
 * above the floor.
 */

import { HANDBOOK_HEARTBEAT_INTERVAL_SEC, ROUTES } from '@ab/constants';

export interface HeartbeatTickerProps {
	readonly sectionId: string;
	/** When false (anonymous user), the component renders nothing and never ticks. */
	readonly enabled: boolean;
}
</script>

<script lang="ts">
import { onDestroy, onMount } from 'svelte';

let { sectionId, enabled }: HeartbeatTickerProps = $props();

let intervalId: ReturnType<typeof setInterval> | null = null;
let stopped = $state(false);

function isVisible(): boolean {
	if (typeof document === 'undefined') return false;
	return document.visibilityState === 'visible';
}

async function tick(): Promise<void> {
	if (stopped) return;
	if (!isVisible()) return;
	try {
		const response = await fetch(ROUTES.FLIGHTBAG_SECTION_HEARTBEAT(sectionId), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ delta: HANDBOOK_HEARTBEAT_INTERVAL_SEC }),
		});
		if (!response.ok) stopped = true;
	} catch {
		stopped = true;
	}
}

onMount(() => {
	if (!enabled) return;
	intervalId = setInterval(() => {
		void tick();
	}, HANDBOOK_HEARTBEAT_INTERVAL_SEC * 1000);
});

onDestroy(() => {
	if (intervalId !== null) clearInterval(intervalId);
});
</script>
