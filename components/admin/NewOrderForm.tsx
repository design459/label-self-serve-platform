"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABELS, CatalogProduct, PACK_FORMAT_LABELS, PackFormat, ProductCategory } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

const STEPS = [
  { id: "customer-info", label: "Customer info" },
  { id: "product-details", label: "Product details" },
  { id: "pack-format", label: "Pack format" },
  { id: "regulatory-content", label: "Regulatory content" },
  { id: "review-submit", label: "Review & submit" },
];

export default function NewOrderForm({ origin, staffEmail }: { origin: string; staffEmail: string | null }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [productName, setProductName] = useState("");
  const [packFormat, setPackFormat] = useState<PackFormat>("pouch");
  const [category, setCategory] = useState<ProductCategory>("capsule_tablet");
  const [revisionLimit, setRevisionLimit] = useState(5);
  const [ingredients, setIngredients] = useState("");
  const [claims, setClaims] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [statutoryMarks, setStatutoryMarks] = useState("");
  const [calories, setCalories] = useState("");
  const [servingSize, setServingSize] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Starter catalog (7 Ancient Nutra bestsellers, see
  // supabase/migrations/0002_products.sql) — picking one auto-fills the
  // Regulatory content section below with that product's real, exact
  // ingredients/claims/dosage text instead of typing it by hand each time.
  useEffect(() => {
    fetch("/api/admin/products")
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setProducts([]));
  }, []);

  function onSelectProduct(id: string) {
    setSelectedProductId(id);
    if (!id) return; // "— Custom / not listed —"
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setProductName(p.name);
    setPackFormat(p.pack_format);
    setCategory(p.category);
    setIngredients(p.ingredients);
    setClaims(p.claims);
    setStatutoryMarks(p.statutory_marks);
    setServingSize(p.serving_size);
    setCalories(p.calories);
  }

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
  }, [link]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLink(null);

    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerEmail,
        skuCode,
        productName,
        packFormat,
        category,
        revisionLimit,
        regulatory: {
          ingredients,
          claims,
          batchCode,
          manufactureDate,
          expiryDate,
          statutoryMarks,
          nutritionPanel: { calories, servingSize },
        },
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setLink(`${origin}/workspace/${data.accessToken}`);
  }

  return (
    <div className="wizard-layout">
      <aside className="wizard-sidebar">
        <p className="wizard-brand">Label platform</p>
        <ol className="wizard-steps">
          {STEPS.map((step, i) => (
            <li
              key={step.id}
              className={`wizard-step ${!link && i === activeStep ? "active" : ""} ${link || i < activeStep ? "done" : ""}`}
            >
              <span className="wizard-step-circle">{link || i < activeStep ? "✓" : i + 1}</span>
              <span className="wizard-step-label">{step.label}</span>
            </li>
          ))}
        </ol>
        <p className="wizard-step-count">
          {link ? (
            <>
              Steps <strong style={{ color: "#fff" }}>{STEPS.length}</strong> / {STEPS.length} complete
            </>
          ) : (
            <>
              Step {activeStep + 1} of {STEPS.length}
            </>
          )}
        </p>
      </aside>

      <main className={link ? "wizard-main wizard-main--flush" : "wizard-main"}>
        {link ? (
          <div className="success-bg">
            <img className="success-bg-img" src="/hero/success-hero.png" alt="" />
            <div className="success-bg-scrim" />
            <nav className="success-topnav">
              <a className="btn btn-outline" href="/admin/review" style={{ padding: "6px 12px" }}>
                Review queue
              </a>
              <span className="success-topnav-email">{staffEmail}</span>
              <button className="btn" onClick={signOut} style={{ padding: "6px 12px" }} type="button">
                Sign out
              </button>
            </nav>
            <div className="success-card">
              <div className="success-check">✓</div>
              <h2 style={{ textAlign: "center" }}>Label workspace created</h2>
              <p className="subtitle" style={{ textAlign: "center" }}>
                Share this link with {customerName || "the customer"}. It is scoped to this order only.
              </p>
              <div className="success-link-row">
                <input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <div className="btn-row" style={{ justifyContent: "center" }}>
                <button className="btn" type="button" onClick={() => setLink(null)}>
                  Create another
                </button>
                <a className="btn btn-outline" href="/admin/review">
                  Review queue
                </a>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="wizard-topbar">
              <h1 style={{ marginBottom: 0 }}>New label workspace</h1>
              <nav style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 14 }}>
                <a className="btn btn-outline" href="/admin/review" style={{ padding: "6px 12px" }}>
                  Review queue
                </a>
                <span style={{ color: "var(--muted)" }}>{staffEmail}</span>
                <button className="btn" onClick={signOut} style={{ padding: "6px 12px" }} type="button">
                  Sign out
                </button>
              </nav>
            </div>
            <form onSubmit={onSubmit} style={{ maxWidth: 780 }}>
            {error && <div className="error-box">{error}</div>}

            <div className="wizard-section" ref={(el) => { sectionRefs.current[0] = el; }}>
              <p className="wizard-section-label">Your personal details</p>
              <div className="wizard-grid-2">
                <div className="field">
                  <label>Customer name</label>
                  <input type="text" placeholder="Enter full name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Customer email</label>
                  <input type="email" placeholder="email@example.com" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
                </div>
              </div>
            </div>

            <div className="wizard-section" ref={(el) => { sectionRefs.current[1] = el; }}>
              <p className="wizard-section-label">Your product information</p>
              <div className="field">
                <label>Product</label>
                <select value={selectedProductId} onChange={(e) => onSelectProduct(e.target.value)}>
                  <option value="">— Custom / not listed —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  Picking a product fills in Regulatory content below with its real ingredients/claims/dosage text —
                  choose &quot;Custom&quot; to type your own instead.
                </p>
              </div>
              <div className="wizard-grid-2">
                <div className="field">
                  <label>SKU code</label>
                  <input type="text" placeholder="SKU-001" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Product name (shown on label)</label>
                  <input type="text" placeholder="Enter product name" value={productName} onChange={(e) => setProductName(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="wizard-section" ref={(el) => { sectionRefs.current[2] = el; }}>
              <p className="wizard-section-label">Pack format</p>
              <div className="wizard-grid-2">
                <div className="field">
                  <label>Pack format</label>
                  <select value={packFormat} onChange={(e) => setPackFormat(e.target.value as PackFormat)}>
                    {Object.entries(PACK_FORMAT_LABELS).map(([value, labelText]) => (
                      <option key={value} value={value}>
                        {labelText}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Product category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)}>
                    {Object.entries(CATEGORY_LABELS).map(([value, labelText]) => (
                      <option key={value} value={value}>
                        {labelText}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">Determines the nutrition/supplement panel shown on the label.</p>
                </div>
              </div>
              <div className="wizard-grid-2">
                <div className="field">
                  <label>Revision cap</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={revisionLimit}
                    onChange={(e) => setRevisionLimit(Number(e.target.value.replace(/\D/g, "")) || 0)}
                  />
                  <p className="field-hint">Default 5 — regenerations allowed before the cap blocks further attempts.</p>
                </div>
              </div>
            </div>

            <div className="wizard-section" ref={(el) => { sectionRefs.current[3] = el; }}>
              <p className="wizard-section-label">Regulatory content</p>
              <p className="field-hint" style={{ marginTop: -4, marginBottom: 16 }}>
                Exact text only — never AI-paraphrased.
              </p>
              <div className="field">
                <label>Ingredients</label>
                <textarea placeholder="Exact text only — never AI-paraphrased" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
              </div>
              <div className="field">
                <label>Claims (comma-separated)</label>
                <input type="text" placeholder="Non-GMO, Gluten Free, Vegan" value={claims} onChange={(e) => setClaims(e.target.value)} />
              </div>
              <div className="field">
                <label>Statutory marks</label>
                <textarea value={statutoryMarks} onChange={(e) => setStatutoryMarks(e.target.value)} />
              </div>
              <div className="wizard-grid-2">
                <div className="field">
                  <label>Serving size</label>
                  <input type="text" value={servingSize} onChange={(e) => setServingSize(e.target.value)} />
                </div>
                <div className="field">
                  <label>Calories</label>
                  <input type="text" value={calories} onChange={(e) => setCalories(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Batch code</label>
                <input type="text" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} />
              </div>
              <div className="wizard-grid-2">
                <div className="field">
                  <label>Manufacture date</label>
                  <input type="date" value={manufactureDate} onChange={(e) => setManufactureDate(e.target.value)} />
                </div>
                <div className="field">
                  <label>Expiry date</label>
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="wizard-section" ref={(el) => { sectionRefs.current[4] = el; }}>
              <p className="wizard-section-label">Review & submit</p>
              <p className="field-hint" style={{ marginBottom: 16 }}>
                Creates the workspace and issues the customer&apos;s self-serve link — this stands in for the
                order-confirmation trigger (not yet wired to the real order flow — see README open items).
              </p>
              <div className="btn-row" style={{ marginTop: 0, justifyContent: "flex-end" }}>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Creating…" : "Create workspace"}
                </button>
              </div>
            </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
