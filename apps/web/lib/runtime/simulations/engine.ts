import type { OperationalEventType } from "../events/types";

type SimulationTick = {
  type: OperationalEventType;
  weight: number;
};

const SIMULATION_POOL: SimulationTick[] = [
  { type: "PAYMENT_FAILED", weight: 12 },
  { type: "RECOVERY_STARTED", weight: 10 },
  { type: "RECOVERY_SUCCESS", weight: 14 },
  { type: "BOOKING_CONFIRMED", weight: 8 },
  { type: "UPSELL_ACCEPTED", weight: 16 },
  { type: "VIP_ESCALATION", weight: 6 },
  { type: "OTA_CONVERSION", weight: 12 },
  { type: "HUMAN_TAKEOVER", weight: 5 },
];

function pickWeighted(pool: SimulationTick[]): OperationalEventType {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return item.type;
  }
  return pool[0]?.type ?? "UPSELL_ACCEPTED";
}

export type SimulationController = {
  stop: () => void;
};

/**
 * Master switch for the ambient random simulation.
 *
 * Disabled for the sales demo: random ticks caused payment/recovery state to jump and
 * payments/operations to mutate while a prospect was browsing. With this off the demo is
 * fully deterministic (seed state only); manual actions still dispatch normally. Flip to
 * `true` to restore ambient liveliness.
 */
const SIMULATION_ENABLED: boolean = false;

/** Lightweight client-side operational activity — enterprise pacing, no flashy effects */
export function startOperationalSimulation(
  onTick: (type: OperationalEventType) => void
): SimulationController {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    const delayMs = 14_000 + Math.floor(Math.random() * 11_000);
    timeoutId = setTimeout(() => {
      if (stopped) return;
      onTick(pickWeighted(SIMULATION_POOL));
      schedule();
    }, delayMs);
  };

  // Deterministic demo: never schedule ambient mutations. Return an inert controller.
  if (SIMULATION_ENABLED) {
    schedule();
  }

  return {
    stop: () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}
