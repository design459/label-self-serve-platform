"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogProduct, CategoryPanelTemplate } from "@/lib/types";

type Selection = { kind: "catalog"; product: CatalogProduct } | { kind: "category"; category: CategoryPanelTemplate } | null;

export default function ProductPicker() {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CategoryPanelTemplate[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [customName, setCustomName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/products")
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setProducts([]));
    fetch("/api/public/categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection) return;
    setBusy(true);
    setError(null);

    const body =
      selection.kind === "catalog"
        ? { customerName, companyName, customerEmail, catalogProductId: selection.product.id, honeypot, renderedAt }
        : {
            customerName,
            companyName,
            customerEmail,
            customProductName: customName,
            category: selection.category.category,
            packFormat: selection.category.default_pack_format,
            honeypot,
            renderedAt,
          };

    const res = await fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Something went wrong. Please try again.");
      return;
    }
    if (!data?.accessToken) {
      setError("Couldn't start your label workspace. Please try again.");
      return;
    }
    router.push(`/workspace/${data.accessToken}`);
  }

  return (
    <>
      <section className="landing-section">
        <h2 className="landing-section-title">Popular products</h2>
        <p className="field-hint" style={{ marginBottom: 20 }}>
          Pick a product we already know — its real ingredients, claims and dosage text fill in automatically.
        </p>
        <div className="template-grid">
          {products.map((p) => (
            <div
              key={p.id}
              className={`template-card ${selection?.kind === "catalog" && selection.product.id === p.id ? "selected" : ""}`}
              onClick={() => setSelection({ kind: "catalog", product: p })}
            >
              <strong>{p.name}</strong>
              <div>
                <span className="template-card-category">{p.category.replace("_", " ")}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2 className="landing-section-title">Or start from a category</h2>
        <p className="field-hint" style={{ marginBottom: 20 }}>
          Not on our list? Pick the closest category and we&apos;ll set up the right nutrition/supplement panel for
          it — you fill in the real details yourself.
        </p>
        <div className="template-grid">
          {categories.map((c) => (
            <div
              key={c.id}
              className={`template-card ${selection?.kind === "category" && selection.category.category === c.category ? "selected" : ""}`}
              onClick={() => setSelection({ kind: "category", category: c })}
            >
              <strong>{c.display_label}</strong>
              <p className="field-hint">
                {c.panel_style === "supplement_facts" ? "Supplement Facts panel" : c.panel_style === "nutrition_facts" ? "Nutrition Facts panel" : "Blank — fill in by hand"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {selection && (
        <div className="modal-overlay" onClick={() => !busy && setSelection(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Start your label</h2>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelection(null)}
                disabled={busy}
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <form onSubmit={onSubmit}>
              {error && <div className="error-box">{error}</div>}
              {selection.kind === "category" && (
                <div className="field">
                  <label>What are you calling this product?</label>
                  <input
                    type="text"
                    placeholder="e.g. Mango Juice"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="field">
                <label>Your name</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Your company name</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Your email</label>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
              </div>
              {/* Honeypot — hidden from real users via CSS, left blank by
                  them; a filled value means it's an automated submission. */}
              <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input
                  id="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
              <p className="field-hint" style={{ marginBottom: 16 }}>
                You&apos;ll design and fill in the real regulatory details yourself in the next step, then submit for
                a quick compliance check before it&apos;s print-ready.
              </p>
              <button className="btn btn-block" type="submit" disabled={busy}>
                {busy ? "Starting…" : "Start designing"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
