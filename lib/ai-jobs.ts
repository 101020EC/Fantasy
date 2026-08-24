import { createHash, randomBytes } from 'node:crypto';
import { getAdminDb } from './firebase-admin';

/**
 * Persistent state for a multi-step AI job.
 *
 * The problem this solves is narrow and specific. An analysis is a sequence of
 * steps, only some of which cost money, and the expensive ones can be refused
 * by the monthly ceiling in lib/ai-budget.ts at any point. Without persistence
 * that refusal throws away everything computed before it, and the retry after
 * the ceiling is raised pays for the same work twice.
 *
 * So each step records its own outcome BEFORE the next one starts. A resume
 * reads those records, skips every step already marked `completed`, and picks
 * up at the first one that is not. A completed step is never re-executed and
 * therefore never re-charged - the guarantee holds across a browser reload, a
 * serverless timeout, a redeploy, and a budget refusal, because the record is
 * in Firestore rather than in a request.
 *
 * What this module is NOT: it is not a cache. That distinction is the whole
 * reason job identity looks the way it does below, so it is worth stating
 * precisely. Resuming means rejoining work that never finished. Reusing a
 * finished result is caching. Both amount to "skip the completed step", which
 * is exactly why they collapse into each other if identity is derived from the
 * inputs - a deterministic id makes the same request tomorrow address
 * yesterday's finished job, and it is served back as though it were fresh.
 *
 * That failure is not theoretical here. The forecast this job explains is
 * rebuilt daily from a new market snapshot, newly finalised player stats and a
 * refitted calibration factor. A cached explanation would sit on the page
 * beside a table that had already moved, describing numbers nobody could see.
 *
 * So identity is split in two, and the rule that separates them is
 * REJOIN ONLY IF INCOMPLETE:
 *
 *   jobId     one execution. Random, never derived, never reused. A completed
 *             job keeps its id forever as history and can never be handed to a
 *             later request as a fresh answer.
 *   resumeKey derived from the inputs, and used ONLY to find an execution that
 *             is still unfinished. The pointer it addresses is removed the
 *             moment the job completes, so it can never resolve to a result.
 *
 * It is not a queue either: there is no background worker, and a job advances
 * only while a request is driving it. And it does not touch budget accounting -
 * reserving, settling and the monthly ceiling all remain exactly as they are in
 * lib/ai-budget.ts, which this module calls into not at all.
 *
 * Why fields are written as explicit nulls: every write here is a
 * set(merge:true) whose field mask is built from leaf paths, so omitting a key
 * leaves the old value in place (the trap documented at length in
 * lib/ai-budget.ts). Clearing a lease therefore writes `null` at that path
 * rather than leaving it out. No FieldValue.delete() is needed because nothing
 * here removes a key - steps and their results only ever accumulate.
 */

const JOBS_COLLECTION = 'aiJobs';
/**
 * resumeKey -> the one execution for those inputs that is still unfinished.
 *
 * A pointer, not an index and emphatically not a cache. It exists so a browser
 * reload can find the job it was already running. It is deleted the instant
 * that job completes, which is the mechanism that makes reuse of a finished
 * result impossible rather than merely discouraged.
 */
const ACTIVE_COLLECTION = 'aiJobActive';

/**
 * How long a claimed step stays claimed.
 *
 * Longer than the 30s provider timeout in lib/openai.ts so a slow call is never
 * stolen from itself, and short enough that a process killed mid-step frees the
 * step within one user's patience. Shorter than the 5-minute reservation TTL in
 * lib/ai-budget.ts, so a lease can never outlive the money it is spending.
 */
export const LEASE_TTL_MS = 120_000;

export type StepState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Derived from the steps, stored so a listing does not have to recompute it.
 *
 * `stale` is the one state that is not about progress: it means the engine
 * changed under an unfinished job, so its completed steps and its remaining
 * ones would no longer belong to the same computation.
 */
export type JobState = 'pending' | 'running' | 'completed' | 'blocked' | 'failed' | 'stale';

export interface JobStepRecord {
  id: string;
  /** `ai` steps can be refused by the budget; `compute` steps cost nothing. */
  kind: 'ai' | 'compute';
  state: StepState;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  /** Set when the budget stopped this step. The step stays `pending`. */
  blockedReason: string | null;
  /** Held by the request currently executing this step. */
  lease: { id: string; expiresAt: number } | null;
  /** Persisted before the next step starts. Present only once completed. */
  result: unknown;
}

