"use client";

// This component is rendered by BOTH /dashboard and /demo/otel-paneli. It mirrors
// /app/overview's visual structure section-for-section, using the same operational
// runtime components and selectors. Both /dashboard and /demo routes already mount
// OperationalMount in their layouts, so the runtime is always available here.
//
// The only demo-specific deviation from /app/overview is the page header: it shows
// the demo's friendly greeting + date subtitle and routes its CTAs through
// `linkPrefix` so the buttons stay inside the demo (or dashboard) navigation tree.
// Everything below the header — KPIs, graph, pipeline funnel, recovery journeys,
// OTA panel, AI impact, operations feed, revenue stories, reservations and
// conversations panels — uses the exact same components and runtime data as the
// real /app/overview, giving full visual parity without duplicating logic.

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Bot,
  Banknote,
  ChevronRight,
  DollarSign,
  PiggyBank,
  Radio,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserPlus,
  Zap,
} from "lucide-react";
import {
  useOperationalRuntime,
  selectRevenueMetrics,
  selectMounted,
  selectOperationsFeed,
  selectRecoveryJourneys,
  selectRevenueStories,
  selectReservations,
  selectConversations,
} from "@/stores/operational-runtime";
import { OverviewGraphPanel } from "@/app/app/_components/overview-graph-panel";
import { formatEur, formatPct } from "@/lib/operational/format";
import { RevenueMetricCard } from "@/app/app/_components/revenue-metric-card";
import { RecoveryJourneyCard } from "@/app/app/_components/recovery-journey-card";
import { RevenueStoryCard } from "@/app/app/_components/revenue-story-card";
import { AiImpactPanel } from "@/app/app/_components/ai-impact-panel";
import { OtaRecoveryPanel } from "@/app/app/_components/ota-recovery-panel";
import { FinancialAttributionBadge } from "@/app/app/_components/financial-attribution-badge";
import { OperationsFeedRuntimeItem } from "@/app/app/_components/operational-intelligence-feed";
import { OperationsFeedSkeleton } from "./skeletons";
import { useMutationPulse } from "@/lib/runtime/hooks/use-mutation-pulse";

// ── Pipeline funnel (also lives in /app/overview as ReservationPipelineSection) ──
// Static representative counts for the AI-managed reservation pipeline.
const RESERVATION_PIPELINE_STAGES = [
  { key: "inquiry", labelEn: "Yeni talep", label: "Talep", count: 6, color: "text-slate-300", ring: "border-white/[0.08] bg-white/[0.03]" },
  { key: "qualified", labelEn: "Uygunluk", label: "Nitelendirildi", count: 4, color: "text-violet-300", ring: "border-violet-500/20 bg-violet-500/[0.06]" },
  { key: "offer", labelEn: "Teklif gönderildi", label: "Teklif", count: 3, color: "text-blue-300", ring: "border-blue-500/20 bg-blue-500/[0.06]" },
  { key: "payment", labelEn: "Ödeme bekleniyor", label: "Ödeme", count: 2, color: "text-amber-300", ring: "border-amber-500/20 bg-amber-500/[0.06]" },
  { key: "confirmed", labelEn: "Onaylandı", label: "Onaylı", count: 11, color: "text-emerald-300", ring: "border-emerald-500/25 bg-emerald-500/[0.08]" },
] as const;

