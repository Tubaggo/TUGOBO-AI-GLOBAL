// DEPLOY-2 — Production environment fail-fast guard.
//
// Next.js calls register() once at server startup. We validate the runtime
// environment here so a misconfigured production deployment crashes immediately
// instead of booting in a silently degraded state (no DB, no auth, mock AI,
// localhost callback URLs, …).
//
// - Only the Node.js server runtime runs the check (edge runtime + browser skip).
// - assertProductionEnv() is a no-op unless NODE_ENV=production, so local dev and
//   tests keep working with partial/missing env.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Never validate during `next build` — builds must be reproducible without
  // runtime secrets. The guard is for actual server startup only.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertProductionEnv } = await import("@tugobo/shared/env");
  assertProductionEnv();
}