export interface AiJobRecord {
  /** Unique to THIS execution. Random, never derived from the input. */
  jobId: string;
  kind: string;
  /** Derived from the input. Addresses the active pointer, nothing else. */
  resumeKey: string;
  state: JobState;
  /** The engine this job's results belong to. Resuming across a bump is unsafe. */
  computeVersion: number;
  /** Set when the job may no longer be resumed. Explains why, for the UI. */
  staleReason: string | null;
  createdAt: string;
  updatedAt: string;
  /** Execution order. The first step whose state is not `completed` runs next. */
  stepOrder: string[];
  steps: Record<string, JobStepRecord>;
  /** What the job was asked for. Hashed into the resumeKey, kept for display. */
  input: Record<string, unknown>;
}

export interface StepSpec {
  id: string;
  kind: 'ai' | 'compute';
}

export interface JobSpec {
  kind: string;
  /** Everything that identifies the analysis context. Hashed into resumeKey. */
  input: Record<string, unknown>;
  steps: StepSpec[];
  /** The caller's current engine version, e.g. forecast-engine COMPUTE_VERSION. */
  computeVersion: number;
}

/**
 * The deterministic pointer key.
 *
 * Derived from the inputs so a reload can find the execution already running
 * for them. It is NOT an id and NOT a cache key: the only thing it ever
 * addresses is aiJobActive/{resumeKey}, which exists only while a job is
 * unfinished. Keys are sorted so an object written in a different order still
 * hashes the same.
 */
export function makeResumeKey(kind: string, input: Record<string, unknown>): string {
  const canonical = JSON.stringify(input, Object.keys(input).sort());
  return `${kind}_${createHash('sha256').update(`${kind} ${canonical}`).digest('hex').slice(0, 24)}`;
}

/**
 * A fresh id for one execution.
 *
 * Time-ordered prefix so jobs sort by age in a console listing, and 16 random
 * bytes so two executions started in the same millisecond cannot collide. The
 * important property is simply that it is NOT a function of the input - that is
 * what stops a later request ever addressing an earlier result.
 */
export function newJobId(kind: string): string {
  return `${kind}_${Date.now().toString(36)}_${randomBytes(16).toString('hex')}`;
}

const jobRef = (jobId: string) => getAdminDb().collection(JOBS_COLLECTION).doc(jobId);
const activeRef = (resumeKey: string) => getAdminDb().collection(ACTIVE_COLLECTION).doc(resumeKey);

function freshStep(spec: StepSpec): JobStepRecord {
  return {
    id: spec.id,
    kind: spec.kind,
    state: 'pending',
    attempts: 0,
    startedAt: null,
    completedAt: null,
    error: null,
    blockedReason: null,
    lease: null,
    result: null,
  };
}

function normaliseStep(raw: any, spec: StepSpec | undefined): JobStepRecord {
  const base = freshStep(
    spec ?? { id: String(raw?.id ?? ''), kind: raw?.kind === 'ai' ? 'ai' : 'compute' }
  );
  if (!raw || typeof raw !== 'object') return base;
  const lease =
    raw.lease && typeof raw.lease === 'object' && raw.lease.id
      ? { id: String(raw.lease.id), expiresAt: Number(raw.lease.expiresAt) || 0 }
      : null;
  const states: StepState[] = ['pending', 'running', 'completed', 'failed', 'skipped'];
  return {
    ...base,
    state: states.includes(raw.state) ? raw.state : base.state,
    attempts: Number(raw.attempts) || 0,
    startedAt: raw.startedAt ?? null,
    completedAt: raw.completedAt ?? null,
    error: raw.error ?? null,
    blockedReason: raw.blockedReason ?? null,
    lease,
    result: raw.result ?? null,
  };
}

/** Reconstructs a job from a stored document. This is what a reload reads. */
export function readJobDoc(data: any, spec?: JobSpec): AiJobRecord | null {
  if (!data) return null;
  const stepOrder: string[] = Array.isArray(data.stepOrder)
    ? data.stepOrder.map(String)
    : (spec?.steps ?? []).map((s) => s.id);
  const rawSteps = (data.steps ?? {}) as Record<string, any>;
  const steps: Record<string, JobStepRecord> = {};
  for (const id of stepOrder) {
    steps[id] = normaliseStep(rawSteps[id], spec?.steps.find((s) => s.id === id));
  }
  const staleReason = data.staleReason ? String(data.staleReason) : null;
  return {
    jobId: String(data.jobId ?? ''),
    kind: String(data.kind ?? ''),
    resumeKey: String(data.resumeKey ?? ''),
    computeVersion: Number(data.computeVersion) || 0,
    staleReason,
    state: deriveState(stepOrder, steps, staleReason),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
    stepOrder,
    steps,
    input: (data.input ?? {}) as Record<string, unknown>,
  };
}

