"""Tests for AIM HTML section + appendix extraction (BeautifulSoup-based)."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from ingest.aim_html_extract import (
    discover_aim_appendix_files,
    discover_aim_section_files,
    parse_appendix_file,
    parse_section_file,
)


SECTION_HTML = textwrap.dedent(
    """\
    <!DOCTYPE html>
    <html>
    <body>
    <main>
    <h2>Chapter 7. Section 3. Cold Weather Operations</h2>
    <h4 class="paragraph-title" id="7-3-1">7-3-1. Effect of Cold Temperature</h4>
    <p>Cold temperature affects altimeter readings.</p>
    <p>Pilots must apply cold-temperature corrections at the airports listed in the AIM.</p>
    <h4 class="paragraph-title" id="7-3-2">7-3-2. Effect of Wind</h4>
    <p>Wind affects ground speed but not airspeed.</p>
    <h4 class="paragraph-title" id="7-3-3">7-3-3. Mountain Flying</h4>
    <p>Mountain flying carries unique risks.</p>
    </main>
    </body>
    </html>
    """
)


APPENDIX_HTML = textwrap.dedent(
    """\
    <!DOCTYPE html>
    <html>
    <body>
    <main class="main-content usa-content">
    <h1>Appendix 3. Abbreviations and Acronyms</h1>
    <p>This appendix contains common AIM abbreviations.</p>
    <table>
      <tr><th>Acronym</th><th>Meaning</th></tr>
      <tr><td>AAWU</td><td>Alaska Aviation Weather Unit</td></tr>
      <tr><td>AAS</td><td>Airport Advisory Service</td></tr>
      <tr><td>AAM</td><td>Advanced Air Mobility</td></tr>
    </table>
    </main>
    </body>
    </html>
    """
)


def test_parse_section_file_extracts_paragraph_titles_and_bodies(tmp_path: Path) -> None:
    target = tmp_path / "chap07_section_03.html"
    target.write_text(SECTION_HTML, encoding="utf-8")
    section = parse_section_file(target)
    assert section.chapter == 7
    assert section.section == 3
    assert [p.locator for p in section.paragraphs] == ["7-3-1", "7-3-2", "7-3-3"]
    assert "Effect of Cold Temperature" in section.paragraphs[0].title
    assert "altimeter" in section.paragraphs[0].body_text
    # The body text under 7-3-1 includes both <p> children and stops at 7-3-2.
    assert "ground speed" not in section.paragraphs[0].body_text
    assert "ground speed" in section.paragraphs[1].body_text


def test_parse_section_file_rejects_unexpected_filename(tmp_path: Path) -> None:
    target = tmp_path / "weird.html"
    target.write_text("<html></html>", encoding="utf-8")
    with pytest.raises(ValueError, match="unexpected name"):
        parse_section_file(target)


def test_parse_appendix_file_extracts_main_content(tmp_path: Path) -> None:
    target = tmp_path / "appendix_03.html"
    target.write_text(APPENDIX_HTML, encoding="utf-8")
    appendix = parse_appendix_file(target)
    assert appendix.ordinal == 3
    assert "Abbreviations and Acronyms" in appendix.title
    # Acronyms must appear in the plaintext extraction.
    assert "AAWU" in appendix.body_text
    assert "AAS" in appendix.body_text
    assert "AAM" in appendix.body_text
    # The HTML body still contains the table tag for downstream renderers.
    assert "<table>" in appendix.body_html


def test_discover_aim_section_files_sorts_lexicographically(tmp_path: Path) -> None:
    (tmp_path / "chap00_section_01.html").write_text("<html></html>", encoding="utf-8")
    (tmp_path / "chap07_section_03.html").write_text("<html></html>", encoding="utf-8")
    (tmp_path / "chap10_section_04.html").write_text("<html></html>", encoding="utf-8")
    files = discover_aim_section_files(tmp_path)
    names = [p.name for p in files]
    assert names == ["chap00_section_01.html", "chap07_section_03.html", "chap10_section_04.html"]


def test_discover_aim_appendix_files(tmp_path: Path) -> None:
    (tmp_path / "appendix_01.html").write_text("<html></html>", encoding="utf-8")
    (tmp_path / "appendix_05.html").write_text("<html></html>", encoding="utf-8")
    files = discover_aim_appendix_files(tmp_path)
    names = [p.name for p in files]
    assert names == ["appendix_01.html", "appendix_05.html"]


def test_discover_handles_missing_dir(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"
    assert discover_aim_section_files(missing) == []
    assert discover_aim_appendix_files(missing) == []
