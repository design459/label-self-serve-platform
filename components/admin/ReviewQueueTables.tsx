"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { LabelOrder, LabelOrderStatus } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type StatCardStatus = Extract<LabelOrderStatus, "submitted" | "approved" | "in_progress" | "rejected">;

const STAT_CARDS: { status: StatCardStatus; label: string }[] = [
  { status: "submitted", label: "Awaiting" },
  { status: "approved", label: "Approved" },
  { status: "in_progress", label: "In progress" },
  { status: "rejected", label: "Rejected" },
];

interface Props {
  orders: LabelOrder[];
}

export default function ReviewQueueTables({ orders: initialOrders }: Props) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // page.tsx re-fetches on the server when router.refresh() runs, but this
  // component's own `orders` is local state seeded once from that prop —
  // without this it would never pick up the fresh data.
  useEffect(() => setOrders(initialOrders), [initialOrders]);
  // Clicking a stat card both highlights it and filters the table below to
  // just that status — clicking the already-active one clears the filter
  // back to the normal Awaiting/Recently-Decided split.
  const [statusFilter, setStatusFilter] = useState<StatCardStatus | null>(null);

  const submitted = useMemo(() => orders.filter((o) => o.status === "submitted"), [orders]);
  const others = useMemo(() => orders.filter((o) => o.status !== "submitted" && o.status !== "draft"), [orders]);
  const approvedCount = useMemo(() => orders.filter((o) => o.status === "approved").length, [orders]);
  const inProgressCount = useMemo(() => orders.filter((o) => o.status === "in_progress").length, [orders]);
  const rejectedCount = useMemo(() => orders.filter((o) => o.status === "rejected").length, [orders]);
  const countByStatus: Record<StatCardStatus, number> = {
    submitted: submitted.length,
    approved: approvedCount,
    in_progress: inProgressCount,
    rejected: rejectedCount,
  };

  const q = query.trim().toLowerCase();
  const byName = (o: LabelOrder) => !q || o.customer_name.toLowerCase().includes(q);

  const filteredSubmitted = useMemo(() => submitted.filter(byName), [submitted, q]);
  const filteredOthers = useMemo(() => others.filter(byName), [others, q]);
  const filteredByStatus = useMemo(
    () => (statusFilter ? orders.filter((o) => o.status === statusFilter).filter(byName) : []),
    [orders, statusFilter, q]
  );

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

  function actionLabel(status: LabelOrderStatus) {
    return status === "submitted" ? "Review" : "View Proof";
  }

  function renderRows(list: LabelOrder[], withPackFormat: boolean) {
    return list.map((o) => (
      <tr key={o.id}>
        <td>
          <span className="row-avatar">{initials(o.customer_name)}</span>
          {o.customer_name}
        </td>
        <td>{o.sku_code}</td>
        {withPackFormat ? (
          <>
            <td>{o.pack_format}</td>
            <td>
              {o.revisions_used} / {o.revision_limit}
            </td>
          </>
        ) : (
          <td>
            <span className={`pill pill-${o.status}`}>{o.status}</span>
          </td>
        )}
        <td>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="pill-btn pill-btn-dark" href={`/admin/review/${o.id}`}>
              {actionLabel(o.status)}
            </Link>
            <button type="button" className="pill-btn pill-btn-danger" disabled={deletingId === o.id} onClick={() => handleDelete(o)}>
              {deletingId === o.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <>
      <div className="dashboard-search-row">
        <input
          type="text"
          className="dashboard-search"
          placeholder="Search by customer name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline dashboard-refresh-btn"
          disabled={isRefreshing}
          onClick={() => startRefresh(() => router.refresh())}
        >
          <RefreshCw size={16} className={isRefreshing ? "spin" : ""} />
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="stat-row">
        {STAT_CARDS.map((c) => (
          <button
            type="button"
            key={c.status}
            className={`stat-card stat-card-clickable ${statusFilter === c.status ? "stat-card-accent" : ""}`}
            onClick={() => setStatusFilter((cur) => (cur === c.status ? null : c.status))}
          >
            <div>
              <p className="stat-label">{c.label}</p>
              <p className="stat-value">{pad2(countByStatus[c.status])}</p>
            </div>
          </button>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      {statusFilter ? (
        <div className="dashboard-table-card">
          <h2>{STAT_CARDS.find((c) => c.status === statusFilter)?.label}</h2>
          {filteredByStatus.length === 0 ? (
            <p className="subtitle" style={{ margin: 0 }}>
              {q ? "No matching orders." : "Nothing here right now."}
            </p>
          ) : (
            <table className="review-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>SKU Reference</th>
                  {statusFilter === "submitted" ? (
                    <>
                      <th>Pack Format</th>
                      <th>Revisions</th>
                    </>
                  ) : (
                    <th>Compliance Status</th>
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>{renderRows(filteredByStatus, statusFilter === "submitted")}</tbody>
            </table>
          )}
        </div>
      ) : (
        <>
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
                <tbody>{renderRows(filteredSubmitted, true)}</tbody>
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
                <tbody>{renderRows(filteredOthers, false)}</tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