export function deriveState(
  stepOrder: string[],
  steps: Record<string, JobStepRecord>,
  staleReason: string | null = null
): JobState {
  const all = stepOrder.map((id) => steps[id]).filter(Boolean);
  // Completion wins over staleness: a finished job is finished, and its result
  // is a true record of what that engine produced.
  if (all.length && all.every((s) => s.state === 'completed' || s.state === 'skipped')) return 'completed';
  if (staleReason) return 'stale';
  if (all.some((s) => s.state === 'failed')) return 'failed';
  if (all.some((s) => s.state === 'running')) return 'running';
  if (all.some((s) => s.blockedReason)) return 'blocked';
  if (all.some((s) => s.state === 'completed')) return 'running';
  return 'pending';
}

export interface StartResult {
  job: AiJobRecord;
  /** True when this rejoined an unfinished execution instead of starting one. */
  rejoined: boolean;
  /** The execution the pointer used to name, and why it was let go. */
  replaced: { jobId: string; reason: 'completed' | 'stale' | 'missing' } | null;
}

/**
 * Starts a new execution, or rejoins the unfinished one for these inputs.
 *
 * This is the function the whole identity design exists for, and it has exactly
 * one rule: REJOIN ONLY IF INCOMPLETE. A pointer that names a finished job is
 * not a hit, it is a stale pointer - it gets replaced and a new execution
 * begins. There is no path through this function that returns a completed job
 * to a caller who asked for a new analysis, which is what makes "we are not
 * caching" a property of the code rather than a promise about it.
 *
 * Both reads happen before any write, as Firestore requires, and the pointer is
 * only overwritten from inside the transaction, so two Analyze clicks arriving
 * together produce one execution and one pointer rather than two of each.
 */
export async function startOrRejoinJob(spec: JobSpec, now: Date = new Date()): Promise<StartResult> {
  const resumeKey = makeResumeKey(spec.kind, spec.input);
  const pointer = activeRef(resumeKey);

  return getAdminDb().runTransaction(async (txn): Promise<StartResult> => {
    const pointerSnap = await txn.get(pointer);
    const pointedId = pointerSnap.data()?.jobId ? String(pointerSnap.data()!.jobId) : null;
    const pointed = pointedId ? readJobDoc((await txn.get(jobRef(pointedId))).data()) : null;

    if (pointed) {
      const version = pointed.computeVersion === spec.computeVersion;
      if (pointed.state !== 'completed' && !pointed.staleReason && version) {
        // The one case that rejoins: a real execution, still unfinished, from
        // the same engine. Nothing is written; its progress is left exactly as
        // it is.
        return { job: pointed, rejoined: true, replaced: null };
      }

      // Everything else lets the old execution go. It stays in aiJobs as
      // history; only the pointer moves.
      if (pointed.state !== 'completed' && !version) {
        txn.set(
          jobRef(pointed.jobId),
          {
            staleReason:
              `Built by forecast engine v${pointed.computeVersion}, which is no longer current ` +
              `(v${spec.computeVersion}). Its finished steps cannot be mixed with new ones.`,
            state: 'stale',
            updatedAt: now.toISOString(),
          },
          { merge: true }
        );
      }
    }

    const jobId = newJobId(spec.kind);
    const steps: Record<string, JobStepRecord> = {};
    for (const s of spec.steps) steps[s.id] = freshStep(s);
    const job: AiJobRecord = {
      jobId,
      kind: spec.kind,
      resumeKey,
      computeVersion: spec.computeVersion,
      staleReason: null,
      state: 'pending',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      stepOrder: spec.steps.map((s) => s.id),
      steps,
      input: spec.input,
    };
    txn.set(jobRef(jobId), job);
    // A full overwrite, not a merge: the pointer holds one job and replacing it
    // must leave nothing of the old one behind.
    txn.set(pointer, { jobId, resumeKey, updatedAt: now.toISOString() });

    const reason = pointed
      ? pointed.state === 'completed'
        ? ('completed' as const)
        : ('stale' as const)
      : null;
    return {
      job,
      rejoined: false,
      replaced: pointed && reason ? { jobId: pointed.jobId, reason } : null,
    };
  });
}

