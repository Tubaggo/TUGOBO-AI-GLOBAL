"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  PiggyBank,
  ShieldAlert,
  Bot,
  Banknote,
  UserPlus,
  Sparkles,
  ChevronRight,
  Radio,
  AlertTriangle,
  Zap,
} from "lucide-react";

// Reservation pipeline funnel — visual parity with /demo/otel-paneli's
// "Rezervasyon süreci" section. Static, representative stage counts; no runtime
// or schema change. Mirrors the operational view of the AI-managed pipeline.
const RESERVATION_PIPELINE_STAGES = [
  {
    key: "inquiry",
    labelEn: "Yeni talep",
    label: "Talep",
    count: 6,
    color: "text-slate-300",
    ring: "border-white/[0.08] bg-white/[0.03]",
  },
  {
    key: "qualified",
    labelEn: "Uygunluk",
    label: "Nitelendirildi",
    count: 4,
    color: "text-violet-300",
    ring: "border-violet-500/20 bg-violet-500/[0.06]",
  },
  {
    key: "offer",
    labelEn: "Teklif gönderildi",
    label: "Teklif",
    count: 3,
    color: "text-blue-300",
    ring: "border-blue-500/20 bg-blue-500/[0.06]",
  },
  {
    key: "payment",
    labelEn: "Ödeme bekleniyor",
    label: "Ödeme",
    count: 2,
    color: "text-amber-300",
    ring: "border-amber-500/20 bg-amber-500/[0.06]",
  },
  {
    key: "confirmed",
    labelEn: "Onaylandı",
    label: "Onaylı",
    count: 11,
    color: "text-emerald-300",
    ring: "border-emerald-500/25 bg-emerald-500/[0.08]",
  },
] as const;
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
import { OverviewGraphPanel } from "../_components/overview-graph-panel";
import { formatEur, formatPct } from "@/lib/operational/format";
import { RevenueMetricCard } from "../_components/revenue-metric-card";
import { RecoveryJourneyCard } from "../_components/recovery-journey-card";
import { RevenueStoryCard } from "../_components/revenue-story-card";
import { AiImpactPanel } from "../_components/ai-impact-panel";
import { OtaRecoveryPanel } from "../_components/ota-recovery-panel";
import { FinancialAttributionBadge } from "../_components/financial-attribution-badge";
import { OperationsFeedRuntimeItem } from "../_components/operational-intelligence-feed";
import { OperationsFeedSkeleton } from "@/app/dashboard/_components/skeletons";
import { useMutationPulse } from "@/lib/runtime/hooks/use-mutation-pulse";

export default function OverviewPage() {
  const t = useTranslations("overview");
  const mounted = useOperationalRuntime(selectMounted);
  const m = useOperationalRuntime(selectRevenueMetrics);
  const feed = useOperationalRuntime(selectOperationsFeed);
  const journeys = useOperationalRuntime(selectRecoveryJourneys);
  const stories = useOperationalRuntime(selectRevenueStories);
  const reservations = useOperationalRuntime(selectReservations);
  const conversations = useOperationalRuntime(selectConversations);
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
        <OverviewHeader />
        <MotionRuntimeOverviewExecutiveStrip items={executiveStrip} />
        <MotionOverviewMetricGrid metricCards={metricCards} />
        <OverviewGraphPanel />
        <ReservationPipelineSection />
        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <MotionRecoveryEngineHeader />
              <Link href="/app/conversations" className="text-xs text-emerald-400 hover:text-emerald-300">
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
          <MotionRevenueStoriesHeader />
          <MotionRevenueStoriesGrid stories={stories} />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <MotionOverviewReservationsPanel reservations={reservations} />
          <MotionOverviewConversationsPanel conversations={conversations} />
        </div>
      </div>
    </div>
  );
}

function OverviewHeader() {
  const t = useTranslations("overview");
  const tCommon = useTranslations("common");

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-400/50">
          {t("eyebrow")}
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-white">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-white/38">{t("description")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
          <MotionOverviewLiveDot />
          <span className="text-xs font-medium text-emerald-400">{tCommon("liveOperations")}</span>
        </div>
        <Link
          href="/app/conversations"
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Bot className="h-3.5 w-3.5" />
          {tCommon("openConversations")}
        </Link>
      </div>
    </div>
  );
}

