"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminNav({ email }: { email: string | null }) {
  const router = useRouter();

  async function signOut() {
    // Clear the SPINE SSO session cookie (httpOnly, so it needs a server route).
    await fetch("/api/sso/logout", { method: "POST" }).catch(() => undefined);
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="topbar">
      <div className="topbar-title">Label platform — staff</div>
      <nav style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 14 }}>
        <Link className="btn btn-outline" href="/admin/review" style={{ padding: "6px 12px" }}>
          Review queue
        </Link>
        <span style={{ color: "var(--muted)" }}>{email}</span>
        <button className="btn" onClick={signOut} style={{ padding: "6px 12px" }}>
          Sign out
        </button>
      </nav>
    </div>
  );
}
