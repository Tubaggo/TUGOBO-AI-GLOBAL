"use client";

import type { GraphPropagation } from "@/lib/runtime/entities";
import { NODE_LABELS } from "@/lib/runtime/graph/propagation";
import { useOperationalRuntime, selectLastPropagation } from "@/stores/operational-runtime";
import { useMutationPulse } from "@/lib/runtime/hooks/use-mutation-pulse";
import { cn } from "@/lib/utils";
import { GitBranch } from "lucide-react";

const NODE_TONES: Record<string, string> = {
  revenue: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  reservation: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  thread: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  guest: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  recovery: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  alert: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  audit: "border-white/15 bg-white/[0.04] text-white/55",
  ai_action: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  memory: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  timeline: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
};

export function GraphPropagationEngine({
  propagation,
  embedded = false,
  variant = "default",
}: {
  propagation?: GraphPropagation | null;
  embedded?: boolean;
  variant?: "default" | "operational";
}) {
  const live = useOperationalRuntime(selectLastPropagation);
  const pulseActive = useMutationPulse(4000);
  const chain = propagation ?? live;
  const isLive = !propagation && pulseActive;

  if (!chain) return null;

  const isOperational = variant === "operational";

  return (
    <div
      className={cn(
        embedded ? "border-t border-cyan-500/10 pt-4" : "rounded-lg border border-cyan-500/10 bg-cyan-500/[0.03] px-3 py-3",
        isLive && "shadow-[0_0_28px_-12px_rgba(34,211,238,0.35)]"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-cyan-400/90" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-400/90">
          {isOperational ? "Gelir etkisi" : "Operasyon etki zinciri"}
        </p>
        {isLive ? (
          <span className="ml-auto flex items-center gap-1.5 text-[9px] font-semibold text-cyan-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            {isOperational ? "Güncelleniyor" : "Sistem eşitlendi"}
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-white/45">{chain.summary}</p>
      <div className="flex flex-wrap items-center gap-1">
        {chain.nodes.map((node, i) => (
          <span key={node} className="flex items-center gap-1">
            <span
              className={cn(
                "rounded border px-2 py-1 text-[9px] font-medium transition-all",
                NODE_TONES[node] ?? "border-white/10 bg-white/[0.04] text-white/50",
                isLive && i === chain.nodes.length - 1 && "animate-runtime-node-sync"
              )}
            >
              {NODE_LABELS[node]}
            </span>
            {i < chain.nodes.length - 1 ? (
              <span className="text-[10px] text-cyan-500/40">→</span>
            ) : null}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/28">
        {isOperational
          ? "Rezervasyon, gelir ve misafir kayıtları güncellendi"
          : "Operasyon katmanları eşitlendi"}
      </p>
    </div>
  );
}

/** @deprecated Use GraphPropagationEngine */
export function PropagationChain(props: {
  propagation?: GraphPropagation | null;
  compact?: boolean;
}) {
  return <GraphPropagationEngine propagation={props.propagation} embedded={props.compact} />;
}
