"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CreditCard, ShieldAlert, Wallet } from "lucide-react";
import {
  useOperationalRuntime,
  selectMounted,
  selectReservations,
  selectRecoveryJourneys,
} from "@/stores/operational-runtime";
import { formatEur } from "@/lib/operational/format";
import { cn } from "@/lib/utils";

const PAYMENT_STAGES = ["payment_pending", "payment_risk", "recovery", "quote"] as const;

export default function DashboardPaymentsPage() {
  const mounted = useOperationalRuntime(selectMounted);
  const reservations = useOperationalRuntime(selectReservations);
  const journeys = useOperationalRuntime(selectRecoveryJourneys);

  const paymentReservations = useMemo(
    () => reservations.filter((r) => (PAYMENT_STAGES as readonly string[]).includes(r.currentStage)),
    [reservations]
  );

  const pending = useMemo(
    () =>
      paymentReservations.filter(
        (r) => r.currentStage === "payment_pending" || r.currentStage === "quote"
      ),
    [paymentReservations]
  );
  const atRisk = useMemo(
    () => paymentReservations.filter((r) => r.currentStage === "payment_risk"),
    [paymentReservations]
  );
  const recoveries = useMemo(
    () =>
      journeys.filter((j) => j.kind === "failed_payment" || j.kind === "abandoned_booking"),
    [journeys]
  );
  const activeRecoveryCount = useMemo(
    () => recoveries.filter((j) => j.status === "active").length,
    [recoveries]
  );

  const hasAny = paymentReservations.length > 0 || recoveries.length > 0;

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-[1200px] p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
          Ödeme takibi
        </p>
        <h1 className="text-xl font-semibold text-white">Ödemeler</h1>
        <p className="mt-0.5 text-sm text-white/40">
          Bekleyen ödemeler, ödeme sorunları ve yeniden deneme durumları
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard icon={CreditCard} label="Bekleyen" value={mounted ? String(pending.length) : "—"} />
          <StatCard icon={ShieldAlert} label="Riskli" value={mounted ? String(atRisk.length) : "—"} tone="rose" />
          <StatCard
            icon={Wallet}
            label="Aktif müdahale"
            value={mounted ? String(activeRecoveryCount) : "—"}
            tone="amber"
          />
        </div>

        {!mounted ? (
          <p className="mt-10 text-center text-sm text-white/30">Yükleniyor…</p>
        ) : !hasAny ? (
          <div className="mt-12 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-zinc-900/50 px-8 py-16 text-center">
            <CreditCard className="mb-4 h-10 w-10 text-white/20" />
            <p className="text-sm font-medium text-white/55">Bekleyen ödeme bulunmuyor.</p>
            <p className="mt-2 max-w-sm text-[12px] text-white/30">
              Misafir ödeme adımına geçtiğinde kayıtlar burada görüntülenecek.
            </p>
            <Link
              href="/dashboard/conversations"
              className="mt-6 text-[12px] font-medium text-blue-400/80 hover:text-blue-300"
            >
              Operasyon kuyruğuna git →
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {paymentReservations.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900 px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-white">{r.guest}</p>
                  <p className="text-[11px] text-white/35">{r.room}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-400/90">{formatEur(r.bookingValueEur)}</p>
                  <p className="text-[10px] text-white/30">{r.currentStage}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof CreditCard;
  label: string;
  value: string;
  tone?: "default" | "rose" | "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        tone === "rose"
          ? "border-rose-500/15 bg-rose-500/[0.04]"
          : tone === "amber"
            ? "border-amber-500/15 bg-amber-500/[0.04]"
            : "border-white/[0.06] bg-zinc-900"
      )}
    >
      <Icon className="mb-2 h-4 w-4 text-white/35" />
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-white/35">{label}</p>
    </div>
  );
}
