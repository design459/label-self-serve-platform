"use client";

import { useState } from "react";
import { PACK_FORMAT_LABELS, PackFormat } from "@/lib/types";

export default function NewOrderForm({ origin }: { origin: string }) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [productName, setProductName] = useState("");
  const [packFormat, setPackFormat] = useState<PackFormat>("pouch");
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

  if (link) {
    return (
      <div className="card">
        <h2>Label workspace created</h2>
        <p className="subtitle">Share this link with {customerName || "the customer"}. It is scoped to this order only.</p>
        <div className="field">
          <input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <div className="btn-row">
          <button
            className="btn"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button className="btn btn-outline" onClick={() => setLink(null)}>
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>New label workspace</h2>
      <p className="subtitle">
        Stand-in for the order-confirmation trigger (not yet wired to the real order flow — see README open items).
        This issues the customer&apos;s self-serve link.
      </p>
      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Customer name</label>
        <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
      </div>
      <div className="field">
        <label>Customer email</label>
        <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label>SKU code</label>
        <input type="text" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} required />
      </div>
      <div className="field">
        <label>Product name (shown on label)</label>
        <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} />
      </div>
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
        <label>Revision cap</label>
        <input
          type="text"
          inputMode="numeric"
          value={revisionLimit}
          onChange={(e) => setRevisionLimit(Number(e.target.value.replace(/\D/g, "")) || 0)}
        />
        <p className="field-hint">Default 5 — the number of times this customer can regenerate before the cap blocks further attempts.</p>
      </div>

      <h2 style={{ marginTop: 24 }}>Regulatory content</h2>
      <p className="subtitle">Exact text only — this is what renders on the label, never AI-paraphrased.</p>
      <div className="field">
        <label>Ingredients</label>
        <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
      </div>
      <div className="field">
        <label>Claims (comma-separated, e.g. Non-GMO, Gluten Free)</label>
        <input type="text" value={claims} onChange={(e) => setClaims(e.target.value)} />
      </div>
      <div className="field">
        <label>Statutory marks</label>
        <textarea value={statutoryMarks} onChange={(e) => setStatutoryMarks(e.target.value)} />
      </div>
      <div className="field">
        <label>Serving size</label>
        <input type="text" value={servingSize} onChange={(e) => setServingSize(e.target.value)} />
      </div>
      <div className="field">
        <label>Calories</label>
        <input type="text" value={calories} onChange={(e) => setCalories(e.target.value)} />
      </div>
      <div className="field">
        <label>Batch code</label>
        <input type="text" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} />
      </div>
      <div className="field">
        <label>Manufacture date</label>
        <input type="date" value={manufactureDate} onChange={(e) => setManufactureDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Expiry date</label>
        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
      </div>

      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create workspace + issue link"}
      </button>
    </form>
  );
}
