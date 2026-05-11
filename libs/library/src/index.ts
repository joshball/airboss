/**
 * `@ab/library` -- rendering primitives for FAA reference content.
 *
 * Source of truth: `docs/platform/REFERENCES.md` ("Routing layer -- where URL
 * strings live"). This lib owns the *rendering* knowledge; URL templates live
 * in `@ab/constants`, the `airboss-ref:` URI scheme + URI-to-URL bridge live
 * in `@ab/sources`. Surfaces compose these three packages:
 *
 * - `apps/flightbag/` consumes `<RenderedSection>` to display a section body.
 * - Other surfaces (study, sim, hangar, avionics) consume `<CitationChip>` to
 *   link to flightbag via `urlForReference` from `@ab/sources`.
 *
 * This lib's barrel is the **pure-TS entry** -- types and utilities only.
 * Svelte components are loaded by subpath so non-svelte consumers (e.g.
 * scripts) can import the types without pulling in the svelte runtime:
 *
 *   import RenderedSection from '@ab/library/RenderedSection.svelte';
 *   import CitationChip from '@ab/library/CitationChip.svelte';
 *   import type { RenderedSectionProps } from '@ab/library';
 */

export type { AnnotationLayerProps, AnnotationLayerRecord } from './AnnotationLayer.svelte';
export type { BreadcrumbSegment, BreadcrumbsProps } from './Breadcrumbs.svelte';
export type { ChapterTileProps } from './ChapterTile.svelte';
export type { CitationChipProps } from './CitationChip.svelte';
export type {
	CardComposerPrefill,
	ComposerKind,
	ComposerState,
	NoteComposerPrefill,
} from './composer-state.svelte';
export {
	createComposerState,
	provideComposerState,
	useComposerState,
} from './composer-state.svelte';
export type { HeartbeatTickerProps } from './HeartbeatTicker.svelte';
export type { ReaderEmptyStateKind, ReaderEmptyStateProps } from './ReaderEmptyState.svelte';
export type { ReaderLayoutProps } from './ReaderLayout.svelte';
export type { ReaderNavData, ReaderNavLink, ReaderNavProps } from './ReaderNav.svelte';
export type { ReaderPrefsButtonProps, ReadingPrefKey, ReadingPrefValue } from './ReaderPrefsButton.svelte';
export type { ReadingTimeProps } from './ReadingTime.svelte';
export type { ReferenceCardProps } from './ReferenceCard.svelte';
export type { RenderedSectionFigure, RenderedSectionProps } from './RenderedSection.svelte';
export type { SelectionToolbarProps, SelectionToolbarSection } from './SelectionToolbar.svelte';
export type { SourceLinksProps } from './SourceLinks.svelte';
export type { SubjectChipProps } from './SubjectChip.svelte';
export {
	plainTextFromElement,
	plainTextFromMarkdown,
	rangeToOffsets,
} from './section-text';
export type { TOCDrawerEntry, TOCDrawerProps } from './TOCDrawer.svelte';
export type { TOCRenderEntry, TOCRenderMode, TOCRenderProps } from './TOCRender.svelte';
