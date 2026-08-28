import { EliteGameweekSnapshot, FPLBootstrap } from './types';
import { ENTRY_FIELDS, PICK_FIELDS, SUB_FIELDS, TRANSFER_FIELDS, unflatten } from './elite-cohort';

/**
 * Reading the stored cohort snapshot back into something a page can render.
 *
 * Everything is positional on disk — Firestore rejects arrays of arrays, and
 * repeating field names twenty times over is what the encoding exists to avoid.
 * The field lists travel inside each document, so this reads the document's own
 * `pickFields` rather than the current constant: a snapshot captured before a
 * field was added must still decode correctly.
 */

export interface ElitePick {
  element: number;
  position: number;
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  typeId: number;
}

export interface EliteTransfer {
  inId: number;
  outId: number;
  inCost: number;
  outCost: number;
}

export interface EliteManagerView {
  managerId: number;
  teamName: string;
  managerName: string;
  qualification: string;
  activeChip: string | null;
  points: number | null;
  totalPoints: number | null;
  overallRank: number | null;
  bank: number | null;
  value: number | null;
  picks: ElitePick[];
  transfers: EliteTransfer[];
  /** element ids auto-subbed on, and off. */
  subbedOn: number[];
  subbedOff: number[];
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function readManager(
  snapshot: EliteGameweekSnapshot,
  managerId: number,
  roster?: { teamName?: string; managerName?: string; qualification?: string }
): EliteManagerView | null {
  const raw = snapshot.managers?.[String(managerId)];
  if (!raw) return null;

  const pickFields = snapshot.pickFields ?? [...PICK_FIELDS];
  const entryFields = snapshot.entryFields ?? [...ENTRY_FIELDS];
  const subFields = snapshot.subFields ?? [...SUB_FIELDS];
  const transferFields = snapshot.transferFields ?? [...TRANSFER_FIELDS];

  const entry = unflatten(raw.entry, entryFields)[0] ?? {};
  const subs = unflatten(raw.subs, subFields);

  return {
    managerId,
    teamName: roster?.teamName ?? `Manager ${managerId}`,
    managerName: roster?.managerName ?? '',
    qualification: roster?.qualification ?? '',
    activeChip: raw.activeChip ?? null,
    points: num(entry.points),
    totalPoints: num(entry.total_points),
    overallRank: num(entry.overall_rank),
    bank: num(entry.bank),
    value: num(entry.value),
    picks: unflatten(raw.picks, pickFields)
      .map((p) => ({
        element: Number(p.element),
        position: Number(p.position),
        multiplier: Number(p.multiplier),
        isCaptain: Boolean(p.is_captain),
        isViceCaptain: Boolean(p.is_vice_captain),
        typeId: Number(p.element_type),
      }))
      .sort((a, b) => a.position - b.position),
    transfers: unflatten(raw.transfers, transferFields).map((t) => ({
      inId: Number(t.element_in),
      outId: Number(t.element_out),
      inCost: Number(t.element_in_cost),
      outCost: Number(t.element_out_cost),
    })),
    subbedOn: subs.map((s) => Number(s.element_in)),
    subbedOff: subs.map((s) => Number(s.element_out)),
  };
}

export function readAllManagers(
  snapshot: EliteGameweekSnapshot,
  roster: Record<string, { teamName?: string; managerName?: string; qualification?: string }> = {}
): EliteManagerView[] {
  return Object.keys(snapshot.managers ?? {})
    .map((id) => readManager(snapshot, Number(id), roster[id]))
    .filter((m): m is EliteManagerView => Boolean(m))
    .sort((a, b) => (a.overallRank ?? Infinity) - (b.overallRank ?? Infinity));
}

/** Name, club and position for a player id, from the bootstrap. */
export function playerLookup(bootstrap: FPLBootstrap) {
  const el = new Map(bootstrap.elements.map((e) => [e.id, e]));
  const team = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const type = new Map(bootstrap.element_types.map((t) => [t.id, t]));
  return (id: number) => {
    const e = el.get(id);
    return {
      name: e?.web_name ?? `#${id}`,
      club: e ? team.get(e.team)?.short_name ?? '' : '',
      position: e ? type.get(e.element_type)?.singular_name_short ?? '' : '',
      cost: e ? e.now_cost / 10 : null,
    };
  };
}
