import type { LiveConversation, LiveMessage } from "./models";
import type {
  OperationConversation,
  OperationMessage,
  ConversationStage,
} from "@/lib/channels/types";
import { STAGE_STATUS_LABELS } from "@/lib/channels/channelLabels";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLiveConversationId(id: string): boolean {
  return UUID_RE.test(id);
}

function priorityForStage(stage: ConversationStage): OperationConversation["priority"] {
  if (stage === "human_review" || stage === "payment_problem") return "high";
  if (stage === "payment_pending" || stage === "offer_sent") return "medium";
  return "low";
}

export function liveMessageToOperation(msg: LiveMessage): OperationMessage {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    sender: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    channel: msg.channel,
    meta: {
      aiGenerated: msg.aiGenerated,
      takeoverSuggested: msg.humanOverride,
      deliveryStatus: msg.deliveryStatus,
    },
  };
}

export function liveConversationToOperation(
  live: LiveConversation,
  messages: LiveMessage[] = []
): OperationConversation {
  const aiStatus =
    live.status === "human_takeover"
      ? ("waiting_staff" as const)
      : live.aiPaused
        ? ("idle" as const)
        : ("idle" as const);

  return {
    id: live.id,
    hotelId: live.hotelId,
    guestName: live.guestName,
    channel: live.channel,
    provider: messages[0]?.provider ?? (live.channel === "web_chat" ? "web_chat" : live.channel === "instagram" ? "instagram" : "whatsapp_cloud"),
    stage: live.stage,
    statusLabel: live.statusLabel || STAGE_STATUS_LABELS[live.stage],
    lastMessage: live.lastMessage,
    lastActivityAt: live.lastActivityAt,
    bookingValue: live.bookingValue,
    priority: priorityForStage(live.stage),
    requiresHuman: live.requiresHuman,
    aiStatus,
    unreadCount: live.unreadCount,
    reservationState: live.reservationState,
    paymentState: live.paymentState,
    reservation: live.reservation,
    latestLifecycleEvent: live.latestLifecycleEvent,
    latestPaymentEvent: live.latestPaymentEvent,
    aiSuggestion: live.aiSuggestion,
    messages: messages.map(liveMessageToOperation),
    externalId: live.externalSessionId,
    guestPhone: live.guestPhone,
    language: live.language,
  };
}
