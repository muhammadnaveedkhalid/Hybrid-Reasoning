from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import settings
from reasoning.hybrid_engine import reason
from services.hf_stream import next_evidence_batch

app = FastAPI(
    title="Thalassemia — Hybrid Reasoning (Emergency Medicine)",
    description="Rule layer + Hugging Face evidence stream. Educational prototype.",
    version="0.1.0",
)

allowed_origins = [url.strip() for url in settings.frontend_urls.split(",") if url.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_GUIDELINES_PATH = Path(__file__).resolve().parent / "data" / "guidelines.json"


class ReasonRequest(BaseModel):
    clinical_notes: str = Field(..., min_length=3, max_length=8000)
    evidence_k: int = Field(3, ge=1, le=10)


@app.get("/api/health")
def health():
    return {"status": "ok", "hf_dataset": settings.hf_dataset_id}


@app.get("/api/guidelines")
def guidelines():
    if not _GUIDELINES_PATH.is_file():
        raise HTTPException(status_code=500, detail="guidelines.json missing")
    with _GUIDELINES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/dataset/next")
def dataset_next(n: int = 5, max_scan: int = 1200):
    try:
        return {"items": next_evidence_batch(n=n, max_scan=max_scan)}
    except Exception as exc:  # noqa: BLE001 — surface HF/network errors clearly
        raise HTTPException(status_code=502, detail=f"Hugging Face dataset error: {exc}") from exc


@app.post("/api/reason")
def reason_endpoint(body: ReasonRequest):
    try:
        return reason(body.clinical_notes, evidence_k=body.evidence_k)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Reasoning pipeline error: {exc}") from exc
