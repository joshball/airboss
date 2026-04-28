"""airboss handbook ingestion CLI.

Usage:

    bun run sources extract handbooks <doc> [options]
    python -m ingest <doc> [options]

`<doc>` is the document slug (matches `ingest/config/<doc>.yaml`). Options:

    --edition <e>             Override edition tag (defaults to config edition)
    --chapter <code>          Restrict to a single chapter (e.g. `12`)
    --dry-run                 Validate without writing files
    --force                   Re-extract even if hashes match
    --strategy {toc,prompt,compare}
                              Override section-tree strategy. Default = read
                              from `<doc>.yaml -> section_strategy`.
                                * toc     -- deterministic Python parser of
                                             the printed Table of Contents.
                                * prompt  -- emit a prompt set under
                                             tools/handbook-ingest/prompts-out/
                                             that the user pastes into a
                                             fresh Claude Code session
                                             (no API key). Stops after
                                             writing prompts.
                                * compare -- read the prompt-flow JSONs +
                                             model-self-reports and diff
                                             against the TOC strategy.
    --no-archive              Skip writing archive/<run-id>/ for prompt runs.

Verbose narration: every phase prints WHAT it does, WHY, and HOW. The user
should never be confused about which phase is running or what file it
produced.

See docs/agents/section-extraction-prompt-strategy.md for the full
prompt-flow walkthrough.
"""

from __future__ import annotations

from pathlib import Path

import click

from .chapter_plaintext import write_chapter_sidecars
from .config_loader import (
    SECTION_STRATEGY_COMPARE,
    SECTION_STRATEGY_PROMPT,
    SECTION_STRATEGY_TOC,
    VALID_STRATEGIES,
    ConfigError,
    HandbookConfig,
    load_config,
)
from .fetch import fetch_pdf
from .figures import extract_figures
from .figures_dedup import deduplicate_figures
from .normalize import write_outputs
from .outline import OutlineError, OutlineNode, detect_outline_from_text, filter_to_chapter, parse_outline
from .paths import relative_to_repo
from .prompt_emit import emit_prompts, out_dir_for, read_meta
from .section_tree import SectionTreeNode, derive_codes
from .sections import extract_sections
from .sections_compare import compare_strategies
from .sections_via_sidecar import (
    SidecarMalformedError,
    SidecarMissingError,
    load_chapter_sidecars,
)
from .sections_via_toc import extract_via_toc
from .tables import extract_tables

