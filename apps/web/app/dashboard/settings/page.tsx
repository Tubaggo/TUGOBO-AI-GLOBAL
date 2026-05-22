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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const defaultHours: Record<number, { open: boolean; from: string; to: string }> = {
  0: { open: false, from: "09:00", to: "18:00" },
  1: { open: true, from: "09:00", to: "22:00" },
  2: { open: true, from: "09:00", to: "22:00" },
  3: { open: true, from: "09:00", to: "22:00" },
  4: { open: true, from: "09:00", to: "22:00" },
  5: { open: true, from: "09:00", to: "22:00" },
  6: { open: true, from: "10:00", to: "20:00" },
};

type ChannelConnectionStatus = "active" | "pending" | "disabled" | "error";
type ChannelConnectionHealth = "healthy" | "pending" | "error" | "disabled";
type ChannelSetupDetails = {
  channelType: "web_chat" | "instagram" | "whatsapp";
  inboundWebhookUrl: string | null;
  workspaceId: string;
  hotelId: string;
  status: ChannelConnectionStatus;
  connectionHealth: ChannelConnectionHealth;
  secret: {
    available: boolean;
    masked: string | null;
    copyAllowed: boolean;
  };
};
type ChannelConnection = {
  channelType: "web_chat" | "instagram" | "whatsapp";
  displayName: "Web Chat" | "Instagram" | "WhatsApp";
  status: ChannelConnectionStatus;
  lastConnectedAt: string | null;
  lastError: string | null;
  webhookState: "ready" | "not_configured";
  setup: ChannelSetupDetails;
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

const fallbackChannels: ChannelConnection[] = [
  {
    channelType: "web_chat",
    displayName: "Web Chat",
    status: "pending",
    lastConnectedAt: null,
    lastError: null,
    webhookState: "ready",
    setup: {
      channelType: "web_chat",
      inboundWebhookUrl: null,
      workspaceId: "demo-hotel",
      hotelId: "demo-hotel",
      status: "pending",
      connectionHealth: "pending",
      secret: { available: false, masked: null, copyAllowed: false },
    },
  },
  {
    channelType: "instagram",
    displayName: "Instagram",
    status: "pending",
    lastConnectedAt: null,
    lastError: null,
    webhookState: "not_configured",
    setup: {
      channelType: "instagram",
      inboundWebhookUrl: null,
      workspaceId: "demo-hotel",
      hotelId: "demo-hotel",
      status: "pending",
      connectionHealth: "pending",
      secret: { available: false, masked: null, copyAllowed: false },
    },
  },
  {
    channelType: "whatsapp",
    displayName: "WhatsApp",
    status: "pending",
    lastConnectedAt: null,
    lastError: null,
    webhookState: "not_configured",
    setup: {
      channelType: "whatsapp",
      inboundWebhookUrl: null,
      workspaceId: "demo-hotel",
      hotelId: "demo-hotel",
      status: "pending",
      connectionHealth: "pending",
      secret: { available: false, masked: null, copyAllowed: false },
    },
  },
];

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
  const [persona, setPersona] = useState(
    "Tugobo AI supports hotel operations with clear, concise guest replies. Match the guest language, keep booking and payment steps controlled, and route to human support when needed."
  );
  const [hotelName, setHotelName] = useState("Pilot Otel");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [hours, setHours] = useState(defaultHours);

  useEffect(() => {
    let cancelled = false;

    async function loadChannelConnections() {
      if (isSalesPreview) return;

      try {
        const res = await fetch("/api/settings/channels");
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          channels?: ChannelConnection[];
        } | null;

        if (!cancelled && data?.ok && Array.isArray(data.channels)) {
          setChannelConnections(data.channels);
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
      const res = await fetch("/api/settings/channels");
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        channels?: ChannelConnection[];
      } | null;

      if (data?.ok && Array.isArray(data.channels)) {
        setChannelConnections(data.channels);
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[820px] p-5 sm:p-7">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {isSalesPreview ? (
              <p className="mb-2 text-[11px] leading-relaxed text-white/38">
                Preview settings use sample workspace data.
              </p>
            ) : null}
            <h1 className="text-xl font-semibold text-white">Settings</h1>
            <p className="mt-0.5 text-sm text-white/40">
              Manage hotel profile, AI support tone, and channel connections.
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
                Saved
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>

        <div className="space-y-5">
          <Section icon={Building2} title="Hotel profile" description="Core workspace details">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Hotel name">
                <input
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Timezone">
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
                  {["Europe/Istanbul", "Europe/London", "Europe/Berlin", "America/New_York", "Asia/Dubai"].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default language">
                <select className={inputCls}>
                  <option>Turkish</option>
                  <option>English</option>
                  <option>German</option>
                  <option>Russian</option>
                </select>
              </Field>
              <Field label="Contact email">
                <input defaultValue="iletisim@pilototel.com" type="email" className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section icon={Bot} title="AI support tone" description="How AI should assist guest conversations">
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/15 bg-blue-500/[0.06] px-3.5 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                <p className="text-xs leading-relaxed text-blue-300/70">
                  This description is used in guest conversations. Replies still adapt to the guest language.
                </p>
              </div>
              <Field label="System description">
                <textarea
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  rows={4}
                  className={cn(inputCls, "resize-none leading-relaxed")}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Guest-facing AI name">
                  <input defaultValue="Tugobo AI" className={inputCls} />
                </Field>
                <Field label="Human support threshold">
                  <select className={inputCls}>
                    <option>Low (&lt;50%)</option>
                    <option>Balanced (&lt;70%)</option>
                    <option>High (&lt;85%)</option>
                  </select>
                </Field>
              </div>
            </div>
          </Section>

          <Section
            icon={Clock3}
            title="Working hours"
            description="AI remains available; these hours guide human support notifications."
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
                    <span className="text-xs text-white/25">Closed</span>
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
  onToggleSetup,
  onCopy,
  onTest,
  onRotateSecret,
}: {
  channel: ChannelConnection;
  expanded: boolean;
  copiedKey: string | null;
  testResult?: ChannelTestResult;
  rotatedSecret?: RotatedSecret;
  testing: boolean;
  rotating: boolean;
  onToggleSetup: () => void;
  onCopy: (value: string | null | undefined, key: string) => void;
  onTest: () => void;
  onRotateSecret?: () => void;
}) {
  const Icon =
    channel.channelType === "web_chat"
      ? Globe2
      : channel.channelType === "instagram"
        ? Instagram
        : MessageSquare;
  const status = statusView(channel.status);

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
            {testResult ? (
              <p className={cn("mt-1 text-xs", testResultClass(testResult.status))}>
                {testResult.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button type="button" onClick={onTest} className={actionButtonCls} disabled={testing}>
            {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Bağlantıyı test et
          </button>
          <button type="button" onClick={onToggleSetup} className={actionButtonCls}>
            <KeyRound className="h-3.5 w-3.5" />
            Kurulum bilgileri
          </button>
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
          onCopy={onCopy}
          onRotateSecret={onRotateSecret}
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
  onCopy,
  onRotateSecret,
}: {
  channel: ChannelConnection;
  copiedKey: string | null;
  rotatedSecret?: RotatedSecret;
  rotating: boolean;
  onCopy: (value: string | null | undefined, key: string) => void;
  onRotateSecret?: () => void;
}) {
  const setup = channel.setup;
  const isWebhookChannel = channel.channelType === "instagram" || channel.channelType === "whatsapp";
  const secretCopyKey = `${channel.channelType}:secret`;
  const webhookCopyKey = `${channel.channelType}:webhook`;
  const hotelCopyKey = `${channel.channelType}:hotel`;

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
  if (Number.isNaN(date.getTime())) return "recently";

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
