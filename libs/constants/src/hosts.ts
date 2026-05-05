export const HOSTS = {
	AVIONICS: 'avionics.airboss.test',
	STUDY: 'study.airboss.test',
	SIM: 'sim.airboss.test',
	HANGAR: 'hangar.airboss.test',
	FLIGHTBAG: 'flightbag.airboss.test',
} as const;

export const COOKIE_DOMAIN_DEV = '.airboss.test' as const;
export const COOKIE_DOMAIN_PROD = '.air-boss.org' as const;

export const AUTH_INTERNAL_ORIGIN = 'http://localhost' as const;

/** Domain used in transactional email From addresses. */
export const MAIL_DOMAIN_PROD = 'air-boss.org' as const;
export const MAIL_FROM_NOREPLY = `airboss <noreply@${MAIL_DOMAIN_PROD}>` as const;

/**
 * App-host subdomain prefixes. Each surface (study/sim/hangar) is served
 * from `${prefix}.${rootDomain}`; the prefix is constant across dev and
 * prod, only the root domain swaps.
 */
export const HOST_PREFIXES = {
	AVIONICS: 'avionics',
	STUDY: 'study',
	SIM: 'sim',
	HANGAR: 'hangar',
	FLIGHTBAG: 'flightbag',
} as const;

/**
 * Derive a sibling app's origin from the current request URL. Sim and
 * study live on different subdomains of the same parent domain, so the
 * sign-in link from sim has to point at the study origin. Driving the
 * swap from the live URL keeps dev (`*.airboss.test:port`) and prod
 * (`*.air-boss.org`) both working without separate config -- we just
 * replace the leading subdomain.
 */
export function siblingOrigin(currentUrl: URL, prefix: (typeof HOST_PREFIXES)[keyof typeof HOST_PREFIXES]): string {
	const host = currentUrl.host;
	const firstDot = host.indexOf('.');
	const parentHost = firstDot === -1 ? host : host.slice(firstDot + 1);
	return `${currentUrl.protocol}//${prefix}.${parentHost}`;
}

/**
 * Derive the origins for every surface app from the current request URL.
 * Used by the shared `AppHeader` brand dropdown so any app can render a
 * one-click switcher across the surface family. Keys match `AppId` (the
 * lowercase surface ids used by `AppHeader`); values are absolute origins
 * (e.g. `https://hangar.airboss.test`). Subdomain prefixes come from
 * `HOST_PREFIXES`, never inline strings.
 */
export function appOrigins(currentUrl: URL): {
	avionics: string;
	study: string;
	sim: string;
	hangar: string;
	flightbag: string;
} {
	return {
		avionics: siblingOrigin(currentUrl, HOST_PREFIXES.AVIONICS),
		study: siblingOrigin(currentUrl, HOST_PREFIXES.STUDY),
		sim: siblingOrigin(currentUrl, HOST_PREFIXES.SIM),
		hangar: siblingOrigin(currentUrl, HOST_PREFIXES.HANGAR),
		flightbag: siblingOrigin(currentUrl, HOST_PREFIXES.FLIGHTBAG),
	};
}
