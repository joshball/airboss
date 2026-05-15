/**
 * Grader unit tests. Substring-grade decodes accept reasonable
 * variations; single-choice form requires exact key match.
 */

import { WX_PRACTICE_QUESTION_FORMS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { defaultQuestionForm, gradeAttempt } from '../grader';

const altimeterAnnotation = {
	token: 'A2999',
	family: 'altimeter',
	decode: 'altimeter setting 29.99 inHg',
};

describe('gradeAttempt', () => {
	it('accepts a substring match for decode-token form', () => {
		const out = gradeAttempt({
			annotation: altimeterAnnotation,
			questionForm: WX_PRACTICE_QUESTION_FORMS.DECODE_TOKEN,
			answer: '29.99',
		});
		expect(out.correct).toBe(true);
		expect(out.rationale).toMatch(/29\.99/);
	});

	it('rejects unrelated text', () => {
		const out = gradeAttempt({
			annotation: altimeterAnnotation,
			questionForm: WX_PRACTICE_QUESTION_FORMS.DECODE_TOKEN,
			answer: 'low pressure system',
		});
		expect(out.correct).toBe(false);
	});

	it('normalises casing + whitespace', () => {
		const out = gradeAttempt({
			annotation: altimeterAnnotation,
			questionForm: WX_PRACTICE_QUESTION_FORMS.DECODE_TOKEN,
			answer: '   ALTIMETER  SETTING   29.99 INHG   ',
		});
		expect(out.correct).toBe(true);
	});

	it('accepts a value from the acceptable list', () => {
		const out = gradeAttempt({
			annotation: altimeterAnnotation,
			questionForm: WX_PRACTICE_QUESTION_FORMS.DECODE_TOKEN,
			answer: 'two niner niner niner',
			acceptable: ['altimeter setting 29.99 inHg', 'two niner niner niner'],
		});
		expect(out.correct).toBe(true);
	});

	it('single-choice form is exact option key match', () => {
		const ok = gradeAttempt({
			annotation: altimeterAnnotation,
			questionForm: WX_PRACTICE_QUESTION_FORMS.SINGLE_CHOICE,
			answer: 'opt-a',
			expectedOptionKey: 'opt-a',
		});
		expect(ok.correct).toBe(true);

		const bad = gradeAttempt({
			annotation: altimeterAnnotation,
			questionForm: WX_PRACTICE_QUESTION_FORMS.SINGLE_CHOICE,
			answer: 'opt-b',
			expectedOptionKey: 'opt-a',
		});
		expect(bad.correct).toBe(false);
	});
});

describe('defaultQuestionForm', () => {
	it('picks decode-group for wind / sky / temp-dew families', () => {
		expect(defaultQuestionForm('wind')).toBe(WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP);
		expect(defaultQuestionForm('wind-gust')).toBe(WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP);
		expect(defaultQuestionForm('sky-condition')).toBe(WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP);
		expect(defaultQuestionForm('temp-dew')).toBe(WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP);
	});

	it('defaults to decode-token for other families', () => {
		expect(defaultQuestionForm('altimeter')).toBe(WX_PRACTICE_QUESTION_FORMS.DECODE_TOKEN);
		expect(defaultQuestionForm('visibility')).toBe(WX_PRACTICE_QUESTION_FORMS.DECODE_TOKEN);
	});
});
