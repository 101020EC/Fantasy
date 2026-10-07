import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sellingPrice, purchaseCosts, squadValue } from '../lib/squad-value.ts';

// Everything is in tenths, as FPL sends it: 55 = £5.5m.

test('selling price: a rise of 0.1 returns nothing', () => {
  assert.equal(sellingPrice(56, 55), 55);
});
test('selling price: a rise of 0.2 returns 0.1', () => {
  assert.equal(sellingPrice(57, 55), 56);
});
test('selling price: a rise of 0.3 returns 0.1, not 0.15', () => {
  assert.equal(sellingPrice(58, 55), 56);
});
test('selling price: a rise of 1.0 returns 0.5', () => {
  assert.equal(sellingPrice(65, 55), 60);
});
test('selling price: unchanged sells at cost', () => {
  assert.equal(sellingPrice(55, 55), 55);
});
test('selling price: a fall is taken in full', () => {
  assert.equal(sellingPrice(52, 55), 52);
});

const el = (id, now_cost, cost_change_start = 0) => ({ id, now_cost, cost_change_start });
const picks = (...ids) => ids.map((element) => ({ element }));

test('purchase cost: an original pick was bought at the season-start price', () => {
  const costs = purchaseCosts(picks(1), [el(1, 57, 2)], []);
  assert.equal(costs.get(1), 55);
});
test('purchase cost: a transferred-in player was bought at element_in_cost', () => {
  const costs = purchaseCosts(picks(1), [el(1, 60, 5)], [{ element_in: 1, element_in_cost: 58, event: 3 }]);
  assert.equal(costs.get(1), 58);
});
test('purchase cost: bought, sold and bought back — the newest purchase wins', () => {
  const transfers = [
    { element_in: 1, element_in_cost: 55, event: 2 },
    { element_in: 1, element_in_cost: 59, event: 5 },
  ];
  assert.equal(purchaseCosts(picks(1), [el(1, 60)], transfers).get(1), 59);
});
test('purchase cost: within one gameweek the later time wins', () => {
  const transfers = [
    { element_in: 1, element_in_cost: 59, event: 5, time: '2026-09-20T10:00:00Z' },
    { element_in: 1, element_in_cost: 57, event: 5, time: '2026-09-19T10:00:00Z' },
  ];
  assert.equal(purchaseCosts(picks(1), [el(1, 60)], transfers).get(1), 59);
});
test('purchase cost: a pick missing from the player list is skipped', () => {
  assert.equal(purchaseCosts(picks(9), [el(1, 55)], []).has(9), false);
});

// Round 5's real case: Calafiori and João Pedro each up 0.1 since purchase.
test('squad value: two +0.1 rises leave the selling value at what was paid', () => {
  const v = squadValue(picks(1, 2), [el(1, 56, 1), el(2, 76, 1)], []);
  assert.deepEqual(v, { selling: 130, paid: 130, profit: 0 });
});
test('squad value: a fall is a real loss', () => {
  const v = squadValue(picks(1), [el(1, 53, -2)], []);
  assert.deepEqual(v, { selling: 53, paid: 55, profit: -2 });
});
test('squad value: a +0.3 rise counts 0.1 of profit', () => {
  const v = squadValue(picks(1), [el(1, 63)], [{ element_in: 1, element_in_cost: 60, event: 4 }]);
  assert.deepEqual(v, { selling: 61, paid: 60, profit: 1 });
});
