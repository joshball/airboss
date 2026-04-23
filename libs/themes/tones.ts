/**
 * Shared tone vocabulary for Badge, StatTile, Banner, and any primitive
 * that needs to dispatch styling on intent.
 *
 * Kept as a separate module so primitives outside `libs/themes` can
 * import tones without pulling in the full contract / emit pipeline.
 *
 * The tone set matches the spec (package #4):
 *   default | primary | success | warning | danger | info | muted | accent
 *
 * `neutral` is retained as a deprecated alias for `default` for
 * migration purposes; package #5 sweeps call sites.
 */

export const TONES = {
	default: 'default',
	primary: 'primary',
	success: 'success',
	warning: 'warning',
	danger: 'danger',
	info: 'info',
	muted: 'muted',
	accent: 'accent',
} as const;

export type Tone = (typeof TONES)[keyof typeof TONES];

/** @deprecated `neutral` is aliased to `default`; migrate call sites in package #5. */
export type LegacyNeutralTone = 'neutral';

/** Accepts either the current `Tone` set or the legacy `neutral` alias. */
export type ToneInput = Tone | LegacyNeutralTone;

/** Normalize an incoming tone (including the legacy `neutral`) to a `Tone`. */
export function resolveTone(value: ToneInput | undefined): Tone {
	if (value === undefined) return 'default';
	if (value === 'neutral') return 'default';
	return value;
}
