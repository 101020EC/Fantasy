export interface Env {
  /** Origin of the deployed Fanta app, no trailing slash. */
  FANTA_ORIGIN: string;
  /** Must match CRON_SECRET in the Vercel project. Set via `wrangler secret put`. */
  CRON_SECRET: string;
}

/**
 * Which job runs on which schedule. Keyed by cron expression so one Worker can
 * drive every Fanta job: add a line to `crons` in wrangler.toml and an entry
 * here, and nothing else changes.
 */
const JOBS: Record<string, string> = {
  '5 * * * *': '/api/cron/hourly',
};

async function run(path: string, env: Env): Promise<void> {
  const url = `${env.FANTA_ORIGIN}${path}`;
  const started = Date.now();

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    // A Vercel function cold start plus FPL and Firestore round trips; the
    // default would give up on a slow but healthy run.
    signal: AbortSignal.timeout(60_000),
  });

  const body = await res.text().catch(() => '');
  const ms = Date.now() - started;

  // Logged either way, and visible in `wrangler tail`. A silent scheduler that
  // fires into a 500 for a week is worse than no scheduler at all.
  if (!res.ok) {
    console.error(`${path} → ${res.status} in ${ms}ms: ${body.slice(0, 500)}`);
    // Thrown so the invocation is recorded as failed rather than as a success
    // that happened to print an error.
    throw new Error(`${path} returned ${res.status}`);
  }
  console.log(`${path} → 200 in ${ms}ms: ${body.slice(0, 500)}`);
}

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const path = JOBS[event.cron];
    if (!path) {
      console.error(`No job mapped to cron "${event.cron}"`);
      return;
    }
    // waitUntil, so the Worker is not torn down while the request is in flight.
    ctx.waitUntil(run(path, env));
  },
};
