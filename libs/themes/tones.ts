/**
 * Shared tone vocabulary for status-bearing primitives (Badge, StatTile,
 * Banner). A tone communicates *intent of the indicator*, mapped to
 * role tokens by the consuming component.
 *
 * Kept as a separate module so primitives outside `libs/themes` can
 * import tones without pulling in the full contract / emit pipeline.
 *
 * Tone semantics:
 *
 *   default  -- ordinary, no special intent (action-neutral roles)
 *   featured -- the focal indicator on a surface (action-default roles)
 *   muted    -- de-emphasized "FYI" (neutral roles + ink-subtle)
 *   success  -- positive state (signal-success roles)
 *   warning  -- caution / attention (signal-warning roles)
 *   danger   -- error / destructive state (signal-danger roles)
 *   info     -- informational state (signal-info roles)
 *   accent   -- decorative emphasis (accent roles)
 *
 * `featured` replaces the prior `primary` tone. `primary` was a ranked
 * name that collided with `Button.variant="primary"` and had no clear
 * status meaning; `featured` describes what it actually does -- mark
 * the focal status indicator on a surface.
 *
 * Tones are intentionally separate from `Button.variant` (`primary |
 * secondary | ghost | danger`). Buttons express *role of an action*;
 * tones express *intent of a status indicator*. The vocabularies
 * overlap but should not be merged.
 */

export const TONES = ['default', 'featured', 'muted', 'success', 'warning', 'danger', 'info', 'accent'] as const;

export type Tone = (typeof TONES)[number];

export function isTone(value: unknown): value is Tone {
	return typeof value === 'string' && (TONES as readonly string[]).includes(value);
}
