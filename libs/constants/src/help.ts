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
