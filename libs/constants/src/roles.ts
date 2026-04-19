export const ROLES = {
	LEARNER: 'learner',
	AUTHOR: 'author',
	OPERATOR: 'operator',
	ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
