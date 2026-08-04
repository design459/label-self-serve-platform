import { redirect } from "next/navigation";
import Link from "next/link";
import { safeCurrentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import AdminNav from "@/components/admin/AdminNav";
import ConfigNotice from "@/components/admin/ConfigNotice";
import { LabelOrder } from "@/lib/types";

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

  return (
    <div>
      <AdminNav email={staff.email} />
      <div className="page">
        <h1>Review queue</h1>
        <p className="subtitle">Labels waiting for compliance sign-off appear here first.</p>

        <div className="card">
          <h2>Awaiting review ({submitted.length})</h2>
          {submitted.length === 0 ? (
            <p className="subtitle" style={{ margin: 0 }}>Nothing waiting right now.</p>
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
                    <td>{o.customer_name}</td>
                    <td>{o.sku_code}</td>
                    <td>{o.pack_format}</td>
                    <td>{o.revisions_used} / {o.revision_limit}</td>
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

        <div className="card">
          <h2>Recently decided</h2>
          {others.length === 0 ? (
            <p className="subtitle" style={{ margin: 0 }}>Nothing decided yet.</p>
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
                    <td>{o.customer_name}</td>
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
      </div>
    </div>
  );
}
