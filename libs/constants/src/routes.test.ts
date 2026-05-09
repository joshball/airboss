import { describe, expect, it } from 'vitest';
import { ROUTES } from './routes';

describe('ROUTES.FLIGHTBAG_*', () => {
	it('home is the root path', () => {
		expect(ROUTES.FLIGHTBAG_HOME).toBe('/');
	});

	it('handbook landing encodes slug + edition', () => {
		expect(ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C')).toBe('/handbook/phak/8083-25C');
	});

	it('handbook chapter encodes slug + edition + chapter', () => {
		expect(ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '2')).toBe('/handbook/phak/8083-25C/2');
	});

	it('handbook section encodes slug + edition + chapter + section', () => {
		expect(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '2', '3')).toBe('/handbook/phak/8083-25C/2/3');
	});

	it('handbook section URI-encodes path components with slashes', () => {
		// Defense-in-depth: even though FAA edition slugs don't contain slashes today,
		// the route helper must protect against future inputs that do.
		expect(ROUTES.FLIGHTBAG_HANDBOOK_SECTION('a/b', '8083', '1', '2')).toBe('/handbook/a%2Fb/8083/1/2');
	});

	it('aim paragraph encodes chapter + section + paragraph', () => {
		expect(ROUTES.FLIGHTBAG_AIM_PARAGRAPH('5', '1', '7')).toBe('/aim/5/1/7');
	});

	it('cfr section encodes title + part + section', () => {
		expect(ROUTES.FLIGHTBAG_CFR_SECTION('14', '91', '103')).toBe('/cfr/14/91/103');
	});

	it('cfr section preserves alphanumeric section identifiers', () => {
		expect(ROUTES.FLIGHTBAG_CFR_SECTION('14', '91', '103a')).toBe('/cfr/14/91/103a');
	});

	it('ac encodes doc number + revision', () => {
		expect(ROUTES.FLIGHTBAG_AC('61-65', 'j')).toBe('/ac/61-65/j');
	});

	it('ac handles dotted doc numbers', () => {
		expect(ROUTES.FLIGHTBAG_AC('91-21.1', 'd')).toBe('/ac/91-21.1/d');
	});

	it('acs task encodes doc + area + task', () => {
		expect(ROUTES.FLIGHTBAG_ACS_TASK('ppl-airplane-acs-6c', '1', 'A')).toBe('/acs/ppl-airplane-acs-6c/area/1/task/A');
	});
});