_STRATEGY_CHOICES = tuple(sorted(VALID_STRATEGIES))


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("document_slug")
@click.option("--edition", default=None, help="Edition tag override (defaults to YAML config).")
@click.option("--chapter", default=None, help="Chapter code to restrict to (e.g. `12`).")
@click.option("--dry-run", is_flag=True, default=False, help="Validate only; no writes.")
@click.option("--force", is_flag=True, default=False, help="Re-extract even when hashes match.")
@click.option(
    "--strategy",
    default=None,
    type=click.Choice(_STRATEGY_CHOICES, case_sensitive=False),
    help="Section-tree strategy. Defaults to YAML config.",
)
@click.option(
    "--no-archive",
    is_flag=True,
    default=False,
    help="Skip writing archive/<run-id>/ for --strategy prompt (default is to archive).",
)
def main(
    document_slug: str,
    edition: str | None,
    chapter: str | None,
    dry_run: bool,
    force: bool,
    strategy: str | None,
    no_archive: bool,
) -> None:
    """Ingest the handbook identified by `<doc>`."""
    try:
        config = load_config(document_slug)
    except ConfigError as exc:
        click.echo(f"error: {exc}", err=True)
        raise SystemExit(2) from exc
    if edition is not None:
        config = _override_edition(config, edition)

    effective_strategy = (strategy or config.section_strategy).lower()

    if effective_strategy == SECTION_STRATEGY_PROMPT and dry_run:
        click.echo(
            "error: --dry-run is not supported with --strategy prompt; "
            "use --strategy toc --dry-run for outline validation.",
            err=True,
        )
        raise SystemExit(2)

    _print_run_banner(config, effective_strategy)

    fetch_result = _phase_fetch(config, force=force)

    flat_outline = _phase_outline(config, fetch_result.path)

    if config.title_overrides:
        for node in flat_outline:
            override = config.title_overrides.get(node.code)
            if override:
                node.title = override

    if chapter is not None:
        flat_outline = filter_to_chapter(flat_outline, chapter)
        click.echo(f"  outline filtered to chapter `{chapter}`: {len(flat_outline)} nodes")

    section_result = extract_sections(
        fetch_result.path,
        flat_outline,
        page_offset=config.page_offset,
        chapter_overrides=config.chapter_overrides,
        walk_back=config.page_label_walk_back,
    )
    bodies = section_result.bodies
    section_label_warnings = section_result.warnings
    empty_bodies = [b for b in bodies if b.char_count == 0]
    if empty_bodies:
        click.echo(
            f"error: {len(empty_bodies)} section(s) extracted to empty text: "
            f"{[b.node.code for b in empty_bodies][:10]}",
            err=True,
        )
        if not dry_run:
            raise SystemExit(2)

    chapter_nodes = [n for n in flat_outline if n.level == "chapter"]
    chapter_bodies_only = [b for b in bodies if b.node.level == "chapter"]

    if effective_strategy == SECTION_STRATEGY_PROMPT:
        _run_prompt_strategy(
            config,
            chapter_nodes,
            chapter_bodies_only,
            source_pdf_sha256=fetch_result.sha256,
            archive=not no_archive,
        )
        return

    if effective_strategy == SECTION_STRATEGY_COMPARE:
        _run_compare_strategy(
            config,
            fetch_result_sha256=fetch_result.sha256,
            pdf_path=fetch_result.path,
            chapter_nodes=chapter_nodes,
        )
        return

    # Default: TOC strategy. Continue into the legacy seed/manifest path.
    _run_toc_strategy(
        config,
        fetch_result=fetch_result,
        flat_outline=flat_outline,
        bodies=bodies,
        section_label_warnings=section_label_warnings,
        chapter_nodes=chapter_nodes,
        dry_run=dry_run,
    )


def _print_run_banner(config: HandbookConfig, effective_strategy: str) -> None:
    """One-line run banner + strategy reason, before any phase output."""
    reasons = {
        SECTION_STRATEGY_TOC: "deterministic Python parser of the printed TOC; no API calls",
        SECTION_STRATEGY_PROMPT: "no API calls; emits prompt set for paste-into-Claude flow",
        SECTION_STRATEGY_COMPARE: "reads prompt-flow JSON + runs TOC strategy; renders diff report",
    }
    click.echo(f"handbook-ingest: {config.document_slug} edition {config.edition}")
    click.echo(
        f"  strategy: {effective_strategy} ({reasons.get(effective_strategy, 'unknown')})"
    )


def _phase_fetch(config: HandbookConfig, *, force: bool):
    click.echo("")
    click.echo("PHASE -- fetch source PDF")
    click.echo(f"  WHAT: download / read-from-cache the source PDF for "
               f"{config.document_slug} {config.edition}.")
    click.echo("  WHY:  every downstream step (plaintext, prompts, JSON) is "
               "anchored to the bytes of this specific PDF. Cache + checksum")
    click.echo("        guarantees re-runs use the same source.")
    click.echo("  HOW:  read $AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/source.pdf;")
    click.echo("        download from source_url if missing or sha256 mismatch.")
    click.echo(f"  source URL: {config.source_url}")
    fetch_result = fetch_pdf(config, force=force)
    click.echo(
        f"  -> {relative_to_repo_or_path(fetch_result.path)} "
        f"({fetch_result.size_bytes} bytes, sha256 {fetch_result.sha256[:12]}...)"
    )
    return fetch_result


def _phase_outline(config: HandbookConfig, pdf_path: Path) -> list[OutlineNode]:
    click.echo("")
    click.echo("PHASE -- parse outline")
    click.echo("  WHAT: derive the chapter / section tree from the PDF.")
    click.echo("  WHY:  every other phase iterates chapter-by-chapter; the outline")
    click.echo("        is the source of truth for chapter ordinals + page ranges.")
    click.echo(f"  HOW:  {config.outline_strategy} strategy "
               f"(`bookmark` reads PyMuPDF get_toc(); `content` scans page text).")
    try:
        if config.outline_strategy == "content":
            flat_outline = detect_outline_from_text(
                pdf_path, skip_pages=_toc_page_set(config)
            )
        else:
            flat_outline = parse_outline(pdf_path)
    except OutlineError as exc:
        click.echo(f"error: {exc}", err=True)
        raise SystemExit(2) from exc
    click.echo(f"  -> {len(flat_outline)} outline nodes")
    return flat_outline


