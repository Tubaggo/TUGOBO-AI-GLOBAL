"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Bot,
  Building2,
  Check,
  Clock3,
  Copy,
  Globe2,
  Info,
  Instagram,
  KeyRound,
  MessageSquare,
  RefreshCw,
  Send,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

const defaultHours: Record<number, { open: boolean; from: string; to: string }> = {
  0: { open: false, from: "09:00", to: "18:00" },
  1: { open: true, from: "09:00", to: "22:00" },
  2: { open: true, from: "09:00", to: "22:00" },
  3: { open: true, from: "09:00", to: "22:00" },
  4: { open: true, from: "09:00", to: "22:00" },
  5: { open: true, from: "09:00", to: "22:00" },
  6: { open: true, from: "10:00", to: "20:00" },
};

type ChannelConnectionStatus = "active" | "pending" | "degraded" | "disabled" | "error";
type ChannelConnectionHealth = "healthy" | "pending" | "error" | "disabled";
type ChannelReadiness = "not_configured" | "partially_configured" | "connected";
type ChannelOutboundConfig = {
  url: string | null;
  urlConfigured: boolean;
  tokenConfigured: boolean;
  tokenMasked: string | null;
};
type ChannelHealth = {
  channelType: "web_chat" | "instagram" | "whatsapp";
  status: ChannelConnectionStatus;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastTestAt: string | null;
  lastError: string | null;
  messageCountToday: number;
  failedDeliveriesToday: number;
};
type ChannelSetupDetails = {
  channelType: "web_chat" | "instagram" | "whatsapp";
  inboundWebhookUrl: string | null;
  workspaceId: string;
  hotelId: string;
  status: ChannelConnectionStatus;
  readiness: ChannelReadiness;
  connectionHealth: ChannelConnectionHealth;
  secret: {
    available: boolean;
    masked: string | null;
    copyAllowed: boolean;
  };
  outbound: ChannelOutboundConfig;
};
type ChannelConnection = {
  channelType: "web_chat" | "instagram" | "whatsapp";
  displayName: "Web Chat" | "Instagram" | "WhatsApp";
  status: ChannelConnectionStatus;
  readiness: ChannelReadiness;
  lastConnectedAt: string | null;
  lastError: string | null;
  webhookState: "ready" | "not_configured";
  setup: ChannelSetupDetails;
  health?: ChannelHealth;
};

type ChannelTestResult = {
  status: "success" | "pending" | "error";
  message: string;
  testedAt: string;
};

type RotatedSecret = {
  maskedSecret: string;
  secret?: string;
  copyAllowed: boolean;
};

const emptyOutbound: ChannelOutboundConfig = {
  url: null,
  urlConfigured: false,
  tokenConfigured: false,
  tokenMasked: null,
};

const fallbackChannels: ChannelConnection[] = [
  {
    channelType: "web_chat",
    displayName: "Web Chat",
    status: "pending",
    readiness: "connected",
    lastConnectedAt: null,
    lastError: null,
    webhookState: "ready",
    setup: {
      channelType: "web_chat",
      inboundWebhookUrl: null,
      workspaceId: "demo-hotel",
      hotelId: "demo-hotel",
      status: "pending",
      readiness: "connected",
      connectionHealth: "pending",
      secret: { available: false, masked: null, copyAllowed: false },
      outbound: emptyOutbound,
    },
  },
  {
    channelType: "instagram",
    displayName: "Instagram",
    status: "pending",
    readiness: "not_configured",
    lastConnectedAt: null,
    lastError: null,
    webhookState: "not_configured",
    setup: {
      channelType: "instagram",
      inboundWebhookUrl: null,
      workspaceId: "demo-hotel",
      hotelId: "demo-hotel",
      status: "pending",
      readiness: "not_configured",
      connectionHealth: "pending",
      secret: { available: false, masked: null, copyAllowed: false },
      outbound: emptyOutbound,
    },
  },
  {
    channelType: "whatsapp",
    displayName: "WhatsApp",
    status: "pending",
    readiness: "not_configured",
    lastConnectedAt: null,
    lastError: null,
    webhookState: "not_configured",
    setup: {
      channelType: "whatsapp",
      inboundWebhookUrl: null,
      workspaceId: "demo-hotel",
      hotelId: "demo-hotel",
      status: "pending",
      readiness: "not_configured",
      connectionHealth: "pending",
      secret: { available: false, masked: null, copyAllowed: false },
      outbound: emptyOutbound,
    },
  },
];

