import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  and,
  channels,
  db,
  desc,
  eq,
  inArray,
  type DB,
} from "@tugobo/db";
import type {
  ConnectedChannelProvider,
  ConnectedChannelStatus,
  ConnectedChannelType,
} from "@tugobo/shared";
import {
  MANYCHAT_LOCAL_TEST_HOTEL_ID,
  MANYCHAT_LOCAL_TEST_SECRET,
  resolveManychatBridgeConfig,
  sanitizeManychatBridgeMetadata,
} from "@/lib/server/integrations/manychat-config";
import { resolvePilotHotelId } from "@/lib/server/pilot-hotel";

export type ManagedChannelType = Extract<ConnectedChannelType, "web_chat" | "instagram" | "whatsapp">;
export type ChannelHealthStatus = "active" | "pending" | "disabled" | "error";
export type OperationalChannelHealthStatus = ChannelHealthStatus | "degraded";
export type ChannelReadiness = "not_configured" | "partially_configured" | "connected";

export type ChannelOutboundConfig = {
  url: string | null;
  urlConfigured: boolean;
  tokenConfigured: boolean;
  tokenMasked: string | null;
};

/**
 * Operational readiness for a ManyChat-backed channel, derived from the
 * presence of an inbound secret and outbound URL + token. This is distinct
 * from channel *health* (live traffic): readiness reflects configuration
 * completeness only.
 */
export function deriveChannelReadiness(input: {
  hasSecret: boolean;
  hasOutboundUrl: boolean;
  hasOutboundToken: boolean;
}): ChannelReadiness {
  if (input.hasSecret && input.hasOutboundUrl && input.hasOutboundToken) {
    return "connected";
  }
  if (input.hasSecret) {
    return "partially_configured";
  }
  return "not_configured";
}

export type ChannelOperationalHealth = {
  channelType: ManagedChannelType;
  status: OperationalChannelHealthStatus;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastTestAt: string | null;
  lastError: string | null;
  messageCountToday: number;
  failedDeliveriesToday: number;
};

type ChannelHealthSnapshot = Omit<ChannelOperationalHealth, "channelType"> & {
  countDate: string;
};

type ChannelHealthEventInput = {
  hotelId: string;
  channelType: ManagedChannelType;
  direction?: "inbound" | "outbound";
  tested?: boolean;
  status?: OperationalChannelHealthStatus;
  deliveryFailed?: boolean;
  incrementMessageCount?: boolean;
  lastError?: string | null;
};

export type ConnectedChannelDisplay = {
  channelType: ManagedChannelType;
  displayName: "Web Chat" | "Instagram" | "WhatsApp";
  status: ChannelHealthStatus;
  readiness: ChannelReadiness;
  lastConnectedAt: string | null;
  lastError: string | null;
  webhookState: "ready" | "not_configured";
  setup: ChannelSetupDetails;
};

export type ChannelSetupDetails = {
  channelType: ManagedChannelType;
  inboundWebhookUrl: string | null;
  workspaceId: string;
  hotelId: string;
  status: ChannelHealthStatus;
  readiness: ChannelReadiness;
  connectionHealth: "healthy" | "pending" | "error" | "disabled";
  secret: {
    available: boolean;
    masked: string | null;
    copyAllowed: boolean;
  };
  outbound: ChannelOutboundConfig;
};

export type ServerConnectedChannelConfig = {
  id: string | null;
  hotelId: string;
  channelType: ManagedChannelType;
  provider: ConnectedChannelProvider;
  status: ChannelHealthStatus;
  inboundSecret?: string;
  outboundUrl?: string;
  outboundToken?: string;
  externalAccountId?: string;
  lastConnectedAt: Date | null;
  lastError: string | null;
  metadata: Record<string, unknown>;
};

type UpdateConnectedChannelStatusInput = {
  hotelId: string;
  channelType: ManagedChannelType;
  status: ChannelHealthStatus;
  lastError?: string | null;
};

type ValidateChannelSecretInput = {
  hotelId: string;
  channelType: ManagedChannelType;
  secret: string;
};

type ResolveOutboundConfigInput = {
  hotelId: string;
  channelType: ManagedChannelType;
  externalUserId?: string;
};

type RotateChannelSecretInput = {
  hotelId: string;
  channelType: Extract<ManagedChannelType, "instagram" | "whatsapp">;
};

const MANAGED_CHANNELS: ManagedChannelType[] = ["web_chat", "instagram", "whatsapp"];
const LOCAL_HEALTH_GLOBAL_KEY = "__tugobo_channel_health__";
const LOCAL_HEALTH_HYDRATED_GLOBAL_KEY = "__tugobo_channel_health_hydrated__";