def _run_prompt_strategy(
    config: HandbookConfig,
    chapter_nodes: list[OutlineNode],
    chapter_bodies_only,
    *,
    source_pdf_sha256: str,
    archive: bool,
) -> None:
    """Emit the per-run prompt set + chapter sidecars; stop short of seeding."""
    click.echo("")
    click.echo("PHASE -- write chapter plaintext sidecars")
    click.echo("  WHAT: produce _chapter_plaintext.txt for each chapter directory.")
    click.echo("  WHY:  the agent that runs the section-extraction prompt reads")
    click.echo("        the sidecar verbatim. Same bytes for every re-run regardless")
    click.echo("        of which agent / model is processing the prompt.")
    click.echo("  HOW:  PyMuPDF page-by-page output (extract_sections); truncated to")
    click.echo(f"        {config.chapter_text_max_chars} chars from the END so the head")
    click.echo("        of the chapter is always intact.")
    sidecars = write_chapter_sidecars(config, chapter_bodies_only)
    for sc in sidecars:
        click.echo(f"  -> {relative_to_repo(sc.path)} ({sc.char_count} chars)")
    click.echo(f"  {len(sidecars)} sidecars written.")

    click.echo("")
    click.echo("PHASE -- emit prompt set")
    click.echo("  WHAT: render the orchestrator + per-chapter prompts + parameters /")
    click.echo("        contract / config snapshots into the run directory.")
    click.echo("  WHY:  every input that shapes the agent's output is committed alongside")
    click.echo("        the output. A reviewer can read the exact bytes that produced")
    click.echo("        any committed _llm_section_tree.json.")
    click.echo("  HOW:  substitute placeholders in tools/.../section-extraction/{chapter,")
    click.echo("        orchestrator}.md; copy parameters.md + section_tree.md verbatim.")
    result = emit_prompts(
        config,
        chapter_nodes=chapter_nodes,
        chapter_bodies=chapter_bodies_only,
        sidecars=sidecars,
        source_pdf_sha256=source_pdf_sha256,
        archive=archive,
    )
    for path in sorted(result.out_dir.iterdir()):
        click.echo(f"  -> {relative_to_repo(path)}")
    if result.archive_dir is not None:
        click.echo(f"  -> archived to {relative_to_repo(result.archive_dir)}/")
    click.echo(f"  {result.files_written} files written"
               f"{' + archived' if result.archive_dir else ' (no archive)'}.")

    click.echo("")
    click.echo("PHASE -- handoff")
    click.echo("  This run does NOT seed manifest rows; the prompt strategy is two-step.")
    click.echo("  Section JSON files do not yet exist. Render the compare report only")
    click.echo("  after the agent has populated them.")
    click.echo("")
    click.echo("  NEXT STEP (manual):")
    click.echo("    1. Open a FRESH Claude Code session in this repo (NOT this session;")
    click.echo("       the orchestrator is meant for a separate paste-driven session so")
    click.echo("       the no-key story holds and parent context isn't burned).")
    click.echo("    2. Paste the contents of:")
    click.echo(f"         {relative_to_repo(result.out_dir / '_run.md')}")
    click.echo("    3. Wait for the sub-agents to finish writing")
    click.echo(f"         handbooks/{config.document_slug}/{config.edition}/<NN>/_llm_section_tree.json")
    click.echo("       and")
    click.echo(f"         handbooks/{config.document_slug}/{config.edition}/<NN>/_model_self_report.txt")
    click.echo("    4. Then run:")
    click.echo(
        f"         bun run sources extract handbooks {config.document_slug} "
        f"--edition {config.edition} --strategy compare"
    )
    click.echo("")
    archive_note = "; archived" if result.archive_dir else "; not archived (--no-archive)"
    click.echo(f"done. (run-id: {result.run_id}{archive_note})")


