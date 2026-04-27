"""Section extraction via Claude (Option 4).

Determinism contract: the prompt is committed (`prompts/section_tree.md`),
the model is pinned (`MODEL`), `temperature=0`, and the raw JSON response is
saved per-chapter to `_llm_section_tree.json` so PR review surfaces every
change. The SHA-256 of the prompt is recorded in `manifest.json`. Re-runs
of the same prompt against the same input produce ~identical results
within model bounds; differences should surface as a `git diff` on the
saved JSON.

Pipeline shape (per chapter):

1. Read the chapter plaintext (already extracted by Phase 7's `sections.py`).
2. Inject `(title, plaintext)` into the committed prompt template.
3. POST to the Anthropic API with the pinned model + temperature.
4. Parse the strict-JSON response.
5. Save raw response to
   `handbooks/<doc>/<edition>/<chapter>/_llm_section_tree.json`.
6. Convert response objects into `SectionTreeNode` records keyed off
   `chapter_ordinal`. Sort by `(line_offset, level)` so output is stable.

`ANTHROPIC_API_KEY` is required. Missing or empty key -> `LlmKeyMissingError`.

Optional dependency: `anthropic` SDK if installed (extras = `llm`); we fall
back to raw `urllib` requests so the tool runs without the SDK in CI.
"""

from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .config_loader import HandbookConfig
from .outline import OutlineNode
from .paths import edition_root, ensure_dir
from .section_tree import STRATEGY_LLM, SectionTreeNode

# Pinned model + decoding parameters. Bumping these is a deliberate edit
# (PR-visible diff in the saved `_llm_section_tree.json` files).
MODEL = "claude-sonnet-4-5"
"""Pinned Claude model for section-tree extraction. claude-sonnet-4-5 is the
right balance for ~17 chapter calls per handbook (cheap enough; smart
enough for FAA prose). Bump deliberately and regenerate trees in the same
commit."""

TEMPERATURE = 0.0
"""Zero-temperature decoding for reproducibility within the model's bounds."""

MAX_TOKENS = 4096
"""Output cap. PHAK's longest chapter section list fits comfortably."""

ANTHROPIC_API_VERSION = "2023-06-01"
"""Pinned API version header. Bump deliberately."""

ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"


class LlmKeyMissingError(RuntimeError):
    """`ANTHROPIC_API_KEY` is missing or empty."""


class LlmResponseError(RuntimeError):
    """The Claude API call failed or returned malformed JSON."""


@dataclass(frozen=True)
class LlmConfig:
    """Subset of `phak.yaml -> llm` consumed by this module."""

    chapter_text_max_chars: int = 60000
    """Per-chapter input cap. ~60K chars * (1 token / 4 chars) ~= 15K tokens."""

    @classmethod
    def from_raw(cls, raw: dict[str, object] | None) -> LlmConfig:
        raw = raw or {}
        return cls(
            chapter_text_max_chars=int(raw.get("chapter_text_max_chars", 60000)),
        )


@dataclass
class LlmExtractionResult:
    """What `extract_via_llm` returns to callers."""

    nodes: list[SectionTreeNode]
    warnings: list[str] = field(default_factory=list)
    prompt_sha256: str = ""
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class _ChapterInput:
    chapter_ordinal: int
    title: str
    plaintext: str


def extract_via_llm(
    config: HandbookConfig,
    chapters: list[OutlineNode],
    chapter_bodies: dict[int, str],
    *,
    raw_yaml: dict[str, object] | None = None,
    api_caller: ClaudeCaller | None = None,
    write_response_files: bool = True,
) -> LlmExtractionResult:
    """Hand each chapter's plaintext to Claude and emit a section tree.

    `chapter_bodies` maps chapter ordinal -> already-extracted plaintext. The
    caller is responsible for producing this (typically by running the
    existing `sections.extract_sections` against the chapter-level outline).

    `api_caller` is injected for tests so unit tests don't make real API
    calls. Production callers leave it `None` and we instantiate the default.
    """
    if raw_yaml is None:
        raw_yaml = {}
    llm_cfg = LlmConfig.from_raw(raw_yaml.get("llm"))  # type: ignore[arg-type]
    prompt_template = _read_prompt_template()
    prompt_sha256 = hashlib.sha256(prompt_template.encode("utf-8")).hexdigest()

    if api_caller is None:
        api_caller = ClaudeCaller.from_env()

    inputs: list[_ChapterInput] = []
    for ch in chapters:
        if ch.level != "chapter":
            continue
        body = chapter_bodies.get(ch.ordinal)
        if not body:
            continue
        inputs.append(_ChapterInput(chapter_ordinal=ch.ordinal, title=ch.title, plaintext=body))

    nodes: list[SectionTreeNode] = []
    warnings: list[str] = []
    total_in = 0
    total_out = 0

    for inp in inputs:
        chapter_text = inp.plaintext[: llm_cfg.chapter_text_max_chars]
        prompt = prompt_template.format(title=inp.title, plaintext=chapter_text)
        try:
            response, usage_in, usage_out = api_caller.call(prompt)
            total_in += usage_in
            total_out += usage_out
        except LlmResponseError as exc:
            warnings.append(f"llm: chapter {inp.chapter_ordinal}: api call failed: {exc}")
            continue

        if write_response_files:
            _write_response_file(config, inp.chapter_ordinal, response)

        try:
            parsed = _parse_response_json(response)
        except LlmResponseError as exc:
            warnings.append(f"llm: chapter {inp.chapter_ordinal}: malformed response: {exc}")
            continue

        chapter_nodes = _entries_to_nodes(parsed, inp.chapter_ordinal)
        if not chapter_nodes:
            warnings.append(f"llm: chapter {inp.chapter_ordinal}: model returned zero entries")
        nodes.extend(chapter_nodes)

    return LlmExtractionResult(
        nodes=nodes,
        warnings=warnings,
        prompt_sha256=prompt_sha256,
        input_tokens=total_in,
        output_tokens=total_out,
    )


