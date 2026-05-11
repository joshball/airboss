/**
 * `/library/regulations/[kind]/[group]` -- legacy per-group landing.
 * 301s to the flightbag CFR Part / AIM Chapter / etc landing.
 */

import { parseRegulationGroup, parseRegulationKind } from '@ab/aviation';
import { HOST_PREFIXES, siblingOrigin } from '@ab/constants';
import { error, redirect } from '@sveltejs/kit';
import { flightbagPathForRegulationGroup } from '../../../../../../lib/library-redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const kind = parseRegulationKind(params.kind);
	if (!kind) throw error(404, `Unknown regulations kind: ${params.kind}`);
	const group = parseRegulationGroup(kind, params.group);
	if (!group) throw error(404, `Invalid group slug: ${params.group}`);
	const flightbag = siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG);
	throw redirect(301, `${flightbag}${flightbagPathForRegulationGroup(kind, group)}`);
};
