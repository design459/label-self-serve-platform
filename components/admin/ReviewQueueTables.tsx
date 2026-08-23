"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LabelOrder } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface Props {
  submitted: LabelOrder[];
  others: LabelOrder[];
}

export default function ReviewQueueTables({ submitted: initialSubmitted, others: initialOthers }: Props) {
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [others, setOthers] = useState(initialOthers);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filteredSubmitted = useMemo(
    () => (q ? submitted.filter((o) => o.customer_name.toLowerCase().includes(q)) : submitted),
    [submitted, q]
  );
  const filteredOthers = useMemo(() => (q ? others.filter((o) => o.customer_name.toLowerCase().includes(q)) : others), [others, q]);

  async function handleDelete(order: LabelOrder) {
    if (!confirm(`Delete the order for "${order.customer_name}" (SKU ${order.sku_code})? This cannot be undone.`)) return;
    setDeletingId(order.id);
    setError(null);
    const res = await fetch(`/api/admin/review/${order.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't delete this order.");
      return;
    }
    setSubmitted((list) => list.filter((o) => o.id !== order.id));
    setOthers((list) => list.filter((o) => o.id !== order.id));
  }

  return (
    <>
      <div className="field" style={{ maxWidth: 320, marginBottom: 24 }}>
        <label>Search by customer name</label>
        <input type="text" placeholder="e.g. Test009" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && <div className="error-box">{error}</div>}

      <h2 className="section-heading">
        <span className="section-dot section-dot-warn" /> Awaiting review ({filteredSubmitted.length})
      </h2>
      <div className="card">
        {filteredSubmitted.length === 0 ? (
          <p className="subtitle" style={{ margin: 0 }}>
            {q ? "No matching orders." : "Nothing waiting right now."}
          </p>
        ) : (
          <table className="review-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>SKU</th>
                <th>Pack format</th>
                <th>Revisions</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmitted.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="row-avatar">{initials(o.customer_name)}</span>
                    {o.customer_name}
                  </td>
                  <td>{o.sku_code}</td>
                  <td>{o.pack_format}</td>
                  <td>
                    {o.revisions_used} / {o.revision_limit}
                  </td>
                  <td>
                    <Link className="btn" href={`/admin/review/${o.id}`} style={{ padding: "6px 12px" }}>
                      Review
                    </Link>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: "6px 12px" }}
                      disabled={deletingId === o.id}
                      onClick={() => handleDelete(o)}
                    >
                      {deletingId === o.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-heading">
        <span className="section-dot section-dot-ok" /> Recently decided ({filteredOthers.length})
      </h2>
      <div className="card">
        {filteredOthers.length === 0 ? (
          <p className="subtitle" style={{ margin: 0 }}>
            {q ? "No matching orders." : "Nothing decided yet."}
          </p>
        ) : (
          <table className="review-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>SKU</th>
                <th>Status</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOthers.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="row-avatar">{initials(o.customer_name)}</span>
                    {o.customer_name}
                  </td>
                  <td>{o.sku_code}</td>
                  <td>
                    <span className={`pill pill-${o.status}`}>{o.status}</span>
                  </td>
                  <td>
                    <Link href={`/admin/review/${o.id}`}>View</Link>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: "6px 12px" }}
                      disabled={deletingId === o.id}
                      onClick={() => handleDelete(o)}
                    >
                      {deletingId === o.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
