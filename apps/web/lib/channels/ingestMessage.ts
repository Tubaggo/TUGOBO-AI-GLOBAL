import type { IngestChannelMessageInput, OperationConversation } from "./types";
import { STAGE_STATUS_LABELS } from "./channelLabels";
import { detectLanguage } from "../i18n/detect-language";

function nowIso(): string {
  return new Date().toISOString();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function guestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-cyan-600",
  "bg-fuchsia-600",
  "bg-orange-600",
] as const;

function avatarColorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

export function createConversationFromIngest(
  input: IngestChannelMessageInput,
  conversationId: string
): OperationConversation {
  const ts = nowIso();
  const guestName = input.guestName.trim() || "Misafir";

  return {
    id: conversationId,
    hotelId: input.hotelId,
    guestName,
    channel: input.channel,
    provider:
      input.provider ??
      (input.channel === "web_chat"
        ? "web_chat"
        : input.channel === "instagram"
          ? "instagram"
          : "whatsapp_cloud"),
    stage: "new_inquiry",
    statusLabel: STAGE_STATUS_LABELS.new_inquiry,
    lastMessage: input.message,
    lastActivityAt: ts,
    priority: "medium",
    requiresHuman: false,
    aiStatus: "idle",
    unreadCount: input.unreadCount ?? 1,
    messages: [],
    externalId: input.externalId,
    guestPhone: input.guestPhone,
    language: input.language ?? detectLanguage(input.message) ?? "TR",
  };
}

export function buildGuestMessage(
  conversationId: string,
  input: IngestChannelMessageInput
): OperationConversation["messages"][number] {
  const ts = nowIso();
  return {
    // Deterministic id when a stable upstream message id is provided, so a
    // replayed inbound event (e.g. dev-event re-poll after refresh) is deduped
    // by the store instead of appended again.
    id: input.messageId ? `ig-msg-${input.messageId}` : `msg-${conversationId}-${Date.now()}`,
    conversationId,
    sender: "guest",
    content: input.message,
    timestamp: ts,
    channel: input.channel,
  };
}

export { formatTime, guestInitials, avatarColorForId, nowIso };
