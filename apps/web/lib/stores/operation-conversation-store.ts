"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ChannelFilter,
  ChannelType,
  ConversationStage,
  IngestChannelMessageInput,
  OperationConversation,
  OperationMessage,
} from "@/lib/channels/types";
import { STAGE_STATUS_LABELS } from "@/lib/channels/channelLabels";
import {
  buildGuestMessage,
  createConversationFromIngest,
  nowIso,
} from "@/lib/channels/ingestMessage";
import { nextSimulatedIncoming } from "@/lib/channels/simulateIncoming";
import { simulateAIResponse } from "@/lib/channels/simulate-ai-response";
import { isLiveConversationId } from "@/lib/conversation/live-sync";
import { isLiveOpsClientEnabled } from "@/lib/runtime/live/config";

type OperationConversationState = {
  conversations: OperationConversation[];
  selectedConversationId: string | null;
  channelFilter: ChannelFilter;
  pulsingConversationIds: Record<string, true>;
  addIncomingMessage: (input: IngestChannelMessageInput) => string;
  addOperatorMessage: (
    conversationId: string,
    content: string,
    id?: string,
    timestamp?: string,
    deliveryStatus?: NonNullable<OperationMessage["meta"]>["deliveryStatus"]
  ) => OperationMessage | null;
  updateMessageDelivery: (
    conversationId: string,
    messageId: string,
    delivery: NonNullable<OperationMessage["meta"]>["deliveryStatus"],
    externalMessageId?: string
  ) => void;
  addAIResponse: (conversationId: string, guestMessage: string) => void;
  appendAiMessage: (conversationId: string, content: string) => OperationMessage | null;
  selectConversation: (id: string | null) => void;
  updateConversationStage: (id: string, stage: ConversationStage) => void;
  setChannelFilter: (filter: ChannelFilter) => void;
  triggerDemoIncomingMessage: (channel: Exclude<ChannelType, "manual">) => string;
  simulateAIResponseForConversation: (conversationId: string, guestMessage: string) => void;
  getConversation: (id: string) => OperationConversation | undefined;
  clearPulse: (id: string) => void;
};

function newConversationId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localDevConversationId(input: IngestChannelMessageInput): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if (input.provider !== "manychat") return null;
  if (input.channel !== "instagram" && input.channel !== "whatsapp") return null;

  const prefix = `manychat:${input.channel}:`;
  const externalUserId = input.externalId?.startsWith(prefix)
    ? input.externalId.slice(prefix.length).trim()
    : "";

  if (!externalUserId) return null;
  return `demo-manychat-${input.channel}-${externalUserId}`;
}

function priorityForStage(stage: ConversationStage): OperationConversation["priority"] {
  if (stage === "human_review" || stage === "payment_problem") return "high";
  if (stage === "payment_pending" || stage === "offer_sent") return "medium";
  return "low";
}

function reservationStateForStage(stage: ConversationStage): OperationConversation["reservationState"] {
  if (stage === "confirmed") return "confirmed";
  if (stage === "payment_pending" || stage === "payment_problem") return "payment_pending";
  if (stage === "offer_sent") return "quoted";
  if (stage === "human_review") return "inquiry";
  return "inquiry";
}

function paymentStateForStage(stage: ConversationStage): OperationConversation["paymentState"] {
  if (stage === "confirmed") return "completed";
  if (stage === "payment_pending") return "pending";
  if (stage === "payment_problem") return "failed";
  return "none";
}

