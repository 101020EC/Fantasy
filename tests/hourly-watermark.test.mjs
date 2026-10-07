// Run with `npm test` (Node 23+ strips the TypeScript types itself).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextWatermark } from '../lib/hourly-watermark.ts';

const prev = {
  price: { 1: 55, 2: 80, 3: 45 },
  news: { 1: '', 2: '', 3: 'Knock' },
  flag: { 1: 'a', 2: 'a', 3: 'd' },
};

test('a normal run replaces the watermark, so dropped players stop being tracked', () => {
  const seen = { price: { 1: 56 }, news: { 1: '' }, flag: { 1: 'a' } };
  assert.deepEqual(nextWatermark(prev, seen, false), seen);
});

test('after a failed lookup, players missing from this run keep their old values', () => {
  // Squad lookup failed: only watchlist player 1 was seen this hour.
  const seen = { price: { 1: 56 }, news: { 1: '' }, flag: { 1: 'a' } };
  const next = nextWatermark(prev, seen, true);
  assert.deepEqual(next.price, { 1: 56, 2: 80, 3: 45 });
  assert.deepEqual(next.news, { 1: '', 2: '', 3: 'Knock' });
  assert.deepEqual(next.flag, { 1: 'a', 2: 'a', 3: 'd' });
});

test('so a price move during the failed hour is still compared against the old value', () => {
  const failedHour = nextWatermark(prev, { price: {}, news: {}, flag: {} }, true);
  // Next hour the squad is back and player 2 has risen 80 → 81.
  assert.equal(failedHour.price[2], 80);
  assert.notEqual(failedHour.price[2], 81);
});

test('the previous watermark is not mutated', () => {
  const copy = structuredClone(prev);
  nextWatermark(prev, { price: { 9: 40 }, news: {}, flag: {} }, true);
  assert.deepEqual(prev, copy);
});
