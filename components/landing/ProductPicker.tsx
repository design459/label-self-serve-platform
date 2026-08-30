"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogProduct, CategoryPanelTemplate } from "@/lib/types";

type Selection = { kind: "catalog"; product: CatalogProduct } | { kind: "category"; category: CategoryPanelTemplate } | null;

// Generated product photography for the starter catalog products — see
// supabase/migrations/0002_products.sql for where these names come from.
// A product added later without a matching photo just renders without one.
const PRODUCT_IMAGES: Record<string, string> = {
  Ashwagandha: "/products/ashwagandha.jpg",
  Beli: "/products/beli.jpg",
  Garcinia: "/products/garcinia.jpg",
  "Gurmar (Masbedda)": "/products/gurmar.jpg",
  Heenbovitiya: "/products/heenbovitiya.jpg",
  Moringa: "/products/moringa.jpg",
};

// Kept out of the public picker grid — the real product row is untouched
// (staff can still select it in the admin order form), this just keeps the
// landing page's grid at an even 6 cards instead of an unbalanced 7th.
const HIDDEN_FROM_PICKER = new Set(["Turmeric & Black Pepper"]);

const PANEL_STYLE_LABELS: Record<CategoryPanelTemplate["panel_style"], string> = {
  supplement_facts: "Supplement Facts",
  nutrition_facts: "Nutrition Facts",
  blank: "Blank canvas",
};

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
  // The code is emailed only to staff (design@esilkroute.com.lk), never to
  // the customer — this gates "Start designing" behind a human decision
  // (see app/api/public/request-code/route.ts) rather than an open signup.
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);

  useEffect(() => {
    fetch("/api/public/products")
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setProducts((data.products ?? []).filter((p: CatalogProduct) => !HIDDEN_FROM_PICKER.has(p.name))))
      .catch(() => setProducts([]));
    fetch("/api/public/categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  // A code is tied to one email/context — picking a different product (or
  // closing and reopening the modal) starts that gate over rather than
  // carrying a stale "already requested" state into an unrelated request.
  useEffect(() => {
    setCode("");
    setCodeRequested(false);
    setError(null);
  }, [selection]);

  function startingPointContext(): string | undefined {
    if (!selection) return undefined;
    if (selection.kind === "catalog") return selection.product.name;
    return customName ? `${selection.category.display_label} — ${customName}` : selection.category.display_label;
  }

  async function requestCode() {
    setError(null);
    setRequestingCode(true);
    const res = await fetch("/api/public/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName, companyName, customerEmail, context: startingPointContext(), honeypot, renderedAt }),
    });
    const data = await res.json().catch(() => null);
    setRequestingCode(false);
    if (!res.ok) {
      setError(data?.error || "Couldn't send a code. Please try again.");
      return;
    }
    setCodeRequested(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection) return;
    setBusy(true);
    setError(null);

    const body =
      selection.kind === "catalog"
        ? { customerName, companyName, customerEmail, catalogProductId: selection.product.id, code, honeypot, renderedAt }
        : {
            customerName,
            companyName,
            customerEmail,
            customProductName: customName,
            category: selection.category.category,
            packFormat: selection.category.default_pack_format,
            code,
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
        <div className="product-picker-header">
          <span className="how-it-works-accent" />
          <h2 className="landing-section-title">Select Your Starting Point</h2>
          <p className="field-hint">
            Pick a product we already know, or start from the closest category — either way, we set up the right
            regulatory panel for you.
          </p>
        </div>

        <div className="product-grid">
          {products.map((p) => (
            <div
              key={p.id}
              className={`product-card ${selection?.kind === "catalog" && selection.product.id === p.id ? "selected" : ""}`}
              onClick={() => setSelection({ kind: "catalog", product: p })}
            >
              <div className="product-card-info">
                <strong>{p.name}</strong>
                <span className="template-card-category">{p.category.replace("_", " ")}</span>
              </div>
              {PRODUCT_IMAGES[p.name] && <img className="product-card-photo" src={PRODUCT_IMAGES[p.name]} alt="" />}
            </div>
          ))}
        </div>

        <div className="category-panel">
          <h3>Browse by Category</h3>
          <div className="category-grid">
            {categories.map((c) => (
              <div
                key={c.id}
                className={`category-pill ${selection?.kind === "category" && selection.category.category === c.category ? "selected" : ""}`}
                onClick={() => setSelection({ kind: "category", category: c })}
              >
                <strong>{c.display_label}</strong>
                <span>{PANEL_STYLE_LABELS[c.panel_style]}</span>
              </div>
            ))}
          </div>
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
              {!codeRequested ? (
                <>
                  <p className="field-hint" style={{ marginBottom: 12 }}>
                    We&apos;ll send a code to our team to confirm it&apos;s you — enter it on the next step to start
                    designing.
                  </p>
                  <button
                    type="button"
                    className="btn btn-block"
                    disabled={requestingCode || !customerName || !companyName || !customerEmail}
                    onClick={requestCode}
                  >
                    {requestingCode ? "Requesting…" : "Request code"}
                  </button>
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                    <p className="field-hint">
                      We&apos;ve sent a code to our team — enter it here once they share it with you.{" "}
                      <button
                        type="button"
                        className="link-button"
                        disabled={requestingCode}
                        onClick={requestCode}
                      >
                        {requestingCode ? "Resending…" : "Resend code"}
                      </button>
                    </p>
                  </div>
                  <button className="btn btn-block" type="submit" disabled={busy || !code}>
                    {busy ? "Starting…" : "Start designing"}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
