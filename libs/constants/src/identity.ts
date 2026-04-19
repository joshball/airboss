// User account status filter values. The DB stores `banned` as a boolean,
// but the UI and server both use these strings for filter parameters.
export const USER_STATUS = {
	ACTIVE: 'active',
	BANNED: 'banned',
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const MIN_PASSWORD_LENGTH = 8 as const;
