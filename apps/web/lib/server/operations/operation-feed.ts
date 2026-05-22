import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  and,
  db,
  desc,
  eq,
  operationalEvents,
  type DB,
} from "@tugobo/db";
import type { ManagedChannelType } from "@/lib/server/channels/service";
import { MANYCHAT_LOCAL_TEST_HOTEL_ID } from "@/lib/server/integrations/manychat-config";

export type OperationFeedEventType =
  | "guest_request_received"
  | "operator_replied"
  | "ai_support_prepared"
  | "connection_test_success"
  | "message_sent"
  | "delivery_failed"
  | "channel_pending"
  | "unauthorized_channel_request";

export type OperationFeedSeverity = "info" | "success" | "warning" | "error";

export type SafeOperationFeedEvent = {
  id: string;
  hotel_id: string;
  channel: ManagedChannelType;
  event_type: OperationFeedEventType;
  title: string;
  description: string;
  timestamp: string;
  severity: OperationFeedSeverity;
  conversation_id?: string;
};

type RecordOperationEventInput = {
  hotelId: string;
  channel: ManagedChannelType;
  eventType: OperationFeedEventType;
  title: string;
  description: string;
  severity?: OperationFeedSeverity;
  conversationId?: string | null;
  timestamp?: Date;
};

const LOCAL_FEED_GLOBAL_KEY = "__tugobo_operation_feed_events__";
const LOCAL_FEED_HYDRATED_GLOBAL_KEY = "__tugobo_operation_feed_events_hydrated__";
const MAX_LOCAL_EVENTS = 250;

type LocalFeedGlobal = typeof globalThis & {
  [LOCAL_FEED_GLOBAL_KEY]?: SafeOperationFeedEvent[];
  [LOCAL_FEED_HYDRATED_GLOBAL_KEY]?: boolean;
};

function assertDb(): DB {
  if (!db) throw new Error("database_not_configured");
  return db;
}

function persistencePath(): string {
  return path.join(process.cwd(), ".tugobo-dev", "operation-feed.json");
}

function isManagedChannel(input: unknown): input is ManagedChannelType {
  return input === "web_chat" || input === "instagram" || input === "whatsapp";
}

function isEventType(input: unknown): input is OperationFeedEventType {
  return (
    input === "guest_request_received" ||
    input === "operator_replied" ||
    input === "ai_support_prepared" ||
    input === "connection_test_success" ||
    input === "message_sent" ||
    input === "delivery_failed" ||
    input === "channel_pending" ||
    input === "unauthorized_channel_request"
  );
}

function isSeverity(input: unknown): input is OperationFeedSeverity {
  return input === "info" || input === "success" || input === "warning" || input === "error";
}

function sanitizeText(input: string): string {
  return input.trim().slice(0, 220);
}

function eventFromUnknown(input: unknown): SafeOperationFeedEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as Partial<SafeOperationFeedEvent>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.hotel_id !== "string" ||
    !isManagedChannel(candidate.channel) ||
    !isEventType(candidate.event_type) ||
    typeof candidate.title !== "string" ||
    typeof candidate.description !== "string" ||
    typeof candidate.timestamp !== "string" ||
    !isSeverity(candidate.severity)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    hotel_id: candidate.hotel_id,
    channel: candidate.channel,
    event_type: candidate.event_type,
    title: sanitizeText(candidate.title),
    description: sanitizeText(candidate.description),
    timestamp: candidate.timestamp,
    severity: candidate.severity,
    conversation_id:
      typeof candidate.conversation_id === "string" ? candidate.conversation_id : undefined,
  };
}

function readLocalEvents(): SafeOperationFeedEvent[] {
  if (process.env.NODE_ENV === "production") return [];

  try {
    const parsed = JSON.parse(readFileSync(persistencePath(), "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((event) => {
      const normalized = eventFromUnknown(event);
      return normalized ? [normalized] : [];
    }).slice(-MAX_LOCAL_EVENTS);
  } catch {
    return [];
  }
}

