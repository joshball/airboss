"""Per-chapter plaintext sidecar writer for the prompt strategy.

Writes `_chapter_plaintext.txt` next to each chapter directory under
`handbooks/<doc>/<edition>/<NN>/`. The bytes come from
`sections.extract_sections` (PyMuPDF body), the same source of truth used
historically by the deleted `sections_via_llm.py` API path. The deleted
`run-llm-comparison.md` runner concatenated rendered markdown instead --
this module closes that byte-source gap by routing the prompt flow through
the same `extract_sections` output.

Truncation: the body is capped at `HandbookConfig.chapter_text_max_chars`,
truncated from the END so the chapter head (introduction + first sections)
is always intact.

CHAPTER-PDF MODE (per chapter-source-ingestion WP, ADR 022):
When the handbook's YAML carries `chapter_pdfs` AND the chapter PDF exists
in the source cache, the sidecar text is built from the chapter PDF
directly (no whole-doc page-range slicing, no truncation cap). This is the
correctness fix for handbooks where 11 of 17 PHAK chapters were silently
truncated mid-content under the old whole-doc + 60K cap path.

The chapter-mode branch is one early-return at the top of
`write_chapter_sidecars`; the existing whole-doc path runs unchanged when
chapter PDFs aren't available. The boundary keeps the
`section-extraction-contract-v2` WP's truncation/template work cleanly
inside the whole-doc path (`_build_from_whole_doc_with_page_ranges`).

Sidecar policy: only the `prompt` and `compare` strategies write/read these
files. `--strategy toc` does NOT write sidecars (avoids polluting handbooks
that don't use the prompt path).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from .config_loader import HandbookConfig
from .paths import cache_edition_root, edition_root, ensure_dir
from .sections import SectionBody

SIDECAR_FILENAME = "_chapter_plaintext.txt"
"""Stable filename for the per-chapter plaintext sidecar."""


@dataclass(frozen=True)
class ChapterPlaintextSidecar:
    """Result of writing one chapter's plaintext sidecar."""

    chapter_ordinal: int
    """1-indexed chapter number (matches the `<NN>/` directory name)."""

    path: Path
    """Absolute path to the written sidecar."""

    sha256: str
    """SHA-256 of the sidecar bytes (used by prompt-emit + meta.json)."""

    char_count: int
    """Number of characters written (after truncation)."""


def write_chapter_sidecars(
    config: HandbookConfig,
    chapter_bodies: list[SectionBody],
) -> list[ChapterPlaintextSidecar]:
    """Write one `_chapter_plaintext.txt` per chapter and return descriptors.

    Two paths:

    - **Chapter-PDF mode** (`config.chapter_pdfs` set + chapter PDFs cached):
      sidecar text is the full PyMuPDF text extraction of the chapter's PDF.
      No truncation cap applies (chapter PDFs are already the right unit of
      input).
    - **Whole-doc mode** (default): sidecar text comes from `chapter_bodies`
      (PyMuPDF body of the whole-doc PDF, sliced by page range upstream),
      capped at `chapter_text_max_chars`.
    """
    if config.chapter_pdfs is not None:
        chapter_pdf_paths = _list_cached_chapter_pdfs(config)
        if chapter_pdf_paths:
            # Honor the --chapter filter: only emit sidecars for the chapters
            # the caller actually asked about. chapter_bodies has been filtered
            # upstream (cli.py:filter_to_chapter), so its ordinals are the
            # authoritative list. Skip the filter only when chapter_bodies is
            # empty (whole-doc mode never produced bodies, e.g. some test paths).
            wanted_ordinals = {b.node.ordinal for b in chapter_bodies if b.node.level == "chapter"}
            if wanted_ordinals:
                chapter_pdf_paths = {n: p for n, p in chapter_pdf_paths.items() if n in wanted_ordinals}
            return _build_from_chapter_pdfs(config, chapter_pdf_paths)
    return _build_from_whole_doc_with_page_ranges(config, chapter_bodies)


