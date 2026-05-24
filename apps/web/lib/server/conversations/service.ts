import {
  and,
  channels,
  contacts,
  conversations,
  db,
  desc,
  eq,
  hotels,
  inArray,
  messages,
  operationalEvents,
  type DB,
} from "@tugobo/db";
import { logger, type ConnectedChannelProvider, type PanelChannelType } from "@tugobo/shared";
import { dbConversationToLive, dbMessageToLive } from "@/lib/channels/db-bridge";
import type { LiveConversation, LiveMessage } from "@/lib/conversation/models";
import type { TakeoverAction } from "@/lib/conversation/models";
import { generateHotelAssistantResponse } from "@/lib/ai/aiClient";
import type { AiRespondRequest } from "@/lib/ai/types";
import { sendManychatOutboundMessage } from "@/lib/server/integrations/manychat-outbound";
import { updateChannelHealthFromEvent, validateChannelSecret } from "@/lib/server/channels/service";
import { recordOperationFeedEvent } from "@/lib/server/operations/operation-feed";
import {
  aiSuggestionFromLifecycleEvent,
  getLatestReservationLifecycleEvent,
  getReservationSummaryForConversation,
  hasReservationIntent,
  recordReservationLifecycleEvent,
} from "@/lib/server/reservations/lifecycle";
import { getLatestPaymentEvent } from "@/lib/server/payments/payment-runtime";

type ConversationRow = {
  conversation: typeof conversations.$inferSelect;
  contact: typeof contacts.$inferSelect;
  lastContent?: string;
};

function assertDb(): DB {
  if (!db) throw new Error("database_not_configured");
  return db;
}

function providerFromChannel(channel: PanelChannelType) {
  if (channel === "web_chat") return "web_chat" as const;
  if (channel === "instagram") return "instagram_dm" as const;
  return "whatsapp_cloud" as const;
}

function manychatSessionId(channel: Extract<PanelChannelType, "instagram" | "whatsapp">, externalUserId: string) {
  return `manychat:${channel}:${externalUserId}`;
}

function manychatExternalUserIdFromSessionId(
  channel: Extract<PanelChannelType, "instagram" | "whatsapp">,
  externalSessionId: string | null
): string | null {
  const prefix = manychatSessionId(channel, "");
  if (!externalSessionId?.startsWith(prefix)) return null;

  const externalUserId = externalSessionId.slice(prefix.length).trim();
  return externalUserId.length > 0 ? externalUserId : null;
}

function asProviderMetadata(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  return input as Record<string, unknown>;
}

async function ensurePanelChannel(
  database: DB,
  hotelId: string,
  panelChannel: PanelChannelType
): Promise<string> {
  const externalAddress =
    panelChannel === "web_chat"
      ? `web@${hotelId.slice(0, 8)}`
      : panelChannel === "instagram"
        ? `ig@${hotelId.slice(0, 8)}`
        : `wa@${hotelId.slice(0, 8)}`;

  const existing = await database
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.hotelId, hotelId), eq(channels.externalAddress, externalAddress)))
    .limit(1);

  if (existing[0]?.id) return existing[0].id;

  const provider = providerFromChannel(panelChannel);

  const [row] = await database
    .insert(channels)
    .values({
      hotelId,
      provider,
      channelType: panelChannel,
      status: "active",
      metadata: { panelChannel },
      externalAddress,
    })
    .returning({ id: channels.id });

  if (!row?.id) throw new Error("channel_create_failed");
  return row.id;
}

async function findOrCreateContact(
  database: DB,
  hotelId: string,
  guestName: string,
  guestPhone: string,
  language?: string
) {
  const [existing] = await database
    .select()
    .from(contacts)
    .where(and(eq(contacts.hotelId, hotelId), eq(contacts.phone, guestPhone)))
    .limit(1);

  if (existing) {
    if (guestName && existing.name !== guestName) {
      await database
        .update(contacts)
        .set({ name: guestName, updatedAt: new Date() })
        .where(eq(contacts.id, existing.id));
    }
    return existing;
  }

  const [created] = await database
    .insert(contacts)
    .values({
      hotelId,
      phone: guestPhone,
      name: guestName,
      language: language?.toLowerCase() ?? "tr",
    })
    .returning();

  if (!created) throw new Error("contact_create_failed");
  return created;
}

