import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the safe hydration gate and security headers", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  const html = await response.text();
  assert.match(html, /<title>Digital Die Designer<\/title>/i);
  assert.doesNotMatch(html, /CURRENT DIE|CERTIFICATE/);
  assert.match(html, /Loading saved die data/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("publishes application-specific social metadata", async () => {
  const html = await (await render()).text();
  assert.match(html, /property="og:title" content="Digital Die Designer"/);
  assert.match(html, /property="og:image" content="http:\/\/localhost:3000\/og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test("the client includes explicit corrupt-storage recovery actions", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/DigitalDieDesigner.tsx", import.meta.url), "utf8");
  for (const action of [
    "Copy raw saved JSON",
    "Download raw saved JSON",
    "validation errors",
    "Retry after manual correction",
    "Start with a sample die",
    "Reset local saved data",
  ]) {
    assert.match(source, new RegExp(action));
  }
  assert.match(source, /window\.confirm/);
});

test("calculator panel is simplified and still shows fixed all-around margin", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/DigitalDieDesigner.tsx", import.meta.url), "utf8");
  assert.match(source, /type CalculatorMode = "simple" \| "advanced"/);
  assert.match(source, /setCalculatorMode\("simple"\)/);
  assert.match(source, /setCalculatorMode\("advanced"\)/);
  assert.match(source, /Section title="Machine selection"/);
  assert.match(source, /Section title="Semi-rotary cylinder"/);
  assert.match(source, /Section title="Label geometry"/);
  assert.match(source, /Section title="Step & repeat"/);
  assert.match(source, /Section title="Material & certificate"/);
  assert.match(source, /Cutting plate margin/);
  assert.match(source, /mm all around/);
  assert.match(source, /previewWebWidthMm/);
  assert.match(source, /Web width/);
});
