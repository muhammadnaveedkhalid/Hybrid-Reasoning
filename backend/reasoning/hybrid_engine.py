"""Hybrid reasoning: rule layer (WHO-linked cards) + evidence layer (HF stream snippets)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from services.hf_stream import next_evidence_batch

_DATA = Path(__file__).resolve().parent.parent / "data" / "guidelines.json"


def _load_guidelines() -> dict[str, Any]:
    with _DATA.open(encoding="utf-8") as f:
        return json.load(f)


def _match_rules(clinical_text: str) -> list[dict[str, Any]]:
    text = clinical_text.lower()
    gl = _load_guidelines()
    matched: list[dict[str, Any]] = []
    for rule in gl.get("structured_rules", []):
        score = 0
        for sig in rule.get("signals", []):
            if isinstance(sig, str) and sig.lower() in text:
                score += 1
        if score:
            matched.append({**rule, "rule_match_score": score})
    matched.sort(key=lambda r: r.get("rule_match_score", 0), reverse=True)
    return matched


def reason(clinical_notes: str, evidence_k: int = 3) -> dict[str, Any]:
    """
    Combine structured emergency rules with retrieved PubMedQA-style evidence rows.
    """
    guidelines = _load_guidelines()
    rules = _match_rules(clinical_notes)
    evidence = next_evidence_batch(n=evidence_k, max_scan=1200)

    rule_strength = min(1.0, sum(r.get("rule_match_score", 0) for r in rules) / 4.0) if rules else 0.0
    evidence_strength = min(1.0, len(evidence) / max(evidence_k, 1))

    hybrid_score = round(0.55 * rule_strength + 0.45 * evidence_strength, 3)

    narrative_parts: list[str] = []
    if rules:
        top = rules[0]
        narrative_parts.append(
            f"Rule layer: strongest match '{top.get('id')}' ({top.get('category')}) — {top.get('summary')}"
        )
    else:
        narrative_parts.append(
            "Rule layer: no keyword overlap with built-in red-flag signals; refine clinical keywords."
        )
    if evidence:
        narrative_parts.append(
            f"Evidence layer: {len(evidence)} PubMedQA-derived row(s) matched thalassemia-related keywords."
        )
    else:
        narrative_parts.append(
            "Evidence layer: no keyword-matched rows in this scan window (try again or widen dataset keywords in config)."
        )

    return {
        "hybrid_score": hybrid_score,
        "rule_strength": rule_strength,
        "evidence_strength": evidence_strength,
        "matched_rules": rules,
        "evidence": evidence,
        "narrative": " ".join(narrative_parts),
        "disclaimer": guidelines.get("disclaimer", ""),
    }
