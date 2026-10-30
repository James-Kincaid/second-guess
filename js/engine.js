// Second Guess: the game's math, with no page or model code in it.
// Everything here is plain functions so it can be tested in Node (tests/engine.test.js).

export const CHIPS = 100;      // chips the player spreads each round
export const STEP = 10;        // chips added or removed per tap
export const CANDIDATES = 8;   // top tokens shown; everything else shares one "something else" bucket

// Heat is the model's sampling temperature. Good rounds turn it up, bad rounds cool it off.
export const HEAT = { start: 0.7, min: 0.5, max: 2.0, up: 0.2, down: 0.4 };

// Turn raw model scores (logits) into probabilities at a given temperature.
// Low temperature sharpens the distribution toward the top token; high temperature flattens it.
export function softmax(logits, temperature = 1) {
  const t = Math.max(temperature, 0.05);
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  const probs = new Float64Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp((logits[i] - max) / t);
    probs[i] = e;
    sum += e;
  }
  for (let i = 0; i < probs.length; i++) probs[i] /= sum;
  return probs;
}

// Indices of the k most likely tokens, most likely first.
export function topK(probs, k) {
  const best = []; // small sorted list; fine for k around 10 and vocabularies around 50k
  for (let i = 0; i < probs.length; i++) {
    const p = probs[i];
    if (best.length < k || p > probs[best[best.length - 1]]) {
      let j = best.length;
      while (j > 0 && probs[best[j - 1]] < p) j--;
      best.splice(j, 0, i);
      if (best.length > k) best.pop();
    }
  }
  return best;
}

// The betting board: the top candidates plus one bucket for every other token.
// Each bucket: { tokenId (null for "something else"), p }
export function buildBuckets(probs, k = CANDIDATES) {
  const ids = topK(probs, k);
  const buckets = ids.map((id) => ({ tokenId: id, p: probs[id] }));
  const rest = 1 - buckets.reduce((s, b) => s + b.p, 0);
  buckets.push({ tokenId: null, p: Math.max(rest, 0) });
  return buckets;
}

// Roll the dice: pick a token in proportion to its probability.
export function sample(probs, rng = Math.random) {
  let r = rng();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return i;
  }
  return probs.length - 1; // floating-point leftovers
}

// Which bucket a sampled token falls in (the last bucket is "something else").
export function bucketIndex(buckets, tokenId) {
  const i = buckets.findIndex((b) => b.tokenId === tokenId);
  return i === -1 ? buckets.length - 1 : i;
}

// Score a round with a log score, a "proper" scoring rule: the best strategy is to
// spread chips the way the model spreads its probability. Going all-in pays off big
// when right and costs big when wrong. Spreading evenly scores about zero.
// One phantom chip per bucket keeps a zero bet from costing infinity.
export function scoreRound(chips, outcome) {
  const n = chips.length;
  const total = chips.reduce((s, c) => s + c, 0);
  const share = (chips[outcome] + 1) / (total + n);
  return { share, points: Math.round(100 * Math.log2(share * n)) };
}

export function nextHeat(heat, points) {
  const h = points > 0 ? heat + HEAT.up : heat - HEAT.down;
  return Math.round(Math.min(HEAT.max, Math.max(HEAT.min, h)) * 10) / 10;
}

export function heatLabel(heat) {
  if (heat < 0.9) return "Cool: the model plays it safe.";
  if (heat < 1.3) return "Warm: the model takes a few chances.";
  if (heat < 1.7) return "Hot: long shots start coming in.";
  return "Blazing: almost anything goes.";
}

// Small seeded random number generator, for repeatable tests and the practice model.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
