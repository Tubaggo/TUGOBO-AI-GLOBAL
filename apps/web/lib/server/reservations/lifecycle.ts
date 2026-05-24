import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  and,
  contacts,
  conversations,
  db,
  desc,
  eq,
  operationalEvents,
  reservations,
  type DB,
} from "@tugobo/db";
import type {
  ConversationPaymentState,
  ConversationReservationState,
  PanelChannelType,
  ReservationStatus,
  ReservationLifecycleActor,
  ReservationLifecycleSeverity,
  ReservationLifecycleState,
} from "@tugobo/shared";
import type {
  ReservationAiSuggestion,
  ReservationLifecycleEvent,
  LiveReservationSummary,
} from "@/lib/conversation/models";
import { recordOperationFeedEvent } from "@/lib/server/operations/operation-feed";
import { MANYCHAT_LOCAL_TEST_HOTEL_ID } from "@/lib/server/integrations/manychat-config";

type LifecycleInput = {
  hotelId: string;
  conversationId: string;
  reservationId?: string | null;
  state: ReservationLifecycleState;
  actor: ReservationLifecycleActor;
  title?: string;
  description?: string;
  severity?: ReservationLifecycleSeverity;
  timestamp?: Date;
};

type ConversationLifecycleContext = {
  hotelId: string;
  channel: PanelChannelType;
  contactName?: string | null;
};

const LOCAL_LIFECYCLE_GLOBAL_KEY = "__tugobo_reservation_lifecycle_events__";
const LOCAL_LIFECYCLE_HYDRATED_GLOBAL_KEY = "__tugobo_reservation_lifecycle_events_hydrated__";
const MAX_LOCAL_EVENTS = 250;

type LocalLifecycleGlobal = typeof globalThis & {
  [LOCAL_LIFECYCLE_GLOBAL_KEY]?: ReservationLifecycleEvent[];
  [LOCAL_LIFECYCLE_HYDRATED_GLOBAL_KEY]?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertDb(): DB {
  if (!db) throw new Error("database_not_configured");
  return db;
}

function persistencePath(): string {
  return path.join(process.cwd(), ".tugobo-dev", "reservation-lifecycle.json");
}

function isLifecycleState(input: unknown): input is ReservationLifecycleState {
  return (
    input === "inquiry_received" ||
    input === "quote_prepared" ||
    input === "quote_sent" ||
    input === "payment_link_sent" ||
    input === "payment_pending" ||
    input === "confirmed" ||
    input === "cancelled" ||
    input === "expired" ||
    input === "human_review_required"
  );
}

function isLifecycleActor(input: unknown): input is ReservationLifecycleActor {
  return input === "guest" || input === "ai" || input === "operator" || input === "system";
}

function isLifecycleSeverity(input: unknown): input is ReservationLifecycleSeverity {
  return input === "info" || input === "success" || input === "warning" || input === "error";
}

function sanitizeText(input: string): string {
  return input.trim().slice(0, 280);
}

function eventFromUnknown(input: unknown): ReservationLifecycleEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as Partial<ReservationLifecycleEvent>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.hotel_id !== "string" ||
    typeof candidate.conversation_id !== "string" ||
    !isLifecycleState(candidate.state) ||
    typeof candidate.title !== "string" ||
    typeof candidate.description !== "string" ||
    typeof candidate.timestamp !== "string" ||
    !isLifecycleActor(candidate.actor) ||
    !isLifecycleSeverity(candidate.severity)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    hotel_id: candidate.hotel_id,
    conversation_id: candidate.conversation_id,
    reservation_id:
      typeof candidate.reservation_id === "string" ? candidate.reservation_id : undefined,
    state: candidate.state,
    title: sanitizeText(candidate.title),
    description: sanitizeText(candidate.description),
    timestamp: candidate.timestamp,
    actor: candidate.actor,
    severity: candidate.severity,
  };
}

