import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  and,
  conversations,
  db,
  desc,
  eq,
  operationalEvents,
  type DB,
} from "@tugobo/db";
import type {
  PanelChannelType,
  ReservationLifecycleActor,
  ReservationPaymentState,
} from "@tugobo/shared";
import type { ReservationPaymentEvent } from "@/lib/conversation/models";
import { MANYCHAT_LOCAL_TEST_HOTEL_ID } from "@/lib/server/integrations/manychat-config";

export type PaymentRuntimeInput = {
  hotelId: string;
  conversationId: string;
  reservationId?: string | null;
  amount?: number | null;
  currency?: string | null;
  state: ReservationPaymentState;
  actor: ReservationLifecycleActor;
  title?: string;
  description?: string;
  timestamp?: Date;
};

const LOCAL_PAYMENT_GLOBAL_KEY = "__tugobo_payment_events__";
const LOCAL_PAYMENT_HYDRATED_GLOBAL_KEY = "__tugobo_payment_events_hydrated__";
const MAX_LOCAL_EVENTS = 250;

type LocalPaymentGlobal = typeof globalThis & {
  [LOCAL_PAYMENT_GLOBAL_KEY]?: ReservationPaymentEvent[];
  [LOCAL_PAYMENT_HYDRATED_GLOBAL_KEY]?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertDb(): DB {
  if (!db) throw new Error("database_not_configured");
  return db;
}

function persistencePath(): string {
  return path.join(process.cwd(), ".tugobo-dev", "payment-events.json");
}

export function isPaymentState(input: unknown): input is ReservationPaymentState {
  return (
    input === "not_started" ||
    input === "payment_link_sent" ||
    input === "payment_pending" ||
    input === "paid" ||
    input === "failed" ||
    input === "expired" ||
    input === "refunded"
  );
}

function isPaymentActor(input: unknown): input is ReservationLifecycleActor {
  return input === "guest" || input === "ai" || input === "operator" || input === "system";
}

function sanitizeText(input: string): string {
  return input.trim().slice(0, 280);
}

function normalizeAmount(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0) return undefined;
  return Math.round(input * 100) / 100;
}

function normalizeCurrency(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim().slice(0, 8);
  return trimmed.length > 0 ? trimmed : undefined;
}

function eventFromUnknown(input: unknown): ReservationPaymentEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as Partial<ReservationPaymentEvent>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.hotel_id !== "string" ||
    typeof candidate.conversation_id !== "string" ||
    !isPaymentState(candidate.state) ||
    typeof candidate.title !== "string" ||
    typeof candidate.description !== "string" ||
    typeof candidate.timestamp !== "string" ||
    !isPaymentActor(candidate.actor)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    hotel_id: candidate.hotel_id,
    conversation_id: candidate.conversation_id,
    reservation_id:
      typeof candidate.reservation_id === "string" ? candidate.reservation_id : undefined,
    amount: normalizeAmount(candidate.amount),
    currency: normalizeCurrency(candidate.currency),
    state: candidate.state,
    title: sanitizeText(candidate.title),
    description: sanitizeText(candidate.description),
    timestamp: candidate.timestamp,
    actor: candidate.actor,
  };
}

function readLocalEvents(): ReservationPaymentEvent[] {
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

function writeLocalEvents(events: ReservationPaymentEvent[]) {
  if (process.env.NODE_ENV === "production") return;

  try {
    const filePath = persistencePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(events.slice(-MAX_LOCAL_EVENTS), null, 2)}\n`, "utf8");
  } catch {
    // Local payment persistence must never block operator actions.
  }
}

function localEventsStore(): ReservationPaymentEvent[] {
  const scoped = globalThis as LocalPaymentGlobal;

  if (!scoped[LOCAL_PAYMENT_GLOBAL_KEY]) {
    scoped[LOCAL_PAYMENT_GLOBAL_KEY] = [];
  }

  if (!scoped[LOCAL_PAYMENT_HYDRATED_GLOBAL_KEY]) {
    scoped[LOCAL_PAYMENT_GLOBAL_KEY] = readLocalEvents();
    scoped[LOCAL_PAYMENT_HYDRATED_GLOBAL_KEY] = true;
  }

  return scoped[LOCAL_PAYMENT_GLOBAL_KEY];
}

export function paymentDefaults(state: ReservationPaymentState): {
  title: string;
  description: string;
  feedDescription: string;
  severity: "info" | "success" | "warning" | "error";
} {
  switch (state) {
    case "payment_link_sent":
      return {
        title: "Ödeme bağlantısı gönderildi",
        description: "Misafire ödeme bağlantısı gönderildi.",
        feedDescription: "Ödeme bağlantısı gönderildi.",
        severity: "success",
      };
    case "payment_pending":
      return {
        title: "Ödeme bekleniyor",
        description: "Misafirden ödeme bekleniyor.",
        feedDescription: "Ödeme bekleniyor.",
        severity: "warning",
      };
    case "paid":
      return {
        title: "Rezervasyon onaylandı",
        description: "Ödeme alındı ve rezervasyon onaylandı.",
        feedDescription: "Rezervasyon onaylandı.",
        severity: "success",
      };
    case "failed":
      return {
        title: "Ödeme başarısız",
        description: "Ödeme tamamlanamadı.",
        feedDescription: "Ödeme başarısız.",
        severity: "error",
      };
    case "expired":
      return {
        title: "Ödeme bağlantısı süresi doldu",
        description: "Ödeme bağlantısının süresi doldu.",
        feedDescription: "Ödeme bağlantısı süresi doldu.",
        severity: "warning",
      };
    case "refunded":
      return {
        title: "Ödeme iade edildi",
        description: "Ödeme iade edildi.",
        feedDescription: "Ödeme iade edildi.",
        severity: "warning",
      };
    case "not_started":
      return {
        title: "Ödeme başlatılmadı",
        description: "Ödeme süreci henüz başlatılmadı.",
        feedDescription: "Ödeme başlatılmadı.",
        severity: "info",
      };
  }
}

function toPaymentEvent(input: PaymentRuntimeInput, id?: string): ReservationPaymentEvent {
  const defaults = paymentDefaults(input.state);

  return {
    id: id ?? `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hotel_id: input.hotelId,
    conversation_id: input.conversationId,
    reservation_id: input.reservationId ?? undefined,
    amount: normalizeAmount(input.amount),
    currency: normalizeCurrency(input.currency),
    state: input.state,
    title: sanitizeText(input.title ?? defaults.title),
    description: sanitizeText(input.description ?? defaults.description),
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    actor: input.actor,
  };
}

function payloadRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function paymentFromRow(row: typeof operationalEvents.$inferSelect): ReservationPaymentEvent | null {
  if (row.kind !== "payment_lifecycle") return null;
  const payload = payloadRecord(row.payload);
  const state = payload.state;
  const actor = payload.actor;

  if (!isPaymentState(state) || !isPaymentActor(actor)) return null;

  return {
    id: row.id,
    hotel_id: row.hotelId,
    conversation_id: row.conversationId ?? "",
    reservation_id: typeof payload.reservation_id === "string" ? payload.reservation_id : undefined,
    amount: normalizeAmount(payload.amount),
    currency: normalizeCurrency(payload.currency),
    state,
    title: typeof payload.title === "string" ? sanitizeText(payload.title) : row.label,
    description:
      typeof payload.description === "string"
        ? sanitizeText(payload.description)
        : sanitizeText(row.label),
    timestamp: row.createdAt.toISOString(),
    actor,
  };
}

function shouldUseLocalStore(input: Pick<PaymentRuntimeInput, "hotelId" | "conversationId">): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (input.hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID ||
      input.conversationId.startsWith("demo-") ||
      !UUID_RE.test(input.conversationId) ||
      !db)
  );
}

function channelFromSyntheticConversationId(conversationId: string): PanelChannelType {
  if (conversationId.includes("instagram")) return "instagram";
  if (conversationId.includes("whatsapp")) return "whatsapp";
  return "web_chat";
}

async function getConversationChannel(input: {
  hotelId: string;
  conversationId: string;
}): Promise<PanelChannelType | null> {
  if (!db || !UUID_RE.test(input.conversationId)) return null;

  const database = assertDb();
  const [row] = await database
    .select({ channel: conversations.channel })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, input.conversationId),
        eq(conversations.hotelId, input.hotelId)
      )
    )
    .limit(1);

  return row?.channel ?? null;
}

export async function recordPaymentEvent(
  input: PaymentRuntimeInput
): Promise<ReservationPaymentEvent> {
  const latest = await listPaymentEvents({
    hotelId: input.hotelId,
    conversationId: input.conversationId,
    limit: 1,
  });

  if (latest[0]?.state === input.state) {
    return latest[0];
  }

  const event = toPaymentEvent(input);
  const localOnly = shouldUseLocalStore(input);
  const channel = localOnly
    ? channelFromSyntheticConversationId(input.conversationId)
    : await getConversationChannel({
        hotelId: input.hotelId,
        conversationId: input.conversationId,
      });

  if (!localOnly && !channel) {
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
        kind: "payment_lifecycle",
        label: event.title,
        payload: {
          state: event.state,
          title: event.title,
          description: event.description,
          actor: event.actor,
          reservation_id: event.reservation_id,
          amount: event.amount,
          currency: event.currency,
        },
        createdAt: new Date(event.timestamp),
      })
      .returning({ id: operationalEvents.id });

    event.id = row?.id ?? event.id;
  }

  return event;
}

export async function listPaymentEvents(input: {
  hotelId: string;
  conversationId: string;
  limit?: number;
}): Promise<ReservationPaymentEvent[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));

  if (shouldUseLocalStore(input)) {
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
          eq(operationalEvents.kind, "payment_lifecycle")
        )
      )
      .orderBy(desc(operationalEvents.createdAt))
      .limit(limit);

    return rows.flatMap((row) => {
      const event = paymentFromRow(row);
      return event ? [event] : [];
    });
  } catch {
    return [];
  }
}

export async function getLatestPaymentEvent(input: {
  hotelId: string;
  conversationId: string;
}): Promise<ReservationPaymentEvent | undefined> {
  const [event] = await listPaymentEvents({ ...input, limit: 1 });
  return event;
}
