"""Diagnostic: uncapped chapter plaintext size per handbook.

Reads each handbook YAML, fetches/reuses the cached PDF, extracts chapter
bodies via `sections.extract_sections`, and prints per-chapter char counts
plus the recommended `chapter_text_max_chars` cap (longest chapter * 1.2,
rounded up to the next 25K).

When to run:

- Adding a new handbook -- pick the cap value before the first prompt run.
- After a handbook edition update -- verify the existing cap still fits.
- Investigating a truncation symptom in a compare report -- confirm the
  chapter actually fit in the LLM input.

The YAML annotation comments on each handbook's `chapter_text_max_chars`
reference this script as the canonical re-measure tool.

Run from anywhere:

    /path/to/airboss/tools/handbook-ingest/.venv/bin/python \\
        /path/to/airboss/tools/handbook-ingest/measure_chapter_sizes.py
"""

from __future__ import annotations

import math
from pathlib import Path

from ingest.config_loader import load_config
from ingest.fetch import fetch_pdf
from ingest.outline import detect_outline_from_text, parse_outline
from ingest.sections import extract_sections


def _toc_page_set(config) -> set[int]:
    toc_raw = config.raw_yaml.get("toc")
    if not isinstance(toc_raw, dict):
        return set()
    start = toc_raw.get("page_start")
    end = toc_raw.get("page_end")
    if not isinstance(start, int) or not isinstance(end, int):
        return set()
    return {p for p in range(start, end + 1) if p >= 1}


def measure(slug: str) -> None:
    config = load_config(slug)
    fetch_result = fetch_pdf(config, force=False)
    if config.outline_strategy == "content":
        flat_outline = detect_outline_from_text(
            fetch_result.path, skip_pages=_toc_page_set(config)
        )
    else:
        flat_outline = parse_outline(fetch_result.path)
    if config.title_overrides:
        for node in flat_outline:
            override = config.title_overrides.get(node.code)
            if override:
                node.title = override

    section_result = extract_sections(
        fetch_result.path,
        flat_outline,
        page_offset=config.page_offset,
        chapter_overrides=config.chapter_overrides,
        walk_back=config.page_label_walk_back,
    )
    chapter_bodies = [b for b in section_result.bodies if b.node.level == "chapter"]

    sizes: list[tuple[int, str, int]] = []
    for body in chapter_bodies:
        sizes.append((body.node.ordinal, body.node.title, len(body.body_md or "")))
    sizes.sort()

    print(f"\n=== {slug} ({config.edition}) -- current cap: {config.chapter_text_max_chars} ===")
    over = 0
    for ord_, title, n in sizes:
        flag = "  <-- OVER CAP" if n > config.chapter_text_max_chars else ""
        print(f"  ch{ord_:02d}: {n:>7,} chars  {title}{flag}")
        if n > config.chapter_text_max_chars:
            over += 1

    longest = max(n for _, _, n in sizes)
    longest_title = next(t for _, t, n in sizes if n == longest)
    longest_ord = next(o for o, _, n in sizes if n == longest)
    headroom = math.ceil(longest * 1.2 / 25000) * 25000

    print()
    print(f"  longest chapter: ch{longest_ord:02d} ({longest_title}) -- {longest:,} chars")
    print(f"  chapters over current cap: {over}/{len(sizes)}")
    print(f"  recommended new cap (longest * 1.2, rounded to 25K): {headroom:,}")


def main() -> None:
    config_dir = Path(__file__).resolve().parent / "ingest" / "config"
    slugs = sorted(p.stem for p in config_dir.glob("*.yaml"))
    print(f"Found {len(slugs)} handbook configs in {config_dir}: {slugs}")
    for slug in slugs:
        try:
            measure(slug)
        except Exception as exc:  # noqa: BLE001
            print(f"\n=== {slug} -- FAILED ===\n  {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