export function DashboardOverview({ linkPrefix }: { linkPrefix: string }) {
  const t = useTranslations("overview");
  const mounted = useOperationalRuntime(selectMounted);
  const m = useOperationalRuntime(selectRevenueMetrics);
  const feed = useOperationalRuntime(selectOperationsFeed);
  const journeys = useOperationalRuntime(selectRecoveryJourneys);
  const stories = useOperationalRuntime(selectRevenueStories);
  const reservations = useOperationalRuntime(selectReservations);
  const conversations = useOperationalRuntime(selectConversations);

  const conv = `${linkPrefix}/conversations`;
  const res = `${linkPrefix}/reservations`;
  const dash = mounted ? "" : "—";

  const metricCards = [
    {
      label: t("metrics.revenueRecoveredToday"),
      value: mounted ? formatEur(m.revenueRecoveredToday, true) : dash,
      delta: "+€840",
      icon: DollarSign,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      sub: t("metrics.revenueRecoveredSub"),
    },
    {
      label: t("metrics.aiInfluencedRevenue"),
      value: mounted ? formatEur(m.aiInfluencedRevenue, true) : dash,
      delta: "+12%",
      icon: Sparkles,
      iconColor: "text-violet-400",
      iconBg: "bg-violet-500/10",
      sub: t("metrics.aiInfluencedSub"),
    },
    {
      label: t("metrics.otaCommissionAvoided"),
      value: mounted ? formatEur(m.otaCommissionAvoided) : dash,
      delta: "+€212",
      icon: PiggyBank,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
      sub: t("metrics.otaCommissionSub"),
    },
    {
      label: t("metrics.upsellRevenue"),
      value: mounted ? formatEur(m.upsellRevenueGenerated) : dash,
      delta: "+€95 ADR",
      icon: TrendingUp,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      sub: t("metrics.upsellSub"),
    },
    {
      label: t("metrics.paymentRecovery"),
      value: mounted ? formatEur(m.paymentRecoveryRevenue) : dash,
      delta: "3",
      icon: Banknote,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-500/10",
      sub: t("metrics.paymentRecoverySub"),
    },
    {
      label: t("metrics.humanTakeoverSaved"),
      value: mounted ? formatEur(m.humanTakeoverSavedRevenue, true) : dash,
      delta: "91%",
      icon: UserPlus,
      iconColor: "text-rose-400",
      iconBg: "bg-rose-500/10",
      sub: t("metrics.humanTakeoverSub"),
    },
    {
      label: t("metrics.revenueAtRisk"),
      value: mounted ? formatEur(m.revenueAtRisk) : dash,
      delta: "2",
      icon: ShieldAlert,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
      sub: t("metrics.revenueAtRiskSub"),
      variant: "risk" as const,
    },
    {
      label: t("metrics.recoverySuccessRate"),
      value: mounted ? formatPct(m.recoverySuccessRate) : dash,
      delta: "+4%",
      icon: Zap,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      sub: t("metrics.recoverySuccessSub"),
    },
    {
      label: t("metrics.directBookingConversion"),
      value: mounted ? formatEur(m.directBookingConversionValue, true) : dash,
      delta: "+5",
      icon: Bot,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      sub: t("metrics.directBookingSub"),
    },
  ];

  const executiveStrip = [
    { label: t("executive.aiGeneratedRevenue"), value: mounted ? formatEur(m.aiGeneratedRevenue, true) : dash },
    { label: t("executive.escalatedExposure"), value: mounted ? formatEur(m.escalatedRevenueExposure) : dash },
    { label: t("executive.occupancyInfluence"), value: mounted ? `+${m.occupancyInfluencePct}%` : dash },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-[1400px] p-7">
        <DemoOverviewHeader conv={conv} />
        <DemoExecutiveStrip items={executiveStrip} />
        <DemoMetricGrid metricCards={metricCards} />
        <OverviewGraphPanel />
        <ReservationPipelineSection res={res} />
        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <DemoRecoveryEngineHeader />
              <Link href={conv} className="text-xs text-emerald-400 hover:text-emerald-300">
                {t("recovery.link")}
              </Link>
            </div>
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {journeys.slice(0, 3).map((j) => (
                <RecoveryJourneyCard key={j.id} journey={j} />
              ))}
            </div>
          </div>
          <OtaRecoveryPanel />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5">
            <h2 className="text-sm font-semibold text-white mb-1">{t("aiImpact.title")}</h2>
            <p className="text-[11px] text-white/35 mb-4">{t("aiImpact.subtitle")}</p>
            <AiImpactPanel />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900 overflow-hidden flex flex-col max-h-[520px]">
            <div className="border-b border-white/[0.05] px-5 py-4 shrink-0">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-400/80" />
                <div>
                  <h2 className="text-sm font-semibold text-white">{t("feed.title")}</h2>
                  <p className="text-[10px] text-white/30">{t("feed.subtitle")}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 divide-y divide-white/[0.04] overflow-y-auto">
              {!mounted ? (
                <OperationsFeedSkeleton rows={4} />
              ) : (
                feed.map((item) => <OperationsFeedRuntimeItem key={item.id} item={item} />)
              )}
            </div>
          </div>
        </div>
        <div className="mb-6">
          <DemoRevenueStoriesHeader conv={conv} />
          <DemoRevenueStoriesGrid stories={stories} />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DemoOverviewReservationsPanel reservations={reservations} res={res} />
          <DemoOverviewConversationsPanel conversations={conversations} conv={conv} />
        </div>
      </div>
    </div>
  );
}

// ── Demo header preserves the personalised greeting + linkPrefix-aware CTA. ──
function DemoOverviewHeader({ conv }: { conv: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-400/50">
          Operasyon merkezi
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-white">Günaydın</h1>
        <p className="mt-0.5 text-sm text-white/38">
          Cumartesi, 25 Nisan · Grand Hotel Demo · canlı operasyon
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Operasyon aktif</span>
        </div>
        <Link
          href={conv}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Bot className="h-3.5 w-3.5" />
          Operasyon kuyruğu
        </Link>
      </div>
    </div>
  );
}

