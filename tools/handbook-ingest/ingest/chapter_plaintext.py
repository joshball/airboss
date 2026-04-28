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

Sidecar policy: only the `prompt` and `compare` strategies write/read these
files. `--strategy toc` does NOT write sidecars (avoids polluting handbooks
that don't use the prompt path).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from .config_loader import HandbookConfig
from .paths import edition_root, ensure_dir
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

    Only chapters with non-empty bodies get a sidecar. The cap is applied
    from the END so the head of the chapter is always intact.
    """
    cap = config.chapter_text_max_chars
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
