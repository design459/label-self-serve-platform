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

  const [{ data: design }, { data: reviews }] = await Promise.all([
    // is_submitted=true, not just the latest revision — if the customer
    // regenerated a fresh proof after submitting but hasn't re-submitted
    // it yet, that draft revision isn't what staff is meant to be
    // reviewing (see SubmitForReview.tsx: they still need to click
    // "Submit for review" again for the new one to count).
    db
      .from("label_designs")
      .select("*")
      .eq("label_order_id", o.id)
      .eq("is_submitted", true)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("compliance_reviews").select("*").eq("label_order_id", o.id).order("decided_at", { ascending: false }),
  ]);

  const proofPaths: string[] = Array.isArray(design?.proof_storage_paths)
    ? design.proof_storage_paths
    : design?.proof_storage_path
    ? [design.proof_storage_path]
    : [];
  const proofUrls = (await Promise.all(proofPaths.map((p) => signedUrlFor(p)))).filter((u): u is string => u !== null);

  return (
    <div>
      <AdminNav email={staff.email} />
      <div className="page">
        <h1>{o.customer_name}</h1>
        <p className="subtitle">
          {o.company_name ? `${o.company_name} · ` : ""}
          SKU {o.sku_code} · {o.pack_format} · <span className={`pill pill-${o.status}`}>{o.status}</span>
        </p>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Submitted proof{proofUrls.length > 1 ? `s (${proofUrls.length} pages)` : ""}</h2>
            {proofUrls.length > 0 && (
              <a className="btn btn-outline" href={`/api/admin/review/${o.id}/download-pdf`} style={{ padding: "6px 12px" }}>
                Download PDF
              </a>
            )}
          </div>
          <p className="field-hint">
            Revision {design?.revision_number ?? "—"} of {o.revision_limit} used ({o.revisions_used} used total).
          </p>
          {proofUrls.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {proofUrls.map((url, i) => (
                <div key={i}>
                  {proofUrls.length > 1 && (
                    <p className="field-hint" style={{ margin: "0 0 4px" }}>
                      Page {i + 1} of {proofUrls.length}
                    </p>
                  )}
                  <img src={url} alt={`Label proof page ${i + 1}`} style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, display: "block" }} />
                </div>
              ))}
            </div>
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
      </div>
    </div>
  );
}
