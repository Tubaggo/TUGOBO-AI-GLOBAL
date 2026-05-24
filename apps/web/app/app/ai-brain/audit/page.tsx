"use client";

import Link from "next/link";
import { Bot, User, Cog, ChevronLeft } from "lucide-react";
import { useOperationalRuntime, selectAuditLog, selectMounted } from "@/stores/operational-runtime";
import { formatEur } from "@/lib/operational/format";
import { AIReasoningBlock } from "../../_components/ai-reasoning-block";
import { PropagationChain } from "../../_components/propagation-chain";
import { NODE_LABELS } from "@/lib/runtime/graph/propagation";

const ACTOR_META = {
  ai: { icon: Bot, label: "AI", color: "text-blue-400" },
  human: { icon: User, label: "Operatör", color: "text-rose-400" },
  system: { icon: Cog, label: "Sistem", color: "text-white/45" },
} as const;

export default function AuditPage() {
  const mounted = useOperationalRuntime(selectMounted);
  const auditLog = useOperationalRuntime(selectAuditLog);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-7 max-w-[900px]">
        <Link
          href="/app/ai-brain"
          className="mb-4 inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
        >
          <ChevronLeft className="h-3 w-3" />
          AI merkezi
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Kayıt ve açıklanabilirlik</p>
        <h1 className="text-xl font-semibold text-white">Operasyon zeka kayıtları</h1>
        <p className="mt-0.5 text-sm text-white/40">
          AI gerekçesi, etki zincirleri ve operasyon sonuçları — kurumsal operasyon kaydı
        </p>
        <MotionAuditList mounted={mounted} auditLog={auditLog} />
      </div>
    </div>
  );
}

function MotionAuditList({
  mounted,
  auditLog,
}: {
  mounted: boolean;
  auditLog: ReturnType<typeof selectAuditLog>;
}) {
  return (
    <div className="mt-8 space-y-3">
      {auditLog.map((entry) => {
        const meta = ACTOR_META[entry.actor];
        const Icon = meta.icon;
        return (
          <div
            key={entry.id}
            className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                <Icon className={`h-4 w-4 ${meta.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/90">{entry.action}</p>
                  <span className="text-[10px] text-white/28 tabular-nums">{entry.timestamp}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  <span className={`font-medium ${meta.color}`}>{meta.label} · </span>
                  {entry.rationale}
                </p>
                {mounted && entry.financialImpactEur !== undefined ? (
                  <p className="mt-2 text-[11px] font-semibold text-emerald-400 tabular-nums">
                    Finansal etki · {formatEur(entry.financialImpactEur)}
                    {entry.attribution ? ` · ${entry.attribution.replace(/_/g, " ")}` : ""}
                  </p>
                ) : null}
                {entry.reasoning ? (
                  <div className="mt-3">
                    <AIReasoningBlock reasoning={entry.reasoning} compact />
                  </div>
                ) : null}
                {entry.propagation ? (
                  <div className="mt-2">
                    <PropagationChain propagation={entry.propagation} compact />
                  </div>
                ) : null}
                {entry.orchestrationConsequence ? (
                  <p className="mt-2 text-[10px] text-white/35">{entry.orchestrationConsequence}</p>
                ) : null}
                {entry.affectedSystems && entry.affectedSystems.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.affectedSystems.map((n) => (
                      <span
                        key={n}
                        className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[9px] text-white/40"
                      >
                        {NODE_LABELS[n]}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
