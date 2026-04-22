# Thalassemia — hybrid reasoning for emergency medicine

Educational full-stack prototype: **React** frontend, **Python (FastAPI)** backend, **hybrid reasoning** (rule layer aligned to WHO-linked references + evidence from a **streaming Hugging Face** dataset), focused on **thalassemia** and acute presentations.

> **Not medical advice.** For research, teaching, and engineering demos only.

## Stack

- **Frontend:** Vite + React + TypeScript (`frontend/`)
- **Backend:** FastAPI (`backend/`)
- **Data:** Default HF dataset `pubmed_qa` / `pqa_labeled` (streaming), rows filtered by thalassemia-related keywords (`backend/config.py`)

## Quick start

### Backend

On Windows, if `python` is not on your PATH, use the `py` launcher (`py -3`).

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Optional: set `HF_TOKEN` in the environment for higher Hugging Face Hub rate limits ([token docs](https://huggingface.co/docs/huggingface_hub/quick-start#authentication)).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. API calls are proxied to `http://127.0.0.1:8000`.

## WHO PDFs

Official WHO PDFs are not bundled. Use **Guidelines** in the app or `docs/WHO_PDF_GUIDE.md` to link downloads and optional local `backend/data/pdfs/` storage.

## Configuration

Copy `backend/.env.example` to `backend/.env` and adjust `HF_DATASET_ID`, `HF_DATASET_CONFIG`, `HF_DATASET_SPLIT`, or `GUIDELINE_KEYWORDS` if needed.
