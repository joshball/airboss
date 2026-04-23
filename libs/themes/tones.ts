/**
 * Shared tone enum used across Badge, StatTile, Banner, and other primitives
 * whose variants are discrete semantic tones rather than free-form color.
 *
 * Tones map to role tokens:
 *   default -> action-neutral / ink-body
 *   primary -> action-default
 *   success -> signal-success
 *   warning -> signal-warning
 *   danger  -> signal-danger / action-hazard
 *   info    -> signal-info
 *   accent  -> accent-reference
 *
 * The primitive decides whether a tone reads as "action" (interactive) or
 * "signal" (status). Consumers pick a tone; the primitive picks the right
 * token family.
 */

export const TONES = {
	DEFAULT: 'default',
	PRIMARY: 'primary',
	SUCCESS: 'success',
	WARNING: 'warning',
	DANGER: 'danger',
	INFO: 'info',
	ACCENT: 'accent',
} as const;

export type Tone = (typeof TONES)[keyof typeof TONES];
