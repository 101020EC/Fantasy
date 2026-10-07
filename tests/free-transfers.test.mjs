import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeTransfersFor } from '../lib/free-transfers.ts';

const row = (event, event_transfers = 0, event_transfers_cost = 0) => ({ event, event_transfers, event_transfers_cost });

// The real team 2792350 on 2026-10-07: GW2 one transfer, GW3 Wildcard,
// GW4 none, GW5 two free → 2 for GW6.
test('the tracked team: 1 → 0+1 → wildcard keeps 1, +1 → 3 → 3−2+1 = 2', () => {
  assert.equal(
    freeTransfersFor({
      history: [row(1), row(2, 1), row(3, 0), row(4, 0), row(5, 2)],
      chips: [{ name: 'wildcard', event: 3 }],
      nextGameweek: 6,
    }),
    2
  );
});

test('before the second deadline there is exactly one', () => {
  assert.equal(freeTransfersFor({ history: [row(1)], chips: [], nextGameweek: 2 }), 1);
});

test('rolling every week caps the bank at five', () => {
  const history = [1, 2, 3, 4, 5, 6, 7, 8].map((e) => row(e));
  assert.equal(freeTransfersFor({ history, chips: [], nextGameweek: 9 }), 5);
});

test('a hit spends nothing beyond the free ones', () => {
  // GW2: 1 free available, made 2 (one paid −4) → 0, then +1.
  assert.equal(freeTransfersFor({ history: [row(1), row(2, 2, 4)], chips: [], nextGameweek: 3 }), 1);
});

test('a Free Hit week keeps the bank and still adds one', () => {
  const history = [row(1), row(2), row(3, 9)];
  assert.equal(freeTransfersFor({ history, chips: [{ name: 'freehit', event: 3 }], nextGameweek: 4 }), 3);
});

test('transfers already made for the next deadline come off', () => {
  const opts = { history: [row(1), row(2), row(3)], chips: [], nextGameweek: 4 };
  assert.equal(freeTransfersFor(opts), 3);
  assert.equal(freeTransfersFor({ ...opts, pendingTransfers: 2 }), 1);
  assert.equal(freeTransfersFor({ ...opts, pendingTransfers: 5 }), 0);
});

test('a late starter counts from their own first gameweek', () => {
  assert.equal(freeTransfersFor({ history: [row(4), row(5)], chips: [], nextGameweek: 6 }), 2);
});

test('other chips (bench boost, triple captain) do not protect transfers', () => {
  const history = [row(1), row(2), row(3, 2)];
  assert.equal(freeTransfersFor({ history, chips: [{ name: 'bboost', event: 3 }], nextGameweek: 4 }), 1);
});