def _run_compare_strategy(
    config: HandbookConfig,
    *,
    fetch_result_sha256: str,
    pdf_path: Path,
    chapter_nodes: list[OutlineNode],
) -> None:
    """Read prompt-flow sidecars, run TOC strategy, render comparison report."""
    click.echo("")
    click.echo("PHASE -- verify source PDF SHA-256 against the prompt-run record")
    click.echo("  WHAT: compare the cached PDF's SHA-256 with meta.json.source_pdf_sha256.")
    click.echo("  WHY:  if the PDF bytes changed since the prompt run, the JSONs were")
    click.echo("        produced against stale text and the comparison would be wrong.")
    click.echo(f"  HOW:  read {relative_to_repo(out_dir_for(config))}/meta.json; require match.")
    try:
        meta = read_meta(config)
    except FileNotFoundError as exc:
        click.echo(f"error: {exc}", err=True)
        click.echo(
            f"  hint: run `bun run sources extract handbooks {config.document_slug} "
            f"--edition {config.edition} --strategy prompt` first.",
            err=True,
        )
        raise SystemExit(2) from exc
    expected_sha = meta.get("source_pdf_sha256")
    if not isinstance(expected_sha, str):
        click.echo("error: meta.json missing `source_pdf_sha256`; rerun --strategy prompt.", err=True)
        raise SystemExit(2)
    if expected_sha != fetch_result_sha256:
        click.echo(
            f"error: source PDF SHA-256 mismatch. meta.json records "
            f"{expected_sha[:12]}..., but the cached PDF is {fetch_result_sha256[:12]}.... "
            f"The JSONs were produced against stale bytes; re-run --strategy prompt.",
            err=True,
        )
        raise SystemExit(2)
    click.echo(f"  -> match ({fetch_result_sha256[:12]}...)")

    click.echo("")
    click.echo("PHASE -- read per-chapter prompt outputs")
    click.echo("  WHAT: load _llm_section_tree.json + _model_self_report.txt for each chapter.")
    click.echo("  WHY:  the prompt flow's outputs are the LLM-side of the comparison.")
    click.echo("        Hard-fail on missing or malformed files (no skip-with-warning).")
    click.echo("  HOW:  walk chapters in ordinal order; raise SidecarMissingError /")
    click.echo("        SidecarMalformedError on any anomaly.")
    try:
        sidecar_load = load_chapter_sidecars(config, chapter_nodes)
    except (SidecarMissingError, SidecarMalformedError) as exc:
        click.echo(f"error: {exc}", err=True)
        click.echo(
            f"  hint: re-paste {relative_to_repo(out_dir_for(config) / '_run.md')} "
            f"into a fresh Claude Code session.",
            err=True,
        )
        raise SystemExit(2) from exc
    click.echo(
        f"  -> {len(sidecar_load.chapters)} chapter sidecars read; "
        f"{sum(len(c.nodes) for c in sidecar_load.chapters)} total entries."
    )
    if sidecar_load.model_self_reports:
        unique_models = sorted({m for m in sidecar_load.model_self_reports.values()})
        click.echo(f"  models self-reported: {', '.join(unique_models)}")

    click.echo("")
    click.echo("PHASE -- run TOC strategy")
    click.echo("  WHAT: extract the section tree from the printed Table of Contents.")
    click.echo("  WHY:  the deterministic Python parse is the comparison baseline.")
    click.echo("  HOW:  sections_via_toc.py against the chapter list from the outline.")
    toc_result = extract_via_toc(pdf_path, config, chapter_nodes, raw_yaml=config.raw_yaml)
    click.echo(f"  -> {len(toc_result.nodes)} TOC nodes; {len(toc_result.warnings)} warnings.")

    click.echo("")
    click.echo("PHASE -- render comparison report")
    click.echo("  WHAT: diff the two trees per chapter and write a markdown report.")
    click.echo("  WHY:  the user reads the report and decides which strategy to trust.")
    click.echo("  HOW:  greedy title-match within (chapter, level); markdown table + diff.")
    chapter_titles = {n.ordinal: n.title for n in chapter_nodes}
    compare_result = compare_strategies(toc_result.nodes, sidecar_load.all_nodes, chapter_titles)
    report_path = _write_compare_report(config, compare_result)
    click.echo(f"  -> {relative_to_repo(report_path)}")
    click.echo("done.")


