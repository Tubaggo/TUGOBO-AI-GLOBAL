import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getConnectedChannel,
  type ManagedChannelType,
  updateChannelHealthFromEvent,
  validateSettingsHotelId,
} from "@/lib/server/channels/service";
import {
  MANYCHAT_LOCAL_TEST_HOTEL_ID,
  MANYCHAT_LOCAL_TEST_SECRET,
} from "@/lib/server/integrations/manychat-config";
import { recordOperationFeedEvent } from "@/lib/server/operations/operation-feed";

export const runtime = "nodejs";

const channelTestSchema = z.object({
  hotel_id: z.string().trim().min(1).optional(),
  channelType: z.enum(["web_chat", "instagram", "whatsapp"]),
});

type ChannelTestStatus = "success" | "pending" | "error";

function cleanError(error: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

function channelName(channelType: ManagedChannelType) {
  if (channelType === "instagram") return "Instagram";
  if (channelType === "whatsapp") return "WhatsApp";
  return "Web Chat";
}

async function recordChannelTest(
  hotelId: string,
  channelType: ManagedChannelType,
  status: ChannelTestStatus
) {
  await updateChannelHealthFromEvent({
    hotelId,
    channelType,
    tested: true,
    status: status === "success" ? "active" : status === "error" ? "error" : "pending",
    incrementMessageCount: false,
    lastError: status === "error" ? "Bağlantı testi tamamlanamadı." : null,
  });
  await recordOperationFeedEvent({
    hotelId,
    channel: channelType,
    eventType:
      status === "success"
        ? "connection_test_success"
        : status === "error"
          ? "delivery_failed"
          : "channel_pending",
    title:
      status === "success"
        ? "Bağlantı testi başarılı"
        : status === "error"
          ? "Teslimat hatası"
          : "Kanal bağlantısı beklemede",
    description:
      status === "success"
        ? `${channelName(channelType)} bağlantı testi başarılı.`
        : status === "error"
          ? `${channelName(channelType)} bağlantı testi tamamlanamadı.`
          : `${channelName(channelType)} bağlantısı beklemede.`,
    severity: status === "success" ? "success" : status === "error" ? "error" : "warning",
  });
}

async function testResult(
  hotelId: string,
  channelType: ManagedChannelType,
  status: ChannelTestStatus,
  message: string
) {
  await recordChannelTest(hotelId, channelType, status);
  return NextResponse.json({
    ok: true,
    result: {
      channelType,
      status,
      message,
      testedAt: new Date().toISOString(),
    },
  });
}

async function runLocalInstagramTest(req: Request) {
  const url = new URL("/api/integrations/manychat/inbound", new URL(req.url).origin);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hotel_id: MANYCHAT_LOCAL_TEST_HOTEL_ID,
      secret: MANYCHAT_LOCAL_TEST_SECRET,
      provider: "manychat",
      channel: "instagram",
      external_user_id: "admin-test-user",
      guest_name: "Test Guest",
      message: "Bağlantı testi",
      timestamp: new Date().toISOString(),
    }),
  });

  return response.ok;
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return cleanError("invalid_json", "Request body must be valid JSON.");
  }

  const parsed = channelTestSchema.safeParse(body);
  if (!parsed.success) {
    return cleanError("invalid_body", "Channel test payload is invalid.");
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

  if (channelType === "web_chat") {
    return testResult(hotelId, channelType, "success", "Web Chat aktif.");
  }

  if (channelType === "whatsapp") {
    return testResult(hotelId, channelType, "pending", "WhatsApp bağlantısı beklemede veya test yapılandırması eksik.");
  }

  if (process.env.NODE_ENV !== "production" && hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID) {
    try {
      const ok = await runLocalInstagramTest(req);
      return testResult(
        hotelId,
        channelType,
        ok ? "success" : "error",
        ok ? "Instagram test mesajı yerel akışa iletildi." : "Instagram yerel test akışı başarısız oldu."
      );
    } catch {
      return testResult(hotelId, channelType, "error", "Instagram yerel test akışı çalıştırılamadı.");
    }
  }

  try {
    const config = await getConnectedChannel(hotelId, channelType);
    if (!config) {
      return testResult(hotelId, channelType, "pending", "Instagram bağlantısı için kayıt bulunamadı.");
    }

    if (config.status === "error") {
      return testResult(hotelId, channelType, "error", config.lastError ?? "Instagram bağlantısında hata var.");
    }

    if (config.inboundSecret && config.status === "active") {
      return testResult(hotelId, channelType, "success", "Instagram bağlantısı hazır.");
    }

    return testResult(hotelId, channelType, "pending", "Instagram bağlantısı beklemede veya gizli anahtar eksik.");
  } catch {
    return testResult(hotelId, channelType, "pending", "Instagram bağlantısı şu anda test edilemedi.");
  }
}
