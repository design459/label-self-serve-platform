"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { THEME_PRESETS, Theme } from "@/lib/types";
import { Summary, safeJson } from "./types";
import WorkspaceSidebar from "./WorkspaceSidebar";
import PhotoAndPaletteEditor from "./PhotoAndPaletteEditor";
import MarketingCopyEditor from "./MarketingCopyEditor";
import CategoryPanelEditor from "./CategoryPanelEditor";
import GenerateAndPreview from "./GenerateAndPreview";
import SubmitForReview from "./SubmitForReview";

export default function WorkspaceApp({ token }: { token: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(THEME_PRESETS[0]);
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const load = useCallback(async () => {
    try {
      // See app/api/workspace/[token]/summary/route.ts's comment — a Netlify
      // caching layer previously served stale snapshots without this.
      const res = await fetch(`/api/workspace/${token}/summary?t=${Date.now()}`, { cache: "no-store" });
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length === 0) return;
        const idx = sectionRefs.current.findIndex((el) => el === visible[0].target);
        if (idx !== -1) setActiveStep(idx);
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [summary]);

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
  const locked = order.status === "approved";
  const workspaceUrl = typeof window !== "undefined" ? window.location.href : "";

  if (locked) {
    return (
      <div className="page">
        <h1>{order.displayName || order.productName || order.skuCode}</h1>
        <p className="subtitle">
          {order.customerName} · SKU {order.skuCode} · <span className="pill pill-approved">approved</span>
        </p>
        <div className="card">
          <h2>Approved — print-ready</h2>
          <p>Your label has passed compliance review and is ready for print.</p>
          {summary.printUrl && (
            <a className="btn" href={summary.printUrl} target="_blank" rel="noreferrer">
              Download print-ready PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  const sections = [
    <PhotoAndPaletteEditor key="photo" token={token} summary={summary} theme={theme} onThemeChange={setTheme} locked={locked} onSaved={load} />,
    <MarketingCopyEditor key="marketing" token={token} summary={summary} locked={locked} onSaved={load} />,
    <CategoryPanelEditor key="regulatory" token={token} summary={summary} locked={locked} onSaved={load} />,
    <GenerateAndPreview key="generate" token={token} summary={summary} theme={theme} onGenerated={load} />,
    <SubmitForReview key="submit" token={token} summary={summary} onSubmitted={load} />,
  ];

  return (
    <div className="wizard-layout">
      <WorkspaceSidebar activeIndex={activeStep} footer={`Step ${activeStep + 1} of ${sections.length}`} />
      <main className="wizard-main">
        <div className="wizard-topbar">
          <div>
            <h1 style={{ marginBottom: 0 }}>{order.displayName || order.productName || order.skuCode}</h1>
            <p className="subtitle" style={{ marginBottom: 0 }}>
              SKU {order.skuCode} · <span className={`pill pill-${order.status}`}>{order.status.replace("_", " ")}</span>
            </p>
          </div>
        </div>

        <div className="success-link-row" style={{ maxWidth: 480, marginBottom: 32 }}>
          <input type="text" readOnly value={workspaceUrl} onFocus={(e) => e.currentTarget.select()} />
          <button
            className="btn"
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(workspaceUrl);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Save this link"}
          </button>
        </div>

        {order.status === "rejected" && summary.lastReview && (
          <div className="notice-box">Your last submission was returned: {summary.lastReview.reason}. Make changes and generate again.</div>
        )}

        {sections.map((section, i) => (
          <div
            className="wizard-section"
            key={i}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
          >
            {section}
          </div>
        ))}
      </main>
    </div>
  );
}
