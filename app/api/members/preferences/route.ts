export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAppOrg } from "@/lib/auth/get-app-org";
import {
  loadBookkeepingPreference,
  saveBookkeepingPreference,
} from "@/lib/member-preferences";

export async function GET() {
  const org = await getAppOrg();
  if (!org.ok) {
    return NextResponse.json(
      { error: org.reason === "unauthorized" ? "Unauthorized" : org.message },
      { status: org.reason === "unauthorized" ? 401 : 400 }
    );
  }

  const result = await loadBookkeepingPreference(org.userId, org.orgId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    show_invoice_bookkeeping_status: result.show_invoice_bookkeeping_status,
  });
}

export async function PATCH(req: NextRequest) {
  const org = await getAppOrg();
  if (!org.ok) {
    return NextResponse.json(
      { error: org.reason === "unauthorized" ? "Unauthorized" : org.message },
      { status: org.reason === "unauthorized" ? 401 : 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    show_invoice_bookkeeping_status?: boolean;
  };

  if (typeof body.show_invoice_bookkeeping_status !== "boolean") {
    return NextResponse.json(
      { error: "show_invoice_bookkeeping_status (boolean) wajib" },
      { status: 400 }
    );
  }

  const result = await saveBookkeepingPreference(
    org.userId,
    org.orgId,
    body.show_invoice_bookkeeping_status
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    show_invoice_bookkeeping_status: result.show_invoice_bookkeeping_status,
  });
}
