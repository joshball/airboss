/**
 * Shared a11y caption store for every cockpit audio cue. Each cue calls
 * `show(cueId)` when it starts sounding and `hide(cueId)` when it stops;
 * captions linger for `SIM_CAPTION.LINGER_MS` after hide so they do not
 * flicker on intermittent cues (stall warning blinks, marker dots).
 *
 * Implemented as a rune-backed module so both the cue classes (which run in
 * `.svelte.ts` contexts) and the `<AudioCaptions>` panel share one source of
 * truth. The panel renders an `aria-live="polite"` region so screen readers
 * announce each caption when it appears.
 */

import { SIM_CAPTION, SIM_WARNING_CUE_LABELS, type SimWarningCue } from '@ab/constants';

interface CaptionEntry {
	cue: SimWarningCue;
	label: string;
	/** Wall-clock ms at which this entry should be removed if still inactive. */
	expiresAt: number | null;
}

class CaptionStore {
	private entries = $state<CaptionEntry[]>([]);
	private timers = new Map<SimWarningCue, ReturnType<typeof setTimeout>>();

	/** Reactive accessor for consumers. */
	get captions(): readonly CaptionEntry[] {
		return this.entries;
	}

	/** Mark a cue as active -- caption appears immediately and persists until `hide()`. */
	show(cue: SimWarningCue): void {
		this.clearTimer(cue);
		const existing = this.entries.find((e) => e.cue === cue);
		if (existing) {
			existing.expiresAt = null;
			return;
		}
		this.entries = [
			...this.entries.slice(-SIM_CAPTION.MAX_VISIBLE + 1),
			{ cue, label: SIM_WARNING_CUE_LABELS[cue], expiresAt: null },
		];
	}

	/** Mark a cue as inactive. Caption lingers for `LINGER_MS` then fades. */
	hide(cue: SimWarningCue): void {
		this.clearTimer(cue);
		const entry = this.entries.find((e) => e.cue === cue);
		if (!entry) return;
		const expiresAt = Date.now() + SIM_CAPTION.LINGER_MS;
		entry.expiresAt = expiresAt;
		const timer = setTimeout(() => {
			this.entries = this.entries.filter((e) => e.cue !== cue);
			this.timers.delete(cue);
		}, SIM_CAPTION.LINGER_MS);
		this.timers.set(cue, timer);
	}

	/** Fire-and-linger helper for single-shot cues (alt alert, AP disconnect). */
	pulse(cue: SimWarningCue): void {
		this.show(cue);
		this.hide(cue);
	}

	/** Clear every caption and pending timer. Called on scenario outcome / destroy. */
	reset(): void {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.timers.clear();
		this.entries = [];
	}

	private clearTimer(cue: SimWarningCue): void {
		const timer = this.timers.get(cue);
		if (timer !== undefined) {
			clearTimeout(timer);
			this.timers.delete(cue);
		}
	}
}

export const captionStore = new CaptionStore();
export type { CaptionEntry };
