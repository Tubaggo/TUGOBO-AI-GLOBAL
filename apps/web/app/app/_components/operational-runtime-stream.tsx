"use client";

import type { RuntimeStreamNode, RuntimeStreamNodeKind } from "@/lib/runtime/graph/stream";
import { NODE_LABELS } from "@/lib/runtime/graph/propagation";
import { formatEur } from "@/lib/operational/format";
import { cn } from "@/lib/utils";
import {
  Brain,
  GitBranch,
  Sparkles,
  Banknote,
  Radio,
  Zap,
  ArrowDown,
  CheckCircle2,
} from "lucide-react";

const KIND_META: Record<
  RuntimeStreamNodeKind,
  { icon: typeof Zap; accent: string; glow: string }
> = {
  event: { icon: Zap, accent: "text-amber-400", glow: "shadow-[0_0_12px_-4px_rgba(251,191,36,0.4)]" },
  reasoning: { icon: Sparkles, accent: "text-blue-400", glow: "shadow-[0_0_12px_-4px_rgba(96,165,250,0.35)]" },
  memory: { icon: Brain, accent: "text-violet-400", glow: "shadow-[0_0_12px_-4px_rgba(167,139,250,0.35)]" },
  propagation: { icon: GitBranch, accent: "text-cyan-400", glow: "shadow-[0_0_12px_-4px_rgba(34,211,238,0.35)]" },
  orchestration: { icon: Radio, accent: "text-cyan-300", glow: "shadow-[0_0_12px_-4px_rgba(34,211,238,0.25)]" },
  financial: { icon: Banknote, accent: "text-emerald-400", glow: "shadow-[0_0_12px_-4px_rgba(52,211,153,0.4)]" },
  outcome: { icon: CheckCircle2, accent: "text-emerald-300", glow: "shadow-[0_0_12px_-4px_rgba(52,211,153,0.45)]" },
  transition: { icon: ArrowDown, accent: "text-white/40", glow: "" },
};

export function OperationalRuntimeStream({
  nodes,
  className,
}: {
  nodes: RuntimeStreamNode[];
  className?: string;
}) {
  if (nodes.length === 0) return null;

  return (
    <section className={cn("runtime-surface -mx-1 px-1 py-2", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <MotionRuntimeStreamHeadingBlock />
        <span className="text-[10px] tabular-nums text-white/25">{nodes.length} bağlı olay</span>
      </div>
      <div className="relative pl-1">
        {nodes.map((node, i) => (
          <StreamNodeRow key={node.id} node={node} isLast={i === nodes.length - 1} />
        ))}
      </div>
    </section>
  );
}

function MotionRuntimeStreamHeadingBlock() {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/70">
        Canlı operasyon
      </p>
      <h3 className="text-sm font-semibold text-white/90">Birleşik zeka akışı</h3>
    </div>
  );
}

function StreamNodeRow({ node, isLast }: { node: RuntimeStreamNode; isLast: boolean }) {
  const meta = KIND_META[node.kind];
  const Icon = meta.icon;

  return (
    <div className={cn("animate-tick-fade", !isLast && "group")}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-1">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-zinc-950/80",
              meta.glow,
              node.kind === "propagation" && "animate-runtime-node-sync"
            )}
          >
            <Icon className={cn("h-3 w-3", meta.accent)} />
          </div>
          {!isLast ? (
            <div
              className="runtime-causal-line my-1.5 min-h-[20px] w-px flex-1 animate-runtime-causal-pulse"
              aria-hidden
            />
          ) : null}
        </div>
        <div className={cn("min-w-0 flex-1", !isLast && "pb-5")}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-[10px] tabular-nums font-medium text-white/30">{node.timestamp}</span>
            {node.confidence !== undefined ? (
              <span className="text-[10px] font-medium text-blue-300/80">AI {node.confidence}%</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm font-medium leading-snug text-white/88">{node.title}</p>
          {node.detail ? (
            <p className="mt-1 text-[11px] leading-relaxed text-white/42">{node.detail}</p>
          ) : null}
          {node.financialEur !== undefined && node.financialEur > 0 ? (
            <p className="mt-1.5 text-xs font-semibold tabular-nums text-emerald-400/95">
              {node.kind === "event" && node.title.toLowerCase().includes("risk")
                ? `${formatEur(node.financialEur)} risk algılandı`
                : `${formatEur(node.financialEur)} korundu`}
            </p>
          ) : null}
          {node.propagationNodes && node.propagationNodes.length > 0 && node.kind === "propagation" ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {node.propagationNodes.map((n) => (
                <span
                  key={n}
                  className="rounded border border-cyan-500/15 bg-cyan-500/[0.06] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-cyan-300/70"
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
}
