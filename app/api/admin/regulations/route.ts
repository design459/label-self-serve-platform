import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin, uploadAsset, signedUrlFor } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

const MAX_BYTES = 20 * 1024 * 1024;

// Staff-only library of label regulation PDFs, global (not tied to any
// order) — see supabase/migrations/0011_label_regulation_documents.sql.
// Read by app/api/admin/review/[id]/compliance-check/route.ts.
export async function GET() {
  try {
    const staff = await currentStaff();
    if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("label_regulation_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const documents = await Promise.all(
      (data ?? []).map(async (d) => ({ ...d, url: await signedUrlFor(d.storage_path) }))
    );

    return NextResponse.json({ documents });
  } catch (err) {
    return apiCatch(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await currentStaff();
    if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be under 20MB." }, { status: 400 });
    }

    const path = `regulations/${randomBytes(8).toString("hex")}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadAsset(path, buffer, "application/pdf");

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("label_regulation_documents")
      .insert({ file_name: file.name, storage_path: path, size_bytes: file.size, uploaded_by: staff.userId ?? null, uploaded_by_email: staff.email })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, document: data });
  } catch (err) {
    return apiCatch(err);
  }
}