export async function readJob(jobId: string, spec?: JobSpec): Promise<AiJobRecord | null> {
  const snap = await jobRef(jobId).get();
  return readJobDoc(snap.data(), spec);
}

/** What the active pointer names, or null. Exposed for tests and diagnostics. */
export async function readActivePointer(resumeKey: string): Promise<string | null> {
  const snap = await activeRef(resumeKey).get();
  return snap.data()?.jobId ? String(snap.data()!.jobId) : null;
}

export type ResumeCheck =
  | { ok: true; job: AiJobRecord }
  | { ok: false; reason: 'missing' | 'stale'; job: AiJobRecord | null; message: string };

/**
 * Validates a resume of one named execution.
 *
 * Resuming addresses exactly the job it was given: no id is derived, no other
 * job is searched for. The only thing checked is that finishing it would still
 * be coherent - an engine bump between the completed steps and the remaining
 * ones would splice two different computations together, and half-recomputing
 * it silently is worse than saying so.
 *
 * A completed job passes: replaying it executes nothing and returns its own
 * stored result, which is that execution's result and not a cache hit on
 * someone else's.
 */
export async function checkResumable(
  jobId: string,
  computeVersion: number
): Promise<ResumeCheck> {
  const job = await readJob(jobId);
  if (!job) {
    return { ok: false, reason: 'missing', job: null, message: 'That analysis no longer exists.' };
  }
  if (job.staleReason) {
    return { ok: false, reason: 'stale', job, message: job.staleReason };
  }
  if (job.state !== 'completed' && job.computeVersion !== computeVersion) {
    const message =
      `This analysis was started by forecast engine v${job.computeVersion} and the current engine ` +
      `is v${computeVersion}. Its finished steps cannot be combined with new ones, so it cannot be ` +
      `resumed. Run a fresh analysis — nothing already saved is lost.`;
    await markStale(jobId, message).catch(() => undefined);
    return { ok: false, reason: 'stale', job: { ...job, staleReason: message, state: 'stale' }, message };
  }
  return { ok: true, job };
}

/**
 * Marks a job unresumable and releases its pointer.
 *
 * The pointer is deleted rather than left to be overwritten later, so nothing
 * can rejoin a job that has been ruled out.
 */
export async function markStale(jobId: string, reason: string, now: Date = new Date()): Promise<void> {
  const db = getAdminDb();
  await db.runTransaction(async (txn) => {
    const snap = await txn.get(jobRef(jobId));
    const job = readJobDoc(snap.data());
    if (!job) return;
    const pointerSnap = job.resumeKey ? await txn.get(activeRef(job.resumeKey)) : null;
    txn.set(jobRef(jobId), { staleReason: reason, state: 'stale', updatedAt: now.toISOString() }, { merge: true });
    if (pointerSnap?.data()?.jobId === jobId) txn.delete(activeRef(job.resumeKey));
  });
}

export type ClaimResult =
  | { ok: true; leaseId: string; job: AiJobRecord }
  | { ok: false; reason: 'missing' | 'completed' | 'locked'; job: AiJobRecord | null };

/**
 * Takes exclusive ownership of one step, atomically.
 *
 * This is what makes two Resume clicks safe. Both read the same `pending` step,
 * both try to mark it `running`; Firestore serialises the transactions, so the
 * second one re-reads the first one's lease and is refused before any provider
 * call is made. A step already `completed` is refused for the same reason by a
 * different branch - that is the guarantee that a completed step is never
 * charged twice.
 *
 * An expired lease is reclaimable: a process that died mid-step must not lock
 * the job forever.
 */