def _run_toc_strategy(
    config: HandbookConfig,
    *,
    fetch_result,
    flat_outline: list[OutlineNode],
    bodies,
    section_label_warnings: list[str],
    chapter_nodes: list[OutlineNode],
    dry_run: bool,
) -> None:
    """Legacy seed/manifest path: TOC strategy emits + write_outputs."""
    click.echo("")
    click.echo("PHASE -- extract figures + tables")
    click.echo("  WHAT: pull figure images + table HTML from the PDF.")
    click.echo("  WHY:  the seed needs them inline; the reader surfaces them later.")
    click.echo("  HOW:  PyMuPDF page-by-page; figures dedup; tables HTML serialize.")
    figures, figure_warnings = extract_figures(
        fetch_result.path,
        flat_outline,
        config.document_slug,
        config.edition,
        figure_pattern=config.figure_prefix_pattern,
    )
    click.echo(f"  -> figures: {len(figures)} extracted, {len(figure_warnings)} warnings")
    figures, dedup_meta = deduplicate_figures(figures)
    if dedup_meta["canonicalized"] > 0:
        click.echo(
            f"  figure dedup: {dedup_meta['canonicalized']} redundant files removed, "
            f"{dedup_meta['freed_bytes']} bytes freed"
        )
    tables, table_warnings = extract_tables(
        fetch_result.path,
        flat_outline,
        config.document_slug,
        config.edition,
        table_pattern=config.table_prefix_pattern,
    )
    click.echo(f"  -> tables: {len(tables)} extracted, {len(table_warnings)} warnings")

    click.echo("")
    click.echo("PHASE -- run TOC strategy")
    click.echo("  WHAT: extract the section tree from the printed Table of Contents.")
    click.echo("  WHY:  the deterministic parse seeds chapter / section / subsection rows.")
    click.echo("  HOW:  sections_via_toc.py reads the YAML toc: block + heading_style.")
    section_extra_warnings: list[str] = []
    extraction_metadata: dict[str, object] = {
        "section_strategy": {"kind": SECTION_STRATEGY_TOC},
        "figure_dedup": dedup_meta,
    }
    toc_result = extract_via_toc(fetch_result.path, config, chapter_nodes, raw_yaml=config.raw_yaml)
    section_nodes: list[SectionTreeNode] = toc_result.nodes
    section_extra_warnings.extend(toc_result.warnings)
    extraction_metadata["section_strategy"] = {
        "kind": SECTION_STRATEGY_TOC,
        "config": _redact_toc_config(config.raw_yaml),
    }

    click.echo(
        f"  -> section-tree nodes: {len(section_nodes)} "
        f"({sum(1 for n in section_nodes if n.level == 1)} L1, "
        f"{sum(1 for n in section_nodes if n.level == 2)} L2, "
        f"{sum(1 for n in section_nodes if n.level == 3)} L3)"
    )
    if section_extra_warnings:
        click.echo(f"  section-tree warnings: {len(section_extra_warnings)} -- see manifest")
    if section_label_warnings:
        click.echo(f"  page-label warnings: {len(section_label_warnings)} -- see manifest")

    if section_nodes:
        flat_outline, bodies = _merge_section_nodes_into_outline(
            flat_outline, bodies, section_nodes, fetch_result.path, config
        )

    if dry_run:
        click.echo("")
        click.echo(
            f"dry-run summary: {len(bodies)} sections, {len(figures)} figures, {len(tables)} tables, "
            f"{len(figure_warnings) + len(table_warnings)} warnings"
        )
        return

    click.echo("")
    click.echo("PHASE -- write outputs (markdown + manifest)")
    click.echo("  WHAT: serialize the chapter / section markdown + figures/tables + manifest.json.")
    click.echo("  WHY:  the seed loads these files; the reader serves them.")
    click.echo("  HOW:  normalize.write_outputs writes the in-repo derivative tree.")
    summary = write_outputs(
        config=config,
        fetch_result=fetch_result,
        outline_nodes=flat_outline,
        bodies=bodies,
        figures=figures,
        figure_warnings=figure_warnings,
        tables=tables,
        table_warnings=table_warnings,
        extraction_metadata=extraction_metadata,
        extra_warnings=[*section_extra_warnings, *section_label_warnings],
    )
    click.echo(
        f"  -> wrote {summary.sections_written} sections, "
        f"{summary.figures_written} figures, {summary.tables_written} tables; "
        f"manifest -> {summary.manifest_path}"
    )
    click.echo(f"done: {config.document_slug} {config.edition}")


