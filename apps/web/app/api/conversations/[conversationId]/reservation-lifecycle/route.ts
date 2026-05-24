import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listReservationLifecycleEvents,
  recordReservationLifecycleEvent,
} from "@/lib/server/reservations/lifecycle";
import { isLiveOpsEnabled, resolvePilotHotelId } from "@/lib/server/pilot-hotel";

export const runtime = "nodejs";

const lifecycleSchema = z.object({
  hotel_id: z.string().min(1).max(80).optional(),
  reservation_id: z.string().uuid().optional(),
  state: z.enum([
    "inquiry_received",
    "quote_prepared",
    "quote_sent",
    "payment_link_sent",
    "payment_pending",
    "confirmed",
    "cancelled",
    "expired",
    "human_review_required",
  ]),
  title: z.string().min(1).max(160).optional(),
  description: z.string().min(1).max(280).optional(),
  actor: z.enum(["guest", "ai", "operator", "system"]).default("operator"),
  severity: z.enum(["info", "success", "warning", "error"]).optional(),
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
    const events = await listReservationLifecycleEvents({
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

  const parsed = lifecycleSchema.safeParse(body);
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
    const event = await recordReservationLifecycleEvent({
      hotelId,
      conversationId,
      reservationId: parsed.data.reservation_id,
      state: parsed.data.state,
      title: parsed.data.title,
      description: parsed.data.description,
      actor: parsed.data.actor,
      severity: parsed.data.severity,
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
      { ok: false, error: "lifecycle_update_failed" },
      { status: 500 }
    );
  }
}
