import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { XC_SCENARIO_BUNDLE, XC_SCENARIO_VALUES, type XcScenario } from '@ab/constants';
import type { ScenarioBundle } from '@ab/spatial-engine';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * XC viewer page load.
 *
 * Reads the composed `ScenarioBundle` from `data/xc-scenarios/<slug>/`
 * and returns it to the page. The bundle is produced by
 * `bun run xc-scenario build <slug>`; this load is a pure file read --
 * the page never imports the spatial engine on the client.
 *
 * 404s when the slug is not a registered scenario or its bundle has not
 * been built.
 */
export const load: PageServerLoad = ({ params }) => {
	const slug = params.slug;
	if (!(XC_SCENARIO_VALUES as readonly string[]).includes(slug)) {
		throw error(404, `Unknown XC scenario: ${slug}`);
	}

	const bundlePath = join(process.cwd(), '..', '..', 'data', 'xc-scenarios', slug, XC_SCENARIO_BUNDLE.BUNDLE);
	let bundle: ScenarioBundle;
	try {
		bundle = JSON.parse(readFileSync(bundlePath, 'utf-8')) as ScenarioBundle;
	} catch {
		throw error(404, `Scenario "${slug}" has not been built. Run \`bun run xc-scenario build ${slug}\`.`);
	}

	return { bundle, scenarioId: slug as XcScenario };
};
