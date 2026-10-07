import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextEliteCapture } from '../lib/elite-capture.ts';

// GW1 data-checked; GW2 deadline Friday 17:30Z, not yet checked; GW3 in the future.
const events = [
  { id: 1, data_checked: true, deadline_time: '2026-08-15T10:00:00Z' },
  { id: 2, data_checked: false, deadline_time: '2026-08-22T17:30:00Z' },
  { id: 3, data_checked: false, deadline_time: '2026-08-29T10:00:00Z' },
];
const afterGw2Deadline = new Date('2026-08-22T22:30:00Z');
const beforeGw2Deadline = new Date('2026-08-22T12:00:00Z');

test('captures the in-flight week provisionally once its deadline has passed', () => {
  assert.deepEqual(
    nextEliteCapture({ finalised: [1], storedFinal: [1], storedAny: [1], events, now: afterGw2Deadline }),
    { gameweek: 2, dataChecked: false }
  );
});

test('does not re-capture the in-flight week the following night', () => {
  assert.equal(
    nextEliteCapture({ finalised: [1], storedFinal: [1], storedAny: [1, 2], events, now: afterGw2Deadline }),
    null
  );
});

test('re-captures a provisional week once FPL data-checks it, this time as final', () => {
  const checked = events.map((e) => (e.id === 2 ? { ...e, data_checked: true } : e));
  assert.deepEqual(
    nextEliteCapture({ finalised: [1, 2], storedFinal: [1], storedAny: [1, 2], events: checked, now: afterGw2Deadline }),
    { gameweek: 2, dataChecked: true }
  );
});

test('finalised work wins over in-flight work when both are pending', () => {
  assert.deepEqual(
    nextEliteCapture({ finalised: [1], storedFinal: [], storedAny: [], events, now: afterGw2Deadline }),
    { gameweek: 1, dataChecked: true }
  );
});

test('captures nothing before the deadline', () => {
  assert.equal(
    nextEliteCapture({ finalised: [1], storedFinal: [1], storedAny: [1], events, now: beforeGw2Deadline }),
    null
  );
});

test('an empty database starts at the first finalised week', () => {
  assert.deepEqual(
    nextEliteCapture({ finalised: [1, 2, 3], storedFinal: [], storedAny: [], events, now: afterGw2Deadline }),
    { gameweek: 1, dataChecked: true }
  );
});

test('a gap among finalised weeks is filled oldest first', () => {
  assert.deepEqual(
    nextEliteCapture({ finalised: [1, 2, 3], storedFinal: [1, 3], storedAny: [1, 3], events, now: afterGw2Deadline }),
    { gameweek: 2, dataChecked: true }
  );
});
