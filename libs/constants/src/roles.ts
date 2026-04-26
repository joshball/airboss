export const ROLES = {
	LEARNER: 'learner',
	AUTHOR: 'author',
	OPERATOR: 'operator',
	ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * All role values, in display order (least -> most privileged). Used by
 * UI surfaces that render role pickers, badges, or summary counts so the
 * order is stable across pages.
 */
export const ROLE_VALUES: readonly Role[] = [ROLES.LEARNER, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN] as const;

/**
 * Human-readable labels for each role. Title-cased copy for badges,
 * filter pickers, and summary text. Mirrors the `LABELS` map pattern
 * used for other enums (e.g. `SOURCE_TYPE_LABELS`).
 */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
	[ROLES.LEARNER]: 'Learner',
	[ROLES.AUTHOR]: 'Author',
	[ROLES.OPERATOR]: 'Operator',
	[ROLES.ADMIN]: 'Admin',
};
