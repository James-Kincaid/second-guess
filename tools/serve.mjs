// A tiny local web server for trying the game. Works on Windows, Mac and Linux.
//
//   npm run serve             (or: node tools/serve.mjs)
//
// Then open http://localhost:8000 (add ?practice to skip the model download).
// Only reachable from this computer. Press Ctrl+C to stop.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const port = Number(process.env.PORT ?? 8000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    if (!statSync(file).isFile()) throw new Error("not a file");
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end(`Not found: ${path}`);
    return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`Second Guess is running at http://localhost:${port}`);
  console.log(`Practice model (no download): http://localhost:${port}/?practice`);
  console.log("Press Ctrl+C to stop.");
});
