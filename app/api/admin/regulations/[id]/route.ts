import { NextRequest, NextResponse } from "next/server";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin, storageBucket } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await currentStaff();
    if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const db = supabaseAdmin();
    const { data: doc } = await db.from("label_regulation_documents").select("storage_path").eq("id", params.id).maybeSingle();
    if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    await db.storage.from(storageBucket()).remove([doc.storage_path]);

    const { error } = await db.from("label_regulation_documents").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch(err);
  }
}
