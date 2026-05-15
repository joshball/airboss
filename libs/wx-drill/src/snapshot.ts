/**
 * Build a snapshot of a single wx scenario's encoded-text products with
 * per-token annotations attached. Server-only -- pulls from
 * `@ab/wx-engine/server` (`generateScenario`), which evaluates the truth
 * model and authors all four product types.
 *
 * Pulled into a separate module so the sampler (pure / browser-safe) can
 * consume the snapshot shape via type-only imports.
 */

import type { WxScenario } from '@ab/constants';
import { generateScenario } from '@ab/wx-engine/server';
import { explainAirmet, explainFb, explainMetar, explainPirep, explainTaf, type TokenAnnotation } from '@ab/wx-explain';

export interface ScenarioSnapshot {
	slug: WxScenario;
	metars: { icao: string; raw: string; annotations: TokenAnnotation[] }[];
	tafs: { icao: string; raw: string; annotations: TokenAnnotation[] }[];
	pireps: { raw: string; annotations: TokenAnnotation[] }[];
	fbItems: { raw: string; annotations: TokenAnnotation[] } | null;
	airmets: { id: string; annotations: TokenAnnotation[] }[];
}

export function snapshotScenario(slug: WxScenario): ScenarioSnapshot {
	const bundle = generateScenario({ kind: slug });
	const truth = bundle.truth;
	return {
		slug,
		metars: bundle.products.metars.map((m) => ({
			icao: m.parsed.station,
			raw: m.raw,
			annotations: explainMetar(m.parsed, truth),
		})),
		tafs: bundle.products.tafs.map((t) => ({
			icao: t.parsed.station,
			raw: t.raw,
			annotations: explainTaf(t.parsed, truth),
		})),
		pireps: bundle.products.pireps.map((p) => ({
			raw: p.raw,
			annotations: explainPirep(p.parsed, truth),
		})),
		fbItems: bundle.products.fbGrid
			? { raw: bundle.products.fbGrid.raw, annotations: explainFb(bundle.products.fbGrid.parsed, truth) }
			: null,
		airmets: bundle.products.airmets.map((a) => ({
			id: a.id,
			annotations: explainAirmet(a, truth),
		})),
	};
}