function mergeChannelHealth(
  channels: ChannelConnection[],
  health: ChannelHealth[] | undefined
): ChannelConnection[] {
  if (!health?.length) return channels;
  return channels.map((channel) => ({
    ...channel,
    health: health.find((item) => item.channelType === channel.channelType),
  }));
}

export default function SettingsPage() {
  const pathname = usePathname();
  const isSalesPreview = pathname.startsWith("/demo/otel-paneli");

  const [saved, setSaved] = useState(false);
  const [channelConnections, setChannelConnections] = useState<ChannelConnection[]>(fallbackChannels);
  const [expandedChannel, setExpandedChannel] = useState<ChannelConnection["channelType"] | null>(null);
  const [testingChannel, setTestingChannel] = useState<ChannelConnection["channelType"] | null>(null);
  const [rotatingChannel, setRotatingChannel] = useState<ChannelConnection["channelType"] | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Partial<Record<ChannelConnection["channelType"], ChannelTestResult>>
  >({});
  const [rotatedSecrets, setRotatedSecrets] = useState<
    Partial<Record<Extract<ChannelConnection["channelType"], "instagram" | "whatsapp">, RotatedSecret>>
  >({});
  const [outboundDrafts, setOutboundDrafts] = useState<
    Partial<Record<Extract<ChannelConnection["channelType"], "instagram" | "whatsapp">, { url: string; token: string }>>
  >({});
  const [savingChannel, setSavingChannel] = useState<
    Extract<ChannelConnection["channelType"], "instagram" | "whatsapp"> | null
  >(null);
  const [outboundSavedChannel, setOutboundSavedChannel] = useState<
    Extract<ChannelConnection["channelType"], "instagram" | "whatsapp"> | null
  >(null);
  const [simulatingInstagram, setSimulatingInstagram] = useState(false);
  const [simResult, setSimResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  // Dev/demo-only inbound simulator (never shown in the sales preview or production build).
  const showInstagramSimulator = !isSalesPreview && process.env.NODE_ENV !== "production";
  const [persona, setPersona] = useState(
    "Tugobo AI otel operasyonunu net, kontrollü ve misafir diline uygun yanıtlarla destekler. Rezervasyon ve ödeme adımlarını görünür tutar; gerekli olduğunda operatöre devreder."
  );
  const [hotelName, setHotelName] = useState("Pilot Otel");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [hours, setHours] = useState(defaultHours);

  useEffect(() => {
    let cancelled = false;

    async function loadChannelConnections() {
      if (isSalesPreview) return;

      try {
        const [channelsRes, healthRes] = await Promise.all([
          fetch("/api/settings/channels"),
          fetch("/api/settings/channels/health"),
        ]);
        const data = (await channelsRes.json().catch(() => null)) as {
          ok?: boolean;
          channels?: ChannelConnection[];
        } | null;
        const healthData = (await healthRes.json().catch(() => null)) as {
          ok?: boolean;
          channels?: ChannelHealth[];
        } | null;

        if (!cancelled && data?.ok && Array.isArray(data.channels)) {
          setChannelConnections(mergeChannelHealth(data.channels, healthData?.channels));
        }
      } catch {
        // Keep the local safe fallback visible.
      }
    }

    void loadChannelConnections();

    return () => {
      cancelled = true;
    };
  }, [isSalesPreview]);

  async function handleSave() {
    setSaved(true);
    if (!isSalesPreview) {
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotelName, timezone, persona }),
        });
      } catch {
        // The saved affordance is intentionally optimistic for this local admin surface.
      }
    }
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleDay(day: number) {
    setHours((h) => ({ ...h, [day]: { ...h[day], open: !h[day].open } }));
  }

  async function refreshChannels() {
    if (isSalesPreview) return;

    try {
      const [channelsRes, healthRes] = await Promise.all([
        fetch("/api/settings/channels"),
        fetch("/api/settings/channels/health"),
      ]);
      const data = (await channelsRes.json().catch(() => null)) as {
        ok?: boolean;
        channels?: ChannelConnection[];
      } | null;
      const healthData = (await healthRes.json().catch(() => null)) as {
        ok?: boolean;
        channels?: ChannelHealth[];
      } | null;

      if (data?.ok && Array.isArray(data.channels)) {
        setChannelConnections(mergeChannelHealth(data.channels, healthData?.channels));
      }
    } catch {
      // Keep the last safe state visible.
    }
  }

  async function handleCopy(value: string | null | undefined, key: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setCopiedKey(null);
    }
  }

  async function handleTestChannel(channelType: ChannelConnection["channelType"]) {
    setTestingChannel(channelType);

    try {
      const res = await fetch("/api/settings/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelType }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        result?: ChannelTestResult & { channelType: ChannelConnection["channelType"] };
      } | null;

      setTestResults((current) => ({
        ...current,
        [channelType]: data?.ok && data.result
          ? data.result
          : {
              status: "error",
              message: "Bağlantı testi tamamlanamadı.",
              testedAt: new Date().toISOString(),
            },
      }));
    } catch {
      setTestResults((current) => ({
        ...current,
        [channelType]: {
          status: "error",
          message: "Bağlantı testi çalıştırılamadı.",
          testedAt: new Date().toISOString(),
        },
      }));
    } finally {
      setTestingChannel(null);
    }
  }

  async function handleRotateSecret(channelType: Extract<ChannelConnection["channelType"], "instagram" | "whatsapp">) {
    setRotatingChannel(channelType);

    try {
      const res = await fetch("/api/settings/channels/rotate-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelType }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        result?: RotatedSecret;
      } | null;

      if (data?.ok && data.result) {
        setRotatedSecrets((current) => ({
          ...current,
          [channelType]: data.result,
        }));
        await refreshChannels();
      }
    } catch {
      // Rotation errors are surfaced by leaving the previous setup state in place.
    } finally {
      setRotatingChannel(null);
    }
  }

  function handleOutboundDraftChange(
    channelType: Extract<ChannelConnection["channelType"], "instagram" | "whatsapp">,
    patch: Partial<{ url: string; token: string }>,
    fallbackUrl: string
  ) {
    setOutboundDrafts((current) => {
      const existing = current[channelType] ?? { url: fallbackUrl, token: "" };
      return { ...current, [channelType]: { ...existing, ...patch } };
    });
  }

  async function handleSimulateInstagram() {
    if (isSalesPreview || simulatingInstagram) return;

    setSimulatingInstagram(true);
    setSimResult(null);

    try {
      const res = await fetch("/api/integrations/manychat/simulate-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        simulated?: { guestName: string; message: string };
      } | null;

      if (data?.ok && data.simulated) {
        setSimResult({
          status: "success",
          message: `Instagram DM alındı — ${data.simulated.guestName}. Görüşmeler sayfasında listelenir.`,
        });
        await refreshChannels();
      } else {
        setSimResult({ status: "error", message: "Instagram mesajı simüle edilemedi." });
      }
    } catch {
      setSimResult({ status: "error", message: "Instagram mesajı simüle edilemedi." });
    } finally {
      setSimulatingInstagram(false);
      setTimeout(() => setSimResult(null), 6000);
    }
  }

  async function handleConfigureOutbound(
    channelType: Extract<ChannelConnection["channelType"], "instagram" | "whatsapp">,
    fallbackUrl: string
  ) {
    if (isSalesPreview) return;

    const draft = outboundDrafts[channelType] ?? { url: fallbackUrl, token: "" };
    setSavingChannel(channelType);

    try {
      const res = await fetch("/api/settings/channels/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelType,
          outboundUrl: draft.url,
          // Only send the token when the operator typed a new value, so a blank
          // field never clears an already-stored token.
          ...(draft.token.trim() ? { outboundToken: draft.token.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;

      if (data?.ok) {
        setOutboundDrafts((current) => ({
          ...current,
          [channelType]: { url: draft.url, token: "" },
        }));
        setOutboundSavedChannel(channelType);
        setTimeout(() => setOutboundSavedChannel(null), 2500);
        await refreshChannels();
      }
    } catch {
      // Leave the previous state visible on failure.
    } finally {
      setSavingChannel(null);
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[820px] p-5 sm:p-7">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {isSalesPreview ? (
              <p className="mb-2 text-[11px] leading-relaxed text-white/38">
                Önizleme ayarları örnek çalışma alanı verilerini kullanır.
              </p>
            ) : null}
            <h1 className="text-xl font-semibold text-white">Ayarlar</h1>
            <p className="mt-0.5 text-sm text-white/40">
              Otel profili, AI destek tonu ve kanal bağlantılarını yönetin.
            </p>
          </div>
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:w-auto",
              saved
                ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : "bg-blue-600 text-white hover:bg-blue-500"
            )}
          >
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Kaydedildi
              </>
            ) : (
              "Değişiklikleri kaydet"
            )}
          </button>
        </div>

        <div className="space-y-5">
          <Section icon={Building2} title="Otel profili" description="Temel çalışma alanı bilgileri">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Otel adı">
                <input
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Saat dilimi">
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
                  {["Europe/Istanbul", "Europe/London", "Europe/Berlin", "America/New_York", "Asia/Dubai"].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Varsayılan dil">
                <select className={inputCls}>
                  <option>Türkçe</option>
                  <option>İngilizce</option>
                  <option>Almanca</option>
                  <option>Rusça</option>
                </select>
              </Field>
              <Field label="İletişim e-postası">
                <input defaultValue="iletisim@pilototel.com" type="email" className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section icon={Bot} title="AI destek tonu" description="AI'nın misafir görüşmelerine nasıl eşlik edeceği">
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/15 bg-blue-500/[0.06] px-3.5 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                <p className="text-xs leading-relaxed text-blue-300/70">
                  Bu açıklama misafir görüşmelerinde kullanılır. Yanıtlar misafirin diline uyum sağlar.
                </p>
              </div>
              <Field label="Sistem açıklaması">
                <textarea
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  rows={4}
                  className={cn(inputCls, "resize-none leading-relaxed")}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Misafire görünen AI adı">
                  <input defaultValue="Tugobo AI" className={inputCls} />
                </Field>
                <Field label="Operatör devri eşiği">
                  <select className={inputCls}>
                    <option>Düşük (&lt;%50)</option>
                    <option>Dengeli (&lt;%70)</option>
                    <option>Yüksek (&lt;%85)</option>
                  </select>
                </Field>
              </div>
            </div>
          </Section>

          <Section
            icon={Clock3}
            title="Çalışma saatleri"
            description="AI her zaman aktiftir; bu saatler operatör bildirimlerini yönlendirir."
          >
            <div className="space-y-2">
              {DAY_LABELS.map((day, i) => (
                <div
                  key={day}
                  className={cn(
                    "flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 transition-colors",
                    hours[i].open ? "border-white/[0.06] bg-white/[0.03]" : "border-transparent"
                  )}
                >
                  <button
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      hours[i].open ? "bg-blue-600" : "bg-white/[0.10]"
                    )}
                    type="button"
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                        hours[i].open ? "translate-x-4" : "translate-x-0.5"
                      )}
                    />
                  </button>
                  <span
                    className={cn(
                      "w-10 shrink-0 text-sm",
                      hours[i].open ? "font-medium text-white/80" : "text-white/30"
                    )}
                  >
                    {day}
                  </span>
                  {hours[i].open ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <input
                        type="time"
                        value={hours[i].from}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, [i]: { ...h[i], from: e.target.value } }))
                        }
                        className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-xs text-white focus:border-blue-500/50 focus:outline-none"
                      />
                      <span className="text-xs text-white/30">-</span>
                      <input
                        type="time"
                        value={hours[i].to}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, [i]: { ...h[i], to: e.target.value } }))
                        }
                        className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-xs text-white focus:border-blue-500/50 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-white/25">Kapalı</span>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section icon={MessageSquare} title="Kanal bağlantıları" description="Operasyonel kurulum ve sağlık durumu">
            <div className="divide-y divide-white/[0.06]">
              {channelConnections.map((channel) => {
                const rotatableChannel =
                  channel.channelType === "instagram" || channel.channelType === "whatsapp"
                    ? channel.channelType
                    : null;

                return (
                  <ChannelConnectionRow
                    key={channel.channelType}
                    channel={channel}
                    expanded={expandedChannel === channel.channelType}
                    copiedKey={copiedKey}
                    testResult={testResults[channel.channelType]}
                    rotatedSecret={rotatableChannel ? rotatedSecrets[rotatableChannel] : undefined}
                    testing={testingChannel === channel.channelType}
                    rotating={rotatingChannel === channel.channelType}
                    outboundDraft={rotatableChannel ? outboundDrafts[rotatableChannel] : undefined}
                    savingOutbound={rotatableChannel ? savingChannel === rotatableChannel : false}
                    outboundSaved={rotatableChannel ? outboundSavedChannel === rotatableChannel : false}
                    onToggleSetup={() =>
                      setExpandedChannel((current) =>
                        current === channel.channelType ? null : channel.channelType
                      )
                    }
                    onCopy={handleCopy}
                    onTest={() => handleTestChannel(channel.channelType)}
                    onRotateSecret={
                      rotatableChannel ? () => handleRotateSecret(rotatableChannel) : undefined
                    }
                    onOutboundDraftChange={
                      rotatableChannel
                        ? (patch, fallbackUrl) =>
                            handleOutboundDraftChange(rotatableChannel, patch, fallbackUrl)
                        : undefined
                    }
                    onConfigureOutbound={
                      rotatableChannel
                        ? (fallbackUrl) => handleConfigureOutbound(rotatableChannel, fallbackUrl)
                        : undefined
                    }
                    simulator={
                      showInstagramSimulator && channel.channelType === "instagram"
                        ? {
                            simulating: simulatingInstagram,
                            result: simResult,
                            onSimulate: handleSimulateInstagram,
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function ChannelConnectionRow({
  channel,
  expanded,
  copiedKey,
  testResult,
  rotatedSecret,
  testing,
  rotating,
  outboundDraft,
  savingOutbound,
  outboundSaved,
  onToggleSetup,
  onCopy,
  onTest,
  onRotateSecret,
  onOutboundDraftChange,
  onConfigureOutbound,
  simulator,
}: {
  channel: ChannelConnection;
  expanded: boolean;
  copiedKey: string | null;
  testResult?: ChannelTestResult;
  rotatedSecret?: RotatedSecret;
  testing: boolean;
  rotating: boolean;
  outboundDraft?: { url: string; token: string };
  savingOutbound: boolean;
  outboundSaved: boolean;
  onToggleSetup: () => void;
  onCopy: (value: string | null | undefined, key: string) => void;
  onTest: () => void;
  onRotateSecret?: () => void;
  onOutboundDraftChange?: (patch: Partial<{ url: string; token: string }>, fallbackUrl: string) => void;
  onConfigureOutbound?: (fallbackUrl: string) => void;
  simulator?: {
    simulating: boolean;
    result: { status: "success" | "error"; message: string } | null;
    onSimulate: () => void;
  };
}) {
  const Icon =
    channel.channelType === "web_chat"
      ? Globe2
      : channel.channelType === "instagram"
        ? Instagram
        : MessageSquare;
  const health = channel.health;
  const status = statusView(health?.status ?? channel.status);
  const isWebhookChannel = channel.channelType === "instagram" || channel.channelType === "whatsapp";
  const readiness = readinessView(channel.readiness);

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
            <Icon className="h-4.5 w-4.5 text-white/55" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/85">{channel.displayName}</p>
            <p className="mt-0.5 text-xs text-white/35">
              {channel.lastConnectedAt
                ? `Son bağlantı ${formatConnectionDate(channel.lastConnectedAt)}`
                : channel.webhookState === "ready"
                  ? "Bağlantı hazır"
                  : "Bağlantı beklemede"}
            </p>
            {channel.lastError ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-red-300/80">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="truncate">{channel.lastError}</span>
              </p>
            ) : null}
            {health ? (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-white/38">
                  {health.lastInboundAt
                    ? `Son mesaj ${formatConnectionDate(health.lastInboundAt)}`
                    : "Son mesaj bekleniyor"}
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] text-white/34">
                  <span className="rounded-full bg-white/[0.04] px-2 py-0.5">
                    Günlük mesaj {health.messageCountToday}
                  </span>
                  <span className="rounded-full bg-white/[0.04] px-2 py-0.5">
                    Teslimat hatası {health.failedDeliveriesToday}
                  </span>
                  {health.lastOutboundAt ? (
                    <span className="rounded-full bg-white/[0.04] px-2 py-0.5">
                      Yanıt gönderildi {formatConnectionDate(health.lastOutboundAt)}
                    </span>
                  ) : null}
                  {health.lastTestAt ? (
                    <span className="rounded-full bg-white/[0.04] px-2 py-0.5">
                      Test {formatConnectionDate(health.lastTestAt)}
                    </span>
                  ) : null}
                </div>
                {health.lastError && !channel.lastError ? (
                  <p className="flex items-center gap-1.5 text-xs text-red-300/80">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span className="truncate">{health.lastError}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            {testResult ? (
              <p className={cn("mt-1 text-xs", testResultClass(testResult.status))}>
                {testResult.message}
              </p>
            ) : null}
            {simulator?.result ? (
              <p
                className={cn(
                  "mt-1 text-xs",
                  simulator.result.status === "success" ? "text-emerald-300/80" : "text-red-300/80"
                )}
              >
                {simulator.result.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-3">
          {simulator ? (
            <button
              type="button"
              onClick={simulator.onSimulate}
              className={actionButtonCls}
              disabled={simulator.simulating}
              title="Geliştirme/demo: gerçek ingest hattı üzerinden örnek bir Instagram DM oluşturur"
            >
              {simulator.simulating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Instagram className="h-3.5 w-3.5" />
              )}
              Instagram DM simüle et
            </button>
          ) : null}
          <button type="button" onClick={onTest} className={actionButtonCls} disabled={testing}>
            {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Bağlantıyı test et
          </button>
          <button type="button" onClick={onToggleSetup} className={actionButtonCls}>
            <KeyRound className="h-3.5 w-3.5" />
            Kurulum bilgileri
          </button>
          {isWebhookChannel ? (
            <div
              className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                readiness.className
              )}
              title="Kanalın operasyonel yapılandırma durumu"
            >
              <readiness.icon className="h-3 w-3" />
              {readiness.label}
            </div>
          ) : null}
          <div
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              status.className
            )}
          >
            <status.icon className="h-3 w-3" />
            {status.label}
          </div>
        </div>
      </div>
      {expanded ? (
        <ChannelSetupPanel
          channel={channel}
          copiedKey={copiedKey}
          rotatedSecret={rotatedSecret}
          rotating={rotating}
          outboundDraft={outboundDraft}
          savingOutbound={savingOutbound}
          outboundSaved={outboundSaved}
          onCopy={onCopy}
          onRotateSecret={onRotateSecret}
          onOutboundDraftChange={onOutboundDraftChange}
          onConfigureOutbound={onConfigureOutbound}
        />
      ) : null}
    </div>
  );
}

function ChannelSetupPanel({
  channel,
  copiedKey,
  rotatedSecret,
  rotating,
  outboundDraft,
  savingOutbound,
  outboundSaved,
  onCopy,
  onRotateSecret,
  onOutboundDraftChange,
  onConfigureOutbound,
}: {
  channel: ChannelConnection;
  copiedKey: string | null;
  rotatedSecret?: RotatedSecret;
  rotating: boolean;
  outboundDraft?: { url: string; token: string };
  savingOutbound: boolean;
  outboundSaved: boolean;
  onCopy: (value: string | null | undefined, key: string) => void;
  onRotateSecret?: () => void;
  onOutboundDraftChange?: (patch: Partial<{ url: string; token: string }>, fallbackUrl: string) => void;
  onConfigureOutbound?: (fallbackUrl: string) => void;
}) {
  const setup = channel.setup;
  const isWebhookChannel = channel.channelType === "instagram" || channel.channelType === "whatsapp";
  const secretCopyKey = `${channel.channelType}:secret`;
  const webhookCopyKey = `${channel.channelType}:webhook`;
  const hotelCopyKey = `${channel.channelType}:hotel`;
  const fallbackUrl = setup.outbound.url ?? "";
  const urlValue = outboundDraft?.url ?? fallbackUrl;
  const tokenValue = outboundDraft?.token ?? "";

  return (
    <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <SetupField
          label="Kanal tipi"
          value={channel.displayName}
        />
        <SetupField
          label="Durum"
          value={statusView(setup.status).label}
        />
        <SetupField
          label="Bağlantı sağlığı"
          value={healthLabel(setup.connectionHealth)}
        />
        <SetupField
          label="Workspace / otel kimliği"
          value={setup.workspaceId}
          onCopy={() => onCopy(setup.workspaceId, hotelCopyKey)}
          copied={copiedKey === hotelCopyKey}
        />
        {isWebhookChannel ? (
          <SetupField
            className="md:col-span-2"
            label="Webhook adresi"
            value={setup.inboundWebhookUrl ?? "Henüz yapılandırılmadı"}
            onCopy={setup.inboundWebhookUrl ? () => onCopy(setup.inboundWebhookUrl, webhookCopyKey) : undefined}
            copied={copiedKey === webhookCopyKey}
          />
        ) : (
          <SetupField
            className="md:col-span-2"
            label="Kurulum notu"
            value="Web Chat yerleşik kanal üzerinden çalışır."
          />
        )}
      </div>

      {isWebhookChannel ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/55">Gizli anahtar</p>
            <p className="mt-1 font-mono text-xs text-white/70">
              {rotatedSecret?.maskedSecret ?? setup.secret.masked ?? "Sunucuda oluşturulmadı"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/35">
              Ham değer varsayılan olarak gösterilmez. Üretim ortamında istemciye token veya gizli anahtar sızdırılmaz.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {rotatedSecret?.secret && rotatedSecret.copyAllowed ? (
              <button
                type="button"
                onClick={() => onCopy(rotatedSecret.secret, secretCopyKey)}
                className={actionButtonCls}
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedKey === secretCopyKey ? "Kopyalandı" : "Yeni anahtarı kopyala"}
              </button>
            ) : null}
            {onRotateSecret ? (
              <button type="button" onClick={onRotateSecret} className={actionButtonCls} disabled={rotating}>
                {rotating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Gizli anahtarı yenile
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {isWebhookChannel ? (
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/15 p-3">
          <div className="flex items-center gap-2">
            <Send className="h-3.5 w-3.5 text-white/45" />
            <p className="text-xs font-medium text-white/55">Giden bağlantı (ManyChat)</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/35">
            Operatör yanıtlarının misafire iletilebilmesi için giden uç adresi ve erişim token&apos;ı
            gereklidir. Token kaydedildikten sonra yeniden gösterilmez.
          </p>

          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-white/45">Giden URL</label>
              <input
                value={urlValue}
                onChange={(e) => onOutboundDraftChange?.({ url: e.target.value }, fallbackUrl)}
                placeholder="https://api.manychat.com/..."
                spellCheck={false}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-white/45">Giden token</label>
              <input
                value={tokenValue}
                onChange={(e) => onOutboundDraftChange?.({ token: e.target.value }, fallbackUrl)}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  setup.outbound.tokenConfigured
                    ? `Kayıtlı (${setup.outbound.tokenMasked ?? "••••"}) — değiştirmek için yazın`
                    : "Token girin"
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-white/34">
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5">
                URL {setup.outbound.urlConfigured ? "tanımlı" : "eksik"}
              </span>
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5">
                Token {setup.outbound.tokenConfigured ? "tanımlı" : "eksik"}
              </span>
            </div>
            {onConfigureOutbound ? (
              <button
                type="button"
                onClick={() => onConfigureOutbound(fallbackUrl)}
                className={actionButtonCls}
                disabled={savingOutbound}
              >
                {savingOutbound ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : outboundSaved ? (
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {outboundSaved ? "Kaydedildi" : "Giden bağlantıyı kaydet"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SetupField({
  label,
  value,
  className,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  className?: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-white/[0.05] bg-black/10 px-3 py-2.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-white/40">{label}</p>
          <p className="mt-1 break-all text-xs text-white/75">{value}</p>
        </div>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/45 transition-colors hover:text-white/75"
            title={copied ? "Kopyalandı" : "Kopyala"}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function statusView(status: ChannelConnectionStatus) {
  if (status === "active") {
    return {
      label: "Bağlı",
      icon: Wifi,
      className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (status === "degraded") {
    return {
      label: "Teslimat bekleniyor",
      icon: Clock3,
      className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    };
  }

  if (status === "error") {
    return {
      label: "Hata",
      icon: AlertCircle,
      className: "border-red-500/25 bg-red-500/10 text-red-300",
    };
  }

  if (status === "disabled") {
    return {
      label: "Devre dışı",
      icon: AlertCircle,
      className: "border-white/[0.10] bg-white/[0.04] text-white/40",
    };
  }

  return {
    label: "Beklemede",
    icon: Clock3,
    className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  };
}

function readinessView(readiness: ChannelReadiness) {
  if (readiness === "connected") {
    return {
      label: "Bağlantı hazır",
      icon: Wifi,
      className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (readiness === "partially_configured") {
    return {
      label: "Kısmen yapılandırıldı",
      icon: Clock3,
      className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    };
  }

  return {
    label: "Yapılandırılmadı",
    icon: AlertCircle,
    className: "border-white/[0.10] bg-white/[0.04] text-white/40",
  };
}

function healthLabel(health: ChannelConnectionHealth) {
  if (health === "healthy") return "Sağlıklı";
  if (health === "error") return "Hata";
  if (health === "disabled") return "Devre dışı";
  return "Beklemede";
}

function testResultClass(status: ChannelTestResult["status"]) {
  if (status === "success") return "text-emerald-300/80";
  if (status === "error") return "text-red-300/80";
  return "text-amber-300/80";
}

function formatConnectionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "az önce";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-6 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
          <Icon className="h-4 w-4 text-white/50" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-white/35">{description}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-white/50">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 transition-all focus:border-blue-500/50 focus:bg-white/[0.07] focus:outline-none";

const actionButtonCls =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-white/55 transition-colors hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-55";
