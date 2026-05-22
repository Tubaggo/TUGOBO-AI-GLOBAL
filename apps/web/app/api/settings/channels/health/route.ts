import { NextResponse } from "next/server";
import { listChannelHealth, validateSettingsHotelId } from "@/lib/server/channels/service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let hotelId: string;

  try {
    hotelId = validateSettingsHotelId(new URL(req.url).searchParams.get("hotel_id"));
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json(
      {
        ok: false,
        error: code === "invalid_hotel_id" ? "invalid_hotel_id" : "hotel_not_configured",
        message:
          code === "invalid_hotel_id"
            ? "Requested hotel_id does not match the active workspace."
            : "Hotel workspace is not configured.",
      },
      { status: code === "invalid_hotel_id" ? 403 : 503 }
    );
  }

  try {
    const health = await listChannelHealth(hotelId, new URL(req.url).origin);
    return NextResponse.json({ ok: true, hotelId, channels: health });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "channel_health_unavailable",
        message: "Channel health is not available.",
      },
      { status: 503 }
    );
  }
}