def _read_prompt_template() -> str:
    """Return the committed prompt's text; raise on missing file."""
    here = Path(__file__).resolve().parent
    path = here / "prompts" / "section_tree.md"
    if not path.is_file():
        raise FileNotFoundError(
            f"LLM section-tree prompt missing at {path}. "
            "Restore from git or author per prompts/README.md."
        )
    return path.read_text(encoding="utf-8")


def _write_response_file(config: HandbookConfig, chapter_ordinal: int, response_text: str) -> None:
    """Save raw model output for review + audit."""
    chapter_dir = ensure_dir(edition_root(config.document_slug, config.edition) / f"{chapter_ordinal:02d}")
    target = chapter_dir / "_llm_section_tree.json"
    target.write_text(response_text.rstrip() + "\n", encoding="utf-8")


def _parse_response_json(response_text: str) -> list[dict[str, Any]]:
    """Strip optional markdown fencing + parse strict JSON."""
    cleaned = response_text.strip()
    # The committed prompt forbids markdown fencing, but we strip it
    # defensively so an off-prompt response doesn't kill the run.
    if cleaned.startswith("```"):
        first_nl = cleaned.find("\n")
        cleaned = cleaned[first_nl + 1 :] if first_nl > 0 else cleaned
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    if not cleaned:
        raise LlmResponseError("empty response from model")
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise LlmResponseError(f"json parse failed: {exc}") from exc
    if not isinstance(parsed, list):
        raise LlmResponseError(f"expected JSON array, got {type(parsed).__name__}")
    for entry in parsed:
        if not isinstance(entry, dict):
            raise LlmResponseError(f"every entry must be an object, got {type(entry).__name__}")
    return parsed


def _entries_to_nodes(entries: list[dict[str, Any]], chapter_ordinal: int) -> list[SectionTreeNode]:
    """Convert parsed model entries into `SectionTreeNode` records.

    Skips entries with missing/invalid `title` or `level`. Sorts by
    `(line_offset, level)` so the output is deterministic.
    """
    rows: list[tuple[int, int, SectionTreeNode]] = []
    for entry in entries:
        title_raw = entry.get("title")
        if not isinstance(title_raw, str):
            continue
        title = title_raw.strip()
        if not title:
            continue
        level_raw = entry.get("level")
        if not isinstance(level_raw, int) or level_raw < 1 or level_raw > 3:
            continue
        # The DB schema is chapter / section / subsection (3 levels of dotted
        # codes). The prompt allows L1..L3 from the model's perspective, but
        # we clamp L3 to L2 here so the emitted nodes match the storage shape
        # and stay consistent with the TOC strategy's clamp.
        if level_raw == 3:
            level_raw = 2
        page_anchor_raw = entry.get("page_anchor")
        page_anchor = (
            page_anchor_raw if isinstance(page_anchor_raw, str) and page_anchor_raw.strip() else None
        )
        line_offset_raw = entry.get("line_offset", 0)
        line_offset = int(line_offset_raw) if isinstance(line_offset_raw, int) else 0
        parent_title_raw = entry.get("parent_title")
        parent_title = (
            parent_title_raw.strip()
            if isinstance(parent_title_raw, str) and parent_title_raw.strip()
            else None
        )
        node = SectionTreeNode(
            chapter_ordinal=chapter_ordinal,
            level=level_raw,
            title=title,
            parent_title=parent_title,
            page_anchor=page_anchor,
            provenance=STRATEGY_LLM,
            confidence=1.0,
            extra={"line_offset": str(line_offset)},
        )
        rows.append((line_offset, level_raw, node))
    rows.sort(key=lambda r: (r[0], r[1]))
    return [r[2] for r in rows]


# ---------------------------------------------------------------------------
# Claude API caller -- raw urllib so the tool runs without the SDK installed.
# ---------------------------------------------------------------------------


@dataclass
class ClaudeCaller:
    """Thin wrapper around the Anthropic Messages API.

    Default implementation uses raw `urllib`. Tests pass a fake by
    monkey-patching the `call` method or by subclassing. The `anthropic`
    SDK is intentionally not required.
    """

    api_key: str
    model: str = MODEL
    temperature: float = TEMPERATURE
    max_tokens: int = MAX_TOKENS

    @classmethod
    def from_env(cls) -> ClaudeCaller:
        key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        if not key:
            raise LlmKeyMissingError(
                "ANTHROPIC_API_KEY env var is missing or empty. "
                "Export it or run the pipeline with --strategy toc instead."
            )
        return cls(api_key=key)

    def call(self, prompt: str) -> tuple[str, int, int]:
        """Send `prompt` to Claude. Return `(text, input_tokens, output_tokens)`."""
        body = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        request = urllib.request.Request(
            ANTHROPIC_MESSAGES_URL,
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={
                "content-type": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": ANTHROPIC_API_VERSION,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise LlmResponseError(f"HTTP {exc.code}: {detail[:500]}") from exc
        except urllib.error.URLError as exc:
            raise LlmResponseError(f"network error: {exc}") from exc

        content_blocks = payload.get("content") or []
        text_chunks = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
        if not text_chunks:
            raise LlmResponseError(f"response missing text content: {payload}")
        usage = payload.get("usage", {}) or {}
        return ("".join(text_chunks), int(usage.get("input_tokens", 0)), int(usage.get("output_tokens", 0)))
