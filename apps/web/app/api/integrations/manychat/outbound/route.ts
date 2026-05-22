import { NextResponse } from "next/server";
import {
  hasManychatLocalDevSecret,
  isManychatLocalDevOutboundPayload,
  isValidManychatInternalToken,
  parseManychatOutboundPayload,
  sendManychatOutboundMessage,
} from "@/lib/server/integrations/manychat-outbound";
import { validateManychatSecret } from "@/lib/server/conversations/service";
import { recordManychatDevRuntimeEvent } from "@/lib/server/integrations/manychat-dev-events";
import { updateChannelHealthFromEvent } from "@/lib/server/channels/service";
import { recordOperationFeedEvent } from "@/lib/server/operations/operation-feed";

export const runtime = "nodejs";

function outboundResponse(result: Awaited<ReturnType<typeof sendManychatOutboundMessage>>) {
  const configMissing = result.metadata?.error === "manychat_bridge_config_missing";

  return {
    success: result.deliveryStatus !== "failed",
    provider: result.provider,
    deliveryStatus: result.deliveryStatus,
    mockMode: result.mockMode,
    externalMessageId: result.externalMessageId,
    ...(configMissing
      ? {
          error: "manychat_bridge_config_missing",
          message: "Manychat bridge outbound config is missing for this hotel and channel.",
        }
      : {}),
  };
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

  const parsed = parseManychatOutboundPayload(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, error: parsed.error, message: parsed.message },
      { status: 400 }
    );
  }

  const normalized = parsed.data;

  if (isManychatLocalDevOutboundPayload(normalized)) {
    if (!hasManychatLocalDevSecret(normalized) && !isValidManychatInternalToken(normalized.internalAuthToken)) {
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
        conversationId: normalized.conversationId,
      });

      return NextResponse.json(
        { success: false, error: "forbidden", message: "Shared secret validation failed." },
        { status: 403 }
      );
    }

    const result = await sendManychatOutboundMessage(normalized);
    recordManychatDevRuntimeEvent({
      messageId: normalized.clientMessageId,
      hotelId: normalized.hotelId,
      provider: "manychat",
      channel: normalized.channel,
      senderType: "staff",
      externalUserId: normalized.externalUserId,
      externalId: `manychat:${normalized.channel}:${normalized.externalUserId}`,
      message: normalized.message,
    });
    await updateChannelHealthFromEvent({
      hotelId: normalized.hotelId,
      channelType: normalized.channel,
      direction: "outbound",
      status: result.deliveryStatus === "failed" ? "error" : "active",
      deliveryFailed: result.deliveryStatus === "failed",
      lastError:
        result.deliveryStatus === "failed"
          ? "Teslimat hatası"
          : null,
    });
    await recordOperationFeedEvent({
      hotelId: normalized.hotelId,
      channel: normalized.channel,
      eventType: result.deliveryStatus === "failed" ? "delivery_failed" : "message_sent",
      title: result.deliveryStatus === "failed" ? "Teslimat hatası" : "Mesaj gönderildi",
      description:
        result.deliveryStatus === "failed"
          ? "Misafire yanıt teslim edilemedi."
          : "Operatör misafire yanıt gönderdi.",
      severity: result.deliveryStatus === "failed" ? "error" : "success",
      conversationId: normalized.conversationId,
    });

    return NextResponse.json(outboundResponse(result));
  }

  if (!isValidManychatInternalToken(normalized.internalAuthToken)) {
    if (!normalized.secret) {
      return NextResponse.json(
        { success: false, error: "forbidden", message: "Shared secret or internal token is required." },
        { status: 403 }
      );
    }

    try {
      await validateManychatSecret({
        hotelId: normalized.hotelId,
        channel: normalized.channel,
        secret: normalized.secret,
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
        conversationId: normalized.conversationId,
      });

      return NextResponse.json(
        { success: false, error: "forbidden", message: "Shared secret validation failed." },
        { status: 403 }
      );
    }
  }

  const result = await sendManychatOutboundMessage(normalized);
  await updateChannelHealthFromEvent({
    hotelId: normalized.hotelId,
    channelType: normalized.channel,
    direction: "outbound",
    status: result.deliveryStatus === "failed" ? "error" : "active",
    deliveryFailed: result.deliveryStatus === "failed",
    lastError: result.deliveryStatus === "failed" ? "Teslimat hatası" : null,
  });
  await recordOperationFeedEvent({
    hotelId: normalized.hotelId,
    channel: normalized.channel,
    eventType: result.deliveryStatus === "failed" ? "delivery_failed" : "message_sent",
    title: result.deliveryStatus === "failed" ? "Teslimat hatası" : "Mesaj gönderildi",
    description:
      result.deliveryStatus === "failed"
        ? "Misafire yanıt teslim edilemedi."
        : "Operatör misafire yanıt gönderdi.",
    severity: result.deliveryStatus === "failed" ? "error" : "success",
    conversationId: normalized.conversationId,
  });
  const status =
    result.metadata?.error === "manychat_bridge_config_missing"
      ? 503
      : result.deliveryStatus === "failed"
        ? 502
        : 200;

  return NextResponse.json(outboundResponse(result), { status });
}
