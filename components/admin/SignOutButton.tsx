"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button className="btn" onClick={signOut} style={{ padding: "6px 12px" }} type="button">
      Sign out
    </button>
  );
}
