"use client";

import { UnifiedOperationalTimeline } from "./unified-timeline";
import { GraphPropagationEngine } from "./graph-propagation-engine";
import { useOperationalRuntime, selectUnifiedTimeline } from "@/stores/operational-runtime";

export function OverviewGraphPanel() {
  const timeline = useOperationalRuntime(selectUnifiedTimeline);

  return (
    <div className="mb-6 grid grid-cols-1 gap-8 xl:grid-cols-[1fr_320px]">
      <section className="border-b border-white/[0.04] pb-6 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/50">
          Bağlı operasyon geçmişi
        </p>
        <h2 className="mb-4 text-sm font-semibold text-white">Birleşik operasyon akışı</h2>
        <UnifiedOperationalTimeline entries={timeline} limit={6} />
      </section>
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/50">
          Sistem eşitleme
        </p>
        <h2 className="mb-4 text-sm font-semibold text-white">Etki zinciri</h2>
        <GraphPropagationEngine />
      </section>
    </div>
  );
}
