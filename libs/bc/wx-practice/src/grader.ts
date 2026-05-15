/**
 * Per-attempt grader. Given a token annotation + the student's answer +
 * the question form, returns correct/incorrect + a rationale string the
 * route can render after the answer is submitted.
 *
 * Pure -- no DB. Browser-safe.
 *
 * The grader is intentionally permissive on free-form decodes: it
 * normalizes whitespace + casing and checks for substring overlap with
 * the canonical decode plus a handful of common acceptable variants. The
 * goal is encoded-text fluency, not exact-prose memorization -- a
 * student who answers "broken 1200" for a `BKN012` decode should not be
 * marked wrong because they didn't say "Broken layer at 1,200 ft AGL".
 *
 * For single-choice / multi-choice question forms, the answer is the
 * option key and grading is an exact string match.
 */

import { WX_PRACTICE_QUESTION_FORMS, type WxPracticeQuestionForm } from '@ab/constants';
import type { TokenAnnotation } from '@ab/wx-explain';

export interface GradeAttemptInput {
	annotation: TokenAnnotation;
	questionForm: WxPracticeQuestionForm;
	/** The student's literal answer (decode text, option key, JSON-encoded structured fields, etc.). */
	answer: string;
	/** Optional explicit set of acceptable answers (overrides default decode-substring grading). */
	acceptable?: readonly string[];
	/** The expected option key for single/multi-choice forms. */
	expectedOptionKey?: string;
}

export interface GradeAttemptResult {
	correct: boolean;
	/** Human-readable rationale shown after the answer is submitted. */
	rationale: string;
}

function normalize(s: string): string {
	return s
		.toLowerCase()
		.replace(/[,\s]+/g, ' ')
		.trim();
}

function decodeSubstringMatches(answer: string, decode: string): boolean {
	const normAnswer = normalize(answer);
	const normDecode = normalize(decode);
	if (normAnswer.length === 0) return false;
	if (normAnswer === normDecode) return true;
	// Accept if the answer is a substring of the canonical decode, OR vice versa
	// (student went shorter or longer than canonical).
	if (normDecode.includes(normAnswer)) return true;
	if (normAnswer.includes(normDecode)) return true;
	return false;
}

export function gradeAttempt(input: GradeAttemptInput): GradeAttemptResult {
	const { annotation, questionForm, answer } = input;

	switch (questionForm) {
		case WX_PRACTICE_QUESTION_FORMS.SINGLE_CHOICE:
		case WX_PRACTICE_QUESTION_FORMS.MULTI_CHOICE: {
			const expected = input.expectedOptionKey ?? '';
			const correct = normalize(answer) === normalize(expected);
			return {
				correct,
				rationale: correct
					? `Correct -- ${annotation.token} means: ${annotation.decode}.`
					: `Not quite. ${annotation.token} means: ${annotation.decode}.`,
			};
		}
		case WX_PRACTICE_QUESTION_FORMS.STRUCTURED:
		case WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP:
		case WX_PRACTICE_QUESTION_FORMS.DECODE_TOKEN: {
			const acceptable = input.acceptable ?? [annotation.decode];
			const correct = acceptable.some((a) => decodeSubstringMatches(answer, a));
			return {
				correct,
				rationale: correct
					? `Correct -- ${annotation.token} = ${annotation.decode}${annotation.why ? ` (${annotation.why})` : ''}.`
					: `Expected ${annotation.token} = ${annotation.decode}${annotation.why ? ` (${annotation.why})` : ''}.`,
			};
		}
	}
}

/**
 * Pick a sensible question form for a given annotation family. Lets the
 * route ask "what form should I render?" without hardcoding family ->
 * form. Default is `decode-token`; wind / sky / temp groups use
 * `decode-group` and may be split into sub-questions by the caller.
 */
export function defaultQuestionForm(family: string): WxPracticeQuestionForm {
	if (family.startsWith('wind')) return WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP;
	if (family.startsWith('sky')) return WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP;
	if (family === 'temp-dew') return WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP;
	return WX_PRACTICE_QUESTION_FORMS.DECODE_TOKEN;
}
