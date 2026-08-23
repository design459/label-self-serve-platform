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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

interface Props {
  orders: LabelOrder[];
}

export default function ReviewQueueTables({ orders: initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitted = useMemo(() => orders.filter((o) => o.status === "submitted"), [orders]);
  const others = useMemo(() => orders.filter((o) => o.status !== "submitted" && o.status !== "draft"), [orders]);
  const approvedCount = useMemo(() => orders.filter((o) => o.status === "approved").length, [orders]);
  const inProgressCount = useMemo(() => orders.filter((o) => o.status === "in_progress").length, [orders]);

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
    setOrders((list) => list.filter((o) => o.id !== order.id));
  }

  return (
    <>
      <input
        type="text"
        className="dashboard-search"
        placeholder="Search by customer name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="stat-row">
        <div className="stat-card stat-card-accent">
          <div>
            <p className="stat-label">Awaiting</p>
            <p className="stat-value">{pad2(submitted.length)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="stat-label">Approved</p>
            <p className="stat-value">{pad2(approvedCount)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="stat-label">In progress</p>
            <p className="stat-value">{pad2(inProgressCount)}</p>
          </div>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="dashboard-table-card">
        <h2>Awaiting Review</h2>
        {filteredSubmitted.length === 0 ? (
          <p className="subtitle" style={{ margin: 0 }}>
            {q ? "No matching orders." : "Nothing waiting right now."}
          </p>
        ) : (
          <table className="review-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>SKU Reference</th>
                <th>Pack Format</th>
                <th>Revisions</th>
                <th>Actions</th>
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
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link className="pill-btn pill-btn-dark" href={`/admin/review/${o.id}`}>
                        Review
                      </Link>
                      <button
                        type="button"
                        className="pill-btn pill-btn-danger"
                        disabled={deletingId === o.id}
                        onClick={() => handleDelete(o)}
                      >
                        {deletingId === o.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dashboard-table-card">
        <h2>Recently Decided</h2>
        {filteredOthers.length === 0 ? (
          <p className="subtitle" style={{ margin: 0 }}>
            {q ? "No matching orders." : "Nothing decided yet."}
          </p>
        ) : (
          <table className="review-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>SKU Reference</th>
                <th>Compliance Status</th>
                <th>Actions</th>
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
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link className="pill-btn pill-btn-dark" href={`/admin/review/${o.id}`}>
                        View Proof
                      </Link>
                      <button
                        type="button"
                        className="pill-btn pill-btn-danger"
                        disabled={deletingId === o.id}
                        onClick={() => handleDelete(o)}
                      >
                        {deletingId === o.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
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
