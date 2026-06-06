import { NextResponse } from "next/server";
import { z } from "zod";
import {
  type ManagedChannelType,
  updateOutboundConfig,
  validateSettingsHotelId,
} from "@/lib/server/channels/service";
import { recordOperationFeedEvent } from "@/lib/server/operations/operation-feed";

export const runtime = "nodejs";

const configureSchema = z.object({
  hotel_id: z.string().trim().min(1).optional(),
  channelType: z.enum(["instagram", "whatsapp"]),
  outboundUrl: z.string().trim().max(500).optional(),
  outboundToken: z.string().trim().max(500).optional(),
});

function cleanError(error: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

function channelName(channelType: ManagedChannelType) {
  if (channelType === "instagram") return "Instagram";
  if (channelType === "whatsapp") return "WhatsApp";
  return "Web Chat";
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return cleanError("invalid_json", "Request body must be valid JSON.");
  }

  const parsed = configureSchema.safeParse(body);
  if (!parsed.success) {
    return cleanError("invalid_body", "Channel configuration payload is invalid.");
  }

  // A provided, non-empty URL must be a valid http(s) endpoint. Empty string is
  // allowed and clears the stored value.
  const outboundUrl = parsed.data.outboundUrl;
  if (outboundUrl && !/^https?:\/\//i.test(outboundUrl)) {
    return cleanError("invalid_url", "Giden URL geçerli bir http(s) adresi olmalıdır.");
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

  const channelType = parsed.data.channelType;

  try {
    const result = await updateOutboundConfig({
      hotelId,
      channelType,
      outboundUrl: parsed.data.outboundUrl,
      outboundToken: parsed.data.outboundToken,
    });

    await recordOperationFeedEvent({
      hotelId,
      channel: channelType,
      eventType: "channel_configuration_updated",
      title: "Kanal yapılandırması güncellendi",
      description: `${channelName(channelType)} giden bağlantı bilgileri güncellendi.`,
      severity: "info",
    });

    if (result.readiness === "connected") {
      await recordOperationFeedEvent({
        hotelId,
        channel: channelType,
        eventType: "channel_connected",
        title: "Kanal bağlandı",
        description: `${channelName(channelType)} giden bağlantısı hazır.`,
        severity: "success",
      });
    }

    return NextResponse.json({ ok: true, hotelId, result });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown_error";

    if (code === "database_not_configured") {
      return cleanError("service_unavailable", "Database is not configured.", 503);
    }

    return cleanError("channel_configure_failed", "Channel outbound config could not be saved.", 503);
  }
}
