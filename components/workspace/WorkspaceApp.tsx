"use client";

import { useCallback, useEffect, useState } from "react";
import { PackFormatTemplate, THEME_PRESETS, Theme } from "@/lib/types";

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

interface Summary {
  order: {
    id: string;
    customerName: string;
    skuCode: string;
    productName: string;
    packFormat: string;
    status: "draft" | "in_progress" | "submitted" | "approved" | "rejected";
    revisionLimit: number;
    revisionsUsed: number;
    selectedTemplateId: string | null;
    theme: Theme | null;
  };
  templates: PackFormatTemplate[];
  hasLogo: boolean;
  latestDesign: { id: string; revisionNumber: number; isSubmitted: boolean } | null;
  proofUrl: string | null;
  printUrl: string | null;
  lastReview: { decision: string; reason: string | null } | null;
}

export default function WorkspaceApp({ token }: { token: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(THEME_PRESETS[0]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspace/${token}/summary`);
      const data = await safeJson(res);
      if (!res.ok) {
        setLoadError(data?.error || "This link is invalid or has expired.");
        return;
      }
      setLoadError(null);
      setSummary(data);
      if (data.order.theme) setTheme(data.order.theme);
    } catch {
      setLoadError("Couldn't reach the server. Please try again shortly.");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="page-narrow">
        <div className="error-box">{loadError}</div>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="page-narrow">
        <p>Loading your workspace…</p>
      </div>
    );
  }

  const { order } = summary;
  const capReached = order.revisionsUsed >= order.revisionLimit;
  const locked = order.status === "approved";

  async function selectTemplate(id: string) {
    setBusy("template");
    setActionError(null);
    try {
      const res = await fetch(`/api/workspace/${token}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: id }),
      });
      const data = await safeJson(res);
      setBusy(null);
      if (!res.ok) return setActionError(data?.error || "Couldn't select that template.");
      load();
    } catch {
      setBusy(null);
      setActionError("Couldn't reach the server. Please try again.");
    }
  }

  async function uploadLogo(file: File) {
    setBusy("logo");
    setActionError(null);
    try {
      const form = new FormData();
      form.append("logo", file);
      const res = await fetch(`/api/workspace/${token}/logo`, { method: "POST", body: form });
      const data = await safeJson(res);
      setBusy(null);
      if (!res.ok) return setActionError(data?.error || "Couldn't upload that logo.");
      load();
    } catch {
      setBusy(null);
      setActionError("Couldn't reach the server. Please try again.");
    }
  }

  async function generate() {
    setBusy("generate");
    setActionError(null);
    try {
      const res = await fetch(`/api/workspace/${token}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const data = await safeJson(res);
      setBusy(null);
      if (!res.ok) return setActionError(data?.error || "Couldn't generate a proof.");
      load();
    } catch {
      setBusy(null);
      setActionError("Couldn't reach the server. Please try again.");
    }
  }

  async function submit() {
    setBusy("submit");
    setActionError(null);
    try {
      const res = await fetch(`/api/workspace/${token}/submit`, { method: "POST" });
      const data = await safeJson(res);
      setBusy(null);
      if (!res.ok) return setActionError(data?.error || "Couldn't submit for review.");
      load();
    } catch {
      setBusy(null);
      setActionError("Couldn't reach the server. Please try again.");
    }
  }

  return (
    <div className="page">
      <h1>{order.productName || order.skuCode}</h1>
      <p className="subtitle">
        {order.customerName} · SKU {order.skuCode} · <span className={`pill pill-${order.status}`}>{order.status.replace("_", " ")}</span>
      </p>

      <div className="revision-meter">
        Revisions used: <strong>{order.revisionsUsed} / {order.revisionLimit}</strong>
        {capReached && !locked && " — cap reached, no more regenerations on this label."}
      </div>

      {order.status === "rejected" && summary.lastReview && (
        <div className="notice-box">
          Your last submission was returned: {summary.lastReview.reason}. Make changes and generate again
          {capReached ? " — you're out of revisions, contact us to raise the cap." : ""}.
        </div>
      )}

      {actionError && <div className="error-box">{actionError}</div>}

      {locked ? (
        <div className="card">
          <h2>Approved — print-ready</h2>
          <p>Your label has passed compliance review and is ready for print.</p>
          {summary.printUrl && (
            <a className="btn" href={summary.printUrl} target="_blank" rel="noreferrer">
              Download print-ready PDF
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="card">
            <h2>1. Pick a template</h2>
            <div className="template-grid">
              {summary.templates.map((t) => (
                <div
                  key={t.id}
                  className={`template-card ${order.selectedTemplateId === t.id ? "selected" : ""}`}
                  onClick={() => busy === null && selectTemplate(t.id)}
                >
                  <strong>{t.name}</strong>
                  <p className="field-hint">
                    {t.trim_width_mm}mm × {t.trim_height_mm}mm trim
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>2. Upload your logo</h2>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            />
            {summary.hasLogo && <p className="field-hint">Logo uploaded ✓ — choose a file again to replace it.</p>}
          </div>

          <div className="card">
            <h2>3. Choose a theme</h2>
            <div className="palette-row">
              {THEME_PRESETS.map((preset, i) => (
                <div
                  key={i}
                  className={`swatch ${theme.primaryColor === preset.primaryColor ? "selected" : ""}`}
                  style={{ background: preset.primaryColor }}
                  onClick={() => setTheme(preset)}
                  title={preset.primaryColor}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <h2>4. Generate</h2>
            <button
              className="btn"
              disabled={busy !== null || capReached || !order.selectedTemplateId}
              onClick={generate}
            >
              {busy === "generate" ? "Generating…" : "Generate artwork"}
            </button>
            {summary.proofUrl && (
              <div style={{ marginTop: 16 }}>
                <div className="watermark-banner">PROOF — NOT APPROVED FOR PRINT</div>
                <iframe
                  src={summary.proofUrl}
                  title="Label proof"
                  style={{ width: "100%", height: 500, border: "1px solid var(--line)", borderRadius: 8 }}
                />
              </div>
            )}
          </div>

          {summary.latestDesign && !summary.latestDesign.isSubmitted && order.status !== "submitted" && (
            <div className="card">
              <h2>5. Submit for compliance approval</h2>
              <p className="field-hint">A reviewer on our side will approve this or return it with reasons.</p>
              <button className="btn" disabled={busy !== null} onClick={submit}>
                {busy === "submit" ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          )}

          {order.status === "submitted" && (
            <div className="notice-box">Submitted — waiting on compliance review. You can still regenerate if you spot something, which will need re-submitting.</div>
          )}
        </>
      )}
    </div>
  );
}
