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

  return (
    <div>
      <AdminNav email={staff.email} />
      <div className="page">
        <div className="wizard-page-header">
          <h1>Management Dashboard</h1>
        </div>

        <ReviewQueueTables orders={(orders ?? []) as LabelOrder[]} />
      </div>
    </div>
  );
}