export async function claimStep(
  jobId: string,
  stepId: string,
  now: Date = new Date()
): Promise<ClaimResult> {
  const ref = jobRef(jobId);
  const leaseId = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return getAdminDb().runTransaction(async (txn): Promise<ClaimResult> => {
    const snap = await txn.get(ref);
    const job = readJobDoc(snap.data());
    if (!job) return { ok: false, reason: 'missing', job: null };
    const step = job.steps[stepId];
    if (!step) return { ok: false, reason: 'missing', job };
    if (step.state === 'completed' || step.state === 'skipped') {
      return { ok: false, reason: 'completed', job };
    }
    if (step.state === 'running' && step.lease && step.lease.expiresAt > now.getTime()) {
      return { ok: false, reason: 'locked', job };
    }

    const claimed: JobStepRecord = {
      ...step,
      state: 'running',
      attempts: step.attempts + 1,
      startedAt: now.toISOString(),
      // Cleared explicitly: a previous block is no longer the reason for
      // anything once the step is running again.
      blockedReason: null,
      error: null,
      lease: { id: leaseId, expiresAt: now.getTime() + LEASE_TTL_MS },
    };
    const steps = { ...job.steps, [stepId]: claimed };
    const state = deriveState(job.stepOrder, steps, job.staleReason);
    txn.set(ref, { steps: { [stepId]: claimed }, state, updatedAt: now.toISOString() }, { merge: true });
    return { ok: true, leaseId, job: { ...job, steps, state } };
  });
}

/**
 * Records a step's result and marks it complete.
 *
 * Refuses if the lease has moved on, so a request that lost its claim to a
 * timeout cannot overwrite the work of whoever took over.
 */
export async function completeStep(
  jobId: string,
  stepId: string,
  leaseId: string,
  result: unknown,
  now: Date = new Date()
): Promise<AiJobRecord> {
  // Round-tripped through JSON because Firestore rejects `undefined` outright,
  // and an optional field left off a result object is the normal way for one to
  // appear. A step result has to be storable to be resumable, so making that a
  // property of this function rather than of every caller is the safer place
  // for the rule to live.
  const storable = result === undefined ? null : JSON.parse(JSON.stringify(result));
  return writeOutcome(jobId, stepId, leaseId, now, (step) => ({
    ...step,
    state: 'completed',
    completedAt: now.toISOString(),
    error: null,
    blockedReason: null,
    lease: null,
    result: storable,
  }));
}

/**
 * Hands a step back without completing it.
 *
 * `pending` with a reason is the budget case: nothing failed, the work simply
 * did not happen and will happen on the next resume. `failed` is a genuine
 * error. Neither touches any other step, so everything already completed stays
 * completed.
 */
export async function releaseStep(
  jobId: string,
  stepId: string,
  leaseId: string,
  outcome: { state: 'pending'; blockedReason: string } | { state: 'failed'; error: string },
  now: Date = new Date()
): Promise<AiJobRecord> {
  return writeOutcome(jobId, stepId, leaseId, now, (step) => ({
    ...step,
    state: outcome.state,
    lease: null,
    error: outcome.state === 'failed' ? outcome.error : null,
    blockedReason: outcome.state === 'pending' ? outcome.blockedReason : null,
  }));
}

async function writeOutcome(
  jobId: string,
  stepId: string,
  leaseId: string,
  now: Date,
  apply: (step: JobStepRecord) => JobStepRecord
): Promise<AiJobRecord> {
  const ref = jobRef(jobId);
  return getAdminDb().runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    const job = readJobDoc(snap.data());
    if (!job) throw new Error(`Job ${jobId} no longer exists`);
    const step = job.steps[stepId];
    if (!step) throw new Error(`Job ${jobId} has no step ${stepId}`);
    // Read before any write, unconditionally: whether the pointer needs
    // releasing is only known after the new state is computed, and by then it
    // is too late to read anything.
    const pointerSnap = job.resumeKey ? await txn.get(activeRef(job.resumeKey)) : null;

    // Lost the lease, or the step was already settled by whoever holds it now.
    if (step.state === 'completed' || !step.lease || step.lease.id !== leaseId) return job;

    const next = apply(step);
    const steps = { ...job.steps, [stepId]: next };
    const state = deriveState(job.stepOrder, steps, job.staleReason);
    txn.set(ref, { steps: { [stepId]: next }, state, updatedAt: now.toISOString() }, { merge: true });

    // The moment the last step lands, the pointer goes. This is the single
    // write that makes a finished job unreachable by a future Analyze request:
    // an explicit delete of the whole pointer document, guarded on it still
    // naming this job, rather than an omission from a merge - which would
    // silently leave the old pointer in place and hand the next request a
    // finished result.
    if (state === 'completed' && pointerSnap?.data()?.jobId === jobId) {
      txn.delete(activeRef(job.resumeKey));
    }
    return { ...job, steps, state };
  });
}

export type StepOutcome =
  | { status: 'completed'; result: unknown }
  /** The monthly ceiling refused it. Nothing failed; nothing was charged. */
  | { status: 'blocked'; reason: string }
  | { status: 'failed'; error: string };

