// Run with `npm test` (Node 23+ strips the TypeScript types itself).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dueSlots,
  markAttempt,
  markDelivered,
  slotStatus,
  fixturesPerTeam,
  captainPicks,
  statusDrops,
  reminderFindings,
  EMPTY_DEADLINE_STATE,
} from '../lib/deadline-alerts.ts';

const on = { summary: true, reminder: true, event: 10 };

test('nothing is due more than 24h out, or once the deadline has passed', () => {
  assert.deepEqual(dueSlots({ ...on, hoursAway: 30, state: EMPTY_DEADLINE_STATE }), []);
  assert.deepEqual(dueSlots({ ...on, hoursAway: -0.5, state: EMPTY_DEADLINE_STATE }), []);
});

test('the summary is due inside 24h, and only once per gameweek', () => {
  assert.deepEqual(dueSlots({ ...on, hoursAway: 23.4, state: EMPTY_DEADLINE_STATE }), ['24h']);
  const tried = markAttempt(EMPTY_DEADLINE_STATE, 10, ['24h'], {});
  const state = markDelivered(tried, 10, ['24h'], 't');
  assert.deepEqual(dueSlots({ ...on, hoursAway: 22.4, state }), []);
  assert.deepEqual(dueSlots({ ...on, hoursAway: 1.4, state }), ['2h']);
});

test('a missed summary is caught up together with the reminder', () => {
  assert.deepEqual(dueSlots({ ...on, hoursAway: 1.4, state: EMPTY_DEADLINE_STATE }), ['24h', '2h']);
});

test('state from the previous gameweek does not suppress this one', () => {
  const old = markDelivered(EMPTY_DEADLINE_STATE, 9, ['24h', '2h'], 't');
  assert.deepEqual(dueSlots({ ...on, hoursAway: 20, state: old }), ['24h']);
});

test('switched-off slots are never due', () => {
  assert.deepEqual(
    dueSlots({ ...on, summary: false, hoursAway: 1, state: EMPTY_DEADLINE_STATE }),
    ['2h']
  );
  assert.deepEqual(
    dueSlots({ ...on, reminder: false, hoursAway: 1, state: EMPTY_DEADLINE_STATE }),
    ['24h']
  );
});

test('the news snapshot is the summary\'s, not the reminder\'s', () => {
  const after24 = markAttempt(EMPTY_DEADLINE_STATE, 10, ['24h'], { 1: 'Knock' });
  const after2 = markAttempt(after24, 10, ['2h'], { 1: 'Ruled out' });
  assert.deepEqual(after2.newsAtSummary, { 1: 'Knock' });
});

test('a rejected slot is retried until the third attempt, then given up', () => {
  let state = EMPTY_DEADLINE_STATE;
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(dueSlots({ ...on, hoursAway: 20 - i, state }), ['24h']);
    state = markAttempt(state, 10, ['24h'], {});
  }
  assert.deepEqual(dueSlots({ ...on, hoursAway: 17, state }), []);
  assert.equal(slotStatus(state, 10, '24h'), 'gave-up');
  // The reminder has its own three attempts.
  assert.deepEqual(dueSlots({ ...on, hoursAway: 1.5, state }), ['2h']);
});

test('a delivered slot reads as sent even after failed attempts', () => {
  let state = markAttempt(EMPTY_DEADLINE_STATE, 10, ['24h'], {});
  state = markAttempt(state, 10, ['24h'], {});
  state = markDelivered(state, 10, ['24h'], 't');
  assert.equal(slotStatus(state, 10, '24h'), 'sent');
});

test('only a worse status is a drop; improvements and new players are not', () => {
  const squad = [
    { id: 1, status: 'd' }, // a → d: drop
    { id: 2, status: 'i' }, // d → i: drop
    { id: 3, status: 'd' }, // i → d: improvement
    { id: 4, status: 'i' }, // new to the squad
    { id: 5, status: 'a' }, // unchanged
  ];
  const drops = statusDrops(squad, { 1: 'a', 2: 'd', 3: 'i', 5: 'a' });
  assert.deepEqual(
    drops.map((d) => [d.el.id, d.from, d.to]),
    [
      [1, 'a', 'd'],
      [2, 'd', 'i'],
    ]
  );
});

test('the reminder flags starters only, and news only when it changed', () => {
  const els = new Map([
    [1, { id: 1, status: 'd', news: 'Knock' }],
    [2, { id: 2, status: 'i', news: 'Hamstring' }],
    [3, { id: 3, status: 'a', news: '' }],
  ]);
  const picks = [
    { element: 1, position: 1 },
    { element: 3, position: 2 },
    { element: 2, position: 12 },
  ];
  const r = reminderFindings(picks, els, { 1: 'Knock' });
  assert.deepEqual(r.flaggedStarters.map((e) => e.id), [1]);
  assert.deepEqual(r.freshNews.map((e) => e.id), [2]);
});

test('fixture counts: blanking clubs are absent, doubles count two', () => {
  const fx = [
    { event: 10, team_h: 1, team_a: 2 },
    { event: 10, team_h: 3, team_a: 1 },
    { event: 11, team_h: 4, team_a: 5 },
  ];
  const c = fixturesPerTeam(fx, 10);
  assert.equal(c.get(1), 2);
  assert.equal(c.get(2), 1);
  assert.equal(c.get(4), undefined);
});

test('captain picks skip flagged and blanking players and rank by xPts', () => {
  const squad = [
    { id: 1, status: 'a', team: 1 },
    { id: 2, status: 'd', team: 1 }, // flagged
    { id: 3, status: 'a', team: 9 }, // blanks
    { id: 4, status: 'a', team: 2 },
    { id: 5, status: 'a', team: 2 }, // no forecast
  ];
  const xp = { 1: 6.1, 2: 9.9, 3: 12, 4: 7.4 };
  const picks = captainPicks(squad, (id) => xp[id] ?? null, new Map([[1, 1], [2, 1]]));
  assert.deepEqual(picks.map((p) => p.el.id), [4, 1]);
});