function shouldCreateReservationSummary(stage: ConversationStage): boolean {
  return stage === "offer_sent" || stage === "payment_pending" || stage === "payment_problem" || stage === "confirmed";
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function synthesizeReservationSummary(
  conv: OperationConversation,
  result: { stage: ConversationStage; bookingValue?: number; roomSuggestion?: string }
): OperationConversation["reservation"] {
  if (!shouldCreateReservationSummary(result.stage)) return conv.reservation;

  const checkIn = conv.reservation?.checkIn ?? addDays(new Date(), 21).toISOString();
  const checkOut = conv.reservation?.checkOut ?? addDays(new Date(checkIn), 5).toISOString();
  const totalAmount = result.bookingValue ?? conv.reservation?.totalAmount ?? conv.bookingValue ?? 12500;
  const status =
    result.stage === "confirmed"
      ? "confirmed"
      : result.stage === "offer_sent"
        ? "quoted"
        : "pending_payment";

  return {
    id: conv.reservation?.id ?? `runtime-${conv.id}`,
    ref: conv.reservation?.ref ?? `TGO-${conv.id.slice(-6).toUpperCase()}`,
    roomType: result.roomSuggestion ?? conv.reservation?.roomType ?? "Superior Çift Oda",
    checkIn,
    checkOut,
    guestCount: conv.reservation?.guestCount ?? 2,
    totalAmount,
    currency: conv.reservation?.currency ?? "TRY",
    status,
  };
}

function appendMessage(
  conv: OperationConversation,
  message: OperationMessage
): OperationConversation {
  if (conv.messages.some((existing) => existing.id === message.id)) {
    return {
      ...conv,
      messages: conv.messages.map((existing) =>
        existing.id === message.id ? message : existing
      ),
      lastActivityAt: message.timestamp,
    };
  }

  return {
    ...conv,
    messages: [...conv.messages, message],
    lastMessage: message.sender === "guest" ? message.content : conv.lastMessage,
    lastActivityAt: message.timestamp,
  };
}

function unreadCountAfterGuestMessage(
  conv: OperationConversation,
  conversationId: string,
  selectedConversationId: string | null
) {
  return selectedConversationId === conversationId ? 0 : (conv.unreadCount ?? 0) + 1;
}

export const useOperationConversationStore = create<OperationConversationState>()(
  persist((set, get) => ({
  conversations: [],
  selectedConversationId: null,
  channelFilter: "all",
  pulsingConversationIds: {},

  getConversation: (id) => get().conversations.find((c) => c.id === id),

  selectConversation: (id) => set({ selectedConversationId: id }),

  setChannelFilter: (filter) => set({ channelFilter: filter }),

  clearPulse: (id) =>
    set((state) => {
      const next = { ...state.pulsingConversationIds };
      delete next[id];
      return { pulsingConversationIds: next };
    }),

  updateConversationStage: (id, stage) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              stage,
              statusLabel: STAGE_STATUS_LABELS[stage],
              priority: priorityForStage(stage),
            }
          : c
      ),
    })),

  addIncomingMessage: (input) => {
    const state = get();
    let conversationId = input.conversationId;

    if (!conversationId && input.externalId) {
      const existing = state.conversations.find((c) => c.externalId === input.externalId);
      conversationId = existing?.id;
    }

    if (!conversationId) {
      conversationId = localDevConversationId(input) ?? newConversationId();
    }

    const guestMsg = buildGuestMessage(conversationId, input);
    const exists = state.conversations.some((c) => c.id === conversationId);

    set((s) => {
      const pulsing = { ...s.pulsingConversationIds, [conversationId!]: true as const };

      if (exists) {
        return {
          pulsingConversationIds: pulsing,
          selectedConversationId: s.selectedConversationId ?? conversationId!,
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const updated = appendMessage(c, guestMsg);
            return {
              ...updated,
              lastMessage: input.message,
              channel: input.channel,
              unreadCount: unreadCountAfterGuestMessage(c, conversationId!, s.selectedConversationId),
            };
          }),
        };
      }

      const created = createConversationFromIngest(input, conversationId!);
      const withMsg = appendMessage(created, guestMsg);

      return {
        pulsingConversationIds: pulsing,
        selectedConversationId: s.selectedConversationId ?? conversationId!,
        conversations: [withMsg, ...s.conversations],
      };
    });

    const skipLocalAi =
      input.skipLocalAi ||
      (isLiveOpsClientEnabled() && input.channel === "web_chat");

    if (!skipLocalAi && !isLiveConversationId(conversationId!)) {
      window.setTimeout(() => {
        get().simulateAIResponseForConversation(conversationId!, input.message);
      }, 900);
    }

    return conversationId!;
  },

  addOperatorMessage: (conversationId, content, id, timestamp, deliveryStatus = "pending") => {
    const conv = get().getConversation(conversationId);
    if (!conv) return null;

    const message: OperationMessage = {
      id: id ?? `staff-${conversationId}-${Date.now()}`,
      conversationId,
      sender: "staff",
      content,
      timestamp: timestamp ?? nowIso(),
      channel: conv.channel,
      meta: {
        deliveryStatus,
      },
    };

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? appendMessage(c, message) : c
      ),
    }));

    return message;
  },

  updateMessageDelivery: (conversationId, messageId, deliveryStatus, externalMessageId) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;

        return {
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  meta: {
                    ...message.meta,
                    deliveryStatus,
                    externalMessageId,
                  },
                }
              : message
          ),
        };
      }),
    })),

  addAIResponse: (conversationId, guestMessage) => {
    get().simulateAIResponseForConversation(conversationId, guestMessage);
  },

  // Appends a real, pre-generated AI reply (e.g. from /api/ai/respond → DeepSeek)
  // into the persisted conversation. Reuses the same persistence path as guest /
  // operator / simulated-AI messages, so it survives refresh via the store's
  // localStorage persist middleware. No new storage mechanism.
  appendAiMessage: (conversationId, content) => {
    const conv = get().getConversation(conversationId);
    if (!conv) return null;

    const message: OperationMessage = {
      id: `ai-${conversationId}-${Date.now()}`,
      conversationId,
      sender: "ai",
      content,
      timestamp: nowIso(),
      channel: conv.channel,
      meta: { aiGenerated: true },
    };

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? appendMessage(c, message) : c
      ),
    }));

    return message;
  },

  simulateAIResponseForConversation: (conversationId, guestMessage) => {
    const conv = get().getConversation(conversationId);
    if (!conv) return;

    if (isLiveConversationId(conversationId)) {
      return;
    }

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, aiStatus: "checking" } : c
      ),
    }));

    const result = simulateAIResponse(guestMessage, conv);
    const ts = nowIso();

    window.setTimeout(() => {
      const systemMessages: OperationMessage[] = result.operationalEvents.map((event, i) => ({
        id: `sys-${conversationId}-${Date.now()}-${i}`,
        conversationId,
        sender: "system" as const,
        content: event,
        timestamp: ts,
        channel: conv.channel,
        meta: { operationalEvent: event },
      }));

      const aiMessage: OperationMessage = {
        id: `ai-${conversationId}-${Date.now()}`,
        conversationId,
        sender: "ai",
        content: result.replyText,
        timestamp: nowIso(),
        channel: conv.channel,
        meta: {
          aiGenerated: true,
          takeoverSuggested: result.requiresHuman,
          reservationValue: result.bookingValue,
          paymentLinkSent: result.paymentLinkSent,
          roomSuggestion: result.roomSuggestion,
        },
      };

      set((s) => ({
        conversations: s.conversations.map((c) => {
          if (c.id !== conversationId) return c;
          let next = c;
          for (const sm of systemMessages) {
            next = appendMessage(next, sm);
          }
          next = appendMessage(next, aiMessage);
          const reservation = synthesizeReservationSummary(next, result);
          return {
            ...next,
            stage: result.stage,
            statusLabel: result.statusLabel,
            requiresHuman: result.requiresHuman,
            aiStatus: result.aiStatus,
            bookingValue: result.bookingValue ?? c.bookingValue,
            reservationState: reservationStateForStage(result.stage),
            paymentState: paymentStateForStage(result.stage),
            reservation,
            lastMessage: result.replyText,
            priority: priorityForStage(result.stage),
          };
        }),
      }));
    }, 1400);
  },

  triggerDemoIncomingMessage: (channel) => {
    const preset = nextSimulatedIncoming(channel);
    return get().addIncomingMessage({
      channel: preset.channel,
      guestName: preset.guestName,
      message: preset.message,
      guestPhone: preset.guestPhone,
      language: preset.language,
    });
  },
  }), {
    name: "tugobo-operation-conversations-v1",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      conversations: state.conversations,
      selectedConversationId: state.selectedConversationId,
      channelFilter: state.channelFilter,
      pulsingConversationIds: {},
    }),
  })
);

export function ingestChannelMessage(input: IngestChannelMessageInput): string {
  return useOperationConversationStore.getState().addIncomingMessage(input);
}
