// Second Guess: the page. Wires the model and the game math to the buttons.
import {
  CHIPS, STEP, HEAT, softmax, buildBuckets, sample, bucketIndex, scoreRound, nextHeat, heatLabel, shuffle,
} from "./engine.js";
import { realModel, practiceModel } from "./models.js";
import { PROMPTS } from "./prompts.js";

const WORDS_PER_HAND = 4;
const $ = (id) => document.getElementById(id);

const state = {
  model: null,
  prompts: shuffle(PROMPTS),
  promptIndex: -1,
  promptText: "",
  ids: [],          // token ids so far: the prompt plus what the model has added
  promptLength: 0,
  round: 1,
  score: 0,
  handPoints: 0,
  heat: HEAT.start,
  probs: null,
  buckets: [],      // most likely first, "something else" last
  order: [],        // the shuffled order the board shows while betting
  chips: [],        // per bucket, same indexing as buckets
  phase: "betting",
};

// ---------------------------------------------------------------- showing tokens
// Make a token readable: spaces become a gold dot, line breaks and fragments get a plain label.
function tokenHTML(text) {
  if (text === "\n" || /^\n+$/.test(text)) return `<span class="sp">↵</span> new line`;
  if (text.includes("�")) return `<span class="other">part of a symbol</span>`;
  if (/^\s+$/.test(text)) return `<span class="sp">·</span> just a space`;
  const lead = text.match(/^ +/)?.[0].length ?? 0;
  return `<span class="sp">${"·".repeat(lead)}</span>${escapeHTML(text.slice(lead))}`;
}
function tokenText(text) { // for screen readers and messages
  if (/^\n+$/.test(text)) return "a new line";
  if (/^\s+$/.test(text)) return "a space";
  return `“${text.trim()}”` + (text.startsWith(" ") ? "" : " (joined to the last piece)");
}
const escapeHTML = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// "a 24% chance" but "an 80% chance", "an 8% chance", "an 11% chance"
const aPct = (p) => (/^(8|11|18)/.test(pct(p)) ? "an " : "a ") + pct(p);
const pct = (p) => (p >= 0.995 ? "99%+" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);

function bucketLabel(b) {
  return b.tokenId === null
    ? `<span class="tok other">Something else</span>`
    : `<span class="tok">${tokenHTML(state.model.decode([b.tokenId]))}</span>`;
}
function bucketName(b) {
  return b.tokenId === null ? "something else" : tokenText(state.model.decode([b.tokenId]));
}

// ---------------------------------------------------------------- loading
async function start(model) {
  state.model = model;
  $("load").disabled = $("practice").disabled = true;
  $("meter").hidden = false;
  $("load-msg").textContent = `Loading ${model.name}...`;
  try {
    await model.load((f) => {
      // fill in whole 4px steps so the bar stays pixel-crisp
      $("meter-fill").style.width = `${Math.floor(f * 100)}%`;
    });
  } catch (err) {
    console.error(err);
    $("load-msg").textContent =
      "The model didn't load. It may be a network problem, or this browser may not support it. " +
      "You can still try the practice model.";
    $("meter").hidden = true;
    $("practice").disabled = false;
    return;
  }
  $("loader").hidden = true;
  $("game").hidden = false;
  $("model-note").textContent = `Playing against ${model.about}`;
  newHand();
}

// ---------------------------------------------------------------- a hand: one starting line, a few words
function newHand() {
  state.promptIndex = (state.promptIndex + 1) % state.prompts.length;
  state.promptText = state.prompts[state.promptIndex];
  state.ids = state.model.encode(state.promptText);
  state.promptLength = state.ids.length;
  state.round = 1;
  state.handPoints = 0;
  newRound();
}

async function newRound() {
  state.phase = "thinking";
  renderStatus();
  renderStory(true);
  $("bets").innerHTML = `<li class="hint">The model is thinking...</li>`;
  $("bet-controls").hidden = false;
  $("result").hidden = true;
  $("board-hint").hidden = false;

  const logits = await state.model.nextLogits(state.ids);
  state.probs = softmax(logits, state.heat);
  state.buckets = buildBuckets(state.probs);
  const n = state.buckets.length;
  // Shuffle the candidates so their order doesn't give away the odds; "something else" stays last.
  state.order = [...shuffle([...Array(n - 1).keys()]), n - 1];
  state.chips = Array(n).fill(0);
  state.phase = "betting";
  renderBets();
}

// ---------------------------------------------------------------- betting
function chipsLeft() { return CHIPS - state.chips.reduce((s, c) => s + c, 0); }

function renderBets() {
  const left = chipsLeft();
  $("bets").innerHTML = state.order.map((i) => {
    const b = state.buckets[i];
    const name = escapeHTML(bucketName(b));
    return `<li class="bet">
      ${bucketLabel(b)}
      <div class="stepper">
        <button data-i="${i}" data-d="-1" aria-label="Take chips off ${name}" ${state.chips[i] ? "" : "disabled"}>−</button>
        <output aria-label="Chips on ${name}">${state.chips[i]}</output>
        <button data-i="${i}" data-d="1" aria-label="Put chips on ${name}" ${left ? "" : "disabled"}>+</button>
      </div>
    </li>`;
  }).join("");
  $("left").innerHTML = left
    ? `Chips left: <strong>${left}</strong>`
    : `All 100 chips placed. Ready when you are.`;
  $("roll").disabled = left > 0;
}

