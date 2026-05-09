import { courseManifestSchema, courseSectionSchema } from '@ab/bc-study';
import { COURSE_KINDS, COURSE_STATUSES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { emitManifest, emitSection } from '../course-yaml-emit';

describe('emitManifest', () => {
	it('round-trips through parse -> validate -> deep-equal', () => {
		const manifest = courseManifestSchema.parse({
			slug: 'demo-course',
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Demo Course',
			status: COURSE_STATUSES.ACTIVE,
			description: 'Multi-line\ndescription with\ntwo line breaks',
		});
		const emitted = emitManifest(manifest);
		const parsed = courseManifestSchema.parse(parse(emitted));
		expect(parsed).toMatchObject(manifest);
	});

	it('preserves multi-line description as block-literal style', () => {
		const manifest = courseManifestSchema.parse({
			slug: 'block-literal-test',
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Block Literal',
			description: 'Line one.\nLine two.\nLine three.',
		});
		const emitted = emitManifest(manifest);
		// The block-literal indicator `|` is the canonical fixture style.
		expect(emitted).toMatch(/description:\s*\|/);
		// The bare string should NOT carry quote characters around the body.
		expect(emitted).not.toContain('"Line one');
	});

	it('emits keys in stable order matching the seed-smoke fixture', () => {
		const manifest = courseManifestSchema.parse({
			slug: 'order-test',
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Order Test',
		});
		const emitted = emitManifest(manifest);
		const slugIdx = emitted.indexOf('slug:');
		const kindIdx = emitted.indexOf('kind:');
		const titleIdx = emitted.indexOf('title:');
		const statusIdx = emitted.indexOf('status:');
		const descIdx = emitted.indexOf('description:');
		expect(slugIdx).toBeLessThan(kindIdx);
		expect(kindIdx).toBeLessThan(titleIdx);
		expect(titleIdx).toBeLessThan(statusIdx);
		expect(statusIdx).toBeLessThan(descIdx);
	});
});

describe('emitSection', () => {
	it('round-trips through parse -> validate -> deep-equal', () => {
		const section = courseSectionSchema.parse({
			code: 's1',
			ordinal: 1,
			title: 'First section',
			body_md: 'A short prelude.\n',
			steps: [
				{
					code: 's1.1',
					ordinal: 1,
					title: 'Step one',
					body_md: 'Step body.\n',
					knowledge_node_id: 'wx-thunderstorm-hazards',
				},
				{
					code: 's1.2',
					ordinal: 2,
					title: 'Step two',
					body_md: '',
					knowledge_node_id: 'wx-icing-types-and-avoidance',
				},
			],
		});
		const emitted = emitSection(section);
		const parsed = courseSectionSchema.parse(parse(emitted));
		expect(parsed.code).toBe(section.code);
		expect(parsed.ordinal).toBe(section.ordinal);
		expect(parsed.title).toBe(section.title);
		expect(parsed.body_md).toBe(section.body_md);
		expect(parsed.steps.length).toBe(2);
		expect(parsed.steps[0].knowledge_node_id).toBe('wx-thunderstorm-hazards');
		expect(parsed.steps[1].knowledge_node_id).toBe('wx-icing-types-and-avoidance');
	});

	it('emits step keys in stable order (code, ordinal, title, body_md, knowledge_node_id)', () => {
		const section = courseSectionSchema.parse({
			code: 's1',
			ordinal: 1,
			title: 's',
			body_md: '',
			steps: [
				{
					code: 's1.1',
					ordinal: 1,
					title: 't',
					body_md: 'body',
					knowledge_node_id: 'wx-thunderstorm-hazards',
				},
			],
		});
		const emitted = emitSection(section);
		const codeIdx = emitted.indexOf('code: s1.1');
		const knowledgeIdx = emitted.indexOf('knowledge_node_id:');
		expect(codeIdx).toBeGreaterThan(0);
		expect(knowledgeIdx).toBeGreaterThan(codeIdx);
	});

	it('omits knowledge_node_id when not present (sections never carry it)', () => {
		const section = courseSectionSchema.parse({
			code: 's2',
			ordinal: 2,
			title: 'No node',
			body_md: '',
			steps: [],
		});
		const emitted = emitSection(section);
		expect(emitted).not.toContain('knowledge_node_id');
	});
});
