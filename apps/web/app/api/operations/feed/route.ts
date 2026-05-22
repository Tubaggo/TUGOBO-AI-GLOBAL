import { NextResponse } from "next/server";
import { listOperationFeedEvents } from "@/lib/server/operations/operation-feed";
import { validateSettingsHotelId } from "@/lib/server/channels/service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);

  let hotelId: string;
  try {
    hotelId = validateSettingsHotelId(url.searchParams.get("hotel_id"));
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json(
      {
        ok: false,
        error: code === "invalid_hotel_id" ? "invalid_hotel_id" : "hotel_not_configured",
      },
      { status: code === "invalid_hotel_id" ? 403 : 503 }
    );
  }

  const limitParam = Number(url.searchParams.get("limit") ?? 20);
  const conversationId = url.searchParams.get("conversation_id");
  const events = await listOperationFeedEvents({
    hotelId,
    conversationId,
    limit: Number.isFinite(limitParam) ? limitParam : 20,
  });

  return NextResponse.json({ ok: true, hotelId, events });
}