def relative_to_repo_or_path(path: Path) -> str:
    """Return repo-relative path when possible; absolute path otherwise.

    Used in narration so cached PDFs (which live OUTSIDE the repo per ADR
    018) print as their absolute path while in-repo derivatives print
    relative.
    """
    try:
        return relative_to_repo(path)
    except ValueError:
        return str(path)


def _override_edition(config: HandbookConfig, edition: str) -> HandbookConfig:
    """Build a new `HandbookConfig` with the edition overridden.

    The dataclass is frozen; we recreate it. Every field gets carried
    forward so adding a field above this function doesn't silently drop it.
    """
    return HandbookConfig(
        document_slug=config.document_slug,
        edition=edition,
        title=config.title,
        publisher=config.publisher,
        kind=config.kind,
        source_url=config.source_url,
        expected_pages=config.expected_pages,
        page_offset=config.page_offset,
        outline_overrides=config.outline_overrides,
        figure_prefix_pattern=config.figure_prefix_pattern,
        table_prefix_pattern=config.table_prefix_pattern,
        outline_strategy=config.outline_strategy,
        title_overrides=config.title_overrides,
        section_strategy=config.section_strategy,
        chapter_text_max_chars=config.chapter_text_max_chars,
        chapter_cover_strip_enabled=config.chapter_cover_strip_enabled,
        chapter_cover_strip_max_lines=config.chapter_cover_strip_max_lines,
        chapter_overrides=config.chapter_overrides,
        page_label_walk_back=config.page_label_walk_back,
        raw_yaml=config.raw_yaml,
    )


def _toc_page_set(config: HandbookConfig) -> set[int]:
    """PDF page numbers (1-indexed) covered by the printed Table of Contents.

    `outline_strategy: content` re-uses page-text scans to derive chapter
    boundaries; the printed-TOC pages would trip that scan because they
    contain right-column page anchors that look like body chapter starts.
    Returning the TOC's page range here lets the outline detector skip them.
    Empty when the YAML carries no `toc:` block.
    """
    toc_raw = config.raw_yaml.get("toc")
    if not isinstance(toc_raw, dict):
        return set()
    start = toc_raw.get("page_start")
    end = toc_raw.get("page_end")
    if not isinstance(start, int) or not isinstance(end, int):
        return set()
    return {p for p in range(start, end + 1) if p >= 1}


def _redact_toc_config(raw: dict[str, object]) -> dict[str, object]:
    """Manifest copy of just the TOC + heading_style blocks (no API keys etc.)."""
    return {
        "toc": raw.get("toc"),
        "heading_style": raw.get("heading_style"),
    }


def _write_compare_report(config: HandbookConfig, compare_result: object) -> Path:
    reports_dir = Path(__file__).resolve().parent.parent / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    out_path = (
        reports_dir / f"section-strategy-compare-{config.document_slug}-{config.edition}.md"
    )
    # Local import keeps the report rendering close to its data class.
    out_path.write_text(compare_result.to_markdown(config), encoding="utf-8")  # type: ignore[attr-defined]
    return out_path


