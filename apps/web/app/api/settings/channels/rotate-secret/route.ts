import { NextResponse } from "next/server";
import { z } from "zod";
import {
  rotateChannelSecret,
  validateSettingsHotelId,
} from "@/lib/server/channels/service";

export const runtime = "nodejs";

const rotateSecretSchema = z.object({
  hotel_id: z.string().trim().min(1).optional(),
  channelType: z.enum(["instagram", "whatsapp"]),
});

function cleanError(error: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return cleanError("invalid_json", "Request body must be valid JSON.");
  }

  const parsed = rotateSecretSchema.safeParse(body);
  if (!parsed.success) {
    return cleanError("invalid_body", "Secret rotation payload is invalid.");
  }

  let hotelId: string;
  try {
    hotelId = validateSettingsHotelId(parsed.data.hotel_id);
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown_error";
    return cleanError(
      code === "invalid_hotel_id" ? "invalid_hotel_id" : "hotel_not_configured",
      code === "invalid_hotel_id"
        ? "Requested hotel_id does not match the active workspace."
        : "Hotel workspace is not configured.",
      code === "invalid_hotel_id" ? 403 : 503
    );
  }

  try {
    const result = await rotateChannelSecret({
      hotelId,
      channelType: parsed.data.channelType,
    });

    return NextResponse.json({ ok: true, hotelId, result });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown_error";

    if (code === "database_not_configured") {
      return cleanError("service_unavailable", "Database is not configured.", 503);
    }

    return cleanError("secret_rotation_failed", "Channel secret could not be rotated.", 503);
  }
}
