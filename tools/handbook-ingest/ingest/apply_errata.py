"""Apply-errata orchestration.

The CLI entrypoints `--apply-errata <id>` and `--reapply-errata` flow
through this module. The orchestrator:

1. Resolves the erratum config from `<doc>.yaml -> errata[]`.
2. Downloads (cache-aware) the errata PDF into
   `<cache>/handbooks/<doc>/<edition>/_errata/<id>.pdf`.
3. Dispatches to the handbook plugin's `parse_errata`, which delegates
   to the layout-keyed parser registry by default.
4. For each :class:`ErrataPatch`, locates the affected section markdown
   under `handbooks/<doc>/<edition>/<chapter>/<section>.md` by chapter
   ordinal + section anchor (frontmatter `section_title`).
5. Edits the section markdown body per the patch kind, recomputes
   `content_hash`, and writes a sidecar `<section>.errata.md` note
   containing the patch metadata + source URL.
6. Updates `manifest.json -> errata[]` with `applied_at`,
   `sections_patched`, and the parser name.
7. Emits a JSON record to stdout listing the section ids + patch
   metadata so the seed step (or a future direct-DB inserter) can
   populate `study.handbook_section_errata`.

Idempotency: when the manifest already records `applied_at` for the
erratum, a second invocation without `--force` exits 0 with a clear
message and no DB-state change. `--force` deletes the existing manifest
record and the sidecar `.errata.md` files for the erratum, then
re-applies. The Python step does not write to Postgres; that's the
seed step's job.

Transactionality: the per-section markdown writes are not transactional
(filesystem). The orchestrator runs all writes for a single erratum in
sequence; on a write failure the partial state is discoverable via the
absence of a complete `manifest.json -> errata[].applied_at`. The
caller can rerun with `--force` to recover.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import click
import yaml

from .config_loader import HandbookConfig
from .handbooks import HandbookPlugin
from .handbooks.base import (
    PATCH_KIND_ADD_SUBSECTION,
    PATCH_KIND_APPEND_PARAGRAPH,
    PATCH_KIND_REPLACE_PARAGRAPH,
    ErrataConfig,
    ErrataPatch,
)
from .paths import cache_edition_root, edition_root, ensure_dir, relative_to_repo


@dataclass
class AppliedSection:
    """One section affected by an applied erratum."""

    section_code: str  # e.g. "2.1"
    section_path: str  # repo-relative path to the section markdown
    chapter: str
    target_page: str
    patch_kind: str
    section_anchor: str
    new_heading: str | None
    original_text: str | None
    replacement_text: str
    new_content_hash: str
    errata_note_path: str  # repo-relative path to the sidecar note


@dataclass
class ApplyResult:
    """Top-level result of one --apply-errata invocation."""

    errata_id: str
    source_url: str
    pdf_path: Path
    pdf_sha256: str
    applied_sections: list[AppliedSection]
    parser_name: str
    applied_at: str
    fetched_at: str
    skipped_already_applied: bool = False


class ErrataApplyError(Exception):
    """Raised for any user-actionable error during apply (unknown id, missing
    section anchor, write failure, etc.)."""


def apply_errata(
    *,
    config: HandbookConfig,
    plugin: HandbookPlugin,
    errata_id: str,
    force: bool = False,
) -> ApplyResult:
    """Apply one named erratum to the handbook on disk.

    See module docstring for the full pipeline. Raises
    :class:`ErrataApplyError` for any user-actionable failure; the caller
    (cli.py) catches and exits with a clear message.
    """
    errata = _resolve_errata(config, errata_id)
    pdf_path, pdf_sha, fetched_at = _download_errata_pdf(config, errata)

    manifest_path = edition_root(config.document_slug, config.edition) / 'manifest.json'
    manifest = _load_manifest(manifest_path)

    existing = _find_manifest_errata_entry(manifest, errata_id)
    if existing is not None and existing.get('applied_at') and not force:
        return ApplyResult(
            errata_id=errata_id,
            source_url=errata.source_url,
            pdf_path=pdf_path,
            pdf_sha256=pdf_sha,
            applied_sections=[],
            parser_name=errata.parser,
            applied_at=str(existing['applied_at']),
            fetched_at=fetched_at,
            skipped_already_applied=True,
        )

    if existing is not None and force:
        _cleanup_existing_errata_files(config, errata_id, manifest)

    patches = plugin.parse_errata(pdf_path, errata)
    if not patches:
        raise ErrataApplyError(
            f"Plugin {plugin.__class__.__name__}.parse_errata returned no patches for "
            f"errata id={errata_id!r}. Refusing to record an empty apply."
        )

    applied: list[AppliedSection] = []
    for patch in patches:
        applied.append(_apply_one_patch(config, errata, patch))

    applied_at = datetime.now(tz=UTC).isoformat()
    _update_manifest(
        manifest_path=manifest_path,
        manifest=manifest,
        errata=errata,
        pdf_sha=pdf_sha,
        fetched_at=fetched_at,
        applied_at=applied_at,
        applied_sections=applied,
    )

    return ApplyResult(
        errata_id=errata_id,
        source_url=errata.source_url,
        pdf_path=pdf_path,
        pdf_sha256=pdf_sha,
        applied_sections=applied,
        parser_name=errata.parser,
        applied_at=applied_at,
        fetched_at=fetched_at,
    )


def reapply_all_errata(
    *,
    config: HandbookConfig,
    plugin: HandbookPlugin,
    force: bool = False,
) -> list[ApplyResult]:
    """Iterate the YAML errata list in `published_at` order and apply each."""
    if not config.errata:
        click.echo(
            f"  no errata configured for {config.document_slug} -- nothing to apply.",
            err=True,
        )
        return []
    results: list[ApplyResult] = []
    for entry in config.errata:
        click.echo(f"  applying errata id={entry.id!r} (parser={entry.parser})...")
        result = apply_errata(
            config=config,
            plugin=plugin,
            errata_id=entry.id,
            force=force,
        )
        results.append(result)
    return results


def emit_apply_record_json(result: ApplyResult, *, doc_slug: str, edition: str) -> None:
    """Write a single-line JSON record describing the applied patches.

    Consumed by the seed step (or any future direct-DB writer) so the
    Python apply layer doesn't need a Postgres connection.
    """
    payload = {
        'document_slug': doc_slug,
        'edition': edition,
        'errata_id': result.errata_id,
        'source_url': result.source_url,
        'parser': result.parser_name,
        'pdf_sha256': result.pdf_sha256,
        'applied_at': result.applied_at,
        'fetched_at': result.fetched_at,
        'skipped_already_applied': result.skipped_already_applied,
        'sections': [
            {
                'section_code': s.section_code,
                'section_path': s.section_path,
                'chapter': s.chapter,
                'target_page': s.target_page,
                'patch_kind': s.patch_kind,
                'section_anchor': s.section_anchor,
                'new_heading': s.new_heading,
                'original_text': s.original_text,
                'replacement_text': s.replacement_text,
                'content_hash': s.new_content_hash,
                'errata_note_path': s.errata_note_path,
            }
            for s in result.applied_sections
        ],
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + '\n')


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_errata(config: HandbookConfig, errata_id: str) -> ErrataConfig:
    for entry in config.errata:
        if entry.id == errata_id:
            return entry
    available = [e.id for e in config.errata]
    raise ErrataApplyError(
        f"No errata with id {errata_id!r} configured for {config.document_slug} "
        f"in YAML. Available: {available}."
    )


def _download_errata_pdf(
    config: HandbookConfig, errata: ErrataConfig
) -> tuple[Path, str, str]:
    """Resolve / download the errata PDF into the cache; return (path, sha256, fetched_at)."""
    cache_dir = ensure_dir(
        cache_edition_root(config.document_slug, config.edition) / '_errata'
    )
    # Common cached filenames (the user often pre-downloads with FAA's
    # exact filename, e.g. "AFH_Addendum_MOSAIC.pdf"). We probe a few
    # conventions before falling back to URL fetch.
    target = cache_dir / f'{errata.id}.pdf'
    if target.is_file():
        sha = _sha256_of(target)
        return target, sha, datetime.now(tz=UTC).isoformat()

    # Attempt: filename matches FAA's `<TOKEN>_Addendum_(MOSAIC).pdf` form
    # already in the cache (manual download by the user).
    cache_root_dir = cache_edition_root(config.document_slug, config.edition)
    for candidate in cache_root_dir.glob(f'*{errata.id}*.pdf'):
        sha = _sha256_of(candidate)
        # Hard-link / copy to canonical name so subsequent runs find it
        # at the standard path.
        target.write_bytes(candidate.read_bytes())
        return target, sha, datetime.now(tz=UTC).isoformat()

    # Fall back to URL fetch.
    request = urllib.request.Request(
        errata.source_url, headers={'User-Agent': 'airboss-handbook-ingest/0.1'}
    )
    with urllib.request.urlopen(request) as response, target.open('wb') as fh:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            fh.write(chunk)
    sha = _sha256_of(target)
    return target, sha, datetime.now(tz=UTC).isoformat()


def _sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _load_manifest(manifest_path: Path) -> dict[str, object]:
    if not manifest_path.is_file():
        raise ErrataApplyError(
            f"Manifest not found at {manifest_path}. Run `bun run sources extract handbooks "
            f"<doc>` first; --apply-errata only works against an extracted edition."
        )
    return json.loads(manifest_path.read_text(encoding='utf-8'))


def _find_manifest_errata_entry(
    manifest: dict[str, object], errata_id: str
) -> dict[str, object] | None:
    raw = manifest.get('errata')
    if not isinstance(raw, list):
        return None
    for entry in raw:
        if isinstance(entry, dict) and entry.get('id') == errata_id:
            return entry
    return None


def _cleanup_existing_errata_files(
    config: HandbookConfig,
    errata_id: str,
    manifest: dict[str, object],
) -> None:
    """Delete sidecar `.errata.md` notes for the erratum being --force re-applied."""
    raw = manifest.get('errata')
    if not isinstance(raw, list):
        return
    for entry in raw:
        if not isinstance(entry, dict) or entry.get('id') != errata_id:
            continue
        sections_patched = entry.get('sections_patched')
        if not isinstance(sections_patched, list):
            continue
        for sec in sections_patched:
            if not isinstance(sec, dict):
                continue
            note_rel = sec.get('errata_note_path')
            if isinstance(note_rel, str):
                # Defensive: the path is repo-relative; resolve against cwd.
                from .paths import repo_root

                note = repo_root() / note_rel
                if note.is_file():
                    note.unlink()


def _apply_one_patch(
    config: HandbookConfig,
    errata: ErrataConfig,
    patch: ErrataPatch,
) -> AppliedSection:
    """Locate the section, edit its markdown, write the sidecar note."""
    section_path = _locate_section_markdown(config, patch)
    raw = section_path.read_text(encoding='utf-8')
    frontmatter, body = _split_frontmatter(raw)
    section_code = _section_code_from_frontmatter(frontmatter, patch)

    new_body, original_text = _apply_patch_to_body(body, patch)
    new_raw = _join_frontmatter(frontmatter) + new_body
    section_path.write_text(new_raw, encoding='utf-8')

    new_hash = hashlib.sha256(new_raw.encode('utf-8')).hexdigest()

    # Sidecar errata note: `<section>.errata.md` next to the section file.
    note_path = section_path.with_name(section_path.stem + '.errata.md')
    note_text = _compose_errata_note(errata, patch, original_text)
    note_path.write_text(note_text, encoding='utf-8')

    return AppliedSection(
        section_code=section_code,
        section_path=relative_to_repo(section_path),
        chapter=patch.chapter,
        target_page=patch.target_page,
        patch_kind=patch.kind,
        section_anchor=patch.section_anchor,
        new_heading=patch.new_heading,
        original_text=original_text,
        replacement_text=patch.replacement_text,
        new_content_hash=new_hash,
        errata_note_path=relative_to_repo(note_path),
    )


def _locate_section_markdown(config: HandbookConfig, patch: ErrataPatch) -> Path:
    """Find the section .md file matching the patch's chapter + section anchor.

    Two-pass: first score every candidate by anchor similarity; then if
    multiple files share the top score, break the tie by checking
    whether the patch's `target_page` is contained in the file's
    frontmatter `faa_pages` range.
    """
    chapter_dir = edition_root(config.document_slug, config.edition) / patch.chapter
    if not chapter_dir.is_dir():
        raise ErrataApplyError(
            f"Chapter directory not found: {chapter_dir}. Cannot apply patch for "
            f"chapter={patch.chapter} section={patch.section_anchor!r}."
        )
    target_norm = _normalize_anchor(patch.section_anchor)
    # Colon-delimited anchors ("Section: Subsection") are a FAA
    # convention. Score the most specific part (after the last colon)
    # so subsection files outscore parent-section files when both
    # contain the parent words.
    target_specific = _normalize_anchor(patch.section_anchor.rsplit(':', 1)[-1])
    target_parent_norm = (
        _normalize_anchor(patch.section_anchor.rsplit(':', 1)[0])
        if ':' in patch.section_anchor
        else None
    )

    # Build a section_number -> file map by reading each candidate's
    # frontmatter once. Used to resolve the parent of colon-delimited
    # anchors so subsection candidates inherit a parent-match bonus.
    md_files: list[tuple[Path, dict[str, object]]] = []
    for md_path in sorted(chapter_dir.glob('*.md')):
        if md_path.name == 'index.md':
            continue
        if md_path.suffix == '.md' and md_path.stem.endswith('.errata'):
            continue
        try:
            text = md_path.read_text(encoding='utf-8')
        except OSError:
            continue
        fm, _ = _split_frontmatter(text)
        md_files.append((md_path, fm))

    parent_section_number: int | None = None
    if target_parent_norm:
        for _path, fm in md_files:
            title = fm.get('section_title')
            if not isinstance(title, str):
                continue
            if _normalize_anchor(title) == target_parent_norm:
                sn = fm.get('section_number')
                if isinstance(sn, int):
                    parent_section_number = sn
                    break

    candidates: list[tuple[int, Path, dict[str, object]]] = []  # (score, path, fm)
    for md_path, fm in md_files:
        title = fm.get('section_title')
        if not isinstance(title, str):
            continue
        title_norm = _normalize_anchor(title)
        full_score = _anchor_score(title_norm, target_norm)
        specific_score = _anchor_score(title_norm, target_specific)
        score = max(full_score, specific_score)
        if parent_section_number is not None:
            sn = fm.get('section_number')
            ssn = fm.get('subsection_number')
            if isinstance(sn, int) and sn == parent_section_number and isinstance(ssn, int):
                # Subsection under the named parent: strong tie-break bonus.
                score += 50
        if score > 0:
            candidates.append((score, md_path, fm))
    if not candidates:
        raise ErrataApplyError(
            f"No section markdown matched anchor {patch.section_anchor!r} in {chapter_dir}. "
            f"Tried frontmatter section_title across {len(list(chapter_dir.glob('*.md')))} files."
        )
    candidates.sort(key=lambda x: -x[0])
    best_score = candidates[0][0]
    top = [c for c in candidates if c[0] == best_score]
    if len(top) == 1:
        return top[0][1]

    # Tie-break: prefer the file whose frontmatter `faa_pages` includes
    # the patch's target_page. The frontmatter typically contains a
    # comma-separated list or the chapter-section starting page only.
    page_matches = [c for c in top if _page_in_frontmatter(c[2], patch.target_page)]
    if len(page_matches) == 1:
        return page_matches[0][1]
    if len(page_matches) > 1:
        # Still ambiguous: give up.
        names = [str(p) for _s, p, _f in page_matches]
        raise ErrataApplyError(
            f"Ambiguous section anchor {patch.section_anchor!r} (page {patch.target_page}) matched "
            f"{len(names)} files with equal score: {names}. Tighten the anchor or add a "
            f"frontmatter override."
        )
    # No file has the target page in frontmatter; fall through to the
    # ambiguity error below.
    names = [str(p) for _s, p, _f in top]
    raise ErrataApplyError(
        f"Ambiguous section anchor {patch.section_anchor!r} matched {len(names)} files "
        f"with equal score and no faa_pages match for target page {patch.target_page!r}: "
        f"{names}. Tighten the anchor or add a frontmatter override."
    )


def _page_in_frontmatter(fm: dict[str, object], target_page: str) -> bool:
    """Return True when the section's frontmatter `faa_pages` contains target_page."""
    raw = fm.get('faa_pages')
    if raw is None:
        return False
    text = str(raw)
    # The frontmatter form is one of:
    #   - a single anchor: "2-4"
    #   - a comma list: "2-4, 2-5"
    #   - a range: "2-4..2-7"
    if target_page in text:
        return True
    # Range form: <start>..<end>; same-chapter only.
    range_match = re.match(r'(\d+-\d+)\.\.(\d+-\d+)', text.strip())
    if range_match:
        start, end = range_match.groups()
        try:
            tc, tp = (int(x) for x in target_page.split('-'))
            sc, sp = (int(x) for x in start.split('-'))
            ec, ep = (int(x) for x in end.split('-'))
        except ValueError:
            return False
        if tc == sc == ec and sp <= tp <= ep:
            return True
    return False


