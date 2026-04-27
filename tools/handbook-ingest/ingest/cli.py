"""airboss handbook ingestion CLI.

Usage:

    bun run handbook-ingest <doc> [options]
    python -m ingest <doc> [options]

`<doc>` is the document slug (matches `ingest/config/<doc>.yaml`). Options:

    --edition <e>             Override edition tag (defaults to config edition)
    --chapter <code>          Restrict to a single chapter (e.g. `12`)
    --dry-run                 Validate without writing files
    --force                   Re-extract even if hashes match
    --strategy {toc,llm,compare}
                              Override section-tree strategy. Default = read
                              from `<doc>.yaml -> section_strategy`. `compare`
                              runs both strategies and writes a markdown diff
                              report under `tools/handbook-ingest/reports/`
                              without seeding the section rows.
"""

from __future__ import annotations

from pathlib import Path

import click

from .config_loader import (
    SECTION_STRATEGY_LLM,
    SECTION_STRATEGY_PER_CHAPTER,
    SECTION_STRATEGY_TOC,
    HandbookConfig,
    load_config,
)
from .fetch import fetch_pdf
from .figures import extract_figures
from .normalize import write_outputs
from .outline import OutlineError, OutlineNode, detect_outline_from_text, filter_to_chapter, parse_outline
from .paths import repo_root
from .section_tree import SectionTreeNode, derive_codes
from .sections import extract_sections
from .sections_compare import compare_strategies
from .sections_via_llm import LlmKeyMissingError, extract_via_llm
from .sections_via_toc import extract_via_toc
from .tables import extract_tables

