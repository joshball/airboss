/**
 * Round-trip tests for the canonical YAML emission
 * (course-reader-and-editor WP, Phase 6).
 *
 * Each test parses an emitted document with the BC's Zod schema (the same
 * one the seed pipeline uses) and asserts the parsed shape deep-equals
 * the input. Catches:
 *
 *   - key-order regressions (`yaml.parse` doesn't care about order, but
 *     the emitted text would diff dirty against the existing fixtures)
 *   - block-scalar regressions (markdown body losing leading whitespace)
 *   - schema drift (new required field landing without a corresponding
 *     emitter update)
 */

import { courseManifestSchema, courseSectionSchema } from '@ab/bc-study';
import { COURSE_KINDS, COURSE_STATUSES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { emitManifest, emitSection } from '../course-yaml-emit';

describe('emitManifest', () => {
	it('round-trips through courseManifestSchema', () => {
		const input = {
			slug: 'weather-comprehensive',
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Weather Comprehensive',
			status: COURSE_STATUSES.ACTIVE,
			description: 'A multi-line\ndescription with paragraphs.\n\nAnd a second paragraph.',
		};
		const yaml = emitManifest(input);
		const parsed = courseManifestSchema.parse(parse(yaml));
		expect(parsed).toEqual(input);
	});

	it('emits keys in stable order: slug, kind, title, status, description', () => {
		const yaml = emitManifest({
			slug: 'demo',
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Demo',
			status: COURSE_STATUSES.DRAFT,
			description: '',
		});
		const lines = yaml.split('\n').filter((line) => line.length > 0 && !line.startsWith(' '));
		const keys = lines.map((line) => line.split(':')[0]);
		// Filter out blank-line markers and keep just the top-level keys.
		expect(keys).toEqual(['slug', 'kind', 'title', 'status', 'description']);
	});

	it('emits an empty description as an empty string', () => {
		const yaml = emitManifest({
			slug: 'demo',
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Demo',
			status: COURSE_STATUSES.ACTIVE,
			description: '',
		});
		const parsed = courseManifestSchema.parse(parse(yaml));
		expect(parsed.description).toBe('');
	});
});

describe('emitSection', () => {
	it('round-trips through courseSectionSchema', () => {
		const input = {
			code: 's1',
			ordinal: 1,
			title: 'First Section',
			body_md: 'Section preamble paragraph.',
			steps: [
				{
					code: 's1.1',
					ordinal: 1,
					title: 'First step',
					body_md: 'Step framing.\n\nWith a second paragraph.',
					knowledge_node_id: 'wx-thunderstorm-hazards',
				},
				{
					code: 's1.2',
					ordinal: 2,
					title: 'Second step',
					body_md: '',
					knowledge_node_id: 'wx-icing-types-and-avoidance',
				},
			],
		};
		const yaml = emitSection(input);
		const parsed = courseSectionSchema.parse(parse(yaml));
		expect(parsed).toEqual(input);
	});

	it('preserves markdown body_md verbatim through the round trip', () => {
		const bodyWithSpecialChars = 'Line one with `code`.\nLine two with **bold** and a colon: here.';
		const input = {
			code: 's1',
			ordinal: 0,
			title: 'Body fidelity',
			body_md: bodyWithSpecialChars,
			steps: [],
		};
		const yaml = emitSection(input);
		const parsed = courseSectionSchema.parse(parse(yaml));
		expect(parsed.body_md).toBe(bodyWithSpecialChars);
	});

	it('emits zero steps as an empty list', () => {
		const yaml = emitSection({
			code: 's1',
			ordinal: 0,
			title: 'Empty section',
			body_md: '',
			steps: [],
		});
		const parsed = courseSectionSchema.parse(parse(yaml));
		expect(parsed.steps).toEqual([]);
	});
});
