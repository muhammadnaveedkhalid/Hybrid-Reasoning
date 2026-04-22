"""Stream rows from a Hugging Face dataset and filter by thalassemia-related keywords."""

from __future__ import annotations

import itertools
from typing import Any, Iterator

from datasets import load_dataset

from config import settings


def _flatten_context(val: Any) -> str:
    if isinstance(val, str) and val.strip():
        return val
    if isinstance(val, dict):
        chunks: list[str] = []
        for sub in ("contexts", "labels", "meshes"):
            inner = val.get(sub)
            if isinstance(inner, str):
                chunks.append(inner)
            elif isinstance(inner, list):
                chunks.extend(str(x) for x in inner if x)
        return " ".join(chunks)
    if isinstance(val, list):
        return " ".join(_flatten_context(x) for x in val)
    return ""


def _row_text(row: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("QUESTION", "question"):
        val = row.get(key)
        if isinstance(val, str) and val.strip():
            parts.append(val)
    ctx = row.get("CONTEXT", row.get("context"))
    flat_ctx = _flatten_context(ctx)
    if flat_ctx:
        parts.append(flat_ctx)
    for key in ("LONG_ANSWER", "long_answer", "final_decision", "FINAL_DECISION"):
        val = row.get(key)
        if isinstance(val, str) and val.strip():
            parts.append(val)
    if not parts:
        parts.append(str(row)[:2000])
    return " ".join(parts).lower()


def _keyword_hits(text: str) -> list[str]:
    hits: list[str] = []
    for kw in settings.guideline_keywords.split(","):
        k = kw.strip().lower()
        if k and k in text:
            hits.append(kw.strip())
    return hits


def stream_filtered_rows(max_scan: int = 500) -> Iterator[dict[str, Any]]:
    """
    Lazily scan the configured HF split and yield rows that match topic keywords.
    max_scan caps how many underlying rows we read per iterator (keeps latency bounded).
    """
    ds = load_dataset(
        settings.hf_dataset_id,
        settings.hf_dataset_config,
        split=settings.hf_dataset_split,
        streaming=True,
    )
    scanned = 0
    for row in ds:
        if scanned >= max_scan:
            break
        scanned += 1
        text = _row_text(row)
        hits = _keyword_hits(text)
        if not hits:
            continue
        ctx_raw = row.get("CONTEXT") or row.get("context")
        ctx_flat = _flatten_context(ctx_raw)
        yield {
            "source": "huggingface",
            "dataset_id": settings.hf_dataset_id,
            "config": settings.hf_dataset_config,
            "keyword_hits": hits,
            "preview": {
                "question": row.get("QUESTION") or row.get("question"),
                "context_excerpt": ctx_flat[:400],
                "long_answer_excerpt": (row.get("LONG_ANSWER") or row.get("long_answer") or "")[:400],
            },
        }


def next_evidence_batch(n: int = 5, max_scan: int = 800) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in itertools.islice(stream_filtered_rows(max_scan=max_scan), n):
        out.append(item)
    return out
