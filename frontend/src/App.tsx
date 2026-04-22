import { useCallback, useEffect, useState } from "react";
import "./App.css";

type WhoLink = { title: string; url: string };
type StructuredRule = {
  id: string;
  category: string;
  summary: string;
  signals: string[];
  action: string;
};
type Guidelines = {
  topic: string;
  disclaimer: string;
  who_pdf_links: WhoLink[];
  structured_rules: StructuredRule[];
};

type EvidenceItem = {
  keyword_hits: string[];
  preview: {
    question?: string;
    context_excerpt?: string;
    long_answer_excerpt?: string;
  };
};

type ReasonResponse = {
  hybrid_score: number;
  rule_strength: number;
  evidence_strength: number;
  matched_rules: (StructuredRule & { rule_match_score?: number })[];
  evidence: EvidenceItem[];
  narrative: string;
  disclaimer: string;
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export default function App() {
  const [guidelines, setGuidelines] = useState<Guidelines | null>(null);
  const [notes, setNotes] = useState(
    "Transfusion-dependent thalassemia, fever 39°C, tachycardia, patient reports missed deferasirox for 2 weeks.",
  );
  const [reason, setReason] = useState<ReasonResponse | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<Guidelines>("/api/guidelines")
      .then(setGuidelines)
      .catch((e: Error) => setError(e.message));
  }, []);

  const runReason = useCallback(async () => {
    setError(null);
    setLoading("reason");
    try {
      const out = await fetchJson<ReasonResponse>("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinical_notes: notes, evidence_k: 4 }),
      });
      setReason(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }, [notes]);

  const loadDataset = useCallback(async () => {
    setError(null);
    setLoading("dataset");
    try {
      const out = await fetchJson<{ items: EvidenceItem[] }>("/api/dataset/next?n=6&max_scan=1500");
      setEvidence(out.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }, []);

  return (
    <div className="shell">
      <header className="hero">
        <p className="eyebrow">Emergency medicine · knowledge + retrieval</p>
        <h1>Thalassemia hybrid reasoning</h1>
        <p className="lede">
          Rule layer (WHO-linked references and red-flag cards) combined with live rows from a Hugging Face
          dataset stream (default: PubMedQA). Educational prototype only.
        </p>
      </header>

      {error ? <div className="banner error">{error}</div> : null}

      <section className="grid">
        <div className="card span-2">
          <div className="card-head">
            <h2>Clinical notes</h2>
            <button type="button" className="btn primary" onClick={runReason} disabled={loading !== null}>
              {loading === "reason" ? "Running…" : "Run hybrid reasoning"}
            </button>
          </div>
          <textarea
            className="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            spellCheck={false}
          />
          {reason ? (
            <div className="reason-out">
              <div className="scores">
                <div>
                  <span className="label">Hybrid score</span>
                  <span className="value">{reason.hybrid_score}</span>
                </div>
                <div>
                  <span className="label">Rule strength</span>
                  <span className="value">{reason.rule_strength}</span>
                </div>
                <div>
                  <span className="label">Evidence strength</span>
                  <span className="value">{reason.evidence_strength}</span>
                </div>
              </div>
              <p className="narrative">{reason.narrative}</p>
              <p className="disclaimer">{reason.disclaimer}</p>
              {reason.matched_rules.length ? (
                <ul className="rules">
                  {reason.matched_rules.map((r) => (
                    <li key={r.id}>
                      <strong>{r.id}</strong> — {r.category}
                      <div className="muted">{r.action}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Hugging Face stream</h2>
            <button type="button" className="btn" onClick={loadDataset} disabled={loading !== null}>
              {loading === "dataset" ? "Fetching…" : "Next batch"}
            </button>
          </div>
          <p className="muted small">
            PubMedQA rows matching thalassemia-related keywords (streaming scan capped per request).
          </p>
          <ul className="evidence">
            {evidence.map((it, i) => (
              <li key={i}>
                <div className="tags">
                  {it.keyword_hits.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="q">{it.preview.question}</div>
                <pre className="ex">{it.preview.context_excerpt || it.preview.long_answer_excerpt}</pre>
              </li>
            ))}
          </ul>
          {!evidence.length ? <p className="muted small">Press “Next batch” to pull evidence.</p> : null}
        </div>

        <div className="card span-3">
          <h2>WHO guidelines and PDFs</h2>
          <p className="muted">
            Official PDFs are not shipped with this repo. Open WHO sources below or place licensed copies under{" "}
            <code>backend/data/pdfs/</code> per your governance process.
          </p>
          {guidelines ? (
            <div className="guidelines">
              <div>
                <h3>Structured rule layer</h3>
                <ul className="rules compact">
                  {guidelines.structured_rules.map((r) => (
                    <li key={r.id}>
                      <strong>{r.id}</strong> {r.summary}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>WHO links</h3>
                <ul className="links">
                  {guidelines.who_pdf_links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="muted">Loading guidelines…</p>
          )}
        </div>
      </section>

      <footer className="footer muted small">
        Hybrid reasoning framework for emergency medicine — thalassemia focus. Not for clinical decision-making.
      </footer>
    </div>
  );
}