def _merge_section_nodes_into_outline(
    flat_outline: list[OutlineNode],
    bodies: list,
    section_nodes: list[SectionTreeNode],
    pdf_path: Path,
    config: HandbookConfig,
) -> tuple[list[OutlineNode], list]:
    """Append section / subsection rows derived from `section_nodes`.

    Chapter-level rows already exist in `flat_outline` and `bodies`; this
    function appends one OutlineNode + one SectionBody per emitted section
    so `write_outputs()` seeds them as `handbook_section` rows.

    Body slicing: the chapter body markdown is split per-section by walking
    the section list in order and locating each section heading inside the
    chapter prose. Each section row gets the slice between its heading and
    the next sibling/descendant heading; the chapter row keeps the
    introduction (text before the first L1 heading). A heading miss leaves
    the row's body empty so the seed still produces the row -- the chapter
    body remains the fallback for that slice.
    """
    from .sections import SectionBody  # local to avoid circular at module load

    chapter_by_ord = {int(n.code): n for n in flat_outline if n.level == "chapter"}
    body_by_ord = {b.node.ordinal: b for b in bodies if b.node.level == "chapter"}

    codes = derive_codes(section_nodes)

    new_outline: list[OutlineNode] = list(flat_outline)
    new_bodies: list = list(bodies)

    # Group nodes per chapter for fallback page-end resolution.
    by_chapter: dict[int, list[tuple[int, SectionTreeNode]]] = {}
    for idx, node in enumerate(section_nodes):
        by_chapter.setdefault(node.chapter_ordinal, []).append((idx, node))

    for chap_ord, items in by_chapter.items():
        chapter_node = chapter_by_ord.get(chap_ord)
        chapter_body = body_by_ord.get(chap_ord)
        if chapter_node is None or chapter_body is None:
            continue

        # Locate each section heading in the chapter body, walking left-to-
        # right so headings appear in document order (not TOC order, which
        # PHAK preserves anyway). Returns parallel list of slice-start
        # offsets aligned with `items`. A None entry means the heading
        # didn't resolve in the chapter body.
        heading_offsets = _locate_section_headings(chapter_body.body_md, items)
        # End offset for each section is the next sibling/descendant offset
        # (i.e. the next located heading); end-of-body for the last located.
        valid_starts = [o for o in heading_offsets if o is not None]
        first_section_offset = min(valid_starts) if valid_starts else None
        slices = _slice_chapter_body(chapter_body.body_md, heading_offsets)

        # Trim the chapter row's body to its introduction: everything before
        # the first located section heading. If no headings located, leave
        # the chapter body untouched (graceful fallback).
        if first_section_offset is not None and first_section_offset > 0:
            chapter_body.body_md = chapter_body.body_md[:first_section_offset].rstrip() + "\n"
            chapter_body.char_count = len(chapter_body.body_md)

        for (idx, node), section_body_md in zip(items, slices, strict=True):
            code = codes[idx]
            page_start = _page_start_from_anchor(node.page_anchor, chapter_node, config.page_offset)
            page_end = page_start
            faa_start = _faa_page_label(node.page_anchor)
            parent_code = _parent_code_from(codes, by_chapter[chap_ord], idx, node, chap_ord)
            level_name = "section" if node.level == 1 else "subsection"
            outline_node = OutlineNode(
                level=level_name,
                code=code,
                title=node.title,
                page_start=page_start,
                page_end=page_end,
                parent_code=parent_code,
                ordinal=node.ordinal,
            )
            new_outline.append(outline_node)
            new_bodies.append(
                SectionBody(
                    node=outline_node,
                    body_md=section_body_md,
                    faa_page_start=faa_start,
                    faa_page_end=faa_start,
                    char_count=len(section_body_md),
                )
            )
    return new_outline, new_bodies


def _page_start_from_anchor(
    anchor: str | None, chapter_node: OutlineNode, page_offset: int
) -> int:
    """Resolve a "12-7" anchor to a 1-indexed PDF page; fall back to chapter start."""
    if not anchor or "-" not in anchor:
        return chapter_node.page_start
    chap_str, page_str = anchor.split("-", 1)
    if not chap_str.isdigit() or not page_str.isdigit():
        return chapter_node.page_start
    page_within_chapter = int(page_str)
    candidate = chapter_node.page_start + page_within_chapter - 1
    if chapter_node.page_start <= candidate <= chapter_node.page_end:
        return candidate
    return chapter_node.page_start


def _faa_page_label(anchor: str | None) -> str | None:
    """Return the printed FAA page anchor verbatim (e.g. `"12-7"`).

    The schema stores `faa_page_start` as text so hyphenated FAA pagination
    round-trips through the seed unchanged. Returns None when the anchor is
    missing or malformed (the seed treats that as "page reference unknown").
    """
    if not anchor:
        return None
    cleaned = anchor.strip()
    if not cleaned:
        return None
    return cleaned


def _locate_section_headings(
    chapter_body: str, items: list[tuple[int, SectionTreeNode]]
) -> list[int | None]:
    """Find each section heading inside the chapter body markdown.

    Walks the chapter body left-to-right while consuming `items` in order.
    For each section, look for its title as a standalone-on-a-line match
    starting from the previous section's offset. Returns parallel list of
    starting character offsets (or None when not found).

    This is intentionally a simple title-match strategy: PHAK's body
    typesetting renders each section heading as its title text on a line
    by itself in the extracted plaintext (the chrome-stripping pass in
    `sections.py` removes everything else). When a future handbook fights
    that assumption, the fingerprint-aware verifier in `sections_via_toc`
    can be extended to emit explicit byte offsets and pipe them through.
    """
    offsets: list[int | None] = []
    cursor = 0
    for _idx, node in items:
        offset = _find_heading_in_body(chapter_body, node.title, cursor)
        offsets.append(offset)
        if offset is not None:
            cursor = offset + len(node.title)
    return offsets


