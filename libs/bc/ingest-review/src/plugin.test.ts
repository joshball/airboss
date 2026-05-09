/**
 * Plugin registry tests. Pure module-level state; the BC's plugin
 * registration is a side-effect of `import './plugins'`. Tests reset
 * the registry before each scenario so re-running this file gives
 * deterministic output.
 */

import { INGEST_REVIEW, type IngestIssueKind } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	getPlugin,
	listPluginKinds,
	listPlugins,
	PluginAlreadyRegisteredError,
	registerPlugin,
	resetPluginRegistry,
	UnknownPluginKindError,
} from './plugin';
import type { IngestIssuePlugin } from './types';

function makeStub(kind: IngestIssueKind): IngestIssuePlugin {
	return {
		kind,
		async *produceIssues() {
			// no-op
		},
		async findCandidates() {
			return [];
		},
		validateAction() {
			// no-op
		},
		serializeForYaml(issue, override) {
			return {
				external_id: issue.externalId,
				kind: issue.kind,
				action: override.action,
				payload: override.payload as Record<string, unknown>,
			};
		},
	};
}

beforeEach(() => {
	resetPluginRegistry();
});

afterEach(() => {
	resetPluginRegistry();
});

describe('plugin registry', () => {
	it('registers and looks up by kind', () => {
		const plugin = makeStub(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN);
		registerPlugin(plugin);
		expect(getPlugin(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN)).toBe(plugin);
	});

	it('throws PluginAlreadyRegisteredError on duplicate kind', () => {
		registerPlugin(makeStub(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN));
		expect(() => registerPlugin(makeStub(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN))).toThrow(
			PluginAlreadyRegisteredError,
		);
	});

	it('throws UnknownPluginKindError on missing kind', () => {
		expect(() => getPlugin('missing.kind')).toThrow(UnknownPluginKindError);
	});

	it('listPluginKinds preserves registration order', () => {
		registerPlugin(makeStub(INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN));
		registerPlugin(makeStub(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN));
		expect(listPluginKinds()).toEqual([
			INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN,
			INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN,
		]);
	});

	it('listPlugins returns the same plugin instances', () => {
		const a = makeStub(INGEST_REVIEW.KINDS.HANDBOOK_CAPTION_ORPHAN);
		const b = makeStub(INGEST_REVIEW.KINDS.HANDBOOK_IMAGE_ORPHAN);
		registerPlugin(a);
		registerPlugin(b);
		expect(listPlugins()).toEqual([a, b]);
	});
});
