import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

type ManychatDevRuntimeEvent = {
  id: string;
  messageId?: string;
  hotelId: string;
  provider: "manychat";
  channel: "instagram" | "whatsapp";
  senderType: "guest" | "staff";
  externalUserId: string;
  externalId: string;
  guestName?: string;
  message: string;
  createdAt: string;
};

const GLOBAL_KEY = "__tugobo_manychat_dev_runtime_events__";
const HYDRATED_GLOBAL_KEY = "__tugobo_manychat_dev_runtime_events_hydrated__";
const MAX_EVENTS = 200;

type ManychatDevEventGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: ManychatDevRuntimeEvent[];
  [HYDRATED_GLOBAL_KEY]?: boolean;
};

function persistencePath(): string {
  return path.join(process.cwd(), ".tugobo-dev", "manychat-dev-events.json");
}

function isDevPersistenceEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

function parsePersistedEvents(input: unknown): ManychatDevRuntimeEvent[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((event): ManychatDevRuntimeEvent[] => {
    if (!event || typeof event !== "object" || Array.isArray(event)) return [];

    const candidate = event as Partial<Record<keyof ManychatDevRuntimeEvent, unknown>>;
    const senderType = candidate.senderType === "staff" ? "staff" : "guest";
    const channel =
      candidate.channel === "instagram" || candidate.channel === "whatsapp"
        ? candidate.channel
        : null;

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.hotelId !== "string" ||
      candidate.provider !== "manychat" ||
      !channel ||
      typeof candidate.externalUserId !== "string" ||
      typeof candidate.externalId !== "string" ||
      typeof candidate.message !== "string" ||
      typeof candidate.createdAt !== "string"
    ) {
      return [];
    }

    return [
      {
        id: candidate.id,
        messageId: typeof candidate.messageId === "string" ? candidate.messageId : undefined,
        hotelId: candidate.hotelId,
        provider: "manychat",
        channel,
        senderType,
        externalUserId: candidate.externalUserId,
        externalId: candidate.externalId,
        guestName: typeof candidate.guestName === "string" ? candidate.guestName : undefined,
        message: candidate.message,
        createdAt: candidate.createdAt,
      },
    ];
  });
}

function readPersistedEvents(): ManychatDevRuntimeEvent[] {
  if (!isDevPersistenceEnabled()) return [];

  try {
    const raw = readFileSync(persistencePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsePersistedEvents(parsed).slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

function writePersistedEvents(events: ManychatDevRuntimeEvent[]) {
  if (!isDevPersistenceEnabled()) return;

  try {
    const filePath = persistencePath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(events.slice(-MAX_EVENTS), null, 2)}\n`, "utf8");
  } catch {
    // Dev persistence must never break webhook or outbound flows.
  }
}

function sanitizeDevEvent(event: ManychatDevRuntimeEvent): ManychatDevRuntimeEvent {
  return {
    id: event.id,
    messageId: event.messageId,
    hotelId: event.hotelId,
    provider: "manychat",
    channel: event.channel,
    senderType: event.senderType,
    externalUserId: event.externalUserId,
    externalId: event.externalId,
    guestName: event.guestName,
    message: event.message,
    createdAt: event.createdAt,
  };
}

function runtimeEventsStore(): ManychatDevRuntimeEvent[] {
  const scoped = globalThis as ManychatDevEventGlobal;

  if (!scoped[GLOBAL_KEY]) {
    scoped[GLOBAL_KEY] = [];
  }

  if (!scoped[HYDRATED_GLOBAL_KEY]) {
    scoped[GLOBAL_KEY] = readPersistedEvents();
    scoped[HYDRATED_GLOBAL_KEY] = true;
  }

  return scoped[GLOBAL_KEY];
}

export function recordManychatDevRuntimeEvent(
  event: Omit<ManychatDevRuntimeEvent, "id" | "createdAt" | "senderType"> & {
    senderType?: ManychatDevRuntimeEvent["senderType"];
  }
) {
  const store = runtimeEventsStore();
  const createdAt = new Date().toISOString();

  store.push(sanitizeDevEvent({
    ...event,
    id: `manychat-dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderType: event.senderType ?? "guest",
    createdAt,
  }));

  if (store.length > MAX_EVENTS) {
    store.splice(0, store.length - MAX_EVENTS);
  }

  writePersistedEvents(store);
}

export function listManychatDevRuntimeEvents(since?: string): ManychatDevRuntimeEvent[] {
  const store = runtimeEventsStore();
  if (!since) {
    return [...store];
  }

  const sinceTime = new Date(since).getTime();
  if (Number.isNaN(sinceTime)) {
    return [...store];
  }

  return store.filter((event) => new Date(event.createdAt).getTime() > sinceTime);
}

export function clearManychatDevRuntimeEvents(): void {
  const scoped = globalThis as ManychatDevEventGlobal;
  scoped[GLOBAL_KEY] = [];
  scoped[HYDRATED_GLOBAL_KEY] = true;

  if (!isDevPersistenceEnabled()) return;

  try {
    rmSync(persistencePath(), { force: true });
  } catch {
    // Reset is best-effort dev tooling.
  }
}

export function getManychatDevRuntimeEventsPath(): string {
  return persistencePath();
}

export type { ManychatDevRuntimeEvent };