def _normalize_anchor(text: str) -> str:
    """Lowercase + collapse whitespace + strip common chrome."""
    return re.sub(r'\s+', ' ', text).strip().lower()


_STOPWORDS = frozenset({'the', 'of', 'and', 'a', 'an', 'to', 'for', 'in', 'on'})


def _anchor_score(haystack: str, needle: str) -> int:
    """Score the section file's title against the patch's anchor.

    Order of preference:

    1. Exact match (haystack == needle).
    2. One is a strict substring of the other.
    3. Word-overlap (Jaccard-style) over content words (stopwords stripped).

    The MOSAIC anchors include long phrases like "Preflight Assessment of
    the Aircraft, Engine, and Propeller" that would naively prefix-match
    the shorter "Preflight Assessment of the Aircraft" file, even though
    the trailing "Engine and Propeller" tokens point at a separate
    section. Word overlap catches this case correctly.
    """
    if haystack == needle:
        return 1000
    h_words = {w for w in re.findall(r'[a-z0-9]+', haystack) if w not in _STOPWORDS}
    n_words = {w for w in re.findall(r'[a-z0-9]+', needle) if w not in _STOPWORDS}
    if not h_words or not n_words:
        return 0
    overlap = len(h_words & n_words)
    if overlap == 0:
        return 0
    union = len(h_words | n_words)
    # Jaccard percent in 0..100 range.
    base = int((overlap / union) * 100)
    # Distinctive-word bonus: the percentage of needle's content words
    # that appear in the haystack. Boosts long anchors that fully cover
    # the file title.
    needle_coverage = int((overlap / len(n_words)) * 50)
    return base + needle_coverage


