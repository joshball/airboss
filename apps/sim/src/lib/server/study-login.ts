/**
 * Study sign-in URL derivation for the sim surface.
 *
 * Sim does not host the login UI -- study owns it. Anonymous visits to
 * gated sim routes bounce to the study login page. Sim runs at
 * `sim.airboss.test` in dev / `sim.air-boss.org` in prod, so the study
 * host is the sibling subdomain: replace the leading subdomain with
 * `study`. Falls back to the dev study host when the request host has no
 * parseable parent (e.g. an IP address like `127.0.0.1`).
 */

import { HOSTS, ROUTES } from '@ab/constants';

export function studyLoginUrl(currentUrl: URL): string {
	const fallback = `${currentUrl.protocol}//${HOSTS.STUDY}${ROUTES.LOGIN}`;
	const host = currentUrl.host;
	const dotIdx = host.indexOf('.');
	if (dotIdx <= 0) return fallback;
	const parent = host.slice(dotIdx + 1);
	return `${currentUrl.protocol}//study.${parent}${ROUTES.LOGIN}`;
}
