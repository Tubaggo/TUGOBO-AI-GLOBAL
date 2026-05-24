import { NextResponse } from "next/server";
import { inngest } from "@tugobo/core";
import { logger } from "@tugobo/shared";
import {
  ingestGuestMessage,
  ingestManychatMessage,
  validateManychatSecret,
} from "@/lib/server/conversations/service";
import { isLiveOpsEnabled, resolvePilotHotelId } from "@/lib/server/pilot-hotel";
import {
  isManychatLocalDevPayload,
  MANYCHAT_LOCAL_TEST_SECRET,
  parseManychatInboundPayload,
  type NormalizedManychatInboundMessage,
} from "@/lib/server/integrations/manychat";
import { recordManychatDevRuntimeEvent } from "@/lib/server/integrations/manychat-dev-events";
import { updateChannelHealthFromEvent } from "@/lib/server/channels/service";
import { recordOperationFeedEvent } from "@/lib/server/operations/operation-feed";
import {
  hasReservationIntent,
  recordReservationLifecycleEvent,
} from "@/lib/server/reservations/lifecycle";

export const runtime = "nodejs";

async function handleLocalDevFallback(normalized: NormalizedManychatInboundMessage) {
  if (normalized.secret !== MANYCHAT_LOCAL_TEST_SECRET) {
    await updateChannelHealthFromEvent({
      hotelId: normalized.hotelId,
      channelType: normalized.channel,
      status: "error",
      deliveryFailed: true,
      incrementMessageCount: false,
      lastError: "Yetkisiz kanal isteği engellendi.",
    });
    await recordOperationFeedEvent({
      hotelId: normalized.hotelId,
      channel: normalized.channel,
      eventType: "unauthorized_channel_request",
      title: "Teslimat hatası",
      description: "Yetkisiz kanal isteği engellendi.",
      severity: "error",
    });

    return NextResponse.json(
      {
        success: false,
        error: "forbidden",
        message: "Shared secret validation failed.",
      },
      { status: 403 }
    );
  }

  if (isLiveOpsEnabled()) {
    const fallbackHotelId = resolvePilotHotelId();

    if (fallbackHotelId) {
      const result = await ingestGuestMessage({
        hotelId: fallbackHotelId,
        channel: normalized.channel,
        guestName: normalized.guestName,
        message: normalized.message,
        externalSessionId: `manychat:${normalized.channel}:${normalized.externalUserId}`,
        guestPhone: normalized.guestPhone,
      });

      return NextResponse.json({
        success: true,
        provider: normalized.provider,
        channel: normalized.channel,
        hotelId: normalized.hotelId,
        conversationId: result.conversationId,
        messageId: result.messageId,
        aiSuggestionPrepared: true,
        localDevFallback: true,
        mode: "live-ops-bridge",
      });
    }
  }

  recordManychatDevRuntimeEvent({
    hotelId: normalized.hotelId,
    provider: normalized.provider,
    channel: normalized.channel,
    externalUserId: normalized.externalUserId,
    externalId: `manychat:${normalized.channel}:${normalized.externalUserId}`,
    guestName: normalized.guestName,
    message: normalized.message,
  });
  await updateChannelHealthFromEvent({
    hotelId: normalized.hotelId,
    channelType: normalized.channel,
    direction: "inbound",
    status: "active",
    lastError: null,
  });
  await recordOperationFeedEvent({
    hotelId: normalized.hotelId,
    channel: normalized.channel,
    eventType: "guest_request_received",
    title: "Misafir talebi alındı",
    description: "Instagram üzerinden yeni misafir talebi alındı.",
    severity: "info",
    conversationId: `demo-manychat-${normalized.channel}-${normalized.externalUserId}`,
  });
  await recordOperationFeedEvent({
    hotelId: normalized.hotelId,
    channel: normalized.channel,
    eventType: "ai_support_prepared",
    title: "AI destek hazırlandı",
    description: "AI destek hazır.",
    severity: "success",
    conversationId: `demo-manychat-${normalized.channel}-${normalized.externalUserId}`,
  });

  if (hasReservationIntent(normalized.message)) {
    await recordReservationLifecycleEvent({
      hotelId: normalized.hotelId,
      conversationId: `demo-manychat-${normalized.channel}-${normalized.externalUserId}`,
      state: "inquiry_received",
      actor: "guest",
      severity: "info",
    });
  }

  return NextResponse.json({
    success: true,
    provider: normalized.provider,
    channel: normalized.channel,
    hotelId: normalized.hotelId,
    conversationId: `demo-manychat-${normalized.channel}-${normalized.externalUserId}`,
    messageId: `demo-message-${normalized.channel}-${Date.now()}`,
    aiSuggestionPrepared: true,
    localDevFallback: true,
    mode: "mock-bridge",
  });
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_json", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = parseManychatInboundPayload(body);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        success: false,
        error: "invalid_body",
        message: parsed.message,
      },
      { status: 400 }
    );
  }

  const normalized = parsed.data;

  if (isManychatLocalDevPayload(normalized)) {
    try {
      return await handleLocalDevFallback(normalized);
    } catch (err) {
      logger.error("Manychat local dev fallback failed", {
        error: err instanceof Error ? err.message : String(err),
      });

      return NextResponse.json(
        {
          success: false,
          error: "dev_fallback_failed",
          message: "Local Manychat fallback could not ingest the message.",
        },
        { status: 500 }
      );
    }
  }

  try {
    await validateManychatSecret({
      hotelId: normalized.hotelId,
      channel: normalized.channel,
      secret: normalized.secret,
    });

    const result = await ingestManychatMessage({
      hotelId: normalized.hotelId,
      provider: normalized.provider,
      channel: normalized.channel,
      externalUserId: normalized.externalUserId,
      guestName: normalized.guestName,
      username: normalized.username,
      guestPhone: normalized.guestPhone,
      message: normalized.message,
      timestamp: normalized.timestamp,
    });

    try {
      await inngest.send({
        name: "conversation/ai-suggestion.requested",
        data: {
          hotelId: normalized.hotelId,
          conversationId: result.conversationId,
          messageId: result.messageId,
          provider: normalized.provider,
          channel: normalized.channel,
          source: "manychat",
          supervised: true,
          requestedAt: normalized.timestamp.toISOString(),
        },
      });
    } catch (err) {
      logger.warn("Manychat AI suggestion event dispatch failed", {
        hotelId: normalized.hotelId,
        conversationId: result.conversationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({
      success: true,
      provider: normalized.provider,
      channel: normalized.channel,
      hotelId: normalized.hotelId,
      conversationId: result.conversationId,
      messageId: result.messageId,
      aiSuggestionPrepared: result.aiSuggestionPrepared,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown_error";

    if (code === "hotel_not_found") {
      return NextResponse.json(
        { success: false, error: "hotel_not_found", message: "Unknown hotel_id." },
        { status: 404 }
      );
    }

    if (code === "channel_not_connected") {
      return NextResponse.json(
        {
          success: false,
          error: "channel_not_connected",
          message: "No connected Manychat channel found for this hotel and channel.",
        },
        { status: 404 }
      );
    }

    if (code === "invalid_secret") {
      await updateChannelHealthFromEvent({
        hotelId: normalized.hotelId,
        channelType: normalized.channel,
        status: "error",
        deliveryFailed: true,
        incrementMessageCount: false,
        lastError: "Yetkisiz kanal isteği engellendi.",
      });
      await recordOperationFeedEvent({
        hotelId: normalized.hotelId,
        channel: normalized.channel,
        eventType: "unauthorized_channel_request",
        title: "Teslimat hatası",
        description: "Yetkisiz kanal isteği engellendi.",
        severity: "error",
      });

      return NextResponse.json(
        { success: false, error: "forbidden", message: "Shared secret validation failed." },
        { status: 403 }
      );
    }

    if (code === "manychat_bridge_config_missing") {
      return NextResponse.json(
        {
          success: false,
          error: "manychat_bridge_config_missing",
          message: "Manychat bridge inbound config is missing for this hotel and channel.",
        },
        { status: 503 }
      );
    }

    if (code === "database_not_configured") {
      return NextResponse.json(
        { success: false, error: "service_unavailable", message: "Database is not configured." },
        { status: 503 }
      );
    }

    logger.error("Manychat inbound webhook failed", {
      error: code,
    });

    return NextResponse.json(
      { success: false, error: "internal_error", message: "Failed to ingest Manychat message." },
      { status: 500 }
    );
  }
}