def _split_frontmatter(raw: str) -> tuple[dict[str, object], str]:
    """Split YAML frontmatter from the body markdown.

    Returns (frontmatter_dict, body_string). Body retains its leading
    blank line so re-joining round-trips byte-stable.
    """
    if not raw.startswith('---\n'):
        return {}, raw
    end_marker = raw.find('\n---\n', 4)
    if end_marker == -1:
        return {}, raw
    fm_text = raw[4:end_marker]
    body = raw[end_marker + 5:]  # past \n---\n
    fm = yaml.safe_load(fm_text) or {}
    if not isinstance(fm, dict):
        fm = {}
    return fm, body


def _join_frontmatter(fm: dict[str, object]) -> str:
    if not fm:
        return ''
    return (
        '---\n'
        + yaml.safe_dump(fm, sort_keys=False, allow_unicode=True, default_flow_style=False)
        + '---\n'
    )


def _section_code_from_frontmatter(
    fm: dict[str, object], patch: ErrataPatch
) -> str:
    """Compose `<chapter>.<section>` code from frontmatter when possible."""
    chapter_num = fm.get('chapter_number')
    section_num = fm.get('section_number')
    if isinstance(chapter_num, int) and isinstance(section_num, int):
        return f'{chapter_num}.{section_num}'
    if isinstance(chapter_num, int):
        return str(chapter_num)
    return patch.chapter