function adjust(i, dir) {
  if (state.phase !== "betting") return;
  const amount = dir > 0 ? Math.min(STEP, chipsLeft()) : -Math.min(STEP, state.chips[i]);
  state.chips[i] += amount;
  const focusKey = `[data-i="${i}"][data-d="${dir}"]`;
  renderBets();
  // keep keyboard focus on the button that was pressed (or its neighbor if it got disabled)
  const btn = document.querySelector(focusKey);
  (btn && !btn.disabled ? btn : document.querySelector(`[data-i="${i}"]:not(:disabled)`) ?? $("roll"))?.focus();
}

function spreadEvenly() {
  const n = state.buckets.length;
  state.chips = state.chips.map((_, i) => Math.floor(CHIPS / n) + (i < CHIPS % n ? 1 : 0));
  renderBets();
}

// ---------------------------------------------------------------- rolling and the reveal
function roll() {
  if (state.phase !== "betting" || chipsLeft() > 0) return;
  state.phase = "reveal";

  const tokenId = sample(state.probs);
  const picked = bucketIndex(state.buckets, tokenId);
  const { points } = scoreRound(state.chips, picked);
  const heatBefore = state.heat;
  state.score += points;
  state.handPoints += points;
  state.heat = nextHeat(state.heat, points);
  state.ids.push(tokenId);

  renderReveal(picked);
  renderStatus();
  renderStory(state.round < WORDS_PER_HAND);

  const b = state.buckets[picked];
  const favorite = state.buckets[0];
  const lines = [];
  if (b.tokenId === null) {
    lines.push(`The dice landed on ${escapeHTML(tokenText(state.model.decode([tokenId])))}, which wasn't on the board. ` +
      `Everything off the board had ${aPct(b.p)} chance combined.`);
  } else {
    lines.push(`The dice landed on ${escapeHTML(bucketName(b))}. The model gave it ${aPct(b.p)} chance.`);
  }
  if (picked !== 0) {
    lines.push(`Its favorite was ${escapeHTML(bucketName(favorite))} at ${pct(favorite.p)}. The dice don't always pick the favorite.`);
  }
  const chips = state.chips[picked];
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  lines.push(`<span class="points">You had ${chips} chip${chips === 1 ? "" : "s"} on it: ${sign}${Math.abs(points)} points.</span>`);
  if (state.heat !== heatBefore) {
    lines.push(state.heat > heatBefore
      ? `Nice. The heat goes up to ${state.heat.toFixed(1)}.`
      : `The heat cools to ${state.heat.toFixed(1)}.`);
  }
  const last = state.round >= WORDS_PER_HAND;
  if (last) {
    const hs = state.handPoints;
    lines.push(`That's the end of this line. You scored ${hs >= 0 ? "+" : "−"}${Math.abs(hs)} on it.`);
  }

  $("result-text").innerHTML = lines.map((l) => `<p>${l}</p>`).join("");
  $("next").textContent = last ? "Next line" : "Next word";
  $("bet-controls").hidden = true;
  $("board-hint").hidden = true;
  $("result").hidden = false;
  $("next").focus();
}

function renderReveal(picked) {
  // Most likely first, so the player can see the model's ranking.
  const total = CHIPS;
  $("bets").innerHTML = state.buckets.map((b, i) => {
    const you = state.chips[i] / total;
    return `<li class="bet reveal${i === picked ? " picked" : ""}">
      <div>${bucketLabel(b)}${i === picked ? `<span class="picked-tag">picked</span>` : ""}</div>
      <div class="bars">
        <span class="who">You</span><span class="track"><span class="you" style="width:${you * 100}%"></span></span><span class="pct">${state.chips[i]}%</span>
        <span class="who">Model</span><span class="track"><span class="model" style="width:${b.p * 100}%"></span></span><span class="pct">${pct(b.p)}</span>
      </div>
    </li>`;
  }).join("");
}

function next() {
  if (state.phase !== "reveal") return;
  if (state.round >= WORDS_PER_HAND) return newHand();
  state.round += 1;
  newRound();
}

// ---------------------------------------------------------------- status and story
function renderStatus() {
  $("score").textContent = state.score;
  $("round").textContent = `${state.round}/${WORDS_PER_HAND}`;
  $("heat").textContent = state.heat.toFixed(1);
  const segments = 8;
  const on = 1 + Math.round(((state.heat - HEAT.min) / (HEAT.max - HEAT.min)) * (segments - 1));
  $("heat-bar").innerHTML = Array.from({ length: segments }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("");
  $("heat-note").textContent = heatLabel(state.heat);
}

function renderStory(waiting) {
  const full = state.model.decode(state.ids);
  const prompt = state.model.decode(state.ids.slice(0, state.promptLength));
  const added = full.startsWith(prompt) ? full.slice(prompt.length) : "";
  $("story").innerHTML =
    `${escapeHTML(prompt)}<span class="new">${escapeHTML(added)}</span>` +
    (waiting ? `<span class="cursor" aria-hidden="true"> ...</span>` : "");
}

// ---------------------------------------------------------------- wiring
$("load").addEventListener("click", () => start(realModel()));
$("practice").addEventListener("click", () => start(practiceModel()));
$("roll").addEventListener("click", roll);
$("even").addEventListener("click", spreadEvenly);
$("clear").addEventListener("click", () => { state.chips.fill(0); renderBets(); });
$("next").addEventListener("click", next);
$("bets").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-i]");
  if (btn) adjust(Number(btn.dataset.i), Number(btn.dataset.d));
});

if (new URLSearchParams(location.search).has("practice")) start(practiceModel());