async function hotelExists(database: DB, hotelId: string): Promise<boolean> {
  const [hotel] = await database
    .select({ id: hotels.id })
    .from(hotels)
    .where(eq(hotels.id, hotelId))
    .limit(1);

  return Boolean(hotel?.id);
}

async function findManychatChannel(
  database: DB,
  hotelId: string,
  channel: Extract<PanelChannelType, "instagram" | "whatsapp">
) {
  const [connectedChannel] = await database
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.hotelId, hotelId),
        eq(channels.provider, "manychat"),
        eq(channels.channelType, channel),
        inArray(channels.status, ["active", "connected"])
      )
    )
    .limit(1);

  return connectedChannel ?? null;
}

async function findConversationByExternalSessionId(
  database: DB,
  hotelId: string,
  externalSessionId: string
) {
  const [row] = await database
    .select({
      conversation: conversations,
      contact: contacts,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(
      and(
        eq(conversations.hotelId, hotelId),
        eq(conversations.externalSessionId, externalSessionId)
      )
    )
    .limit(1);

  return row ?? null;
}

async function updateContactProfile(
  database: DB,
  contactId: string,
  input: {
    guestName: string;
    guestPhone?: string;
    language?: string;
  }
) {
  const [existing] = await database
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!existing) throw new Error("contact_not_found");

  const nextName = input.guestName.trim() || existing.name || "Misafir";
  const nextPhone =
    input.guestPhone?.trim() ||
    existing.phone;
  const nextLanguage = input.language?.toLowerCase() ?? existing.language ?? "tr";

  if (
    existing.name === nextName &&
    existing.phone === nextPhone &&
    (existing.language ?? "tr") === nextLanguage
  ) {
    return existing;
  }

  const [updated] = await database
    .update(contacts)
    .set({
      name: nextName,
      phone: nextPhone,
      language: nextLanguage,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId))
    .returning();

  if (!updated) throw new Error("contact_update_failed");
  return updated;
}

export async function listLiveConversations(hotelId: string): Promise<LiveConversation[]> {
  const database = assertDb();

  const rows = await database
    .select({
      conversation: conversations,
      contact: contacts,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(eq(conversations.hotelId, hotelId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  const result: LiveConversation[] = [];
  for (const row of rows) {
    const [lastMsg] = await database
      .select({ content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, row.conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    const latestLifecycleEvent = await getLatestReservationLifecycleEvent({
      hotelId,
      conversationId: row.conversation.id,
    });
    const latestPaymentEvent = await getLatestPaymentEvent({
      hotelId,
      conversationId: row.conversation.id,
    });
    const reservation = await getReservationSummaryForConversation({
      hotelId,
      conversationId: row.conversation.id,
    });

    result.push({
      ...dbConversationToLive(row.conversation, row.contact, lastMsg?.content),
      latestLifecycleEvent,
      latestPaymentEvent,
      reservation,
      aiSuggestion: aiSuggestionFromLifecycleEvent(latestLifecycleEvent),
    });
  }
  return result;
}

export async function getConversationMessages(
  conversationId: string
): Promise<LiveMessage[]> {
  const database = assertDb();

  const rows = await database
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  return rows.map(dbMessageToLive);
}

export type IngestMessageParams = {
  hotelId: string;
  channel: PanelChannelType;
  guestName: string;
  message: string;
  externalSessionId?: string;
  conversationId?: string;
  guestPhone?: string;
  language?: string;
};

export type IngestManychatMessageParams = {
  hotelId: string;
  channel: Extract<PanelChannelType, "instagram" | "whatsapp">;
  provider: Extract<ConnectedChannelProvider, "manychat">;
  externalUserId: string;
  guestName: string;
  username?: string;
  guestPhone?: string;
  message: string;
  timestamp: Date;
};

export async function ingestGuestMessage(
  params: IngestMessageParams
): Promise<{ conversationId: string; messageId: string }> {
  const database = assertDb();
  const now = new Date();
  const phone =
    params.guestPhone?.trim() ||
    (params.externalSessionId
      ? `session:${params.externalSessionId}`
      : `anon:${Date.now()}`);

  const contact = await findOrCreateContact(
    database,
    params.hotelId,
    params.guestName,
    phone,
    params.language
  );

  let conversationId = params.conversationId;

  if (!conversationId && params.externalSessionId) {
    const [existing] = await database
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.hotelId, params.hotelId),
          eq(conversations.externalSessionId, params.externalSessionId)
        )
      )
      .limit(1);
    conversationId = existing?.id;
  }

  if (!conversationId) {
    const channelId = await ensurePanelChannel(database, params.hotelId, params.channel);
    const [conv] = await database
        .insert(conversations)
      .values({
        hotelId: params.hotelId,
        contactId: contact.id,
        connectedChannelId: channelId,
        channel: params.channel,
        externalSessionId: params.externalSessionId,
        status: "ai_active",
        reservationState: "inquiry",
        lastMessageAt: now,
      })
      .returning();

    if (!conv) throw new Error("conversation_create_failed");
    conversationId = conv.id;
  }

  const [msg] = await database
    .insert(messages)
    .values({
      conversationId,
      senderType: "guest",
      content: params.message,
      provider: providerFromChannel(params.channel),
      deliveryStatus: "delivered",
    })
    .returning();

  if (!msg) throw new Error("message_create_failed");

  const currentUnread = await unreadCountFor(database, conversationId);
  await database
    .update(conversations)
    .set({
      lastMessageAt: now,
      unreadCount: currentUnread + 1,
      reservationState: "inquiry",
    })
    .where(eq(conversations.id, conversationId));

  await updateChannelHealthFromEvent({
    hotelId: params.hotelId,
    channelType: params.channel === "manual" ? "web_chat" : params.channel,
    direction: "inbound",
    status: "active",
    lastError: null,
  });
  await recordOperationFeedEvent({
    hotelId: params.hotelId,
    channel: params.channel === "manual" ? "web_chat" : params.channel,
    conversationId,
    eventType: "guest_request_received",
    title: "Misafir talebi alındı",
    description: "Yeni misafir talebi alındı.",
    severity: "info",
  });

  if (hasReservationIntent(params.message)) {
    await recordReservationLifecycleEvent({
      hotelId: params.hotelId,
      conversationId,
      state: "inquiry_received",
      actor: "guest",
      severity: "info",
    });
  }

  return { conversationId, messageId: msg.id };
}

export async function ingestManychatMessage(
  params: IngestManychatMessageParams
): Promise<{
  conversationId: string;
  messageId: string;
  aiSuggestionPrepared: boolean;
}> {
  const database = assertDb();
  const exists = await hotelExists(database, params.hotelId);

  if (!exists) throw new Error("hotel_not_found");

  const connectedChannel = await findManychatChannel(database, params.hotelId, params.channel);
  if (!connectedChannel) throw new Error("channel_not_connected");

  const externalSessionId = manychatSessionId(params.channel, params.externalUserId.trim());
  const fallbackPhone = `manychat:${params.channel}:${params.externalUserId.trim()}`;
  const normalizedName =
    params.guestName.trim() ||
    params.username?.trim() ||
    "Misafir";

  const existingConversation = await findConversationByExternalSessionId(
    database,
    params.hotelId,
    externalSessionId
  );

  let contact =
    existingConversation?.contact ??
    (await findOrCreateContact(
      database,
      params.hotelId,
      normalizedName,
      params.guestPhone?.trim() || fallbackPhone,
      undefined
    ));

  if (existingConversation?.contact.id || params.guestPhone?.trim()) {
    contact = await updateContactProfile(database, contact.id, {
      guestName: normalizedName,
      guestPhone: params.guestPhone?.trim(),
    });
  }

  let conversationId = existingConversation?.conversation.id;
  if (!conversationId) {
    const [conversation] = await database
      .insert(conversations)
      .values({
        hotelId: params.hotelId,
        contactId: contact.id,
        connectedChannelId: connectedChannel.id,
        channel: params.channel,
        externalSessionId,
        status: "ai_active",
        reservationState: "inquiry",
        lastMessageAt: params.timestamp,
      })
      .returning();

    if (!conversation) throw new Error("conversation_create_failed");
    conversationId = conversation.id;
  }

  const [message] = await database
    .insert(messages)
    .values({
      conversationId,
      senderType: "guest",
      content: params.message,
      provider: params.provider,
      deliveryStatus: "delivered",
      createdAt: params.timestamp,
    })
    .returning();

  if (!message) throw new Error("message_create_failed");

  const currentUnread = await unreadCountFor(database, conversationId);

  await database
    .update(conversations)
    .set({
      connectedChannelId: connectedChannel.id,
      channel: params.channel,
      lastMessageAt: params.timestamp,
      unreadCount: currentUnread + 1,
      reservationState: "inquiry",
      status: "ai_active",
    })
    .where(eq(conversations.id, conversationId));

  await database.insert(operationalEvents).values([
    {
      hotelId: params.hotelId,
      conversationId,
      kind: "message_received",
      label: "Talep geldi",
      payload: {
        source: "manychat",
        provider: params.provider,
        channel: params.channel,
      },
    },
    {
      hotelId: params.hotelId,
      conversationId,
      kind: "ai_suggestion_prepared",
      label: "AI öneri hazırlığı kuyruğa alındı",
      payload: {
        source: "manychat",
        supervised: true,
      },
    },
  ]);

  if (hasReservationIntent(params.message)) {
    await recordReservationLifecycleEvent({
      hotelId: params.hotelId,
      conversationId,
      state: "inquiry_received",
      actor: "guest",
      severity: "info",
    });
  }

  await updateChannelHealthFromEvent({
    hotelId: params.hotelId,
    channelType: params.channel,
    direction: "inbound",
    status: "active",
    lastError: null,
  });

  logger.info("Manychat inbound message ingested", {
    hotelId: params.hotelId,
    conversationId,
    messageId: message.id,
    provider: params.provider,
    channel: params.channel,
    externalUserId: params.externalUserId,
  });

  return {
    conversationId,
    messageId: message.id,
    aiSuggestionPrepared: true,
  };
}

export async function validateManychatSecret(input: {
  hotelId: string;
  channel: Extract<PanelChannelType, "instagram" | "whatsapp">;
  secret: string;
}): Promise<void> {
  const database = assertDb();
  const exists = await hotelExists(database, input.hotelId);

  if (!exists) throw new Error("hotel_not_found");

  const connectedChannel = await findManychatChannel(database, input.hotelId, input.channel);
  if (!connectedChannel) throw new Error("channel_not_connected");

  try {
    await validateChannelSecret({
      hotelId: input.hotelId,
      channelType: input.channel,
      secret: input.secret,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "channel_secret_missing") {
      throw new Error("manychat_bridge_config_missing");
    }

    throw err;
  }
}

async function unreadCountFor(database: DB, conversationId: string): Promise<number> {
  const [row] = await database
    .select({ unreadCount: conversations.unreadCount })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row?.unreadCount ?? 0;
}

export async function sendOperatorMessage(
  conversationId: string,
  body: string
): Promise<LiveMessage> {
  const database = assertDb();
  const now = new Date();

  const [row] = await database
    .select({
      conversation: conversations,
      connectedChannel: {
        provider: channels.provider,
        metadata: channels.metadata,
      },
    })
    .from(conversations)
    .leftJoin(channels, eq(conversations.connectedChannelId, channels.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!row?.conversation) throw new Error("conversation_not_found");

  const conv = row.conversation;
  const connectedChannel = row.connectedChannel;
  const manychatChannel =
    conv.channel === "instagram" || conv.channel === "whatsapp" ? conv.channel : null;
  const isManychatOutbound =
    connectedChannel?.provider === "manychat" &&
    manychatChannel !== null;

  const [msg] = await database
    .insert(messages)
    .values({
      conversationId,
      senderType: "staff",
      content: body,
      provider: isManychatOutbound ? "manychat" : providerFromChannel(conv.channel),
      deliveryStatus: isManychatOutbound ? "pending" : "sent",
      humanOverride: true,
    })
    .returning();

  if (!msg) throw new Error("message_create_failed");

  await database
    .update(conversations)
    .set({ lastMessageAt: now, unreadCount: 0 })
    .where(eq(conversations.id, conversationId));

  if (!isManychatOutbound) {
    const channelType = conv.channel === "manual" ? "web_chat" : conv.channel;
    await updateChannelHealthFromEvent({
      hotelId: conv.hotelId,
      channelType,
      direction: "outbound",
      status: "active",
      lastError: null,
    });
    await recordOperationFeedEvent({
      hotelId: conv.hotelId,
      conversationId,
      channel: channelType,
      eventType: "operator_replied",
      title: "Operatör yanıtladı",
      description: "Operatör misafire yanıt gönderdi.",
      severity: "success",
    });
    if (hasReservationIntent(body)) {
      await recordReservationLifecycleEvent({
        hotelId: conv.hotelId,
        conversationId,
        state: "quote_prepared",
        actor: "operator",
        severity: "info",
      });
    }
    return dbMessageToLive(msg);
  }

  const externalUserId = manychatExternalUserIdFromSessionId(
    manychatChannel,
    conv.externalSessionId
  );

  if (!externalUserId) {
    logger.warn("Manychat outbound skipped because external user id is missing", {
      hotelId: conv.hotelId,
      conversationId,
      messageId: msg.id,
    });

    const [failedMessage] = await database
      .update(messages)
      .set({ deliveryStatus: "failed" })
      .where(eq(messages.id, msg.id))
      .returning();

    await updateChannelHealthFromEvent({
      hotelId: conv.hotelId,
      channelType: manychatChannel,
      direction: "outbound",
      status: "error",
      deliveryFailed: true,
      lastError: "Teslimat hatası",
    });
    await recordOperationFeedEvent({
      hotelId: conv.hotelId,
      conversationId,
      channel: manychatChannel,
      eventType: "delivery_failed",
      title: "Teslimat hatası",
      description: "Misafire yanıt teslim edilemedi.",
      severity: "error",
    });

    return dbMessageToLive(failedMessage ?? msg);
  }

  const delivery = await sendManychatOutboundMessage({
    hotelId: conv.hotelId,
    conversationId,
    externalUserId,
    channel: manychatChannel,
    message: body,
    providerMetadata: asProviderMetadata(connectedChannel?.metadata),
  });

  const [updatedMessage] = await database
    .update(messages)
    .set({
      deliveryStatus: delivery.deliveryStatus === "failed" ? "failed" : "sent",
      externalMessageId: delivery.externalMessageId,
    })
    .where(eq(messages.id, msg.id))
    .returning();

  await updateChannelHealthFromEvent({
    hotelId: conv.hotelId,
    channelType: manychatChannel,
    direction: "outbound",
    status: delivery.deliveryStatus === "failed" ? "error" : "active",
    deliveryFailed: delivery.deliveryStatus === "failed",
    lastError: delivery.deliveryStatus === "failed" ? "Teslimat hatası" : null,
  });
  await recordOperationFeedEvent({
    hotelId: conv.hotelId,
    conversationId,
    channel: manychatChannel,
    eventType: delivery.deliveryStatus === "failed" ? "delivery_failed" : "operator_replied",
    title: delivery.deliveryStatus === "failed" ? "Teslimat hatası" : "Operatör yanıtladı",
    description:
      delivery.deliveryStatus === "failed"
        ? "Misafire yanıt teslim edilemedi."
        : "Operatör misafire yanıt gönderdi.",
    severity: delivery.deliveryStatus === "failed" ? "error" : "success",
  });

  if (hasReservationIntent(body)) {
    await recordReservationLifecycleEvent({
      hotelId: conv.hotelId,
      conversationId,
      state: "quote_prepared",
      actor: "operator",
      severity: "info",
    });
  }

  return dbMessageToLive(updatedMessage ?? msg);
}

export async function runAiReplyForConversation(
  conversationId: string,
  guestMessage: string
): Promise<LiveMessage | null> {
  const database = assertDb();

  const [row] = await database
    .select({
      conversation: conversations,
      contact: contacts,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!row || row.conversation.aiPaused || row.conversation.status === "human_takeover") {
    return null;
  }

  const recent = await database
    .select({ senderType: messages.senderType, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(8);

  const aiRequest: AiRespondRequest = {
    conversationId,
    message: guestMessage,
    mode: "live",
    guest: {
      name: row.contact.name ?? undefined,
      language: row.contact.language ?? undefined,
    },
    recentMessages: recent.reverse().map((m) => ({
      role: m.senderType === "staff" ? "staff" : m.senderType === "ai" ? "ai" : "guest",
      content: m.content,
    })),
  };

  const result = await generateHotelAssistantResponse(aiRequest);
  const replyText =
    result.ok && result.data.reply
      ? result.data.reply
      : "Teşekkür ederim, talebinizi aldım. Size en kısa sürede dönüş yapacağım.";

  const stageMap: Record<string, typeof row.conversation.reservationState> = {
    offer_sent: "quoted",
    payment_pending: "payment_pending",
    confirmed: "confirmed",
    payment_problem: "payment_pending",
    human_review: "inquiry",
    new_inquiry: "inquiry",
    qualified: "inquiry",
  };

  const reservationState =
    result.ok && result.data.reservationStage
      ? (stageMap[result.data.reservationStage] ?? "inquiry")
      : "inquiry";

  const paymentState =
    result.ok && result.data.paymentStatus === "pending"
      ? "pending"
      : result.ok && result.data.paymentStatus === "failed"
        ? "failed"
        : result.ok && result.data.paymentStatus === "completed"
          ? "completed"
          : "none";

  const [aiMsg] = await database
    .insert(messages)
    .values({
      conversationId,
      senderType: "ai",
      content: replyText,
      provider: providerFromChannel(row.conversation.channel),
      deliveryStatus: "sent",
      aiGenerated: true,
      aiMeta: result.ok
        ? { provider: result.meta.provider, model: result.meta.model }
        : undefined,
    })
    .returning();

  if (!aiMsg) return null;

  await database
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      reservationState,
      paymentState,
      escalationState: result.ok && result.data.requiresHuman ? "suggested" : "none",
      status: result.ok && result.data.requiresHuman ? "human_takeover" : "ai_active",
    })
    .where(eq(conversations.id, conversationId));

  await recordOperationFeedEvent({
    hotelId: row.conversation.hotelId,
    conversationId,
    channel: row.conversation.channel === "manual" ? "web_chat" : row.conversation.channel,
    eventType: "ai_support_prepared",
    title: "AI destek hazırlandı",
    description: "AI destek hazır.",
    severity: "success",
  });

  if (result.ok && result.data.reservationStage) {
    const lifecycleState =
      result.data.reservationStage === "offer_sent"
        ? "quote_sent"
        : result.data.reservationStage === "payment_pending" ||
            result.data.reservationStage === "payment_problem"
          ? "payment_pending"
          : result.data.reservationStage === "confirmed"
            ? "confirmed"
            : result.data.requiresHuman
              ? "human_review_required"
              : null;

    if (lifecycleState) {
      await recordReservationLifecycleEvent({
        hotelId: row.conversation.hotelId,
        conversationId,
        state: lifecycleState,
        actor: "ai",
        severity: lifecycleState === "human_review_required" ? "warning" : undefined,
      });
    }
  }

  if (result.ok && result.data.requiresHuman) {
    await database.insert(operationalEvents).values({
      hotelId: row.conversation.hotelId,
      conversationId,
      kind: "human_suggested",
      label: "İnsan desteği öneriliyor",
    });
  }

  return dbMessageToLive(aiMsg);
}

export async function applyTakeover(
  conversationId: string,
  action: TakeoverAction,
  operatorId?: string
): Promise<LiveConversation> {
  const database = assertDb();
  const now = new Date();

  const updates =
    action === "takeover"
      ? {
          status: "human_takeover" as const,
          aiPaused: true,
          assignedOperator: operatorId ?? null,
          operatorJoinedAt: now,
          escalationState: "active" as const,
        }
      : {
          status: "ai_active" as const,
          aiPaused: false,
          operatorJoinedAt: null,
          escalationState: "none" as const,
        };

  const [conv] = await database
    .update(conversations)
    .set(updates)
    .where(eq(conversations.id, conversationId))
    .returning();

  if (!conv) throw new Error("conversation_not_found");

  const [contact] = await database
    .select()
    .from(contacts)
    .where(eq(contacts.id, conv.contactId))
    .limit(1);

  if (!contact) throw new Error("contact_not_found");

  await database.insert(operationalEvents).values({
    hotelId: conv.hotelId,
    conversationId,
    kind: action === "takeover" ? "operator_joined" : "ai_resumed",
    label:
      action === "takeover"
        ? "Operatör görüşmeye katıldı"
        : "AI destek devam ediyor",
  });

  const [lastMsg] = await database
    .select({ content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return dbConversationToLive(conv, contact, lastMsg?.content);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const database = assertDb();
  await database
    .update(conversations)
    .set({ unreadCount: 0 })
    .where(eq(conversations.id, conversationId));
}