def _apply_patch_to_body(body: str, patch: ErrataPatch) -> tuple[str, str | None]:
    """Edit `body` per the patch kind; return (new_body, original_text_replaced).

    `original_text` is None for `add_subsection` (nothing was replaced).
    """
    if patch.kind == PATCH_KIND_ADD_SUBSECTION:
        # Append a new H2 subsection at the end of the section body.
        new = body.rstrip('\n')
        new += (
            f'\n\n## {patch.new_heading}\n\n'
            f'> Added by FAA erratum (target page {patch.target_page}). '
            f'See sidecar `.errata.md` for citation.\n\n'
            f'{patch.replacement_text}\n'
        )
        return new, None

    if patch.kind == PATCH_KIND_APPEND_PARAGRAPH:
        new = body.rstrip('\n')
        new += (
            f'\n\n> Paragraph added by FAA erratum (target page {patch.target_page}).\n\n'
            f'{patch.replacement_text}\n'
        )
        return new, None

    if patch.kind == PATCH_KIND_REPLACE_PARAGRAPH:
        # The Python parser does not pre-resolve original_text. The apply
        # pipeline records the *trailing* paragraph that the patch is
        # nominally replacing only when patch.original_text is non-null;
        # otherwise we annotate the change in-place at the bottom of the
        # body with a clear marker. (A future enhancement: the parser
        # learns to extract the original paragraph by anchor matching;
        # that lands when the anchor-matching test bed exists.)
        if patch.original_text:
            new = body.replace(patch.original_text, patch.replacement_text, 1)
            if new == body:
                # Replace failed; fall through to annotation form.
                pass
            else:
                return new, patch.original_text
        new = body.rstrip('\n')
        new += (
            f'\n\n> Paragraph revised by FAA erratum (target page {patch.target_page}). '
            f'The replacement text below supersedes the matching paragraph; the '
            f'sidecar `.errata.md` records the FAA-published wording verbatim.\n\n'
            f'{patch.replacement_text}\n'
        )
        return new, None

    raise ErrataApplyError(f"Unknown patch_kind: {patch.kind!r}")