function MotionOverviewLiveDot() {
  return <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />;
}

function MotionOverviewMetricGrid({
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

function MotionRecoveryEngineHeader() {
  const t = useTranslations("overview");
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/28">{t("recovery.eyebrow")}</p>
      <h2 className="text-sm font-semibold text-white mt-0.5">{t("recovery.title")}</h2>
    </div>
  );
}

function MotionRevenueStoriesHeader() {
  const t = useTranslations("overview");
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-sm font-semibold text-white">{t("stories.title")}</h2>
        <p className="text-[11px] text-white/35">{t("stories.subtitle")}</p>
      </div>
      <Link href="/app/ai-brain/audit" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
        {t("stories.auditLink")} <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function MotionRevenueStoriesGrid({ stories }: { stories: ReturnType<typeof selectRevenueStories> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {stories.slice(0, 4).map((s) => (
        <RevenueStoryCard key={s.id} story={s} />
      ))}
    </div>
  );
}

function MotionOverviewReservationsPanel({
  reservations,
}: {
  reservations: ReturnType<typeof selectReservations>;
}) {
  const t = useTranslations("overview");
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{t("reservations.title")}</h2>
        <Link href="/app/reservations" className="text-xs text-blue-400 hover:text-blue-300">
          {t("reservations.viewAll")}
        </Link>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {reservations.slice(0, 4).map((r) => (
          <div key={r.id} className="px-5 py-3.5 hover:bg-white/[0.02]">
            <MotionOverviewReservationRow r={r} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MotionOverviewReservationRow({ r }: { r: ReturnType<typeof selectReservations>[number] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-white/85">{r.guest}</p>
        <p className="text-[11px] text-white/38">
          {r.room} · {r.currentStage.replace(/_/g, " ")}
        </p>
      </div>
      <MotionOverviewReservationRowRight r={r} />
    </div>
  );
}

function MotionOverviewReservationRowRight({ r }: { r: ReturnType<typeof selectReservations>[number] }) {
  const t = useTranslations("overviewExtras");
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <span className="text-sm font-bold tabular-nums text-white">{formatEur(r.bookingValueEur)}</span>
      {r.revenueAtRiskEur > 0 ? (
        <span className="text-[10px] font-medium text-amber-400">
          {t("atRisk", { amount: formatEur(r.revenueAtRiskEur) })}
        </span>
      ) : null}
      {r.attributions[0] ? <FinancialAttributionBadge attribution={r.attributions[0]} compact /> : null}
    </div>
  );
}

function MotionOverviewConversationsPanel({
  conversations,
}: {
  conversations: ReturnType<typeof selectConversations>;
}) {
  const tExtra = useTranslations("overviewExtras");
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{tExtra("activeGuestOps")}</h2>
        <Link href="/app/conversations" className="text-xs text-blue-400 hover:text-blue-300">
          {tExtra("openInbox")}
        </Link>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {conversations.map((c) => (
          <div key={c.id} className="px-5 py-3.5">
            <MotionOverviewConversationRow c={c} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MotionRuntimeOverviewExecutiveStrip({
  items,
}: {
  items: { label: string; value: string }[];
}) {
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

function MotionOverviewConversationRow({ c }: { c: ReturnType<typeof selectConversations>[number] }) {
  return (
    <div className="flex gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${c.avatarColor}`}>
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
  );
}

function ReservationPipelineSection() {
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
        <Link
          href="/app/reservations"
          className="shrink-0 text-xs text-blue-400 transition-colors hover:text-blue-300"
        >
          Süreci aç →
        </Link>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
        {RESERVATION_PIPELINE_STAGES.map((st, i) => (
          <div key={st.key} className="flex min-w-0 flex-1 items-stretch gap-2 md:flex-row">
            <div
              className={`flex flex-1 flex-col rounded-xl border px-3 py-3 md:px-3.5 md:py-3.5 ${st.ring}`}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/22">
                {st.labelEn}
              </span>
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
