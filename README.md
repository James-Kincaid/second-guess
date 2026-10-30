# Second Guess

Bet on what a small language model will say next. A browser game that shows how AI writes: one token at a time, each one a roll of loaded dice.

It will live at jameskincaid.com/second-guess/.

## How a round works

The model reads the text so far and scores every token it knows. The board shows its top 8 picks (shuffled, so the order doesn't give the answer away) plus "something else." You spread 100 chips, the model samples a token, and the reveal shows your bets next to its real odds. Four tokens make a line.

- **Scoring** uses a log score: the best long-run strategy is to bet the way the model really thinks. Spreading evenly scores about zero; going all in pays big or costs big.
- **Heat** is the sampling temperature. It starts at 0.7, goes up 0.2 after a winning round and down 0.4 after a losing one (range 0.5 to 2.0).

## Running it

You need [Node.js](https://nodejs.org) (the LTS version). It works the same in PowerShell, Mac Terminal or Linux.

```
npm run vendor   # once: copies transformers.js into vendor/, then commit vendor/
npm run serve    # then open http://localhost:8000
```

It needs a local server because it uses JavaScript modules; opening the file directly won't work. Add `?practice` to the address to skip the download and play against a made-up model that's good for testing the game.

Tests for the game math: `npm test` (no dependencies to install).

## The model

GPT-2 small (`Xenova/gpt2`, 8-bit) runs on the visitor's device through [transformers.js](https://github.com/huggingface/transformers.js). Change `MODEL_ID` in `js/models.js` to try another; SmolLM2-135M is a good candidate.

**Privacy note:** the code is self-hosted, but the model weights download from huggingface.co on first load. That has to go in the game's section of the site's privacy page before launch, unless we self-host the weights too.

## Files

```
index.html          the page
css/style.css       site tokens and components, plus the game's own styles
js/engine.js        game math: temperature, sampling, scoring, heat (no page code)
js/models.js        the real model and the practice model
js/prompts.js       starting lines
js/ui.js            rendering and buttons
vendor/             transformers.js and its WebAssembly runtime (from npm run vendor)
fonts/, icons/      copied from jameskincaid.com
tools/              fetch-vendor.mjs, serve.mjs, build_icon.py
tests/              node --test
```
