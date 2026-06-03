"use client";

import { useEffect } from "react";
import { useOperationalStore } from "@/lib/runtime/store/useOperationalStore";

/**
 * Marks the operational runtime as mounted after client hydration.
 *
 * Demo stability: the ambient random simulation (`startOperationalSimulation`) and the
 * periodic `pulseLiveMetrics` tick are intentionally NOT started here. The demo runs on
 * the deterministic seed state — the only mutations come from explicit manual actions
 * (operator buttons, demo orchestration panel), which still dispatch normally. This keeps
 * payments/operations from changing on their own while a prospect is browsing and makes a
 * refresh always restore the exact same state. Re-enable by restoring the interval +
 * `startOperationalSimulation` call if ambient liveliness is needed again.
 */
export function OperationalMount({ children }: { children: React.ReactNode }) {
  const setMounted = useOperationalStore((s) => s.setMounted);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
    };
  }, [setMounted]);

  return <>{children}</>;
}
