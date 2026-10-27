/**
 * When the deadline messages go out, and which squad changes are urgent enough
 * to send between them.
 *
 * Fanta used to message every night at 21:00 Bangkok and again most mornings
 * when prices moved. Now it sends two messages per gameweek — a full summary
 * 24h before the deadline and a short reminder 2h before — and between them
 * only a squad player's availability getting worse.
 *
 * Deadlines move around (00:30, 17:30, 19:30 Bangkok all occur), so no fixed
 * cron can hit them. The hourly job asks `dueSlots` every run and sends each
 * slot on the first run inside its window. Kept free of Firebase so it can be
 * tested on its own.
 */

export type DeadlineSlot = '24h' | '2h';

export const SLOT_HOURS: Record<DeadlineSlot, number> = { '24h': 24, '2h': 2 };

/** What the hourly job remembers about the gameweek it is counting down to. */
export interface DeadlineState {
  /** The gameweek whose deadline the slots below belong to. */
  event: number | null;
  /** slot → ISO time it was sent. Missing means not sent yet. */
  sent: Partial<Record<DeadlineSlot, string>>;
  /**
   * elementId → `news` as it stood when the T−24h summary went out, so the
   * T−2h reminder can say only what is new since.
   */
  newsAtSummary: Record<string, string>;
}

export const EMPTY_DEADLINE_STATE: DeadlineState = { event: null, sent: {}, newsAtSummary: {} };

/**
 * The slots to send on this run, in the order they belong in one message.
 *
 * - Nothing once the deadline has passed.
 * - Inside 2h: the reminder, and the summary too if it never went out (an
 *   outage, or the feature deploying inside the window) — the caller merges
 *   both into one message rather than sending two at once.
 * - Inside 24h: the summary.
 */
export function dueSlots(opts: {
  hoursAway: number;
  state: DeadlineState;
  event: number;
  summary: boolean;
  reminder: boolean;
}): DeadlineSlot[] {
  const { hoursAway, event } = opts;
  if (hoursAway <= 0) return [];
  // A state written for another gameweek says nothing about this one.
  const sent = opts.state.event === event ? opts.state.sent : {};

  const due: DeadlineSlot[] = [];
  if (opts.summary && !sent['24h'] && hoursAway <= SLOT_HOURS['24h']) due.push('24h');
  if (opts.reminder && !sent['2h'] && hoursAway <= SLOT_HOURS['2h']) due.push('2h');
  return due;
}

/** The state to write once `slots` are about to be sent for `event`. */
export function markSent(
  state: DeadlineState,
  event: number,
  slots: DeadlineSlot[],
  at: string,
  newsNow: Record<string, string>
): DeadlineState {
  const base = state.event === event ? state : { ...EMPTY_DEADLINE_STATE, event };
  const sent = { ...base.sent };
  slots.forEach((s) => (sent[s] = at));
  return {
    event,
    sent,
    newsAtSummary: slots.includes('24h') ? newsNow : base.newsAtSummary,
  };
}

/**
 * How unavailable a status is: available, doubtful, then out (injured,
 * suspended, unavailable). Unknown codes read as available — a new FPL code
 * must not page anyone at 3am before it is understood.
 */
export function severity(status: string): number {
  if (status === 'd') return 1;
  if (status === 'i' || status === 's' || status === 'u') return 2;
  return 0;
}

/**
 * Squad players whose availability got worse since the last run. An
 * improvement (injured → doubtful) is good news and waits for the summary; a
 * player with no previous value was only just added and is not a change.
 */
export function statusDrops<T extends { id: number; status: string }>(
  squad: T[],
  prevFlag: Record<string, string>
): { el: T; from: string; to: string }[] {
  return squad
    .filter((el) => {
      const was = prevFlag[String(el.id)];
      return was !== undefined && severity(el.status) > severity(was);
    })
    .map((el) => ({ el, from: prevFlag[String(el.id)], to: el.status }));
}

export const STATUS_WORD: Record<string, string> = {
  a: 'available',
  d: 'doubtful',
  i: 'injured',
  s: 'suspended',
  u: 'unavailable',
};

/** Starters (positions 1–11) carrying a flag, and news that changed since the summary. */
export function reminderFindings<T extends { id: number; status: string; news: string }>(
  picks: { element: number; position: number }[],
  elements: Map<number, T>,
  newsAtSummary: Record<string, string>
): { flaggedStarters: T[]; freshNews: T[] } {
  const squad = picks
    .map((p) => ({ pos: p.position, el: elements.get(p.element) }))
    .filter((p): p is { pos: number; el: T } => Boolean(p.el));
  return {
    flaggedStarters: squad.filter((p) => p.pos <= 11 && severity(p.el.status) > 0).map((p) => p.el),
    freshNews: squad
      .filter((p) => p.el.news && p.el.news !== (newsAtSummary[String(p.el.id)] ?? ''))
      .map((p) => p.el),
  };
}
