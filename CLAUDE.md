# Second Guess

A browser game where players bet chips on a small language model's next token. Audience: curious non-technical people first, technical learners second. See README.md for how it plays and runs.

## Hard rules

- **Follow jameskincaid.com's CLAUDE.md** (repo `James-Kincaid/James-Kincaid.github.io`) for colors, type, spacing, components, words and privacy. Tokens and shared components in `css/style.css` are copied from that site's `assets/style.css`; keep them in sync. Townie Pixel only covers letters, digits and `. , ' " ! ? - : ( ) / &`, so anything with `+`, `%` or `·` uses Lora.
- **No build step.** Plain ES modules served as static files (GitHub Pages, `main` / root).
- **No code from CDNs.** transformers.js and its WebAssembly runtime live in `vendor/`, filled by `npm run vendor` (`tools/fetch-vendor.mjs`). The model weights are the one outside request (huggingface.co); it must be listed on the site's privacy page before launch.
- **Plain language first.** Say "piece" or "token" with an explanation, "heat" for temperature, "chance" for probability. The math lives in the How it works questions.
- **Keep the scoring proper.** The log score in `js/engine.js` rewards betting the way the model really thinks; don't swap in a rule that rewards always picking the favorite or a ~37% token. `tests/engine.test.js` checks this.
- Nick runs things from Windows PowerShell: tooling must be cross-platform Node scripts (`npm run ...`), not bash or `python3` commands.
- Game math stays in `js/engine.js` with no page code, so it can be tested with `npm test`.
- Check the page at 390px and desktop widths with `?practice` before handing back work.