function readLocalEvents(): ReservationLifecycleEvent[] {
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

function writeLocalEvents(events: ReservationLifecycleEvent[]) {
  if (process.env.NODE_ENV === "production") return;

  try {
    const filePath = persistencePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(events.slice(-MAX_LOCAL_EVENTS), null, 2)}\n`, "utf8");
  } catch {
    // Local lifecycle persistence must never block message handling.
  }
}

function localEventsStore(): ReservationLifecycleEvent[] {
  const scoped = globalThis as LocalLifecycleGlobal;

  if (!scoped[LOCAL_LIFECYCLE_GLOBAL_KEY]) {
    scoped[LOCAL_LIFECYCLE_GLOBAL_KEY] = [];
  }

  if (!scoped[LOCAL_LIFECYCLE_HYDRATED_GLOBAL_KEY]) {
    scoped[LOCAL_LIFECYCLE_GLOBAL_KEY] = readLocalEvents();
    scoped[LOCAL_LIFECYCLE_HYDRATED_GLOBAL_KEY] = true;
  }

  return scoped[LOCAL_LIFECYCLE_GLOBAL_KEY];
}

export function lifecycleDefaults(state: ReservationLifecycleState): {
  title: string;
  description: string;
  severity: ReservationLifecycleSeverity;
} {
  switch (state) {
    case "inquiry_received":
      return {
        title: "Rezervasyon süreci başladı",
        description: "Misafirin talebi rezervasyon sürecine alındı.",
        severity: "info",
      };
    case "quote_prepared":
      return {
        title: "Teklif hazırlandı",
        description: "Misafir için teklif hazırlandı.",
        severity: "info",
      };
    case "quote_sent":
      return {
        title: "Teklif gönderildi",
        description: "Misafire teklif gönderildi.",
        severity: "success",
      };
    case "payment_link_sent":
      return {
        title: "Ödeme bağlantısı gönderildi",
        description: "Misafire ödeme bağlantısı gönderildi.",
        severity: "success",
      };
    case "payment_pending":
      return {
        title: "Ödeme bekleniyor",
        description: "Misafirden ödeme bekleniyor.",
        severity: "warning",
      };
    case "confirmed":
      return {
        title: "Rezervasyon onaylandı",
        description: "Rezervasyon başarıyla onaylandı.",
        severity: "success",
      };
    case "cancelled":
      return {
        title: "Rezervasyon iptal edildi",
        description: "Rezervasyon süreci iptal edildi.",
        severity: "warning",
      };
    case "expired":
      return {
        title: "Teklif süresi doldu",
        description: "Misafire gönderilen teklifin süresi doldu.",
        severity: "warning",
      };
    case "human_review_required":
      return {
        title: "Operatör incelemesi gerekiyor",
        description: "Rezervasyon sürecinde operatör aksiyonu gerekli.",
        severity: "warning",
      };
  }
}

function stateToConversationState(state: ReservationLifecycleState): {
  reservationState: ConversationReservationState;
  paymentState: ConversationPaymentState;
  escalationState?: "none" | "suggested" | "active" | "resolved";
  status?: "ai_active" | "human_takeover" | "resolved";
} {
  switch (state) {
    case "inquiry_received":
      return { reservationState: "inquiry", paymentState: "none", escalationState: "none", status: "ai_active" };
    case "quote_prepared":
    case "quote_sent":
      return { reservationState: "quoted", paymentState: "none" };
    case "payment_link_sent":
    case "payment_pending":
      return { reservationState: "payment_pending", paymentState: "pending" };
    case "confirmed":
      return { reservationState: "confirmed", paymentState: "completed", escalationState: "resolved", status: "resolved" };
    case "cancelled":
    case "expired":
      return { reservationState: "cancelled", paymentState: "none" };
    case "human_review_required":
      return { reservationState: "inquiry", paymentState: "none", escalationState: "suggested", status: "human_takeover" };
  }
}

function stateToReservationStatus(state: ReservationLifecycleState): ReservationStatus | null {
  switch (state) {
    case "payment_link_sent":
    case "payment_pending":
      return "pending_payment";
    case "confirmed":
      return "confirmed";
    case "cancelled":
    case "expired":
      return "cancelled";
    default:
      return null;
  }
}

function feedDescriptionFor(state: ReservationLifecycleState): string {
  switch (state) {
    case "inquiry_received":
      return "Rezervasyon süreci başladı.";
    case "quote_prepared":
      return "Misafir için teklif hazırlandı.";
    case "quote_sent":
      return "Teklif gönderildi.";
    case "payment_link_sent":
      return "Ödeme bağlantısı gönderildi.";
    case "payment_pending":
      return "Ödeme bekleniyor.";
    case "confirmed":
      return "Rezervasyon onaylandı.";
    case "human_review_required":
      return "Operatör incelemesi gerekiyor.";
    case "cancelled":
      return "Rezervasyon iptal edildi.";
    case "expired":
      return "Teklif süresi doldu.";
  }
}

function aiSuggestionFor(state: ReservationLifecycleState): ReservationAiSuggestion {
  if (state === "payment_link_sent" || state === "payment_pending") {
    return {
      suggestedAction: "payment_follow_up",
      label: "Misafir yanıt bekliyor",
      nextReply:
        "Ödeme bağlantısını tekrar paylaşabilirim veya ödeme sırasında takıldığınız bir nokta varsa yardımcı olabilirim.",
    };
  }

  if (state === "human_review_required") {
    return {
      suggestedAction: "human_takeover",
      label: "Operatör aksiyonu gerekli",
      nextReply:
        "Bu talepte özel inceleme gerekiyor. Operatör devralıp misafire net bilgi vermeli.",
    };
  }

  if (state === "confirmed") {
    return {
      suggestedAction: "next_reply",
      label: "AI önerisi hazır",
      nextReply:
        "Rezervasyonunuz onaylandı. Konaklamanızdan önce yardımcı olabileceğimiz başka bir konu varsa buradayız.",
    };
  }

  return {
    suggestedAction: "next_reply",
    label: "AI önerisi hazır",
    nextReply:
      "Talebinizi aldık. Size uygun oda ve fiyat seçeneklerini hazırlıyorum.",
  };
}

function toLifecycleEvent(input: LifecycleInput, id?: string): ReservationLifecycleEvent {
  const defaults = lifecycleDefaults(input.state);

  return {
    id: id ?? `res-life-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hotel_id: input.hotelId,
    conversation_id: input.conversationId,
    reservation_id: input.reservationId ?? undefined,
    state: input.state,
    title: sanitizeText(input.title ?? defaults.title),
    description: sanitizeText(input.description ?? defaults.description),
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    actor: input.actor,
    severity: input.severity ?? defaults.severity,
  };
}

function payloadRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function lifecycleFromRow(row: typeof operationalEvents.$inferSelect): ReservationLifecycleEvent | null {
  if (row.kind !== "reservation_lifecycle") return null;
  const payload = payloadRecord(row.payload);
  const state = payload.state;
  const actor = payload.actor;
  const severity = payload.severity;

  if (!isLifecycleState(state) || !isLifecycleActor(actor) || !isLifecycleSeverity(severity)) {
    return null;
  }

  return {
    id: row.id,
    hotel_id: row.hotelId,
    conversation_id: row.conversationId ?? "",
    reservation_id: typeof payload.reservation_id === "string" ? payload.reservation_id : undefined,
    state,
    title: typeof payload.title === "string" ? sanitizeText(payload.title) : row.label,
    description:
      typeof payload.description === "string"
        ? sanitizeText(payload.description)
        : sanitizeText(row.label),
    timestamp: row.createdAt.toISOString(),
    actor,
    severity,
  };
}

function shouldUseLocalStore(input: LifecycleInput): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (input.hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID ||
      input.conversationId.startsWith("demo-") ||
      !UUID_RE.test(input.conversationId) ||
      !db)
  );
}

async function getConversationContext(input: {
  hotelId: string;
  conversationId: string;
}): Promise<ConversationLifecycleContext | null> {
  if (!db || !UUID_RE.test(input.conversationId)) return null;

  const database = assertDb();
  const [row] = await database
    .select({
      hotelId: conversations.hotelId,
      channel: conversations.channel,
      contactName: contacts.name,
    })
    .from(conversations)
    .leftJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(
      and(
        eq(conversations.id, input.conversationId),
        eq(conversations.hotelId, input.hotelId)
      )
    )
    .limit(1);

  return row ?? null;
}

