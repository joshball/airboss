export const HOSTS = {
	STUDY: 'study.airboss.test',
	SIM: 'sim.airboss.test',
} as const;

export const COOKIE_DOMAIN_DEV = '.airboss.test' as const;
export const COOKIE_DOMAIN_PROD = '.air-boss.org' as const;

export const AUTH_INTERNAL_ORIGIN = 'http://localhost' as const;

/** Domain used in transactional email From addresses. */
export const MAIL_DOMAIN_PROD = 'air-boss.org' as const;
export const MAIL_FROM_NOREPLY = `airboss <noreply@${MAIL_DOMAIN_PROD}>` as const;
