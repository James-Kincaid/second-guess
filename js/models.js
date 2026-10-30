// Second Guess: the two models the game can play against.
//
// Both share one small interface:
//   load(onProgress)   download and start the model; onProgress(fraction 0..1)
//   encode(text)       text -> array of token ids
//   nextLogits(ids)    token ids -> Float32Array of scores for every token in the vocabulary
//   decode(ids)        token ids -> text
//   name, about, vocabSize

import { mulberry32 } from "./engine.js";

// ---------------------------------------------------------------- the real model
// A small open model running entirely in the visitor's browser through transformers.js.
// The library lives in vendor/ (filled by npm run vendor), so the page loads no code from a CDN.
// The model weights still come from Hugging Face on first load; the browser caches them after that.
export const MODEL_ID = "Xenova/gpt2";
const MODEL_DTYPE = "q8"; // 8-bit weights: about a quarter the download of full precision

export function realModel() {
  let tf, tokenizer, model;
  return {
    name: "GPT-2 (small)",
    about: "GPT-2, a small 2019 language model with 124 million parameters, running on your device.",
    vocabSize: 0,

    async load(onProgress = () => {}) {
      tf = await import("../vendor/transformers.min.js");
      tf.env.allowLocalModels = false;
      // Load the ONNX runtime's WebAssembly from our own folder, not a CDN.
      tf.env.backends.onnx.wasm.wasmPaths = new URL("../vendor/", import.meta.url).href;
      tf.env.backends.onnx.wasm.numThreads = 1; // GitHub Pages can't enable multi-threading

      const files = new Map(); // file -> { loaded, total }
      const progress_callback = (e) => {
        if (e.status !== "progress" || !e.total) return;
        files.set(e.file, { loaded: e.loaded, total: e.total });
        let loaded = 0, total = 0;
        for (const f of files.values()) { loaded += f.loaded; total += f.total; }
        onProgress(total ? loaded / total : 0);
      };

      tokenizer = await tf.AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback });
      model = await tf.AutoModelForCausalLM.from_pretrained(MODEL_ID, {
        dtype: MODEL_DTYPE,
        device: "wasm",
        progress_callback,
      });
      this.vocabSize = model.config.vocab_size;
      onProgress(1);
    },

    encode(text) {
      return Array.from(tokenizer.encode(text, { add_special_tokens: false }));
    },

    async nextLogits(ids) {
      const n = ids.length;
      const input_ids = new tf.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, n]);
      const attention_mask = new tf.Tensor("int64", new BigInt64Array(n).fill(1n), [1, n]);
      const { logits } = await model({ input_ids, attention_mask });
      const vocab = logits.dims[2];
      // Only the last position matters: the model's guess for the token after the text.
      return Float32Array.from(logits.data.subarray((n - 1) * vocab, n * vocab));
    },

    decode(ids) {
      return tokenizer.decode(ids, { skip_special_tokens: true });
    },
  };
}

// ---------------------------------------------------------------- the practice model
// A stand-in that downloads nothing and makes up its scores from a small word list.
// It's for testing the game on any machine (add ?practice to the address). Its guesses are nonsense.
const WORDS = (
  " the| a| and| of| to| in| is| was| that| it| for| on| with| as| my| his| her| they| we| you|" +
  " dog| cat| tacos| river| creek| tree| sun| moon| night| day| water| city| Austin| Texas| home|" +
  " happy| quiet| bright| old| new| big| little| warm| cold| green| red| blue|" +
  " ran| sat| saw| said| made| found| went| looked| felt| knew|" +
  " un|believ|able| ing|.|,|!|?|\n"
).split("|");

export function practiceModel() {
  return {
    name: "Practice model",
    about: "a made-up model for testing. It doesn't download anything, and its guesses are random.",
    vocabSize: WORDS.length,
    extra: [], // words from the prompts that aren't in WORDS; the model never picks them

    async load(onProgress = () => {}) {
      onProgress(1);
    },

    encode(text) {
      // Split into words (keeping their leading space) and give unknown ones new ids.
      const vocab = [...WORDS, ...this.extra];
      return (text.match(/ ?[^ ]+| +/g) ?? []).map((piece) => {
        let id = vocab.indexOf(piece);
        if (id === -1) { this.extra.push(piece); id = vocab.push(piece) - 1; }
        return id;
      });
    },

    async nextLogits(ids) {
      const seed = ids.reduce((h, id) => (h * 31 + id + 7) >>> 0, 17);
      const rng = mulberry32(seed);
      // A few strong favorites and a long tail, like a real model.
      const scores = WORDS.map(() => (rng() < 0.15 ? 3 + rng() * 4 : rng() * 3));
      return Float32Array.from([...scores, ...this.extra.map(() => -20)]);
    },

    decode(ids) {
      const vocab = [...WORDS, ...this.extra];
      return ids.map((id) => vocab[id] ?? "").join("");
    },
  };
}