_STRATEGY_CHOICES = ("toc", "llm", "compare")


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
    help="Section-tree strategy: toc, llm, or compare. Defaults to YAML config.",
)
def main(
    document_slug: str,
    edition: str | None,
    chapter: str | None,
    dry_run: bool,
    force: bool,
    strategy: str | None,
) -> None:
    """Ingest the handbook identified by `<doc>`."""
    config = load_config(document_slug)
    if edition is not None:
        config = _override_edition(config, edition)

    click.echo(f"handbook-ingest: {config.document_slug} edition {config.edition}")
    click.echo(f"  source URL: {config.source_url}")

    fetch_result = fetch_pdf(config, force=force)
    click.echo(
        f"  fetched: {fetch_result.path} ({fetch_result.size_bytes} bytes, "
        f"sha256 {fetch_result.sha256[:12]}...)"
    )

    try:
        if config.outline_strategy == "content":
            flat_outline = detect_outline_from_text(fetch_result.path)
        else:
            flat_outline = parse_outline(fetch_result.path)
    except OutlineError as exc:
        click.echo(f"error: {exc}", err=True)
        raise SystemExit(2) from exc

    if config.title_overrides:
        for node in flat_outline:
            override = config.title_overrides.get(node.code)
            if override:
                node.title = override

    if chapter is not None:
        flat_outline = filter_to_chapter(flat_outline, chapter)
        click.echo(f"  outline filtered to chapter `{chapter}`: {len(flat_outline)} nodes")
    else:
        click.echo(f"  outline: {len(flat_outline)} nodes")

    bodies = extract_sections(fetch_result.path, flat_outline, page_offset=config.page_offset)
    empty_bodies = [b for b in bodies if b.char_count == 0]
    if empty_bodies:
        click.echo(
            f"error: {len(empty_bodies)} section(s) extracted to empty text: "
            f"{[b.node.code for b in empty_bodies][:10]}",
            err=True,
        )
        if not dry_run:
            raise SystemExit(2)

    figures, figure_warnings = extract_figures(
        fetch_result.path,
        flat_outline,
        config.document_slug,
        config.edition,
        figure_pattern=config.figure_prefix_pattern,
    )
    click.echo(f"  figures: {len(figures)} extracted, {len(figure_warnings)} warnings")

    tables, table_warnings = extract_tables(
        fetch_result.path,
        flat_outline,
        config.document_slug,
        config.edition,
        table_pattern=config.table_prefix_pattern,
    )
    click.echo(f"  tables: {len(tables)} extracted, {len(table_warnings)} warnings")

    # Section-tree strategy resolution. CLI flag wins over YAML config.
    effective_strategy = (strategy or config.section_strategy).lower()
    click.echo(f"  section-tree strategy: {effective_strategy}")

    section_extra_warnings: list[str] = []
    section_nodes: list[SectionTreeNode] = []
    extraction_metadata: dict[str, object] = {"section_strategy": {"kind": effective_strategy}}

    chapter_nodes = [n for n in flat_outline if n.level == "chapter"]
    chapter_bodies_text = {b.node.ordinal: b.body_md for b in bodies if b.node.level == "chapter"}

    if effective_strategy == "compare":
        compare_result, prompt_sha, in_tok, out_tok, _toc, _llm, toc_warnings, llm_warnings = (
            _run_compare(config, fetch_result.path, chapter_nodes, chapter_bodies_text)
        )
        report_path = _write_compare_report(config, compare_result)
        click.echo(f"  compare report -> {report_path}")
        click.echo(f"  llm tokens: in={in_tok} out={out_tok} (prompt sha={prompt_sha[:12]})")
        if toc_warnings:
            click.echo(f"  toc warnings: {len(toc_warnings)}")
        if llm_warnings:
            click.echo(f"  llm warnings: {len(llm_warnings)}")
        # Compare mode does not seed section rows; chapter-level only.
        section_nodes = []
        extraction_metadata["section_strategy"] = {
            "kind": "compare",
            "report_path": str(report_path.relative_to(repo_root())),
            "llm": {
                "prompt_sha256": prompt_sha,
                "input_tokens": in_tok,
                "output_tokens": out_tok,
                "model": _llm_model(),
            },
        }
    elif effective_strategy == SECTION_STRATEGY_LLM:
        try:
            llm_result = extract_via_llm(
                config, chapter_nodes, chapter_bodies_text, raw_yaml=config.raw_yaml
            )
        except LlmKeyMissingError as exc:
            click.echo(f"error: {exc}", err=True)
            raise SystemExit(3) from exc
        section_nodes = llm_result.nodes
        section_extra_warnings.extend(llm_result.warnings)
        extraction_metadata["section_strategy"] = {
            "kind": SECTION_STRATEGY_LLM,
            "prompt_sha256": llm_result.prompt_sha256,
            "model": _llm_model(),
            "input_tokens": llm_result.input_tokens,
            "output_tokens": llm_result.output_tokens,
        }
    elif effective_strategy == SECTION_STRATEGY_PER_CHAPTER:
        section_nodes, per_chapter_meta = _run_per_chapter(
            config, fetch_result.path, chapter_nodes, chapter_bodies_text, section_extra_warnings
        )
        extraction_metadata["section_strategy"] = per_chapter_meta
    else:
        toc_result = extract_via_toc(
            fetch_result.path, config, chapter_nodes, raw_yaml=config.raw_yaml
        )
        section_nodes = toc_result.nodes
        section_extra_warnings.extend(toc_result.warnings)
        extraction_metadata["section_strategy"] = {
            "kind": SECTION_STRATEGY_TOC,
            "config": _redact_toc_config(config.raw_yaml),
        }

    click.echo(
        f"  section-tree nodes: {len(section_nodes)} "
        f"({sum(1 for n in section_nodes if n.level == 1)} L1, "
        f"{sum(1 for n in section_nodes if n.level == 2)} L2, "
        f"{sum(1 for n in section_nodes if n.level == 3)} L3)"
    )
    if section_extra_warnings:
        click.echo(f"  section-tree warnings: {len(section_extra_warnings)} -- see manifest")

    # Promote section_nodes into the OutlineNode + body list so existing
    # write_outputs() seeds them as `handbook_section` rows.
    if section_nodes:
        flat_outline, bodies = _merge_section_nodes_into_outline(
            flat_outline, bodies, section_nodes, fetch_result.path, config
        )

    if dry_run:
        click.echo(
            f"dry-run summary: {len(bodies)} sections, {len(figures)} figures, {len(tables)} tables, "
            f"{len(figure_warnings) + len(table_warnings)} warnings"
        )
        return

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
        extra_warnings=section_extra_warnings,
    )
    click.echo(
        f"  wrote {summary.sections_written} sections, "
        f"{summary.figures_written} figures, {summary.tables_written} tables; "
        f"manifest -> {summary.manifest_path}"
    )
    click.echo(f"done: {config.document_slug} {config.edition}")


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
        per_chapter_section_strategy=config.per_chapter_section_strategy,
        chapter_cover_strip_enabled=config.chapter_cover_strip_enabled,
        chapter_cover_strip_max_lines=config.chapter_cover_strip_max_lines,
        raw_yaml=config.raw_yaml,
    )


