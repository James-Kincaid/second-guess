import { test } from "node:test";
import assert from "node:assert/strict";
import {
  softmax, topK, buildBuckets, sample, bucketIndex, scoreRound, nextHeat, mulberry32, HEAT,
} from "../js/engine.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("softmax sums to one and keeps order", () => {
  const p = softmax([2, 1, 0, -1], 1);
  close(p.reduce((s, x) => s + x, 0), 1);
  assert.ok(p[0] > p[1] && p[1] > p[2] && p[2] > p[3]);
});

test("higher temperature flattens the distribution", () => {
  const cool = softmax([3, 1, 0], 0.5);
  const hot = softmax([3, 1, 0], 2);
  assert.ok(cool[0] > hot[0]);
  assert.ok(cool[2] < hot[2]);
});

test("topK returns the most likely tokens in order", () => {
  const p = softmax([0.1, 5, 3, 4, -2, 1], 1);
  assert.deepEqual(topK(p, 3), [1, 3, 2]);
});

test("buckets cover all the probability", () => {
  const p = softmax(Array.from({ length: 50 }, (_, i) => Math.sin(i) * 3), 1);
  const b = buildBuckets(p, 8);
  assert.equal(b.length, 9);
  assert.equal(b[8].tokenId, null);
  close(b.reduce((s, x) => s + x.p, 0), 1, 1e-9);
});

test("sampling follows the probabilities", () => {
  const rng = mulberry32(7);
  const p = [0.7, 0.2, 0.1];
  const counts = [0, 0, 0];
  for (let i = 0; i < 20000; i++) counts[sample(p, rng)]++;
  close(counts[0] / 20000, 0.7, 0.02);
  close(counts[2] / 20000, 0.1, 0.02);
});

test("tokens outside the top candidates land in 'something else'", () => {
  const b = [{ tokenId: 4, p: 0.5 }, { tokenId: 9, p: 0.3 }, { tokenId: null, p: 0.2 }];
  assert.equal(bucketIndex(b, 9), 1);
  assert.equal(bucketIndex(b, 123), 2);
});

test("scoring: even spread is about zero, all-in pays or costs", () => {
  const even = scoreRound(Array(10).fill(10), 3);
  assert.equal(even.points, 0);
  const allIn = [100, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.ok(scoreRound(allIn, 0).points > 250);
  assert.ok(scoreRound(allIn, 1).points < -300);
});

test("scoring is proper: matching the model beats going all-in on its favorite", () => {
  const model = [0.6, 0.3, 0.1];
  const expected = (chips) => model.reduce((s, p, i) => s + p * scoreRound(chips, i).points, 0);
  assert.ok(expected([60, 30, 10]) > expected([100, 0, 0]));
  assert.ok(expected([60, 30, 10]) > expected([40, 40, 20]));
});

test("heat rises on good rounds, falls on bad ones, and stays in range", () => {
  assert.equal(nextHeat(0.7, 50), 0.9);
  assert.equal(nextHeat(0.7, -20), HEAT.min);
  assert.equal(nextHeat(2.0, 80), HEAT.max);
});
