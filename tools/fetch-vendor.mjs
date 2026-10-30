// Copies transformers.js and its WebAssembly runtime into vendor/, so the game
// loads no code from a CDN. Run once from the repo root, then commit vendor/:
//
//   npm run vendor            (or: node tools/fetch-vendor.mjs)
//
// Works on Windows, Mac and Linux. Needs Node.js, which includes npm.
// Pass a version to upgrade, e.g. node tools/fetch-vendor.mjs 3.7
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2] ?? "3";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendor = join(root, "vendor");
const tmp = mkdtempSync(join(tmpdir(), "second-guess-"));

try {
  console.log(`Installing @huggingface/transformers@${version} into a temporary folder...`);
  execSync(`npm install --prefix "${tmp}" --no-save --no-audit --no-fund "@huggingface/transformers@${version}"`, {
    stdio: "inherit",
  });

  const pkg = join(tmp, "node_modules", "@huggingface", "transformers");
  const ort = join(tmp, "node_modules", "onnxruntime-web", "dist");
  mkdirSync(vendor, { recursive: true });

  cpSync(join(pkg, "dist", "transformers.min.js"), join(vendor, "transformers.min.js"));

  // The WebAssembly runtime. Newer versions ship it in transformers' own dist folder.
  const wanted = ["ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.jsep.mjs"];
  const copied = [];
  for (const name of wanted) {
    const from = [join(pkg, "dist", name), join(ort, name)].find((p) => existsSync(p));
    if (from) { cpSync(from, join(vendor, name)); copied.push(name); }
  }
  if (copied.length === 0) {
    console.error(`Couldn't find the ort-wasm runtime files. Look in ${join(pkg, "dist")} for files starting with ort-wasm.`);
    process.exit(1);
  }

  const installed = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version;
  writeFileSync(join(vendor, "VERSION"), installed + "\n");
  console.log(`\nDone: transformers.js ${installed}`);
  for (const f of readdirSync(vendor)) {
    console.log(`  vendor/${f}  ${(statSync(join(vendor, f)).size / 1e6).toFixed(1)} MB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
