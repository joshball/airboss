/**
 * AIRMET / SIGMET token-walker. AIRMET advisories arrive as the
 * `AirmetAdvisory` shape from `@ab/wx-engine`; we annotate the fields
 * that matter operationally: kind, label, validity window, ring count.
 */

import type { AirmetAdvisory, TruthModel } from '@ab/wx-engine';
import type { TokenAnnotation } from './types';

export function explainAirmet(advisory: AirmetAdvisory, truth?: TruthModel): TokenAnnotation[] {
	const out: TokenAnnotation[] = [];
	out.push({
		token: advisory.kind,
		family: 'airmet-kind',
		decode: `advisory kind: ${advisory.kind}`,
	});
	out.push({
		token: advisory.label,
		family: 'airmet-label',
		decode: `label: ${advisory.label}`,
	});
	out.push({
		token: `${advisory.validFrom} -> ${advisory.validTo}`,
		family: 'airmet-validity',
		decode: `valid ${advisory.validFrom} through ${advisory.validTo}`,
	});
	const vertexCount = advisory.rings.reduce((sum, ring) => sum + ring.length, 0);
	out.push({
		token: `${advisory.rings.length} ring(s)`,
		family: 'airmet-ring',
		decode: `${advisory.rings.length} closed polygon ring(s), ${vertexCount} vertices total`,
	});
	void truth;
	return out;
}