function writeLocalEvents(events: SafeOperationFeedEvent[]) {
  if (process.env.NODE_ENV === "production") return;

  try {
    const filePath = persistencePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(events.slice(-MAX_LOCAL_EVENTS), null, 2)}\n`, "utf8");
  } catch {
    // Local operation feed persistence must never block message handling.
  }
}

function localEventsStore(): SafeOperationFeedEvent[] {
  const scoped = globalThis as LocalFeedGlobal;

  if (!scoped[LOCAL_FEED_GLOBAL_KEY]) {
    scoped[LOCAL_FEED_GLOBAL_KEY] = [];
  }

  if (!scoped[LOCAL_FEED_HYDRATED_GLOBAL_KEY]) {
    scoped[LOCAL_FEED_GLOBAL_KEY] = readLocalEvents();
    scoped[LOCAL_FEED_HYDRATED_GLOBAL_KEY] = true;
  }

  return scoped[LOCAL_FEED_GLOBAL_KEY];
}

function toSafeEvent(input: RecordOperationEventInput): SafeOperationFeedEvent {
  return {
    id: `ops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hotel_id: input.hotelId,
    channel: input.channel,
    event_type: input.eventType,
    title: sanitizeText(input.title),
    description: sanitizeText(input.description),
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    severity: input.severity ?? "info",
    conversation_id: input.conversationId ?? undefined,
  };
}

function payloadRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function fallbackEventForKind(kind: string, label: string): {
  eventType: OperationFeedEventType;
  title: string;
  description: string;
  severity: OperationFeedSeverity;
} {
  if (kind === "ai_suggestion_prepared") {
    return {
      eventType: "ai_support_prepared",
      title: "AI destek hazırlandı",
      description: "AI destek hazır.",
      severity: "success",
    };
  }

  if (kind === "operator_joined") {
    return {
      eventType: "operator_replied",
      title: "Operatör yanıtladı",
      description: "Operatör görüşmeye katıldı.",
      severity: "info",
    };
  }

  if (kind === "ai_resumed") {
    return {
      eventType: "ai_support_prepared",
      title: "AI destek hazırlandı",
      description: "AI destek hazır.",
      severity: "success",
    };
  }

  if (kind === "human_suggested") {
    return {
      eventType: "ai_support_prepared",
      title: "AI destek hazırlandı",
      description: "AI destek hazır.",
      severity: "warning",
    };
  }

  return {
    eventType: "guest_request_received",
    title: label,
    description: label,
    severity: "info",
  };
}

function safeEventFromRow(row: typeof operationalEvents.$inferSelect): SafeOperationFeedEvent {
  const payload = payloadRecord(row.payload);
  const channel = isManagedChannel(payload.channel) ? payload.channel : "web_chat";
  const fallback = fallbackEventForKind(row.kind, row.label);
  const eventType = isEventType(payload.event_type) ? payload.event_type : fallback.eventType;
  const severity = isSeverity(payload.severity) ? payload.severity : fallback.severity;

  return {
    id: row.id,
    hotel_id: row.hotelId,
    channel,
    event_type: eventType,
    title: typeof payload.title === "string" ? sanitizeText(payload.title) : fallback.title,
    description:
      typeof payload.description === "string"
        ? sanitizeText(payload.description)
        : sanitizeText(fallback.description),
    timestamp: row.createdAt.toISOString(),
    severity,
    conversation_id: row.conversationId ?? undefined,
  };
}

export async function recordOperationFeedEvent(input: RecordOperationEventInput): Promise<void> {
  const event = toSafeEvent(input);

  if (process.env.NODE_ENV !== "production" && input.hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID) {
    const store = localEventsStore();
    store.push(event);
    if (store.length > MAX_LOCAL_EVENTS) {
      store.splice(0, store.length - MAX_LOCAL_EVENTS);
    }
    writeLocalEvents(store);
    return;
  }

  if (!db) return;

  try {
    await db.insert(operationalEvents).values({
      hotelId: input.hotelId,
      conversationId: input.conversationId ?? undefined,
      kind: input.eventType,
      label: input.title,
      payload: {
        channel: input.channel,
        event_type: input.eventType,
        title: input.title,
        description: input.description,
        severity: input.severity ?? "info",
      },
      createdAt: input.timestamp,
    });
  } catch {
    // Operation feed writes are best-effort and must not interrupt messaging.
  }
}

export async function listOperationFeedEvents(input: {
  hotelId: string;
  conversationId?: string | null;
  limit?: number;
}): Promise<SafeOperationFeedEvent[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));

  if (process.env.NODE_ENV !== "production" && input.hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID) {
    return localEventsStore()
      .filter((event) => !input.conversationId || event.conversation_id === input.conversationId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  if (!db) return [];

  try {
    const database = assertDb();
    const rows = await database
      .select()
      .from(operationalEvents)
      .where(
        input.conversationId
          ? and(
              eq(operationalEvents.hotelId, input.hotelId),
              eq(operationalEvents.conversationId, input.conversationId)
            )
          : eq(operationalEvents.hotelId, input.hotelId)
      )
      .orderBy(desc(operationalEvents.createdAt))
      .limit(limit);

    return rows.map(safeEventFromRow);
  } catch {
    return [];
  }
}
