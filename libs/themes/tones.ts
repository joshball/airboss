/**
 * Shared tone vocabulary for Badge, StatTile, Banner, and any primitive
 * that needs to dispatch styling on intent.
 *
 * Kept as a separate module so primitives outside `libs/themes` can
 * import tones without pulling in the full contract / emit pipeline.
 */

export const TONES = {
	neutral: 'neutral',
	info: 'info',
	success: 'success',
	warning: 'warning',
	danger: 'danger',
	accent: 'accent',
} as const;

export type Tone = (typeof TONES)[keyof typeof TONES];