function channelFromSyntheticConversationId(conversationId: string): PanelChannelType {
  if (conversationId.includes("instagram")) return "instagram";
  if (conversationId.includes("whatsapp")) return "whatsapp";
  return "web_chat";
}

function managedChannelFromPanel(channel: PanelChannelType | undefined): "web_chat" | "instagram" | "whatsapp" {
  if (channel === "instagram" || channel === "whatsapp") return channel;
  return "web_chat";
}

export function hasReservationIntent(message: string): boolean {
  const normalized = message.toLocaleLowerCase("tr-TR");
  return [
    "rezervasyon",
    "rezerve",
    "oda ayır",
    "oda ayirt",
    "booking",
    "book ",
    "reserve",
    "reservation",
    "ödeme",
    "odeme",
  ].some((token) => normalized.includes(token));
}

export async function recordReservationLifecycleEvent(
  input: LifecycleInput
): Promise<ReservationLifecycleEvent> {
  const latest = await listReservationLifecycleEvents({
    hotelId: input.hotelId,
    conversationId: input.conversationId,
    limit: 1,
  });

  if (latest[0]?.state === input.state) {
    return latest[0];
  }

  const event = toLifecycleEvent(input);
  const localOnly = shouldUseLocalStore(input);
  const context = localOnly
    ? null
    : await getConversationContext({
        hotelId: input.hotelId,
        conversationId: input.conversationId,
      });

  if (!localOnly && !context) {
    throw new Error("conversation_not_found");
  }

  if (localOnly) {
    const store = localEventsStore();
    store.push(event);
    if (store.length > MAX_LOCAL_EVENTS) {
      store.splice(0, store.length - MAX_LOCAL_EVENTS);
    }
    writeLocalEvents(store);
  } else if (db) {
    const database = assertDb();
    const [row] = await database
      .insert(operationalEvents)
      .values({
        hotelId: input.hotelId,
        conversationId: input.conversationId,
        kind: "reservation_lifecycle",
        label: event.title,
        payload: {
          state: event.state,
          title: event.title,
          description: event.description,
          actor: event.actor,
          severity: event.severity,
          reservation_id: event.reservation_id,
          ai_suggestion: aiSuggestionFor(event.state),
        },
        createdAt: new Date(event.timestamp),
      })
      .returning({ id: operationalEvents.id });

    event.id = row?.id ?? event.id;

    const next = stateToConversationState(event.state);
    const conversationUpdate: Partial<typeof conversations.$inferInsert> = {
      reservationState: next.reservationState,
      paymentState: next.paymentState,
    };
    if (next.escalationState) conversationUpdate.escalationState = next.escalationState;
    if (next.status) conversationUpdate.status = next.status;

    await database
      .update(conversations)
      .set(conversationUpdate)
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.hotelId, input.hotelId)
        )
      );

    const reservationStatus = stateToReservationStatus(event.state);
    if (reservationStatus) {
      const existingRows = await database
        .select()
        .from(reservations)
        .where(
          input.reservationId && UUID_RE.test(input.reservationId)
            ? and(
                eq(reservations.id, input.reservationId),
                eq(reservations.hotelId, input.hotelId)
              )
            : and(
                eq(reservations.conversationId, input.conversationId),
                eq(reservations.hotelId, input.hotelId)
              )
        )
        .orderBy(desc(reservations.updatedAt))
        .limit(1);
      const existingReservation = existingRows[0];

      if (existingReservation) {
        await database
          .update(reservations)
          .set({
            status: reservationStatus,
            timeline: [
              ...(existingReservation.timeline ?? []),
              {
                at: event.timestamp,
                kind: event.state,
                label: event.title,
              },
            ],
            updatedAt: new Date(event.timestamp),
          })
          .where(eq(reservations.id, existingReservation.id));
      }
    }
  }

  await recordOperationFeedEvent({
    hotelId: input.hotelId,
    conversationId: input.conversationId,
    channel: context
      ? managedChannelFromPanel(context.channel)
      : managedChannelFromPanel(channelFromSyntheticConversationId(input.conversationId)),
    eventType: "reservation_lifecycle",
    title: event.title,
    description: feedDescriptionFor(event.state),
    severity: event.severity,
    timestamp: new Date(event.timestamp),
  });

  return event;
}