function assertDb(): DB {
  if (!db) throw new Error("database_not_configured");
  return db;
}

function displayName(channelType: ManagedChannelType): ConnectedChannelDisplay["displayName"] {
  if (channelType === "web_chat") return "Web Chat";
  if (channelType === "instagram") return "Instagram";
  return "WhatsApp";
}

function isInternalDevSafeMode(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.CHANNEL_ADMIN_INTERNAL_SETUP === "true"
  );
}

export function resolveSettingsHotelId(): string | null {
  const pilotHotelId = resolvePilotHotelId();
  if (pilotHotelId) return pilotHotelId;
  if (process.env.NODE_ENV !== "production") return MANYCHAT_LOCAL_TEST_HOTEL_ID;
  return null;
}

export function validateSettingsHotelId(requestedHotelId?: string | null): string {
  const hotelId = resolveSettingsHotelId();

  if (!hotelId) {
    throw new Error("hotel_not_configured");
  }

  if (requestedHotelId && requestedHotelId !== hotelId) {
    throw new Error("invalid_hotel_id");
  }

  return hotelId;
}

export function normalizeChannelStatus(status: ConnectedChannelStatus | string | null | undefined): ChannelHealthStatus {
  if (status === "active" || status === "connected") return "active";
  if (status === "disabled" || status === "disconnected") return "disabled";
  if (status === "error") return "error";
  return "pending";
}

function defaultProviderForChannel(channelType: ManagedChannelType): ConnectedChannelProvider {
  if (channelType === "web_chat") return "web_chat";
  if (channelType === "instagram") return "instagram_dm";
  return "whatsapp_cloud";
}

function metadataRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function localHealthPath(): string {
  return path.join(process.cwd(), ".tugobo-dev", "channel-health.json");
}

function isHealthSnapshot(input: unknown): input is ChannelHealthSnapshot {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const candidate = input as Partial<ChannelHealthSnapshot>;
  return (
    (candidate.status === "active" ||
      candidate.status === "pending" ||
      candidate.status === "degraded" ||
      candidate.status === "error" ||
      candidate.status === "disabled") &&
    typeof candidate.messageCountToday === "number" &&
    typeof candidate.failedDeliveriesToday === "number" &&
    typeof candidate.countDate === "string"
  );
}

function defaultHealth(status: OperationalChannelHealthStatus = "pending"): ChannelHealthSnapshot {
  return {
    status,
    lastInboundAt: null,
    lastOutboundAt: null,
    lastTestAt: null,
    lastError: null,
    messageCountToday: 0,
    failedDeliveriesToday: 0,
    countDate: todayKey(),
  };
}

function normalizeHealthDay(snapshot: ChannelHealthSnapshot): ChannelHealthSnapshot {
  if (snapshot.countDate === todayKey()) return snapshot;
  return {
    ...snapshot,
    countDate: todayKey(),
    messageCountToday: 0,
    failedDeliveriesToday: 0,
  };
}

function healthFromMetadata(
  metadata: Record<string, unknown>,
  fallbackStatus: OperationalChannelHealthStatus
): ChannelHealthSnapshot {
  const health = metadata.channelHealth;
  if (isHealthSnapshot(health)) {
    return normalizeHealthDay(health);
  }

  return defaultHealth(fallbackStatus);
}

type LocalHealthGlobal = typeof globalThis & {
  [LOCAL_HEALTH_GLOBAL_KEY]?: Record<string, ChannelHealthSnapshot>;
  [LOCAL_HEALTH_HYDRATED_GLOBAL_KEY]?: boolean;
};