function DemoExecutiveStrip({ items }: { items: { label: string; value: string }[] }) {
  const isLive = useMutationPulse(5000);
  return (
    <div
      className={
        isLive
          ? "mb-4 grid grid-cols-2 gap-6 border-b border-cyan-500/10 pb-4 md:grid-cols-3"
          : "mb-4 grid grid-cols-2 gap-6 border-b border-white/[0.04] pb-4 md:grid-cols-3"
      }
    >
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/28">{item.label}</p>
          <p
            className={
              isLive
                ? "mt-0.5 text-lg font-bold tabular-nums text-white animate-tick-fade"
                : "mt-0.5 text-lg font-bold tabular-nums text-white"
            }
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function DemoMetricGrid({
  metricCards,
}: {
  metricCards: Parameters<typeof RevenueMetricCard>[0][];
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3">
      {metricCards.map((card) => (
        <RevenueMetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}

function ReservationPipelineSection({ res }: { res: string }) {
  return (
    <div className="mb-6 rounded-xl border border-white/[0.06] bg-zinc-900 p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/28">
            Rezervasyon süreci
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-white">
            Aşama dağılımı · operasyon görünümü
          </h2>
        </div>
        <Link href={res} className="shrink-0 text-xs text-blue-400 transition-colors hover:text-blue-300">
          Süreci aç →
        </Link>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
        {RESERVATION_PIPELINE_STAGES.map((st, i) => (
          <div key={st.key} className="flex min-w-0 flex-1 items-stretch gap-2 md:flex-row">
            <div className={`flex flex-1 flex-col rounded-xl border px-3 py-3 md:px-3.5 md:py-3.5 ${st.ring}`}>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/22">{st.labelEn}</span>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className={`text-lg font-bold tabular-nums ${st.color}`}>{st.count}</span>
                <span className="truncate text-[11px] font-medium text-white/35">{st.label}</span>
              </div>
            </div>
            {i < RESERVATION_PIPELINE_STAGES.length - 1 ? (
              <div className="hidden shrink-0 items-center justify-center px-0.5 md:flex">
                <ChevronRight className="h-4 w-4 text-white/10" aria-hidden />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoRecoveryEngineHeader() {
  const t = useTranslations("overview");
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/28">{t("recovery.eyebrow")}</p>
      <h2 className="text-sm font-semibold text-white mt-0.5">Bağlı operasyon geçmişi</h2>
    </div>
  );
}

function DemoRevenueStoriesHeader({ conv }: { conv: string }) {
  const t = useTranslations("overview");
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-sm font-semibold text-white">{t("stories.title")}</h2>
        <p className="text-[11px] text-white/35">{t("stories.subtitle")}</p>
      </div>
      <Link href={conv} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
        {t("stories.auditLink")} <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function DemoRevenueStoriesGrid({ stories }: { stories: ReturnType<typeof selectRevenueStories> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {stories.slice(0, 4).map((s) => (
        <RevenueStoryCard key={s.id} story={s} />
      ))}
    </div>
  );
}

function DemoOverviewReservationsPanel({
  reservations,
  res,
}: {
  reservations: ReturnType<typeof selectReservations>;
  res: string;
}) {
  const t = useTranslations("overview");
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{t("reservations.title")}</h2>
        <Link href={res} className="text-xs text-blue-400 hover:text-blue-300">
          {t("reservations.viewAll")}
        </Link>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {reservations.slice(0, 4).map((r) => (
          <div key={r.id} className="px-5 py-3.5 hover:bg-white/[0.02]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-white/85">{r.guest}</p>
                <p className="text-[11px] text-white/38">
                  {r.room} · {r.currentStage.replace(/_/g, " ")}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <span className="text-sm font-bold tabular-nums text-white">{formatEur(r.bookingValueEur)}</span>
                {r.revenueAtRiskEur > 0 ? (
                  <span className="text-[10px] font-medium text-amber-400">
                    Risk: {formatEur(r.revenueAtRiskEur)}
                  </span>
                ) : null}
                {r.attributions[0] ? (
                  <FinancialAttributionBadge attribution={r.attributions[0]} compact />
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoOverviewConversationsPanel({
  conversations,
  conv,
}: {
  conversations: ReturnType<typeof selectConversations>;
  conv: string;
}) {
  const tExtra = useTranslations("overviewExtras");
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{tExtra("activeGuestOps")}</h2>
        <Link href={conv} className="text-xs text-blue-400 hover:text-blue-300">
          {tExtra("openInbox")}
        </Link>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {conversations.map((c) => (
          <div key={c.id} className="px-5 py-3.5">
            <div className="flex gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${c.avatarColor}`}
              >
                {c.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white/85">{c.guestName}</span>
                  <span className="text-[10px] text-white/28">{c.time}</span>
                </div>
                <p className="truncate text-xs text-white/40">{c.lastMessage}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.revenueExposureEur > 0 ? (
                    <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      Exposure {formatEur(c.revenueExposureEur)}
                    </span>
                  ) : null}
                  {c.attributions.slice(0, 1).map((a) => (
                    <FinancialAttributionBadge key={a.kind} attribution={a} compact />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
