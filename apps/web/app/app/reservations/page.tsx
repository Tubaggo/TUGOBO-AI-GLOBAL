"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, ChevronRight } from "lucide-react";
import {
  useOperationalRuntime,
  selectReservations,
  selectRevenueMetrics,
  selectMounted,
} from "@/stores/operational-runtime";
import { formatEur } from "@/lib/operational/format";
import { RevenueTimeline } from "../_components/revenue-timeline";
import { FinancialAttributionBadge } from "../_components/financial-attribution-badge";
import type { RevenueLifecycleStage } from "@/lib/operational/types";
import { lifecycleStageLabel } from "@/lib/i18n/operational-copy";
import { cn } from "@/lib/utils";
import { OperationalEmptyState } from "@/app/dashboard/_components/operational-empty-state";
import { ReservationCardSkeleton } from "@/app/dashboard/_components/skeletons";
import { op } from "@/lib/i18n/operationalTexts";
import { CalendarDays } from "lucide-react";

const STAGE_TAB_IDS = [
  "all",
  "inquiry",
  "quote",
  "payment_pending",
  "payment_risk",
  "recovery",
  "confirmation",
  "upsell",
] as const;

export default function ReservationsPage() {
  const t = useTranslations("reservations");
  const tCommon = useTranslations("common");
  const mounted = useOperationalRuntime(selectMounted);
  const reservations = useOperationalRuntime(selectReservations);
  const metrics = useOperationalRuntime(selectRevenueMetrics);
  const [tab, setTab] = useState<(typeof STAGE_TAB_IDS)[number]>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(reservations[1]?.id ?? null);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return reservations.filter((r) => {
      const matchTab = tab === "all" || r.currentStage === tab;
      const matchSearch =
        !needle ||
        r.guest.toLowerCase().includes(needle) ||
        r.room.toLowerCase().includes(needle);
      return matchTab && matchSearch;
    });
  }, [reservations, tab, search]);

  const pendingApprovalCount = useMemo(
    () =>
      reservations.filter(
        (r) => r.currentStage === "quote" || r.currentStage === "payment_pending"
      ).length,
    [reservations]
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">{t("eyebrow")}</p>
        <h1 className="text-xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-white/40">{t("description")}</p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard label={t("summary.inProcess")} value={mounted ? String(reservations.length) : "—"} />
          <SummaryCard
            label={t("summary.pendingApproval")}
            value={mounted ? String(pendingApprovalCount) : "—"}
          />
          <SummaryCard
            label={t("summary.confirmedValue")}
            value={mounted ? formatEur(metrics.aiGeneratedRevenue, true) : "—"}
          />
          <SummaryCard
            label={t("summary.atRisk")}
            value={mounted ? formatEur(metrics.revenueAtRisk) : "—"}
          />
        </div>
        <div className="mt-7 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900">
          <div className="flex flex-col gap-3 border-b border-white/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 overflow-x-auto">
              {STAGE_TAB_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    tab === id ? "bg-white/[0.08] text-white" : "text-white/40 hover:bg-white/[0.04]"
                  )}
                >
                  {id === "all" ? t("tabs.all") : t(`tabs.${id}` as "tabs.inquiry")}
                </button>
              ))}
            </div>
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tCommon("search")}
                className="w-48 rounded-lg border border-white/[0.07] bg-white/[0.05] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>
          {!mounted ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ReservationCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <OperationalEmptyState
              icon={CalendarDays}
              title={op("emptyReservations")}
              description={op("emptyReservationsDetail")}
              compact
            />
          ) : (
            <ReservationsList filtered={filtered} expandedId={expandedId} setExpandedId={setExpandedId} />
          )}
        </div>
        <p className="mt-4 text-center text-[11px] text-white/25">
          <Link href="/app/overview" className="text-blue-400 hover:text-blue-300">
            {tCommon("overviewLink")}
          </Link>
          {" · "}
          {t("footer")}
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-4">
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-white/40">{label}</p>
    </div>
  );
}

function ReservationsList({
  filtered,
  expandedId,
  setExpandedId,
}: {
  filtered: ReturnType<typeof selectReservations>;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const t = useTranslations("reservations");

  return (
    <div className="divide-y divide-white/[0.04]">
      {filtered.map((r) => (
        <div key={r.id}>
          <button
            type="button"
            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-white/25 transition-transform",
                  expandedId === r.id && "rotate-90"
                )}
              />
              <div>
                <p className="text-sm font-medium text-white/90">{r.guest}</p>
                <p className="text-xs text-white/40">
                  {r.room} · {r.checkIn} – {r.checkOut} · {r.channel}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0">
              <StagePill stage={r.currentStage} />
              <span className="text-sm font-bold tabular-nums text-white">{formatEur(r.bookingValueEur)}</span>
              {r.revenueAtRiskEur > 0 ? (
                <span className="text-[10px] font-semibold text-amber-400">
                  {t("riskLabel")} {formatEur(r.revenueAtRiskEur)}
                </span>
              ) : null}
            </div>
          </button>
          {expandedId === r.id ? (
            <div className="border-t border-white/[0.04] bg-white/[0.01] px-5 py-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/28">
                {t("timelineTitle")}
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {r.attributions.map((a) => (
                  <FinancialAttributionBadge key={`${a.kind}-${a.label}`} attribution={a} />
                ))}
              </div>
              <RevenueTimeline events={r.timeline} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const STAGE_PILL_COLORS: Partial<Record<RevenueLifecycleStage, string>> = {
  payment_risk: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  recovery: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  confirmation: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

function StagePill({ stage }: { stage: RevenueLifecycleStage }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
        STAGE_PILL_COLORS[stage] ?? "border-white/[0.08] bg-white/[0.05] text-white/50"
      )}
    >
      {lifecycleStageLabel(stage)}
    </span>
  );
}
