import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { safeCurrentStaff } from "@/lib/supabaseAuth";
import AdminNav from "@/components/admin/AdminNav";
import ConfigNotice from "@/components/admin/ConfigNotice";
import NewOrderForm from "@/components/admin/NewOrderForm";

export default async function NewOrderPage() {
  const { staff, configError } = await safeCurrentStaff();
  if (configError) return <ConfigNotice message={configError} />;
  if (!staff) redirect("/admin/login");

  const h = headers();
  const host = h.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return (
    <div>
      <AdminNav email={staff.email} />
      <div className="page">
        <NewOrderForm origin={origin} />
      </div>
    </div>
  );
}