export async function listReservationLifecycleEvents(input: {
  hotelId: string;
  conversationId: string;
  limit?: number;
}): Promise<ReservationLifecycleEvent[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));

  if (shouldUseLocalStore({
    hotelId: input.hotelId,
    conversationId: input.conversationId,
    state: "inquiry_received",
    actor: "system",
  })) {
    return localEventsStore()
      .filter(
        (event) =>
          event.hotel_id === input.hotelId &&
          event.conversation_id === input.conversationId
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  if (!db || !UUID_RE.test(input.conversationId)) return [];

  try {
    const database = assertDb();
    const rows = await database
      .select()
      .from(operationalEvents)
      .where(
        and(
          eq(operationalEvents.hotelId, input.hotelId),
          eq(operationalEvents.conversationId, input.conversationId),
          eq(operationalEvents.kind, "reservation_lifecycle")
        )
      )
      .orderBy(desc(operationalEvents.createdAt))
      .limit(limit);

    return rows.flatMap((row) => {
      const event = lifecycleFromRow(row);
      return event ? [event] : [];
    });
  } catch {
    return [];
  }
}

export async function getLatestReservationLifecycleEvent(input: {
  hotelId: string;
  conversationId: string;
}): Promise<ReservationLifecycleEvent | undefined> {
  const [event] = await listReservationLifecycleEvents({ ...input, limit: 1 });
  return event;
}

export function aiSuggestionFromLifecycleEvent(
  event?: ReservationLifecycleEvent
): ReservationAiSuggestion | undefined {
  return event ? aiSuggestionFor(event.state) : undefined;
}

export async function getReservationSummaryForConversation(input: {
  hotelId: string;
  conversationId: string;
}): Promise<LiveReservationSummary | undefined> {
  if (!db || !UUID_RE.test(input.conversationId)) return undefined;

  try {
    const database = assertDb();
    const [row] = await database
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.hotelId, input.hotelId),
          eq(reservations.conversationId, input.conversationId)
        )
      )
      .orderBy(desc(reservations.updatedAt))
      .limit(1);

    if (!row) return undefined;

    const total = row.totalAmount === null ? undefined : Number(row.totalAmount);
    return {
      id: row.id,
      ref: row.ref ?? undefined,
      roomType: row.roomType ?? undefined,
      checkIn: row.checkIn?.toISOString(),
      checkOut: row.checkOut?.toISOString(),
      guestCount: row.guestCount ?? undefined,
      totalAmount: Number.isFinite(total) ? total : undefined,
      currency: row.currency ?? "TRY",
      status: row.status === "confirmed"
        ? "confirmed"
        : row.status === "cancelled"
          ? "cancelled"
          : row.status === "pending_payment"
            ? "pending_payment"
            : "quoted",
    };
  } catch {
    return undefined;
  }
}
