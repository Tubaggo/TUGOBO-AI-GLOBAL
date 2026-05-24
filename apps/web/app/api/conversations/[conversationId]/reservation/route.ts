import { NextResponse } from "next/server";
import { z } from "zod";
import { createReservationFromConversation } from "@/lib/server/reservations/service";
import { isLiveOpsEnabled, requirePilotHotelId } from "@/lib/server/pilot-hotel";

export const runtime = "nodejs";

const createSchema = z.object({
  roomType: z.string().max(120).optional(),
  totalAmount: z.string().max(20).optional(),
  currency: z.string().max(8).optional(),
  status: z.enum(["pending_payment", "confirmed", "cancelled", "refunded"]).optional(),
});

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function POST(req: Request, context: RouteContext) {
  if (!isLiveOpsEnabled()) {
    return NextResponse.json({ ok: false, live: false, error: "live_ops_disabled" }, { status: 503 });
  }

  const { conversationId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  try {
    const hotelId = requirePilotHotelId();
    const reservation = await createReservationFromConversation({
      hotelId,
      conversationId,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, reservation });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown_error";
    if (code === "conversation_not_found") {
      return NextResponse.json({ ok: false, error: "conversation_not_found" }, { status: 404 });
    }
    if (code === "database_not_configured") {
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
    }

    console.error("[RESERVATION_CREATE]", {
      error: code,
      conversationId,
    });
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
}
