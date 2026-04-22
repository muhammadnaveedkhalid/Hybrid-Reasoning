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

type HealthResponse = {
  status: string;
  hf_dataset: string;
};

const CASE_TEMPLATES: string[] = [
  "Transfusion-dependent thalassemia, fever 39°C, tachycardia, patient reports missed deferasirox for 2 weeks.",
  "Known beta-thalassemia major with chest pain, dyspnea at rest, severe pallor, and near syncope in emergency triage.",
  "Post-splenectomy thalassemia patient with fever, hypotension, and confusion. Concern for severe infection pathway.",
];

const ABSTRACT_HIGHLIGHTS: string[] = [
  "AHP-TOPSIS + XGBoost pipeline reported high diagnostic classification accuracy in a Bangladesh maternal cohort.",
  "Framework emphasizes explainability via SHAP and LIME to improve clinician trust and transparency.",
  "Study frames the model as an assistive diagnostic classifier, not a causal predictor, requiring external validation.",
];

const ABSTRACT_SNIPPET =
  "Background: Thalassemia has been recognized as a critical public health issue in Bangladesh, especially among pregnant women… " +
  "Methods: MCDM (AHP-TOPSIS) integrated with Random Forest, XGBoost, and CatBoost, plus SHAP/LIME for explainability… " +
  "Results: XGBoost on AHP–TOPSIS–prioritized features reached ~99.28% accuracy under stratified cross-validation (proof-of-concept).";