def _find_heading_in_body(body: str, title: str, start: int) -> int | None:
    """Locate `title` as a standalone line at-or-after `start` in `body`.

    Tries three forms in order:

    1. Exact / case-insensitive line-anchored match (most PHAK headings).
    2. Two-line wrapped match: PHAK occasionally wraps a long heading
       onto two consecutive lines (`"Wind and Pressure Representation on
       Surface" + "Weather Maps"`); join the line with the next line and
       compare to the squashed title.
    3. Whitespace-collapsed prefix match (em-spaces, mid-heading wraps).

    Returns the byte offset of the heading line within `body`, or None.
    """
    norm_title = " ".join(title.split())
    if not norm_title:
        return None
    needle_lower = norm_title.lower()
    title_squashed = needle_lower.replace(" ", "")

    # Form 1: line-anchored exact / case-insensitive scan.
    line_start = start
    while line_start < len(body):
        line_end = body.find("\n", line_start)
        if line_end == -1:
            line_end = len(body)
        line = body[line_start:line_end].strip()
        if line and (line == norm_title or line.lower() == needle_lower):
            return line_start
        line_start = line_end + 1

    # Form 2: two-line wrap. Walk lines and join each with its next line
    # (and the line after, for three-line wraps); compare squashed forms.
    line_offsets: list[int] = []
    line_starts = start
    while line_starts < len(body):
        line_offsets.append(line_starts)
        nxt = body.find("\n", line_starts)
        if nxt == -1:
            break
        line_starts = nxt + 1
    for i, off in enumerate(line_offsets):
        line_end = body.find("\n", off)
        if line_end == -1:
            line_end = len(body)
        line = body[off:line_end].strip()
        if not line:
            continue
        # Try joining 1, 2, or 3 consecutive lines.
        for span in (2, 3):
            if i + span - 1 >= len(line_offsets):
                break
            tail_end_idx = i + span - 1
            tail_end = body.find("\n", line_offsets[tail_end_idx])
            if tail_end == -1:
                tail_end = len(body)
            joined = body[off:tail_end]
            squashed = "".join(joined.split()).lower()
            if squashed == title_squashed:
                return off

    # Form 3: whitespace-collapsed prefix match.
    line_start = start
    while line_start < len(body):
        line_end = body.find("\n", line_start)
        if line_end == -1:
            line_end = len(body)
        line = body[line_start:line_end].strip()
        if line:
            squashed = "".join(line.split()).lower()
            if squashed.startswith(title_squashed) and len(squashed) <= len(title_squashed) + 3:
                return line_start
        line_start = line_end + 1
    return None


def _slice_chapter_body(body: str, offsets: list[int | None]) -> list[str]:
    """Slice the chapter body using consecutive section offsets.

    For each entry in `offsets`, the slice runs from that offset to the
    next non-None offset (or end-of-body for the last located section).
    Entries with `None` offset get an empty string so the section row
    still seeds.
    """
    slices: list[str] = []
    # Pre-compute the next-non-None offset for each index.
    n = len(offsets)
    for i, start in enumerate(offsets):
        if start is None:
            slices.append("")
            continue
        end = len(body)
        for j in range(i + 1, n):
            nxt = offsets[j]
            if nxt is not None and nxt > start:
                end = nxt
                break
        slices.append(body[start:end].strip() + "\n")
    return slices


def _parent_code_from(
    codes: dict[int, str],
    chapter_items: list[tuple[int, SectionTreeNode]],
    self_idx: int,
    self_node: SectionTreeNode,
    chap_ord: int,
) -> str:
    """Walk back through this chapter's items to find the strictly-shallower parent."""
    if self_node.level == 1:
        return str(chap_ord)
    for back_idx, back_node in reversed(chapter_items):
        if back_idx >= self_idx:
            continue
        if back_node.level < self_node.level:
            return codes[back_idx]
    return str(chap_ord)