def _compose_errata_note(
    errata: ErrataConfig, patch: ErrataPatch, original_text: str | None
) -> str:
    """Sidecar `<section>.errata.md` with full audit metadata."""
    lines = [
        '---',
        f'errata_id: {errata.id}',
        f'source_url: {errata.source_url}',
        f'published_at: {errata.published_at}',
        f'parser: {errata.parser}',
        f'patch_kind: {patch.kind}',
        f'target_anchor: {patch.section_anchor!r}',
        f'target_page: {patch.target_page}',
    ]
    if patch.new_heading:
        lines.append(f'new_heading: {patch.new_heading!r}')
    lines.append('---')
    lines.append('')
    lines.append('## Replacement text')
    lines.append('')
    lines.append(patch.replacement_text)
    if original_text:
        lines.append('')
        lines.append('## Original text')
        lines.append('')
        lines.append(original_text)
    lines.append('')
    return '\n'.join(lines)


def _update_manifest(
    *,
    manifest_path: Path,
    manifest: dict[str, object],
    errata: ErrataConfig,
    pdf_sha: str,
    fetched_at: str,
    applied_at: str,
    applied_sections: list[AppliedSection],
) -> None:
    """Insert / update the manifest's `errata[]` entry for this erratum."""
    raw_list = manifest.get('errata')
    errata_list: list[dict[str, object]] = (
        list(raw_list) if isinstance(raw_list, list) else []
    )
    # Filter out any prior entry for this id (force re-apply path).
    errata_list = [
        e for e in errata_list if not (isinstance(e, dict) and e.get('id') == errata.id)
    ]
    sections_patched = [
        {
            'section_code': s.section_code,
            'section_path': s.section_path,
            'chapter': s.chapter,
            'target_page': s.target_page,
            'patch_kind': s.patch_kind,
            'section_anchor': s.section_anchor,
            'new_heading': s.new_heading,
            'content_hash': s.new_content_hash,
            'errata_note_path': s.errata_note_path,
        }
        for s in applied_sections
    ]
    errata_list.append(
        {
            'id': errata.id,
            'source_url': errata.source_url,
            'published_at': errata.published_at,
            'sha256': pdf_sha,
            'fetched_at': fetched_at,
            'applied_at': applied_at,
            'parser': errata.parser,
            'sections_patched': sections_patched,
        }
    )
    # Sort by published_at so the manifest is stable across re-applies.
    errata_list.sort(key=lambda e: str(e.get('published_at', '')))
    manifest['errata'] = errata_list
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8'
    )
