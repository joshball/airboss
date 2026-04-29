"""AIM HTML extraction.

The AIM is published as section + appendix HTML files at
`https://www.faa.gov/air_traffic/publications/atpubs/aim_html/`. The TS
downloader caches these files under `<cache>/aim/`; this module parses
them into the section-tree shape the rest of the handbook-ingest pipeline
expects.

Section files (`chap{C}_section_{S}.html`):
    Each FAA paragraph has a semantic anchor:
        <h4 class="paragraph-title" id="{C}-{S}-{P}">{title}</h4>
        <p>...body...</p>
        <p>...more body...</p>
    until the next <h4 class="paragraph-title">.

Appendix files (`appendix_{N}.html`):
    No `<h4 class="paragraph-title">` -- the publisher puts content
    inside `<main class="main-content usa-content">` as `<p>` and
    `<table>` elements. We treat the entire main as one section.

Per the chapter-source-ingestion WP, the TS layer owns network I/O; this
module only reads cached HTML from disk and emits section-tree nodes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup, Tag


@dataclass(frozen=True)
class AimParagraph:
    """One FAA paragraph extracted from a section HTML file."""

    locator: str
    """Three-part FAA locator (e.g. `7-3-1`)."""

    title: str
    """The paragraph's <h4 class="paragraph-title"> text."""

    body_text: str
    """All content between this h4 and the next h4 / EOF, joined by blank lines."""


@dataclass(frozen=True)
class AimSection:
    """One AIM chapter section (one cached `chap{C}_section_{S}.html`)."""

    chapter: int
    section: int
    paragraphs: list[AimParagraph]


@dataclass(frozen=True)
class AimAppendix:
    """One AIM appendix (one cached `appendix_{N}.html`)."""

    ordinal: int
    """1-indexed appendix number."""

    title: str
    """First <h1>/<h2> text inside <main>, or 'Appendix N' fallback."""

    body_html: str
    """Raw HTML content of <main class="main-content usa-content">."""

    body_text: str
    """Plaintext extraction (used by the prompt sidecar)."""


_LOCATOR_RE = re.compile(r"^\d+-\d+-\d+$")


def parse_section_file(path: Path) -> AimSection:
    """Parse one cached `chap{CC}_section_{SS}.html` file into an AimSection.

    The chapter + section ordinals are recovered from the filename so the
    parser doesn't depend on the publisher embedding them in <head> metadata.
    """
    filename = path.name
    m = re.match(r"chap(\d+)_section_(\d+)\.html$", filename)
    if m is None:
        raise ValueError(f"AIM section file has unexpected name: {filename}")
    chapter = int(m.group(1))
    section = int(m.group(2))

    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    paragraph_titles = soup.select('h4.paragraph-title[id]')

    paragraphs: list[AimParagraph] = []
    for h4 in paragraph_titles:
        locator = h4.get("id", "")
        if not isinstance(locator, str) or not _LOCATOR_RE.match(locator):
            continue
        title_text = h4.get_text(strip=True)
        body_text = _collect_body_until_next_h4(h4)
        paragraphs.append(
            AimParagraph(
                locator=locator,
                title=title_text,
                body_text=body_text,
            )
        )
    return AimSection(chapter=chapter, section=section, paragraphs=paragraphs)


def parse_appendix_file(path: Path) -> AimAppendix:
    """Parse one cached `appendix_{NN}.html` file into an AimAppendix."""
    filename = path.name
    m = re.match(r"appendix_(\d+)\.html$", filename)
    if m is None:
        raise ValueError(f"AIM appendix file has unexpected name: {filename}")
    ordinal = int(m.group(1))

    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    main = soup.select_one("main.main-content.usa-content")
    if main is None:
        # Fall back: the publisher occasionally drops the class list; widen
        # to any <main> tag rather than fail.
        main = soup.select_one("main")
    if main is None:
        raise ValueError(f"AIM appendix file {filename} has no <main> tag")

    title_tag = main.select_one("h1") or main.select_one("h2")
    title = title_tag.get_text(strip=True) if title_tag is not None else f"Appendix {ordinal}"

    body_html = main.decode_contents()
    body_text = _normalize_text(main.get_text("\n", strip=True))

    return AimAppendix(
        ordinal=ordinal,
        title=title,
        body_html=body_html,
        body_text=body_text,
    )


def _collect_body_until_next_h4(h4: Tag) -> str:
    """Walk forward from `h4` collecting text until the next paragraph-title h4.

    Concatenates paragraph and table text with blank-line separators so the
    output is a clean plaintext block suitable for a prompt-strategy sidecar.
    """
    pieces: list[str] = []
    sibling = h4.next_sibling
    while sibling is not None:
        if isinstance(sibling, Tag):
            if sibling.name == "h4" and "paragraph-title" in (sibling.get("class") or []):
                break
            text = sibling.get_text("\n", strip=True)
            if text:
                pieces.append(text)
        sibling = sibling.next_sibling
    return _normalize_text("\n\n".join(pieces))


def _normalize_text(text: str) -> str:
    """Collapse 3+ consecutive newlines to 2, trim leading/trailing whitespace."""
    out = re.sub(r"\n{3,}", "\n\n", text)
    return out.strip()


def discover_aim_section_files(aim_cache_dir: Path) -> list[Path]:
    """Return every `chap{CC}_section_{SS}.html` under the AIM cache dir,
    sorted by (chapter, section) ordinal."""
    if not aim_cache_dir.is_dir():
        return []
    files = list(aim_cache_dir.glob("chap*_section_*.html"))
    files.sort(key=lambda p: p.name)
    return files


def discover_aim_appendix_files(aim_cache_dir: Path) -> list[Path]:
    """Return every `appendix_{NN}.html` under the AIM cache dir, sorted by
    appendix ordinal."""
    if not aim_cache_dir.is_dir():
        return []
    files = list(aim_cache_dir.glob("appendix_*.html"))
    files.sort(key=lambda p: p.name)
    return files