export type StepHandler = (ctx: {
  /** Results of the steps that already completed, keyed by step id. */
  results: Record<string, any>;
  job: AiJobRecord;
}) => Promise<StepOutcome>;

export interface RunOutcome {
  job: AiJobRecord;
  results: Record<string, any>;
  /** Step ids executed by THIS call. A resume that skips everything is empty. */
  executed: string[];
  /** Step ids skipped because they were already completed. */
  skipped: string[];
  /** Set when a step was refused by the budget. */
  blocked: { stepId: string; reason: string } | null;
  failed: { stepId: string; error: string } | null;
  /** True when another request holds the next step right now. */
  contended: boolean;
}

/**
 * Drives a job forward from wherever it is.
 *
 * The whole resume contract is this loop. A completed step contributes its
 * stored result and its handler is never called - which is what stops it being
 * re-run and re-charged. The first step that is not complete is claimed, run
 * and persisted before the loop looks at the next one, so an interruption at
 * any point loses at most the step in flight.
 *
 * A block stops the loop rather than skipping ahead: later steps are written
 * from earlier results, and running them on a missing input would produce
 * something worse than nothing.
 */
export async function runJob(
  jobId: string,
  handlers: Record<string, StepHandler>,
  now: () => Date = () => new Date()
): Promise<RunOutcome> {
  let job = await readJob(jobId);
  if (!job) throw new Error(`Job ${jobId} does not exist`);

  const results: Record<string, any> = {};
  const out: RunOutcome = {
    job,
    results,
    executed: [],
    skipped: [],
    blocked: null,
    failed: null,
    contended: false,
  };

  for (const stepId of job.stepOrder) {
    const step = job.steps[stepId];
    if (step.state === 'completed') {
      results[stepId] = step.result;
      out.skipped.push(stepId);
      continue;
    }
    if (step.state === 'skipped') {
      out.skipped.push(stepId);
      continue;
    }

    const claim = await claimStep(jobId, stepId, now());
    if (!claim.ok) {
      if (claim.reason === 'completed' && claim.job) {
        // Another request finished it between our read and our claim.
        results[stepId] = claim.job.steps[stepId]?.result ?? null;
        out.skipped.push(stepId);
        job = claim.job;
        continue;
      }
      // Held by a live lease: stop, and let the holder finish. Retrying here
      // would either duplicate the call or spin.
      out.contended = true;
      if (claim.job) job = claim.job;
      break;
    }

    job = claim.job;
    const handler = handlers[stepId];
    let outcome: StepOutcome;
    if (!handler) {
      outcome = { status: 'failed', error: `No handler for step ${stepId}` };
    } else {
      try {
        outcome = await handler({ results, job });
      } catch (err: any) {
        outcome = { status: 'failed', error: err?.message ?? 'Step threw' };
      }
    }

    if (outcome.status === 'completed') {
      job = await completeStep(jobId, stepId, claim.leaseId, outcome.result, now());
      results[stepId] = job.steps[stepId]?.result ?? outcome.result;
      out.executed.push(stepId);
      continue;
    }
    if (outcome.status === 'blocked') {
      job = await releaseStep(
        jobId,
        stepId,
        claim.leaseId,
        { state: 'pending', blockedReason: outcome.reason },
        now()
      );
      out.blocked = { stepId, reason: outcome.reason };
      break;
    }
    job = await releaseStep(jobId, stepId, claim.leaseId, { state: 'failed', error: outcome.error }, now());
    out.failed = { stepId, error: outcome.error };
    break;
  }

  out.job = job;
  return out;
}

/**
 * The shape the browser gets: enough to say what completed and what remains,
 * without the step results, which can be large and are already in the response.
 */
export function jobView(job: AiJobRecord) {
  return {
    jobId: job.jobId,
    kind: job.kind,
    state: job.state,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    /** True when at least one step is still to do - the Resume affordance. */
    resumable: job.stepOrder.some((id) => {
      const s = job.steps[id];
      return s && s.state !== 'completed' && s.state !== 'skipped';
    }),
    steps: job.stepOrder.map((id) => {
      const s = job.steps[id];
      return {
        id,
        kind: s.kind,
        state: s.state,
        attempts: s.attempts,
        blockedReason: s.blockedReason,
        error: s.error,
        completedAt: s.completedAt,
      };
    }),
  };
}
