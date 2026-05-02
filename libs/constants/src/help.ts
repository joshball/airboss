/**
 * Default copy for help-trigger affordances (PageHelp, InfoTip, and future
 * HelpTrigger unifications). Kept in constants so labels are swappable without
 * touching component code, and so rendering never depends on magic strings.
 */

export const HELP_TRIGGER_LABELS = {
	PAGE: 'Help',
	ITEM: '',
} as const;

export type HelpTriggerLabelKey = keyof typeof HELP_TRIGGER_LABELS;

/**
 * Debounce window for the help/aviation search palette. Keystrokes inside
 * this window collapse into a single search execution. 150 ms is short
 * enough that the palette feels live for slow typing yet long enough to
 * elide the per-key bursts a fast typist produces (~10 keys/sec).
 */
export const HELP_SEARCH_DEBOUNCE_MS = 150;
