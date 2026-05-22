import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getConnectedChannel,
  type ManagedChannelType,
  validateSettingsHotelId,
} from "@/lib/server/channels/service";
import {
  MANYCHAT_LOCAL_TEST_HOTEL_ID,
  MANYCHAT_LOCAL_TEST_SECRET,
} from "@/lib/server/integrations/manychat-config";

export const runtime = "nodejs";

const channelTestSchema = z.object({
  hotel_id: z.string().trim().min(1).optional(),
  channelType: z.enum(["web_chat", "instagram", "whatsapp"]),
});

type ChannelTestStatus = "success" | "pending" | "error";

function cleanError(error: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

function testResult(channelType: ManagedChannelType, status: ChannelTestStatus, message: string) {
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
    return testResult(channelType, "success", "Web Chat aktif.");
  }

  if (channelType === "whatsapp") {
    return testResult(channelType, "pending", "WhatsApp bağlantısı beklemede veya test yapılandırması eksik.");
  }

  if (process.env.NODE_ENV !== "production" && hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID) {
    try {
      const ok = await runLocalInstagramTest(req);
      return testResult(
        channelType,
        ok ? "success" : "error",
        ok ? "Instagram test mesajı yerel akışa iletildi." : "Instagram yerel test akışı başarısız oldu."
      );
    } catch {
      return testResult(channelType, "error", "Instagram yerel test akışı çalıştırılamadı.");
    }
  }

  try {
    const config = await getConnectedChannel(hotelId, channelType);
    if (!config) {
      return testResult(channelType, "pending", "Instagram bağlantısı için kayıt bulunamadı.");
    }

    if (config.status === "error") {
      return testResult(channelType, "error", config.lastError ?? "Instagram bağlantısında hata var.");
    }

    if (config.inboundSecret && config.status === "active") {
      return testResult(channelType, "success", "Instagram webhook yapılandırması hazır.");
    }

    return testResult(channelType, "pending", "Instagram bağlantısı beklemede veya gizli anahtar eksik.");
  } catch {
    return testResult(channelType, "pending", "Instagram bağlantısı şu anda test edilemedi.");
  }
}