function buildReport(notes: string, reason: ReasonResponse | null): string {
  const lines: string[] = [
    "Thalassemia — Hybrid reasoning summary (educational prototype)",
    "────────────────────────────────────────",
    "",
    "Clinical notes:",
    notes.trim() || "(empty)",
    "",
  ];
  if (!reason) {
    lines.push("No reasoning output yet. Run hybrid reasoning in the app.");
    return lines.join("\n");
  }
  lines.push(
    `Hybrid score: ${reason.hybrid_score}`,
    `Rule strength: ${reason.rule_strength}`,
    `Evidence strength: ${reason.evidence_strength}`,
    "",
    "Narrative:",
    reason.narrative,
    "",
    "Disclaimer:",
    reason.disclaimer,
    "",
  );
  if (reason.matched_rules.length) {
    lines.push("Matched rules:");
    for (const r of reason.matched_rules) {
      lines.push(`- ${r.id} (${r.category}): ${r.action}`);
    }
    lines.push("");
  }
  if (reason.evidence.length) {
    lines.push("Evidence snippets (PubMedQA stream):");
    reason.evidence.forEach((ev, i) => {
      const q = ev.preview.question ?? "";
      lines.push(`${i + 1}. [${ev.keyword_hits.join(", ")}] ${q}`);
    });
  }
  return lines.join("\n");
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";
  const healthHref = apiBase ? `${apiBase}/api/health` : "/api/health";
  const guidelinesHref = apiBase ? `${apiBase}/api/guidelines` : "/api/guidelines";

  const [guidelines, setGuidelines] = useState<Guidelines | null>(null);
  const [notes, setNotes] = useState(CASE_TEMPLATES[0]);
  const [reason, setReason] = useState<ReasonResponse | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<Guidelines>("/api/guidelines").then(setGuidelines).catch((e: Error) => setError(e.message));
    fetchJson<HealthResponse>("/api/health").then(setApiHealth).catch(() => setApiHealth(null));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

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
      setToast("Reasoning complete");
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
      setToast(out.items.length ? `Loaded ${out.items.length} evidence rows` : "No matches in this scan");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }, []);

  const copyReport = useCallback(async () => {
    const text = buildReport(notes, reason);
    try {
      await navigator.clipboard.writeText(text);
      setToast(reason ? "Summary copied to clipboard" : "Copied template (run reasoning for full report)");
    } catch {
      setToast("Could not copy — try selecting text manually");
    }
  }, [notes, reason]);

  const charCount = notes.length;
  const isReasoning = loading === "reason";

  return (
    <div className="app">
      {toast ? <div className="toast" role="status">{toast}</div> : null}

      <div className="shell">
        <nav className="topnav" aria-label="Primary">
          <a className="brand" href="#top">
            <span className="brand-mark" aria-hidden>
              ⧗
            </span>
            <span className="brand-text">
              <span className="brand-title">Hybrid reasoning</span>
              <span className="brand-sub">Thalassemia · emergency</span>
            </span>
          </a>
          <div className="nav-links">
            <a href="#clinical">Workspace</a>
            <a href="#evidence">Evidence</a>
            <a href="#research">Research</a>
            <a href="#guidelines">WHO & rules</a>
          </div>
        </nav>

        <header className="hero" id="top">
          <div className="hero-main">
            <p className="eyebrow">Emergency medicine · knowledge + retrieval</p>
            <h1>Thalassemia hybrid reasoning</h1>
            <p className="lede">
              Rule layer (WHO-linked references and red-flag cards) combined with live rows from a Hugging Face dataset
              stream (default: PubMedQA). Educational prototype only — not for clinical decisions.
            </p>
            <div className="status-row">
              <span className={`chip ${apiHealth ? "ok" : "warn"}`}>
                {apiHealth ? "API connected" : "API not connected"}
              </span>
              <span className="chip">HF: {apiHealth?.hf_dataset ?? "—"}</span>
              <span className="chip">Rules + retrieval fusion</span>
            </div>
          </div>
          <aside className="hero-aside" aria-label="How it works">
            <div className="pipeline">
              <p className="pipeline-title">Processing pipeline</p>
              <div className="pipeline-steps">
                <div className="pipeline-step">
                  <span className="pipeline-num">1</span>
                  <div>
                    <strong>Rule &amp; guideline layer</strong>
                    <span>Structured red flags and WHO-linked references score against your clinical text.</span>
                  </div>
                </div>
                <div className="pipeline-step">
                  <span className="pipeline-num">2</span>
                  <div>
                    <strong>Literature evidence stream</strong>
                    <span>PubMedQA rows are streamed and filtered by thalassemia-related keywords.</span>
                  </div>
                </div>
                <div className="pipeline-step">
                  <span className="pipeline-num">3</span>
                  <div>
                    <strong>Hybrid fusion</strong>
                    <span>Scores combine into a narrative summary plus matched rules for triage-style review.</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mini-stats" aria-live="polite">
              <div className="mini-stat">
                <b>{reason != null ? reason.hybrid_score.toFixed(2) : "—"}</b>
                <span>Hybrid</span>
              </div>
              <div className="mini-stat">
                <b>{reason != null ? String(reason.matched_rules.length) : "—"}</b>
                <span>Rules</span>
              </div>
              <div className="mini-stat">
                <b>{evidence.length}</b>
                <span>Evidence</span>
              </div>
            </div>
          </aside>
        </header>

        {error ? <div className="banner error">{error}</div> : null}

        <section className="grid">
          <div className="card span-2" id="clinical">
            <p className="section-label">Triage workspace</p>
            <div className="card-head">
              <div>
                <h2>
                  <span className="card-icon" aria-hidden>
                    📝
                  </span>
                  Clinical notes
                </h2>
                <p className="card-sub">Paste ED presentation, vitals, history, and concerns. Then run the hybrid engine.</p>
              </div>
              <div className="head-actions">
                <button type="button" className="btn sm" onClick={copyReport}>
                  Copy report
                </button>
                <button type="button" className="btn primary" onClick={runReason} disabled={loading !== null}>
                  {isReasoning ? "Running…" : "Run hybrid reasoning"}
                </button>
              </div>
            </div>
            <div className="notes-wrap">
              <div className="notes-meta">
                <span>Free text</span>
                <span>{charCount} characters</span>
              </div>
              <textarea
                className="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={7}
                spellCheck={false}
                placeholder="e.g. TDT, fever, chelation gap, chest pain…"
              />
            </div>
            <div className="templates">
              {CASE_TEMPLATES.map((template, index) => (
                <button key={template} type="button" className="btn ghost" onClick={() => setNotes(template)}>
                  Sample case {index + 1}
                </button>
              ))}
              <button type="button" className="btn ghost" onClick={() => setNotes("")}>
                Clear
              </button>
            </div>
            {reason || isReasoning ? (
              <div className="reason-out">
                <div className="scores">
                  <div className="score-tile">
                    <span className="label">Hybrid score</span>
                    <span className="value">{isReasoning ? "…" : reason?.hybrid_score}</span>
                  </div>
                  <div className="score-tile">
                    <span className="label">Rule strength</span>
                    <span className="value">{isReasoning ? "…" : reason?.rule_strength}</span>
                  </div>
                  <div className="score-tile">
                    <span className="label">Evidence strength</span>
                    <span className="value">{isReasoning ? "…" : reason?.evidence_strength}</span>
                  </div>
                </div>
                <div className="meters">
                  <div>
                    <span className="label">Hybrid confidence</span>
                    <div className="meter-track">
                      <div
                        className={`meter-fill ${isReasoning ? "shimmer" : ""}`}
                        style={{
                          width: isReasoning ? "40%" : `${Math.round((reason?.hybrid_score ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="label">Rule signal</span>
                    <div className="meter-track">
                      <div
                        className={`meter-fill rule ${isReasoning ? "shimmer" : ""}`}
                        style={{
                          width: isReasoning ? "35%" : `${Math.round((reason?.rule_strength ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="label">Evidence signal</span>
                    <div className="meter-track">
                      <div
                        className={`meter-fill evidence ${isReasoning ? "shimmer" : ""}`}
                        style={{
                          width: isReasoning ? "30%" : `${Math.round((reason?.evidence_strength ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                {!isReasoning && reason ? (
                  <>
                    <p className="narrative">{reason.narrative}</p>
                    <p className="disclaimer">{reason.disclaimer}</p>
                    {reason.matched_rules.length ? (
                      <div className="rule-cards">
                        {reason.matched_rules.map((r) => (
                          <article key={r.id} className="rule-card">
                            <div className="rule-card-top">
                              <span className="rule-id">{r.id}</span>
                              {typeof r.rule_match_score === "number" ? (
                                <span className="rule-badge">Match ×{r.rule_match_score}</span>
                              ) : null}
                            </div>
                            <h4>{r.category}</h4>
                            <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
                              {r.summary}
                            </p>
                            <p className="action">{r.action}</p>
                            {r.signals?.length ? (
                              <div className="signals">
                                {r.signals.map((s) => (
                                  <span key={s} className="signal">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <p className="muted small" style={{ marginTop: "1rem" }}>
                Run hybrid reasoning to see fused scores, narrative, and matched emergency rules.
              </p>
            )}
          </div>

          <div className="card" id="evidence">
            <p className="section-label">Retrieval</p>
            <div className="card-head">
              <div>
                <h2>
                  <span className="card-icon" aria-hidden>
                    ⚡
                  </span>
                  Hugging Face stream
                </h2>
                <p className="card-sub">Keyword-filtered PubMedQA rows (bounded scan per request).</p>
              </div>
              <button type="button" className="btn" onClick={loadDataset} disabled={loading !== null}>
                {loading === "dataset" ? "Fetching…" : "Next batch"}
              </button>
            </div>
            <ul className="evidence">
              {evidence.map((it, i) => (
                <li key={`${it.preview.question ?? ""}-${i}`}>
                  <div className="ev-head">
                    <div className="tags">
                      {it.keyword_hits.map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="ev-num">#{i + 1}</span>
                  </div>
                  <div className="q">{it.preview.question ?? "(No question field)"}</div>
                  <pre className="ex">{it.preview.context_excerpt || it.preview.long_answer_excerpt}</pre>
                </li>
              ))}
            </ul>
            {!evidence.length ? (
              <div className="empty-hint">Press “Next batch” to stream evidence from the configured dataset.</div>
            ) : null}
          </div>

          <div className="card" id="research">
            <p className="section-label">Publication context</p>
            <h2>
              <span className="card-icon" aria-hidden>
                📄
              </span>
              Research abstract
            </h2>
            <p className="card-sub">Highlights from your study abstract (PDF in repo docs).</p>
            <ul className="bullet-list">
              {ABSTRACT_HIGHLIGHTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="abstract-card">
              <p>{ABSTRACT_SNIPPET}</p>
            </div>
          </div>

          <div className="card span-3" id="guidelines">
            <p className="section-label">Knowledge base</p>
            <h2>
              <span className="card-icon" aria-hidden>
                🌍
              </span>
              WHO guidelines &amp; structured rules
            </h2>
            <p className="muted small" style={{ margin: "0 0 1rem" }}>
              Official WHO PDFs are not redistributed here. Use the links below or store licensed copies under{" "}
              <code>backend/data/pdfs/</code> per governance. Rule cards are editable in{" "}
              <code>backend/data/guidelines.json</code>.
            </p>
            {guidelines ? (
              <div className="guidelines">
                <div>
                  <h3>Structured rule layer</h3>
                  <div className="rule-cards">
                    {guidelines.structured_rules.map((r) => (
                      <article key={r.id} className="rule-card">
                        <div className="rule-card-top">
                          <span className="rule-id">{r.id}</span>
                        </div>
                        <h4>{r.category}</h4>
                        <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
                          {r.summary}
                        </p>
                        <p className="action">{r.action}</p>
                        {r.signals?.length ? (
                          <div className="signals">
                            {r.signals.map((s) => (
                              <span key={s} className="signal">
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>WHO resources</h3>
                  <div className="who-link-grid">
                    {guidelines.who_pdf_links.map((l) => (
                      <a key={l.url} className="who-link-card" href={l.url} target="_blank" rel="noreferrer">
                        <div>
                          <strong>{l.title}</strong>
                          <span>Open on who.int / IRIS</span>
                        </div>
                        <span className="arrow" aria-hidden>
                          ↗
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted">Loading guidelines…</p>
            )}
          </div>
        </section>

        <footer className="footer muted small">
          <div className="footer-col">
            <h4>Scope</h4>
            <p>Educational hybrid reasoning demo for thalassemia-related emergency scenarios.</p>
          </div>
          <div className="footer-col">
            <h4>API</h4>
            <a href={healthHref}>Health</a>
            <a href={guidelinesHref}>Guidelines JSON</a>
          </div>
          <div className="footer-col">
            <h4>Notice</h4>
            <p>Not for clinical decision-making. Validate locally before any real-world use.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