function readLocalHealth(): Record<string, ChannelHealthSnapshot> {
  if (process.env.NODE_ENV === "production") return {};

  try {
    const parsed = JSON.parse(readFileSync(localHealthPath(), "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result: Record<string, ChannelHealthSnapshot> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isHealthSnapshot(value)) {
        result[key] = normalizeHealthDay(value);
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeLocalHealth(store: Record<string, ChannelHealthSnapshot>) {
  if (process.env.NODE_ENV === "production") return;

  try {
    const filePath = localHealthPath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  } catch {
    // Local health state must never block channel operations.
  }
}

function localHealthStore(): Record<string, ChannelHealthSnapshot> {
  const scoped = globalThis as LocalHealthGlobal;

  if (!scoped[LOCAL_HEALTH_GLOBAL_KEY]) {
    scoped[LOCAL_HEALTH_GLOBAL_KEY] = {};
  }

  if (!scoped[LOCAL_HEALTH_HYDRATED_GLOBAL_KEY]) {
    scoped[LOCAL_HEALTH_GLOBAL_KEY] = readLocalHealth();
    scoped[LOCAL_HEALTH_HYDRATED_GLOBAL_KEY] = true;
  }

  return scoped[LOCAL_HEALTH_GLOBAL_KEY];
}

function localHealthKey(hotelId: string, channelType: ManagedChannelType): string {
  return `${hotelId}:${channelType}`;
}

// ── Local-dev outbound config store ────────────────────────────────────────
// Mirrors the local-dev channel-health store so operators can save outbound
// URL/token in local development (where `db` may be absent) without touching
// env vars or source. Production persists to the connected_channels columns.
const LOCAL_CONFIG_GLOBAL_KEY = "__tugobo_channel_outbound_config__";
const LOCAL_CONFIG_HYDRATED_GLOBAL_KEY = "__tugobo_channel_outbound_config_hydrated__";

type LocalOutboundConfig = {
  outboundUrl?: string;
  outboundToken?: string;
};

type LocalConfigGlobal = typeof globalThis & {
  [LOCAL_CONFIG_GLOBAL_KEY]?: Record<string, LocalOutboundConfig>;
  [LOCAL_CONFIG_HYDRATED_GLOBAL_KEY]?: boolean;
};

function localConfigPath(): string {
  return path.join(process.cwd(), ".tugobo-dev", "channel-config.json");
}

function isLocalOutboundConfig(input: unknown): input is LocalOutboundConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const candidate = input as LocalOutboundConfig;
  return (
    (candidate.outboundUrl === undefined || typeof candidate.outboundUrl === "string") &&
    (candidate.outboundToken === undefined || typeof candidate.outboundToken === "string")
  );
}

function readLocalConfig(): Record<string, LocalOutboundConfig> {
  if (process.env.NODE_ENV === "production") return {};

  try {
    const parsed = JSON.parse(readFileSync(localConfigPath(), "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result: Record<string, LocalOutboundConfig> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isLocalOutboundConfig(value)) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeLocalConfig(store: Record<string, LocalOutboundConfig>) {
  if (process.env.NODE_ENV === "production") return;

  try {
    const filePath = localConfigPath();
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  } catch {
    // Local outbound config must never block channel operations.
  }
}

function localConfigStore(): Record<string, LocalOutboundConfig> {
  const scoped = globalThis as LocalConfigGlobal;

  if (!scoped[LOCAL_CONFIG_GLOBAL_KEY]) {
    scoped[LOCAL_CONFIG_GLOBAL_KEY] = {};
  }

  if (!scoped[LOCAL_CONFIG_HYDRATED_GLOBAL_KEY]) {
    scoped[LOCAL_CONFIG_GLOBAL_KEY] = readLocalConfig();
    scoped[LOCAL_CONFIG_HYDRATED_GLOBAL_KEY] = true;
  }

  return scoped[LOCAL_CONFIG_GLOBAL_KEY];
}

function getLocalOutboundConfig(
  hotelId: string,
  channelType: ManagedChannelType
): LocalOutboundConfig {
  return localConfigStore()[localHealthKey(hotelId, channelType)] ?? {};
}

function setLocalOutboundConfig(
  hotelId: string,
  channelType: ManagedChannelType,
  patch: { outboundUrl?: string | null; outboundToken?: string | null }
): LocalOutboundConfig {
  const store = localConfigStore();
  const key = localHealthKey(hotelId, channelType);
  const current = store[key] ?? {};

  const next: LocalOutboundConfig = { ...current };
  if (patch.outboundUrl !== undefined) {
    const value = patch.outboundUrl?.trim();
    if (value) next.outboundUrl = value;
    else delete next.outboundUrl;
  }
  if (patch.outboundToken !== undefined) {
    const value = patch.outboundToken?.trim();
    if (value) next.outboundToken = value;
    else delete next.outboundToken;
  }

  store[key] = next;
  writeLocalConfig(store);
  return next;
}

/** Whether the local-dev hotel has an implicit inbound secret for a channel. */
function localDevHasSecret(channelType: ManagedChannelType): boolean {
  // The local-dev Instagram channel ships with the shared test secret;
  // WhatsApp has none until configured against a real workspace.
  return channelType === "instagram";
}

function safeOperationalError(error: string | null | undefined): string | null {
  if (!error) return null;
  const trimmed = error.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 180) : null;
}

function applyHealthEvent(
  current: ChannelHealthSnapshot,
  input: ChannelHealthEventInput
): ChannelHealthSnapshot {
  const now = new Date().toISOString();
  const next = normalizeHealthDay(current);
  const failedDeliveriesToday = next.failedDeliveriesToday + (input.deliveryFailed ? 1 : 0);
  const status =
    input.status ??
    (input.deliveryFailed
      ? "error"
      : next.status === "pending"
        ? "active"
        : next.status);

  return {
    ...next,
    status,
    lastInboundAt: input.direction === "inbound" ? now : next.lastInboundAt,
    lastOutboundAt: input.direction === "outbound" ? now : next.lastOutboundAt,
    lastTestAt: input.tested ? now : next.lastTestAt,
    lastError: input.deliveryFailed || input.status === "error" || input.status === "degraded"
      ? safeOperationalError(input.lastError) ?? next.lastError
      : input.lastError === null
        ? null
        : next.lastError,
    messageCountToday:
      input.incrementMessageCount === false
        ? next.messageCountToday
        : input.direction
          ? next.messageCountToday + 1
          : next.messageCountToday,
    failedDeliveriesToday,
  };
}

function stringValue(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}

function metadataSecret(metadata: Record<string, unknown>) {
  return stringValue(metadata.inboundSecret) ?? stringValue(metadata.inbound_secret);
}

function connectionHealth(status: ChannelHealthStatus): ChannelSetupDetails["connectionHealth"] {
  if (status === "active") return "healthy";
  if (status === "error") return "error";
  if (status === "disabled") return "disabled";
  return "pending";
}

function maskSecret(secret: string | undefined): string | null {
  if (!secret) return null;
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 3)}****${secret.slice(-3)}`;
}

function generateChannelSecret(): string {
  return `tgb_${randomBytes(24).toString("base64url")}`;
}

function channelWebhookUrl(origin: string | undefined, channelType: ManagedChannelType): string | null {
  if (channelType !== "instagram" && channelType !== "whatsapp") {
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || origin?.trim();
  if (!baseUrl) return null;

  return new URL("/api/integrations/manychat/inbound", baseUrl).toString();
}

function secretsMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function toServerConfig(
  row: typeof channels.$inferSelect | null,
  hotelId: string,
  channelType: ManagedChannelType
): ServerConnectedChannelConfig {
  const metadata = metadataRecord(row?.metadata);
  const status = normalizeChannelStatus(row?.status);

  return {
    id: row?.id ?? null,
    hotelId,
    channelType,
    provider: row?.provider ?? defaultProviderForChannel(channelType),
    status,
    inboundSecret: row?.inboundSecret ?? row?.secret ?? metadataSecret(metadata),
    outboundUrl: row?.outboundUrl ?? stringValue(metadata.outboundUrl) ?? stringValue(metadata.outbound_url),
    outboundToken:
      row?.outboundToken ?? stringValue(metadata.outboundToken) ?? stringValue(metadata.outbound_token),
    externalAccountId:
      row?.externalAccountId ??
      stringValue(metadata.externalAccountId) ??
      stringValue(metadata.external_account_id),
    lastConnectedAt: row?.lastConnectedAt ?? (status === "active" ? row?.createdAt ?? null : null),
    lastError: row?.lastError ?? null,
    metadata: sanitizeManychatBridgeMetadata(metadata),
  };
}

function toDisplay(config: ServerConnectedChannelConfig, origin?: string): ConnectedChannelDisplay {
  const secretAvailable = Boolean(config.inboundSecret);
  const isWebhookChannel = config.channelType === "instagram" || config.channelType === "whatsapp";
  const hasOutboundUrl = Boolean(config.outboundUrl);
  const hasOutboundToken = Boolean(config.outboundToken);
  const readiness: ChannelReadiness = isWebhookChannel
    ? deriveChannelReadiness({
        hasSecret: secretAvailable,
        hasOutboundUrl,
        hasOutboundToken,
      })
    : "connected";

  return {
    channelType: config.channelType,
    displayName: displayName(config.channelType),
    status: config.status,
    readiness,
    lastConnectedAt: config.lastConnectedAt?.toISOString() ?? null,
    lastError: config.status === "error" ? config.lastError : null,
    webhookState:
      config.channelType === "web_chat" || config.inboundSecret ? "ready" : "not_configured",
    setup: {
      channelType: config.channelType,
      inboundWebhookUrl: channelWebhookUrl(origin, config.channelType),
      workspaceId: config.hotelId,
      hotelId: config.hotelId,
      status: config.status,
      readiness,
      connectionHealth: connectionHealth(config.status),
      secret: {
        available: secretAvailable,
        masked: maskSecret(config.inboundSecret),
        copyAllowed: secretAvailable && isInternalDevSafeMode(),
      },
      outbound: {
        url: isWebhookChannel ? config.outboundUrl ?? null : null,
        urlConfigured: hasOutboundUrl,
        tokenConfigured: hasOutboundToken,
        tokenMasked: maskSecret(config.outboundToken),
      },
    },
  };
}

function localDevWebhookChannel(
  hotelId: string,
  channelType: Extract<ManagedChannelType, "instagram" | "whatsapp">,
  origin?: string
): ConnectedChannelDisplay {
  const hasSecret = localDevHasSecret(channelType);
  const stored = getLocalOutboundConfig(hotelId, channelType);
  const hasOutboundUrl = Boolean(stored.outboundUrl);
  const hasOutboundToken = Boolean(stored.outboundToken);
  const readiness = deriveChannelReadiness({ hasSecret, hasOutboundUrl, hasOutboundToken });
  const status: ChannelHealthStatus = readiness === "connected" ? "active" : "pending";

  return {
    channelType,
    displayName: channelType === "instagram" ? "Instagram" : "WhatsApp",
    status,
    readiness,
    lastConnectedAt: null,
    lastError: null,
    webhookState: hasSecret ? "ready" : "not_configured",
    setup: {
      channelType,
      inboundWebhookUrl: channelWebhookUrl(origin, channelType),
      workspaceId: hotelId,
      hotelId,
      status,
      readiness,
      connectionHealth: connectionHealth(status),
      secret: {
        available: hasSecret,
        masked: hasSecret ? maskSecret(MANYCHAT_LOCAL_TEST_SECRET) : null,
        copyAllowed: hasSecret && isInternalDevSafeMode(),
      },
      outbound: {
        url: stored.outboundUrl ?? null,
        urlConfigured: hasOutboundUrl,
        tokenConfigured: hasOutboundToken,
        tokenMasked: maskSecret(stored.outboundToken),
      },
    },
  };
}

function localDevDisplayChannels(hotelId: string, origin?: string): ConnectedChannelDisplay[] {
  return [
    {
      channelType: "web_chat",
      displayName: "Web Chat",
      status: "active",
      readiness: "connected",
      lastConnectedAt: null,
      lastError: null,
      webhookState: "ready",
      setup: {
        channelType: "web_chat",
        inboundWebhookUrl: null,
        workspaceId: hotelId,
        hotelId,
        status: "active",
        readiness: "connected",
        connectionHealth: "healthy",
        secret: {
          available: false,
          masked: null,
          copyAllowed: false,
        },
        outbound: {
          url: null,
          urlConfigured: false,
          tokenConfigured: false,
          tokenMasked: null,
        },
      },
    },
    localDevWebhookChannel(hotelId, "instagram", origin),
    localDevWebhookChannel(hotelId, "whatsapp", origin),
  ];
}

export function getLocalDevConnectedChannels(hotelId: string, origin?: string): ConnectedChannelDisplay[] | null {
  if (process.env.NODE_ENV === "production") return null;
  return hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID ? localDevDisplayChannels(hotelId, origin) : null;
}

export async function getConnectedChannel(
  hotelId: string,
  channelType: ManagedChannelType
): Promise<ServerConnectedChannelConfig | null> {
  if (!db) {
    return null;
  }

  const [row] = await db
    .select()
    .from(channels)
    .where(and(eq(channels.hotelId, hotelId), eq(channels.channelType, channelType)))
    .orderBy(desc(channels.createdAt))
    .limit(1);

  return row ? toServerConfig(row, hotelId, channelType) : null;
}

export async function listConnectedChannels(hotelId: string, origin?: string): Promise<ConnectedChannelDisplay[]> {
  const localDevChannels = getLocalDevConnectedChannels(hotelId, origin);
  if (localDevChannels) {
    return localDevChannels;
  }

  if (!db) {
    return MANAGED_CHANNELS.map((channelType) =>
      toDisplay(toServerConfig(null, hotelId, channelType), origin)
    );
  }

  const rows = await db
    .select()
    .from(channels)
    .where(and(eq(channels.hotelId, hotelId), inArray(channels.channelType, MANAGED_CHANNELS)))
    .orderBy(desc(channels.createdAt));

  return MANAGED_CHANNELS.map((channelType) => {
    const row = rows.find((candidate) => candidate.channelType === channelType) ?? null;
    return toDisplay(toServerConfig(row, hotelId, channelType), origin);
  });
}

export async function listChannelHealth(hotelId: string, origin?: string): Promise<ChannelOperationalHealth[]> {
  const displays = await listConnectedChannels(hotelId, origin);

  if (process.env.NODE_ENV !== "production" && hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID) {
    const store = localHealthStore();
    return displays.map((channel) => {
      const key = localHealthKey(hotelId, channel.channelType);
      const snapshot = normalizeHealthDay(
        store[key] ?? defaultHealth(channel.status === "disabled" ? "disabled" : channel.status)
      );
      store[key] = snapshot;

      return {
        channelType: channel.channelType,
        status: snapshot.status,
        lastInboundAt: snapshot.lastInboundAt,
        lastOutboundAt: snapshot.lastOutboundAt,
        lastTestAt: snapshot.lastTestAt,
        lastError: snapshot.lastError,
        messageCountToday: snapshot.messageCountToday,
        failedDeliveriesToday: snapshot.failedDeliveriesToday,
      };
    });
  }

  if (!db) {
    return displays.map((channel) => {
      const snapshot = defaultHealth(channel.status === "disabled" ? "disabled" : channel.status);
      return {
        channelType: channel.channelType,
        status: snapshot.status,
        lastInboundAt: snapshot.lastInboundAt,
        lastOutboundAt: snapshot.lastOutboundAt,
        lastTestAt: snapshot.lastTestAt,
        lastError: snapshot.lastError,
        messageCountToday: snapshot.messageCountToday,
        failedDeliveriesToday: snapshot.failedDeliveriesToday,
      };
    });
  }

  const rows = await db
    .select({
      channelType: channels.channelType,
      status: channels.status,
      metadata: channels.metadata,
      lastError: channels.lastError,
    })
    .from(channels)
    .where(and(eq(channels.hotelId, hotelId), inArray(channels.channelType, MANAGED_CHANNELS)))
    .orderBy(desc(channels.createdAt));

  return displays.map((channel) => {
    const row = rows.find((candidate) => candidate.channelType === channel.channelType);
    const metadata = metadataRecord(row?.metadata);
    const snapshot = healthFromMetadata(
      metadata,
      row ? normalizeChannelStatus(row.status) : channel.status
    );

    return {
      channelType: channel.channelType,
      status: snapshot.status,
      lastInboundAt: snapshot.lastInboundAt,
      lastOutboundAt: snapshot.lastOutboundAt,
      lastTestAt: snapshot.lastTestAt,
      lastError: snapshot.lastError ?? (snapshot.status === "error" ? row?.lastError ?? null : null),
      messageCountToday: snapshot.messageCountToday,
      failedDeliveriesToday: snapshot.failedDeliveriesToday,
    };
  });
}

export async function updateChannelHealthFromEvent(input: ChannelHealthEventInput): Promise<void> {
  if (process.env.NODE_ENV !== "production" && input.hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID) {
    const store = localHealthStore();
    const key = localHealthKey(input.hotelId, input.channelType);
    store[key] = applyHealthEvent(store[key] ?? defaultHealth("pending"), input);
    writeLocalHealth(store);
    return;
  }

  if (!db) return;

  try {
    const [row] = await db
      .select({
        id: channels.id,
        metadata: channels.metadata,
        status: channels.status,
      })
      .from(channels)
      .where(and(eq(channels.hotelId, input.hotelId), eq(channels.channelType, input.channelType)))
      .orderBy(desc(channels.createdAt))
      .limit(1);

    if (!row?.id) return;

    const metadata = metadataRecord(row.metadata);
    const nextHealth = applyHealthEvent(
      healthFromMetadata(metadata, normalizeChannelStatus(row.status)),
      input
    );
    const nextChannelStatus =
      nextHealth.status === "degraded" ? normalizeChannelStatus(row.status) : nextHealth.status;
    const nextLastError =
      nextHealth.status === "error" || nextHealth.status === "degraded"
        ? nextHealth.lastError
        : null;

    await db
      .update(channels)
      .set({
        status: nextChannelStatus,
        lastConnectedAt: nextChannelStatus === "active" ? new Date() : undefined,
        lastError: nextLastError,
        metadata: {
          ...metadata,
          channelHealth: nextHealth,
        },
      })
      .where(eq(channels.id, row.id));
  } catch {
    // Health writes are best-effort and must not interrupt guest messaging.
  }
}

export async function rotateChannelSecret(input: RotateChannelSecretInput): Promise<{
  channelType: RotateChannelSecretInput["channelType"];
  status: ChannelHealthStatus;
  maskedSecret: string;
  secret?: string;
  copyAllowed: boolean;
  stored: boolean;
}> {
  if (
    process.env.NODE_ENV !== "production" &&
    input.hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID
  ) {
    return {
      channelType: input.channelType,
      status: input.channelType === "instagram" ? "active" : "pending",
      maskedSecret: maskSecret(MANYCHAT_LOCAL_TEST_SECRET) ?? "****",
      secret: isInternalDevSafeMode() ? MANYCHAT_LOCAL_TEST_SECRET : undefined,
      copyAllowed: isInternalDevSafeMode(),
      stored: false,
    };
  }

  const database = assertDb();
  const nextSecret = generateChannelSecret();
  const now = new Date();
  const provider = "manychat" as const;

  const [existing] = await database
    .select({ id: channels.id, metadata: channels.metadata })
    .from(channels)
    .where(and(eq(channels.hotelId, input.hotelId), eq(channels.channelType, input.channelType)))
    .orderBy(desc(channels.createdAt))
    .limit(1);

  if (existing?.id) {
    const existingMetadata = metadataRecord(existing.metadata);
    await database
      .update(channels)
      .set({
        provider,
        inboundSecret: nextSecret,
        secret: null,
        status: "pending",
        lastError: null,
        metadata: {
          ...sanitizeManychatBridgeMetadata(existingMetadata),
          secretRotatedAt: now.toISOString(),
        },
      })
      .where(eq(channels.id, existing.id));
  } else {
    await database.insert(channels).values({
      hotelId: input.hotelId,
      provider,
      channelType: input.channelType,
      status: "pending",
      inboundSecret: nextSecret,
      metadata: {
        secretRotatedAt: now.toISOString(),
      },
    });
  }

  const copyAllowed = isInternalDevSafeMode();

  return {
    channelType: input.channelType,
    status: "pending",
    maskedSecret: maskSecret(nextSecret) ?? "****",
    secret: copyAllowed ? nextSecret : undefined,
    copyAllowed,
    stored: true,
  };
}

type UpdateOutboundConfigInput = {
  hotelId: string;
  channelType: Extract<ManagedChannelType, "instagram" | "whatsapp">;
  /** undefined = leave unchanged; "" / null = clear; string = set. */
  outboundUrl?: string | null;
  outboundToken?: string | null;
};

export type UpdateOutboundConfigResult = {
  channelType: UpdateOutboundConfigInput["channelType"];
  readiness: ChannelReadiness;
  outbound: ChannelOutboundConfig;
  stored: boolean;
};

/**
 * Persist outbound URL/token for a ManyChat-backed channel through the existing
 * connected_channels configuration (no new tables). In local dev the values are
 * stored in the same file-backed store used for channel health so operators can
 * configure connectivity without a database.
 */
export async function updateOutboundConfig(
  input: UpdateOutboundConfigInput
): Promise<UpdateOutboundConfigResult> {
  if (
    process.env.NODE_ENV !== "production" &&
    input.hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID
  ) {
    const next = setLocalOutboundConfig(input.hotelId, input.channelType, {
      outboundUrl: input.outboundUrl,
      outboundToken: input.outboundToken,
    });
    const hasOutboundUrl = Boolean(next.outboundUrl);
    const hasOutboundToken = Boolean(next.outboundToken);

    return {
      channelType: input.channelType,
      readiness: deriveChannelReadiness({
        hasSecret: localDevHasSecret(input.channelType),
        hasOutboundUrl,
        hasOutboundToken,
      }),
      outbound: {
        url: next.outboundUrl ?? null,
        urlConfigured: hasOutboundUrl,
        tokenConfigured: hasOutboundToken,
        tokenMasked: maskSecret(next.outboundToken),
      },
      stored: true,
    };
  }

  const database = assertDb();
  const provider = "manychat" as const;

  const [existing] = await database
    .select({
      id: channels.id,
      inboundSecret: channels.inboundSecret,
      legacySecret: channels.secret,
      outboundUrl: channels.outboundUrl,
      outboundToken: channels.outboundToken,
      metadata: channels.metadata,
    })
    .from(channels)
    .where(and(eq(channels.hotelId, input.hotelId), eq(channels.channelType, input.channelType)))
    .orderBy(desc(channels.createdAt))
    .limit(1);

  const existingMetadata = metadataRecord(existing?.metadata);
  const inboundSecret =
    existing?.inboundSecret ?? existing?.legacySecret ?? metadataSecret(existingMetadata);

  const resolveNext = (incoming: string | null | undefined, current: string | null | undefined) => {
    if (incoming === undefined) return current ?? null;
    const trimmed = incoming?.trim();
    return trimmed ? trimmed : null;
  };

  const nextUrl = resolveNext(input.outboundUrl, existing?.outboundUrl);
  const nextToken = resolveNext(input.outboundToken, existing?.outboundToken);

  if (existing?.id) {
    await database
      .update(channels)
      .set({ provider, outboundUrl: nextUrl, outboundToken: nextToken })
      .where(eq(channels.id, existing.id));
  } else {
    await database.insert(channels).values({
      hotelId: input.hotelId,
      provider,
      channelType: input.channelType,
      status: "pending",
      outboundUrl: nextUrl,
      outboundToken: nextToken,
    });
  }

  const hasOutboundUrl = Boolean(nextUrl);
  const hasOutboundToken = Boolean(nextToken);

  return {
    channelType: input.channelType,
    readiness: deriveChannelReadiness({
      hasSecret: Boolean(inboundSecret),
      hasOutboundUrl,
      hasOutboundToken,
    }),
    outbound: {
      url: nextUrl,
      urlConfigured: hasOutboundUrl,
      tokenConfigured: hasOutboundToken,
      tokenMasked: maskSecret(nextToken ?? undefined),
    },
    stored: true,
  };
}

/** Resolve configuration-completeness readiness for a single channel. */
export async function getChannelReadinessState(
  hotelId: string,
  channelType: ManagedChannelType
): Promise<{
  readiness: ChannelReadiness;
  hasSecret: boolean;
  hasOutboundUrl: boolean;
  hasOutboundToken: boolean;
}> {
  if (channelType === "web_chat") {
    return {
      readiness: "connected",
      hasSecret: true,
      hasOutboundUrl: true,
      hasOutboundToken: true,
    };
  }

  if (process.env.NODE_ENV !== "production" && hotelId === MANYCHAT_LOCAL_TEST_HOTEL_ID) {
    const stored = getLocalOutboundConfig(hotelId, channelType);
    const hasSecret = localDevHasSecret(channelType);
    const hasOutboundUrl = Boolean(stored.outboundUrl);
    const hasOutboundToken = Boolean(stored.outboundToken);
    return {
      readiness: deriveChannelReadiness({ hasSecret, hasOutboundUrl, hasOutboundToken }),
      hasSecret,
      hasOutboundUrl,
      hasOutboundToken,
    };
  }

  const config = await getConnectedChannel(hotelId, channelType);
  const hasSecret = Boolean(config?.inboundSecret);
  const hasOutboundUrl = Boolean(config?.outboundUrl);
  const hasOutboundToken = Boolean(config?.outboundToken);
  return {
    readiness: deriveChannelReadiness({ hasSecret, hasOutboundUrl, hasOutboundToken }),
    hasSecret,
    hasOutboundUrl,
    hasOutboundToken,
  };
}

export async function updateConnectedChannelStatus(input: UpdateConnectedChannelStatusInput): Promise<void> {
  const database = assertDb();
  const now = new Date();

  await database
    .update(channels)
    .set({
      status: input.status,
      lastConnectedAt: input.status === "active" ? now : undefined,
      lastError: input.status === "error" ? input.lastError ?? "Connection error" : null,
    })
    .where(and(eq(channels.hotelId, input.hotelId), eq(channels.channelType, input.channelType)));
}

export async function validateChannelSecret(input: ValidateChannelSecretInput): Promise<void> {
  if (input.channelType === "instagram" || input.channelType === "whatsapp") {
    const bridgeConfig = await resolveManychatBridgeConfig({
      hotelId: input.hotelId,
      channel: input.channelType,
    });

    if (!bridgeConfig) {
      throw new Error("channel_not_connected");
    }

    if (!bridgeConfig.inboundSecret) {
      throw new Error("channel_secret_missing");
    }

    if (!secretsMatch(bridgeConfig.inboundSecret, input.secret.trim())) {
      throw new Error("invalid_secret");
    }

    return;
  }

  const config = await getConnectedChannel(input.hotelId, input.channelType);

  if (!config) {
    throw new Error("channel_not_connected");
  }

  if (!config.inboundSecret) {
    throw new Error("channel_secret_missing");
  }

  if (!secretsMatch(config.inboundSecret, input.secret.trim())) {
    throw new Error("invalid_secret");
  }
}

export async function resolveOutboundConfig(input: ResolveOutboundConfigInput) {
  if (input.channelType === "instagram" || input.channelType === "whatsapp") {
    return resolveManychatBridgeConfig({
      hotelId: input.hotelId,
      channel: input.channelType,
      externalUserId: input.externalUserId,
    });
  }

  return null;
}
