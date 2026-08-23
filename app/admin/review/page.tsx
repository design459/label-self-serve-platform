import { redirect } from "next/navigation";
import { safeCurrentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import AdminNav from "@/components/admin/AdminNav";
import ConfigNotice from "@/components/admin/ConfigNotice";
import ReviewQueueTables from "@/components/admin/ReviewQueueTables";
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
  const approvedCount = list.filter((o) => o.status === "approved").length;
  const inProgressCount = list.filter((o) => o.status === "in_progress").length;

  return (
    <div>
      <AdminNav email={staff.email} />
      <div className="page">
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

        <ReviewQueueTables submitted={submitted} others={others} />
      </div>
    </div>
  );
}