def _build_from_whole_doc_with_page_ranges(
    config: HandbookConfig,
    chapter_bodies: list[SectionBody],
) -> list[ChapterPlaintextSidecar]:
    """Whole-doc + page-range slicing path.

    This is the original implementation; the section-extraction-contract-v2
    WP owns the contents of this function (truncation logic, prompt template
    parameters). The chapter-source-ingestion WP only added the early-return
    above and refactored the body into this named function.
    """
    cap = config.chapter_text_max_chars
    if cap is None:
        # config_loader enforces this for section_strategy==prompt; a None
        # here means a caller (or a unit test) constructed a HandbookConfig
        # without going through load_config and forgot the cap. Fail loud
        # rather than silently truncate.
        raise ValueError(
            "chapter_text_max_chars is required when writing chapter sidecars; "
            "set it on the handbook config."
        )
    written: list[ChapterPlaintextSidecar] = []
    for body in chapter_bodies:
        if body.node.level != "chapter":
            continue
        text = body.body_md or ""
        if len(text) > cap:
            text = text[:cap]
        # Always end with a single trailing newline for diff cleanliness.
        if not text.endswith("\n"):
            text = text + "\n"
        chapter_dir = ensure_dir(
            edition_root(config.document_slug, config.edition) / f"{body.node.ordinal:02d}"
        )
        target = chapter_dir / SIDECAR_FILENAME
        target.write_text(text, encoding="utf-8")
        sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
        written.append(
            ChapterPlaintextSidecar(
                chapter_ordinal=body.node.ordinal,
                path=target,
                sha256=sha,
                char_count=len(text),
            )
        )
    return written


def _list_cached_chapter_pdfs(config: HandbookConfig) -> dict[int, Path]:
    """Return {ordinal -> chapter PDF path} for every chapter PDF cached for
    this handbook edition. Empty dict when chapter PDFs are not yet downloaded
    (the caller falls back to whole-doc mode in that case)."""
    out: dict[int, Path] = {}
    if config.chapter_pdfs is None:
        return out
    cache_dir = cache_edition_root(config.document_slug, config.edition)
    if not cache_dir.is_dir():
        return out
    for n in range(1, config.chapter_pdfs.chapter_count + 1):
        path = cache_dir / f"{config.edition}-ch{n:02d}.pdf"
        if path.is_file():
            out[n] = path
    return out


def _build_from_chapter_pdfs(
    config: HandbookConfig,
    chapter_pdf_paths: dict[int, Path],
) -> list[ChapterPlaintextSidecar]:
    """Chapter-PDF mode: extract plaintext from each chapter PDF directly.

    Uses PyMuPDF (the same engine `sections.extract_sections` already runs)
    via a per-chapter open. Page numbering inside the chapter PDF restarts at
    1 but the printed FAA `<chapter>-<page>` reference is preserved in body
    text, so chapter sidecars carry the same locator scheme as whole-doc
    sidecars.
    """
    written: list[ChapterPlaintextSidecar] = []
    for ordinal in sorted(chapter_pdf_paths.keys()):
        pdf_path = chapter_pdf_paths[ordinal]
        text = _extract_pdf_plaintext(pdf_path)
        if not text.endswith("\n"):
            text = text + "\n"
        chapter_dir = ensure_dir(
            edition_root(config.document_slug, config.edition) / f"{ordinal:02d}"
        )
        target = chapter_dir / SIDECAR_FILENAME
        target.write_text(text, encoding="utf-8")
        sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
        written.append(
            ChapterPlaintextSidecar(
                chapter_ordinal=ordinal,
                path=target,
                sha256=sha,
                char_count=len(text),
            )
        )
    return written


def _extract_pdf_plaintext(pdf_path: Path) -> str:
    """Open `pdf_path` with PyMuPDF and concatenate `page.get_text()` output.

    Lazy-imports `fitz` so this module loads in test contexts where the
    optional PyMuPDF dependency may be absent (though every production caller
    has it via the same dependency the rest of `tools/handbook-ingest/` uses).
    """
    try:
        import fitz  # noqa: PLC0415 -- optional heavy dep
    except ImportError as exc:  # pragma: no cover -- prod always has PyMuPDF
        raise RuntimeError(
            f"chapter-PDF mode requires PyMuPDF (fitz); install handbook-ingest deps. "
            f"Source: {pdf_path}."
        ) from exc

    parts: list[str] = []
    with fitz.open(str(pdf_path)) as doc:
        for page in doc:
            parts.append(page.get_text("text"))
    return "\n".join(parts)
