import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Unauthenticated wiring check — presence booleans only, never a value.
// curl https://customlabel.netlify.app/api/selftest must return ok:true
// BEFORE the first SPINE tile click. A missing secret looks exactly like an
// expired token from the browser; this names it in one line.
const present = (k: string) => Boolean(process.env[k]);

export async function GET() {
  return NextResponse.json({
    ok: present("ATLAS_BRIDGE_SECRET") && present("LABELGEN_SESSION_SECRET"),
    surface: "module_label-generator",
    secrets: {
      ATLAS_BRIDGE_SECRET: present("ATLAS_BRIDGE_SECRET"), // copied from SPINE
      LABELGEN_SESSION_SECRET: present("LABELGEN_SESSION_SECRET"), // generated (openssl rand -base64 48)
    },
  });
}
