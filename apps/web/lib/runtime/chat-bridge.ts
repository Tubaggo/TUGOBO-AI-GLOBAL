import type { ChatMsg, ConvReservation } from "@/app/dashboard/_components/chat-threads";
import { CHAT_THREADS } from "@/app/dashboard/_components/chat-threads";
import type {
  Conversation,
  ConversationChannel,
  ConversationStatus,
  LeadStatus,
} from "@/app/dashboard/_components/mock-data";
import { CONVERSATIONS } from "@/app/dashboard/_components/mock-data";
import type { OperationalTimelineEvent } from "./conversation-runtime";
import type { ConversationThread, Guest } from "./entities";
import { op } from "@/lib/i18n/operationalTexts";

export function threadToConversation(thread: ConversationThread, guest?: Guest): Conversation {
  const mock = CONVERSATIONS.find((c) => c.id === thread.id);
  return {
    id: thread.id,
    contact: {
      name: thread.guestName,
      phone: mock?.contact.phone ?? "—",
      initials: thread.initials,
      avatarColor: thread.avatarColor,
    },
    lastMessage: thread.lastMessage,
    time: thread.time,
    language: thread.language,
    status: thread.status as ConversationStatus,
    leadStatus: mock?.leadStatus ?? inferLeadStatus(thread),
    unread: thread.unread,
    messageCount: mock?.messageCount ?? 0,
    channel: channelFromLabel(thread.channel) ?? mock?.channel ?? "whatsapp",
  };
}

export function resolveChatMessages(
  threadId: string,
  timelineEvents: OperationalTimelineEvent[]
): ChatMsg[] {
  const scripted = CHAT_THREADS[threadId]?.messages;
  if (scripted && scripted.length > 0) return scripted;
  return buildChatMessagesFromTimeline(timelineEvents);
}

export function resolveReservation(threadId: string): ConvReservation | undefined {
  return CHAT_THREADS[threadId]?.reservation;
}

export function buildChatMessagesFromTimeline(events: OperationalTimelineEvent[]): ChatMsg[] {
  const messages: ChatMsg[] = [];

  for (const event of events) {
    const time = event.timestamp;

    if (event.displayKind === "guest_message" && event.quote) {
      messages.push({
        id: event.id,
        dir: "in",
        body: event.quote,
        time,
      });
      continue;
    }

    if (event.displayKind === "ai_interpretation") {
      const body = event.detail
        ? `Tugobo AI · ${event.title} — ${event.detail}`
        : `Tugobo AI · ${event.title}`;
      messages.push({ id: event.id, dir: "system", body, time });
      continue;
    }

    if (event.displayKind === "orchestration") {
      const action = event.actions?.[0] ?? event.detail ?? event.title;
      messages.push({
        id: event.id,
        dir: "system",
        body: `Tugobo AI · ${humanizeOrchestration(event.title, action)}`,
        time,
      });
      continue;
    }

    if (event.displayKind === "financial" && event.financialEur) {
      messages.push({
        id: event.id,
        dir: "system",
        body: `Tugobo AI · ${event.title} · €${event.financialEur.toLocaleString("en-EU")}`,
        time,
      });
      continue;
    }

    if (event.displayKind === "outcome") {
      messages.push({
        id: event.id,
        dir: "system",
        body: `✓ ${event.title}${event.detail ? ` — ${event.detail}` : ""}`,
        time,
      });
      continue;
    }

    if (event.displayKind === "memory") {
      messages.push({
        id: event.id,
        dir: "system",
        body: `Tugobo AI · misafir bağlamı işlendi — ${event.detail ?? event.title}`,
        time,
      });
    }
  }

  return messages;
}

export type ReservationStage =
  | "inquiry"
  | "availability"
  | "offer"
  | "payment"
  | "confirmed"
  | "staff_assist";

export function inferReservationStage(
  thread: ConversationThread,
  reservation?: ConvReservation
): ReservationStage {
  if (thread.flags.humanTakeover || thread.flags.vipEscalation) return "staff_assist";
  if (reservation?.status === "confirmed" || thread.status === "resolved") return "confirmed";
  if (reservation?.status === "pending_payment" || thread.flags.paymentRisk) return "payment";
  if (reservation?.status === "quoted") return "offer";
  if (thread.unread > 0 && !reservation) return "inquiry";
  return "availability";
}

export { reservationStageLabel } from "@/lib/i18n/runtime-copy";

function inferLeadStatus(thread: ConversationThread): LeadStatus {
  if (thread.status === "resolved") return "confirmed";
  if (thread.flags.paymentRisk) return "quoted";
  if (thread.unread > 0) return "new";
  return "qualified";
}

function channelFromLabel(channel: string): ConversationChannel | undefined {
  const lower = channel.toLowerCase();
  if (lower.includes("instagram")) return "instagram";
  if (lower.includes("web")) return "web";
  if (lower.includes("whatsapp")) return "whatsapp";
  return undefined;
}

function humanizeOrchestration(title: string, action: string): string {
  if (/payment|recovery/i.test(title)) return op("preparingPaymentRoute");
  if (/takeover|staff|desk/i.test(title)) return op("connectingStaff");
  return action;
}
