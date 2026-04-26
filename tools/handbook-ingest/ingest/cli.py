"""airboss handbook ingestion CLI.

Usage:

    bun run handbook-ingest <doc> [options]
    python -m ingest <doc> [options]

`<doc>` is the document slug (matches `ingest/config/<doc>.yaml`). Options:

    --edition <e>         Override edition tag (defaults to config edition)
    --chapter <code>      Restrict to a single chapter (e.g. `12`)
    --dry-run             Validate without writing files
    --force               Re-extract even if hashes match
"""

from __future__ import annotations

import click

from .config_loader import load_config
from .fetch import fetch_pdf
from .figures import extract_figures
from .normalize import write_outputs
from .outline import OutlineError, detect_outline_from_text, filter_to_chapter, parse_outline
from .sections import extract_sections
from .tables import extract_tables


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("document_slug")
@click.option("--edition", default=None, help="Edition tag override (defaults to YAML config).")
@click.option("--chapter", default=None, help="Chapter code to restrict to (e.g. `12`).")
@click.option("--dry-run", is_flag=True, default=False, help="Validate only; no writes.")
@click.option("--force", is_flag=True, default=False, help="Re-extract even when hashes match.")
def main(document_slug: str, edition: str | None, chapter: str | None, dry_run: bool, force: bool) -> None:
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
    )
    click.echo(
        f"  wrote {summary.sections_written} sections, "
        f"{summary.figures_written} figures, {summary.tables_written} tables; "
        f"manifest -> {summary.manifest_path}"
    )
    click.echo(f"done: {config.document_slug} {config.edition}")


def _override_edition(config, edition: str):  # type: ignore[no-untyped-def]
    # Recreate the dataclass with a different edition. Frozen dataclass means
    # we can't mutate; build a new one.
    from .config_loader import HandbookConfig

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
    )