def _run_compare(
    config: HandbookConfig,
    pdf_path: Path,
    chapter_nodes: list[OutlineNode],
    chapter_bodies_text: dict[int, str],
) -> tuple[
    object,
    str,
    int,
    int,
    list[SectionTreeNode],
    list[SectionTreeNode],
    list[str],
    list[str],
]:
    toc_result = extract_via_toc(pdf_path, config, chapter_nodes, raw_yaml=config.raw_yaml)
    try:
        llm_result = extract_via_llm(config, chapter_nodes, chapter_bodies_text, raw_yaml=config.raw_yaml)
    except LlmKeyMissingError as exc:
        click.echo(f"error: {exc}", err=True)
        raise SystemExit(3) from exc

    chapter_titles = {n.ordinal: n.title for n in chapter_nodes if n.level == "chapter"}
    compare_result = compare_strategies(toc_result.nodes, llm_result.nodes, chapter_titles)
    return (
        compare_result,
        llm_result.prompt_sha256,
        llm_result.input_tokens,
        llm_result.output_tokens,
        toc_result.nodes,
        llm_result.nodes,
        toc_result.warnings,
        llm_result.warnings,
    )


def _run_per_chapter(
    config: HandbookConfig,
    pdf_path: Path,
    chapter_nodes: list[OutlineNode],
    chapter_bodies_text: dict[int, str],
    accumulated_warnings: list[str],
) -> tuple[list[SectionTreeNode], dict[str, object]]:
    """Resolve per-chapter strategy from `per_chapter_section_strategy`."""
    overrides = config.per_chapter_section_strategy
    if not overrides:
        raise SystemExit(
            "per_chapter section_strategy requires `per_chapter_section_strategy` to be populated."
        )
    toc_chapters = {ord_ for ord_, kind in overrides.items() if kind == SECTION_STRATEGY_TOC}
    llm_chapters = {ord_ for ord_, kind in overrides.items() if kind == SECTION_STRATEGY_LLM}
    nodes: list[SectionTreeNode] = []
    metadata: dict[str, object] = {"kind": SECTION_STRATEGY_PER_CHAPTER, "overrides": dict(overrides)}
    if toc_chapters:
        toc_chap_subset = [c for c in chapter_nodes if c.ordinal in toc_chapters]
        toc_result = extract_via_toc(pdf_path, config, toc_chap_subset, raw_yaml=config.raw_yaml)
        nodes.extend(toc_result.nodes)
        accumulated_warnings.extend(toc_result.warnings)
    if llm_chapters:
        llm_chap_subset = [c for c in chapter_nodes if c.ordinal in llm_chapters]
        llm_bodies = {ord_: chapter_bodies_text[ord_] for ord_ in llm_chapters if ord_ in chapter_bodies_text}
        try:
            llm_result = extract_via_llm(
                config, llm_chap_subset, llm_bodies, raw_yaml=config.raw_yaml
            )
        except LlmKeyMissingError as exc:
            click.echo(f"error: {exc}", err=True)
            raise SystemExit(3) from exc
        nodes.extend(llm_result.nodes)
        accumulated_warnings.extend(llm_result.warnings)
        metadata["llm"] = {
            "prompt_sha256": llm_result.prompt_sha256,
            "model": _llm_model(),
            "input_tokens": llm_result.input_tokens,
            "output_tokens": llm_result.output_tokens,
        }
    return nodes, metadata


def _llm_model() -> str:
    """Lazily import to avoid loading the LLM module unless needed."""
    from .sections_via_llm import MODEL

    return MODEL


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


