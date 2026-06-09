import { NextResponse } from "next/server";
import { z } from "zod";
import { zodErrorMessage } from "./common";

export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 }),
    };
  }

  return { ok: true, data: parsed.data };
}
