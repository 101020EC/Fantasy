// Run with `npm test` (Node 23+ strips the TypeScript types itself).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dueSlots,
  markSent,
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
  const state = markSent(EMPTY_DEADLINE_STATE, 10, ['24h'], 't', {});
  assert.deepEqual(dueSlots({ ...on, hoursAway: 22.4, state }), []);
  assert.deepEqual(dueSlots({ ...on, hoursAway: 1.4, state }), ['2h']);
});

test('a missed summary is caught up together with the reminder', () => {
  assert.deepEqual(dueSlots({ ...on, hoursAway: 1.4, state: EMPTY_DEADLINE_STATE }), ['24h', '2h']);
});

test('state from the previous gameweek does not suppress this one', () => {
  const old = markSent(EMPTY_DEADLINE_STATE, 9, ['24h', '2h'], 't', {});
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

test('markSent keeps the news snapshot from the summary when only the reminder is sent', () => {
  const after24 = markSent(EMPTY_DEADLINE_STATE, 10, ['24h'], 'a', { 1: 'Knock' });
  const after2 = markSent(after24, 10, ['2h'], 'b', { 1: 'Ruled out' });
  assert.deepEqual(after2.newsAtSummary, { 1: 'Knock' });
  assert.deepEqual(after2.sent, { '24h': 'a', '2h': 'b' });
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
