import { redirect } from "next/navigation";
import Link from "next/link";
import { safeCurrentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import AppSidebar from "@/components/admin/AppSidebar";
import SignOutButton from "@/components/admin/SignOutButton";
import ConfigNotice from "@/components/admin/ConfigNotice";
import { LabelOrder } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function ReviewQueuePage() {
  const { staff, configError } = await safeCurrentStaff();
  if (configError) return <ConfigNotice message={configError} />;
  if (!staff) redirect("/admin/login");

  const { data: orders } = await supabaseAdmin()
    .from("label_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = (orders ?? []) as LabelOrder[];
  const submitted = list.filter((o) => o.status === "submitted");
  const others = list.filter((o) => o.status !== "submitted" && o.status !== "draft");
  const approvedCount = list.filter((o) => o.status === "approved").length;
  const inProgressCount = list.filter((o) => o.status === "in_progress").length;

  return (
    <div className="wizard-layout">
      <AppSidebar activeIndex={4} footer="Dashboard active" />

      <main className="wizard-main">
        <nav className="appshell-topnav">
          <a className="btn btn-outline" href="/admin/orders/new" style={{ padding: "6px 12px" }}>
            New workspace
          </a>
          <span className="success-topnav-email">{staff.email}</span>
          <SignOutButton />
        </nav>

        <div className="wizard-page-header">
          <h1>Review queue</h1>
          <p className="subtitle">Labels waiting for compliance sign-off appear here first.</p>
        </div>

        <div className="stat-row">
          <div className="stat-card">
            <span className="stat-icon stat-icon-warn">{submitted.length}</span>
            <div>
              <p className="stat-label">Awaiting review</p>
              <p className="stat-value">{submitted.length}</p>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon stat-icon-ok">✓</span>
            <div>
              <p className="stat-label">Approved</p>
              <p className="stat-value">{approvedCount}</p>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon stat-icon-info">⏳</span>
            <div>
              <p className="stat-label">In progress</p>
              <p className="stat-value">{inProgressCount}</p>
            </div>
          </div>
        </div>

        <h2 className="section-heading">
          <span className="section-dot section-dot-warn" /> Awaiting review ({submitted.length})
        </h2>
        <div className="card">
          {submitted.length === 0 ? (
            <p className="subtitle" style={{ margin: 0 }}>
              Nothing waiting right now.
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
                </tr>
              </thead>
              <tbody>
                {submitted.map((o) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2 className="section-heading">
          <span className="section-dot section-dot-ok" /> Recently decided ({others.length})
        </h2>
        <div className="card">
          {others.length === 0 ? (
            <p className="subtitle" style={{ margin: 0 }}>
              Nothing decided yet.
            </p>
          ) : (
            <table className="review-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>SKU</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {others.map((o) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
