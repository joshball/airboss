"""Tests for OCR-leakage detection + elision.

WP-HANDBOOK-RE-EXTRACTION-V2 sub-phase 1D.

Two surfaces:

- `detect_ocr_leaks(body_md)` finds runs of 8+ consecutive 1-2-character
  tokens (often with alphabet duplication, the IFH 2/5 phonetic-alphabet
  leak pattern).
- `elide_ocr_leaks(body_md, spans, *, section_code)` removes spans + emits
  one warning per span carrying the elided text up to 200 chars (forensic
  traceability for the hangar triage dashboard).

Negative cases (must NOT trigger):

- prose with single-letter words ("a", "I").
- acronyms with periods ("U.S.", "N.W.A.").
- section codes ("1.1.2").
- a few short tokens scattered in long paragraphs.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ingest import normalize
from ingest.config_loader import HandbookConfig
from ingest.fetch import FetchResult
from ingest.ocr_leak import (
    MIN_LEAK_RUN,
    OcrLeakWarning,
    detect_ocr_leaks,
    elide_ocr_leaks,
)
from ingest.outline import OutlineNode
from ingest.sections import SectionBody

# Canonical IFH 2/5 leak. ~56 tokens of 1-2 chars, dominantly alpha.
IFH_PHONETIC_LEAK = (
    "r R 0 q Q9 p P 8 o O7 n N6 z ZZ y Y Y x XX w WW v VV u UU t TT s SS "
    "r RR q QQ p PP o OO n NN m MM l LL k KK j JJ i II h HH g GG f FF e EE "
    "d DD c CC b BB a AA"
)


class TestDetectOcrLeaks:
    def test_finds_phonetic_alphabet_leak(self) -> None:
        body = "Some intro prose.\n\n" + IFH_PHONETIC_LEAK + "\n\nMore prose."
        spans = detect_ocr_leaks(body)
        assert len(spans) == 1
        assert len(spans[0].tokens) >= MIN_LEAK_RUN
        # Distinct alpha letters dominate.
        distinct = {t.lower() for t in spans[0].tokens}
        assert len(distinct) >= 4

    def test_does_not_fire_on_short_run(self) -> None:
        # 7 consecutive short tokens is below the threshold.
        body = "a b c d e f g real prose continues from here onward without a leak."
        spans = detect_ocr_leaks(body)
        assert spans == []

    def test_does_not_fire_on_single_letter_words_in_prose(self) -> None:
        body = (
            "I went to a place where I saw a thing. "
            "She told me a story. A long, true tale. "
            "I listened, riveted, as a tale unfolded around the campfire."
        )
        spans = detect_ocr_leaks(body)
        assert spans == []

    def test_does_not_fire_on_us_acronym(self) -> None:
        body = (
            "The U.S. Department of Transportation oversees the FAA. "
            "Per the U.S. Code, the rule applies. "
            "U.S. pilots must comply. U.S. operators are exempt. "
            "Non-U.S. operators face other rules. U.S. policy is clear."
        )
        spans = detect_ocr_leaks(body)
        assert spans == []

    def test_does_not_fire_on_section_codes(self) -> None:
        body = (
            "Section 1.1.2 covers basics. See 1.1.3, 1.1.4, 1.2.1, 2.1.1, "
            "and 3.4.5 for related material. Section 4.1.2 has more."
        )
        spans = detect_ocr_leaks(body)
        assert spans == []

    def test_does_not_fire_on_repeated_single_token(self) -> None:
        # 12 of the same token. Distinct-token guard rejects.
        body = "a a a a a a a a a a a a"
        spans = detect_ocr_leaks(body)
        assert spans == []

    def test_finds_two_separate_leaks(self) -> None:
        # Two leak runs in one body, separated by prose.
        body = (
            IFH_PHONETIC_LEAK
            + "\n\nA paragraph of substantive prose lives between the two leak runs.\n\n"
            + IFH_PHONETIC_LEAK
        )
        spans = detect_ocr_leaks(body)
        assert len(spans) == 2

    def test_pure_digit_run_does_not_qualify(self) -> None:
        # Coordinate / page-number-like sequence: 70%+ digits, alpha-ratio fails.
        body = "10 22 14 08 99 33 12 44 55 66 77 88"
        spans = detect_ocr_leaks(body)
        assert spans == []

    def test_offsets_point_at_run_in_body(self) -> None:
        prefix = "intro prose to set the stage.\n\n"
        body = prefix + IFH_PHONETIC_LEAK
        spans = detect_ocr_leaks(body)
        assert len(spans) == 1
        # The first leak token starts at the first character after the prefix.
        assert body[spans[0].start : spans[0].start + 1] == IFH_PHONETIC_LEAK[0]


class TestElideOcrLeaks:
    def test_removes_leak_and_emits_warning(self) -> None:
        body = "Real prose.\n\n" + IFH_PHONETIC_LEAK + "\n\nMore real prose."
        spans = detect_ocr_leaks(body)
        cleaned, warnings = elide_ocr_leaks(body, spans, section_code="2.5")
        assert "r R 0 q" not in cleaned
        assert "Real prose" in cleaned
        assert "More real prose" in cleaned
        assert len(warnings) == 1
        assert warnings[0].section_code == "2.5"
        # Forensic message carries up to 200 chars of the elided run.
        assert "r R 0 q" in warnings[0].message

    def test_message_truncated_at_200_chars(self) -> None:
        # Build a leak whose stringified form is > 200 chars (cycle alphabet
        # so the alpha-ratio + distinct-token guards both pass).
        alphabet = "abcdefghijklmnopqrstuvwxyz"
        long_run = " ".join([alphabet[i % 26] * (1 + i % 2) for i in range(140)])
        body = "intro\n\n" + long_run + "\n\noutro"
        spans = detect_ocr_leaks(body)
        assert spans, "long_run fixture should produce at least one leak span"
        cleaned, warnings = elide_ocr_leaks(body, spans, section_code="1.1")
        # The warning carries `Elided text (truncated): <head>` and the head
        # is capped at 200 chars.
        head = warnings[0].message.split("Elided text (truncated): ", 1)[1]
        assert len(head) <= 200

    def test_empty_spans_is_noop(self) -> None:
        body = "Untouched prose, no leak."
        cleaned, warnings = elide_ocr_leaks(body, [], section_code="1.1")
        assert cleaned == body
        assert warnings == []

    def test_multi_span_emits_in_document_order(self) -> None:
        body = (
            IFH_PHONETIC_LEAK
            + "\n\nProse separator.\n\n"
            + IFH_PHONETIC_LEAK
        )
        spans = detect_ocr_leaks(body)
        cleaned, warnings = elide_ocr_leaks(body, spans, section_code="3.1")
        assert len(warnings) == 2
        # Both warnings reference §3.1.
        for w in warnings:
            assert w.section_code == "3.1"
        # The first warning's message logically describes the first leak; the
        # truncated head is a prefix of the leak text, so both are equal here.
        assert "r R" in warnings[0].message

    def test_as_extra_warning_str_matches_normalize_prefix_match(self) -> None:
        w = OcrLeakWarning(section_code="2.5", message="hello")
        rendered = w.as_extra_warning_str()
        assert rendered.startswith("ocr-leak-in-section-body: ")


# --- Integration with normalize.write_outputs ---

def _config(slug: str = "synthetic") -> HandbookConfig:
    return HandbookConfig(
        document_slug=slug,
        edition="V1",
        title="Synthetic",
        publisher="FAA",
        kind="handbook",
        source_url="https://example.invalid/x.pdf",
        subjects=["aerodynamics"],
        primary_cert="private",
    )


def _fetch_result(tmp_path: Path) -> FetchResult:
    return FetchResult(
        path=tmp_path / "x.pdf",
        url="https://example.invalid/x.pdf",
        sha256="a" * 64,
        fetched_at="2026-05-04T00:00:00.000+00:00",
        size_bytes=1024,
    )


def _node() -> OutlineNode:
    return OutlineNode(
        level="chapter",
        code="2",
        title="Aeromedical Factors",
        page_start=1,
        page_end=10,
        ordinal=2,
    )


def _body_with_leak() -> SectionBody:
    body_md = "Real prose at the start.\n\n" + IFH_PHONETIC_LEAK + "\n\nMore prose at the tail."
    return SectionBody(
        node=_node(),
        body_md=body_md,
        faa_page_start="2-5",
        faa_page_end="2-5",
        char_count=len(body_md),
    )


@pytest.fixture
def isolate_repo(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    derivative = tmp_path / "handbooks" / "synthetic" / "V1"

    def _edition_root(_doc: str, _ed: str) -> Path:
        return derivative

    def _relative_to_repo(p: Path) -> str:
        try:
            return p.relative_to(tmp_path).as_posix()
        except ValueError:
            return p.as_posix()

    monkeypatch.setattr(normalize, "edition_root", _edition_root)
    monkeypatch.setattr(normalize, "relative_to_repo", _relative_to_repo)
    return derivative


class TestNormalizeWriteOutputsOcrLeak:
    def test_manifest_carries_ocr_leak_warning_with_section_code(
        self, isolate_repo: Path, tmp_path: Path
    ) -> None:
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(tmp_path),
            outline_nodes=[_node()],
            bodies=[_body_with_leak()],
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
        )
        manifest = json.loads((isolate_repo / "manifest.json").read_text(encoding="utf-8"))
        ocr_warnings = [w for w in manifest["warnings"] if w["code"] == "ocr-leak-in-section-body"]
        assert len(ocr_warnings) == 1
        assert ocr_warnings[0]["section_code"] == "2"

    def test_body_markdown_does_not_contain_leak_after_write(
        self, isolate_repo: Path, tmp_path: Path
    ) -> None:
        normalize.write_outputs(
            config=_config(),
            fetch_result=_fetch_result(tmp_path),
            outline_nodes=[_node()],
            bodies=[_body_with_leak()],
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
        )
        # Find the on-disk markdown file. Path conventions: chapter overview
        # under `<NN>-<chapter-slug>/00-<chapter-slug>.md`.
        found = list(isolate_repo.rglob("*.md"))
        assert len(found) == 1
        text = found[0].read_text(encoding="utf-8")
        assert "Real prose at the start." in text
        assert "More prose at the tail." in text
        # Leak run is gone.
        assert "r R 0 q Q9" not in text

    def test_disabled_via_yaml_flag_keeps_leak_text(
        self, isolate_repo: Path, tmp_path: Path
    ) -> None:
        from dataclasses import replace
        cfg = replace(_config(), ocr_leak_detection_enabled=False)
        normalize.write_outputs(
            config=cfg,
            fetch_result=_fetch_result(tmp_path),
            outline_nodes=[_node()],
            bodies=[_body_with_leak()],
            figures=[],
            figure_warnings=[],
            tables=[],
            table_warnings=[],
        )
        manifest = json.loads((isolate_repo / "manifest.json").read_text(encoding="utf-8"))
        assert not any(w["code"] == "ocr-leak-in-section-body" for w in manifest["warnings"])
        # Body retains leak when detection is disabled.
        found = list(isolate_repo.rglob("*.md"))
        text = found[0].read_text(encoding="utf-8")
        assert "r R 0 q" in text
