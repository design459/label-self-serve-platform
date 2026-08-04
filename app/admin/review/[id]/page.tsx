import { redirect } from "next/navigation";
import { safeCurrentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin, signedUrlFor } from "@/lib/supabaseServer";
import AdminNav from "@/components/admin/AdminNav";
import ConfigNotice from "@/components/admin/ConfigNotice";
import ReviewActions from "@/components/admin/ReviewActions";
import { LabelOrder } from "@/lib/types";

export default async function ReviewDetailPage({ params }: { params: { id: string } }) {
  const { staff, configError } = await safeCurrentStaff();
  if (configError) return <ConfigNotice message={configError} />;
  if (!staff) redirect("/admin/login");

  const db = supabaseAdmin();
  const { data: order } = await db.from("label_orders").select("*").eq("id", params.id).maybeSingle();
  if (!order) {
    return (
      <div>
        <AdminNav email={staff.email} />
        <div className="page">
          <div className="error-box">Order not found.</div>
        </div>
      </div>
    );
  }
  const o = order as LabelOrder;

  const [{ data: design }, { data: auditRows }, { data: reviews }] = await Promise.all([
    db
      .from("label_designs")
      .select("*")
      .eq("label_order_id", o.id)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("lg_audit_log").select("*").eq("label_order_id", o.id).order("created_at", { ascending: false }).limit(30),
    db.from("compliance_reviews").select("*").eq("label_order_id", o.id).order("decided_at", { ascending: false }),
  ]);

  const proofUrl = design?.proof_storage_path ? await signedUrlFor(design.proof_storage_path) : null;

  return (
    <div>
      <AdminNav email={staff.email} />
      <div className="page">
        <h1>{o.customer_name}</h1>
        <p className="subtitle">
          SKU {o.sku_code} · {o.pack_format} · <span className={`pill pill-${o.status}`}>{o.status}</span>
        </p>

        <div className="card">
          <h2>Submitted proof</h2>
          <p className="field-hint">
            Revision {design?.revision_number ?? "—"} of {o.revision_limit} used ({o.revisions_used} used total).
          </p>
          {proofUrl ? (
            <iframe src={proofUrl} title="Label proof" style={{ width: "100%", height: 500, border: "1px solid var(--line)", borderRadius: 8 }} />
          ) : (
            <p>No proof has been generated yet.</p>
          )}
        </div>

        <ReviewActions orderId={o.id} disabled={o.status !== "submitted"} />

        <div className="card">
          <h2>Decisions</h2>
          {!reviews || reviews.length === 0 ? (
            <p className="subtitle" style={{ margin: 0 }}>No decisions recorded yet.</p>
          ) : (
            <ul className="audit-list">
              {reviews.map((r) => (
                <li key={r.id}>
                  <strong>{r.decision}</strong> — {new Date(r.decided_at).toLocaleString()}
                  {r.reason ? ` — ${r.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>Audit trail</h2>
          <ul className="audit-list">
            {(auditRows ?? []).map((a) => (
              <li key={a.id}>
                {new Date(a.created_at).toLocaleString()} — <strong>{a.actor}</strong> {a.action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
