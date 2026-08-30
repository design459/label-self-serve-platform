"use client";

import { useEffect, useRef, useState } from "react";

interface Doc {
  id: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
  url: string | null;
}

// The regulation-document library behind the review page's "Quality
// Assurance (QA) Review" check — global, not tied to any order. A
// regulation change is just remove-old / upload-new here, no redeploy.
export default function RegulationDocsManager() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const res = await fetch("/api/admin/regulations");
    const data = await res.json().catch(() => null);
    if (res.ok) setDocs(data.documents ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/regulations", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok) return setError(data?.error || "Upload failed.");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this regulation document? The QA review check will no longer use it.")) return;
    const res = await fetch(`/api/admin/regulations/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="card">
      <h2>Label Regulations</h2>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
        PDFs used by the Quality Assurance (QA) Review check on each label's review page. Upload the current
        regulation — replace or remove it anytime, no code change needed.
      </p>
      {error && <div className="error-box">{error}</div>}
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" className="btn btn-outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? "Uploading…" : "Upload regulation PDF"}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />

      {docs.length > 0 ? (
        <ul className="audit-list" style={{ marginTop: 16 }}>
          {docs.map((d) => (
            <li key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer">
                    {d.file_name}
                  </a>
                ) : (
                  d.file_name
                )}{" "}
                <span className="field-hint">({Math.round(d.size_bytes / 1024)}KB)</span>
              </span>
              <button type="button" className="btn btn-danger" style={{ padding: "4px 10px" }} onClick={() => remove(d.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint" style={{ marginTop: 16 }}>
          No regulation documents uploaded yet — the QA review check won't run until at least one is added.
        </p>
      )}
    </div>
  );
}
