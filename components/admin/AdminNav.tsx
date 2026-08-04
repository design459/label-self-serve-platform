"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AdminNav({ email }: { email: string | null }) {
  const router = useRouter();

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="topbar">
      <div className="topbar-title">Label platform — staff</div>
      <nav style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 14 }}>
        <Link href="/admin/orders/new">New workspace</Link>
        <Link href="/admin/review">Review queue</Link>
        <span style={{ color: "var(--muted)" }}>{email}</span>
        <button className="btn btn-outline" onClick={signOut} style={{ padding: "6px 12px" }}>
          Sign out
        </button>
      </nav>
    </div>
  );
}
