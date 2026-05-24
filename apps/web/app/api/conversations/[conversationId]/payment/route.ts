import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listPaymentEvents,
  recordPaymentEvent,
} from "@/lib/server/payments/payment-runtime";
import { isLiveOpsEnabled, resolvePilotHotelId } from "@/lib/server/pilot-hotel";

export const runtime = "nodejs";

const paymentSchema = z.object({
  hotel_id: z.string().min(1).max(80).optional(),
  reservation_id: z.string().uuid().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().min(1).max(8).optional(),
  state: z.enum([
    "not_started",
    "payment_link_sent",
    "payment_pending",
    "paid",
    "failed",
    "expired",
    "refunded",
  ]),
  title: z.string().min(1).max(160).optional(),
  description: z.string().min(1).max(280).optional(),
  actor: z.enum(["guest", "ai", "operator", "system"]).default("operator"),
});

type RouteContext = { params: Promise<{ conversationId: string }> };

function resolveHotelId(req: Request, bodyHotelId?: string): string | null {
  const url = new URL(req.url);
  return bodyHotelId ?? url.searchParams.get("hotel_id") ?? resolvePilotHotelId();
}

export async function GET(req: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const hotelId = resolveHotelId(req);

  if (!hotelId) {
    return NextResponse.json(
      { ok: false, error: "hotel_not_configured", events: [] },
      { status: 503 }
    );
  }

  if (!isLiveOpsEnabled() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: true, live: false, events: [] });
  }

  try {
    const events = await listPaymentEvents({
      hotelId,
      conversationId,
      limit: 20,
    });

    return NextResponse.json({ ok: true, hotelId, conversationId, events });
  } catch {
    return NextResponse.json({ ok: true, hotelId, conversationId, events: [] });
  }
}

export async function POST(req: Request, context: RouteContext) {
  const { conversationId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const hotelId = resolveHotelId(req, parsed.data.hotel_id);
  if (!hotelId) {
    return NextResponse.json(
      { ok: false, error: "hotel_not_configured" },
      { status: 503 }
    );
  }

  if (!isLiveOpsEnabled() && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, live: false, error: "live_ops_disabled" },
      { status: 503 }
    );
  }

  try {
    const event = await recordPaymentEvent({
      hotelId,
      conversationId,
      reservationId: parsed.data.reservation_id,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      state: parsed.data.state,
      title: parsed.data.title,
      description: parsed.data.description,
      actor: parsed.data.actor,
    });

    return NextResponse.json({ ok: true, hotelId, conversationId, event });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown_error";
    if (code === "conversation_not_found") {
      return NextResponse.json(
        { ok: false, error: "conversation_not_found" },
        { status: 404 }
      );
    }

    if (code === "database_not_configured") {
      return NextResponse.json(
        { ok: false, error: "service_unavailable" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "payment_update_failed" },
      { status: 500 }
    );
  }
}
