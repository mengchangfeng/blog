import assert from "node:assert/strict";
import test from "node:test";

import { before, after } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unstable_dev } from "wrangler";

let worker;
const storage = mkdtempSync(join(tmpdir(), "blog-test-"));
before(async () => {
  execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB",
    "--config", "dist/server/wrangler.json", "--local", "--persist-to", storage,
    "--file", "drizzle/0000_loud_siren.sql"], { stdio: "pipe" });
  worker = await unstable_dev("dist/server/index.js", {
    config: "dist/server/wrangler.json", local: true, persistTo: storage,
    experimental: { disableExperimentalWarning: true },
  });
});
after(async () => {
  await worker?.stop();
  rmSync(storage, { recursive: true, force: true });
});

async function render(pathname = "/") {
  return worker.fetch(pathname, { headers: { accept: "text/html" } });
}

test("renders the article list homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Meng — Writing<\/title>/i);
  assert.match(html, /让网页版 GPT 控制自己的电脑/);
  assert.match(html, /我给 AI 搭了一个跨设备项目路由层/);
  assert.doesNotMatch(html, /WRITING \/ ALL NOTES/);
  assert.match(html, /搜索文章/);
  assert.match(html, /search\?tag=/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("renders a Markdown article", async () => {
  const slug = encodeURIComponent("把家里的电脑稳定暴露给AI：AgentDock域名与云服务器穿透教程");
  const response = await render(`/posts/${slug}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<article class="markdown-body article-content">/);
  assert.match(html, /<h2>连接链路<\/h2>/);
  assert.match(html, /<pre><code class="language-bash">/);
  assert.doesNotMatch(html, /All writing|back-link/);
});


test("renders the cross-device project routing article", async () => {
  const slug = encodeURIComponent("我给AI搭了一个跨设备项目路由层");
  const response = await render(`/posts/${slug}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>我给 AI 搭了一个跨设备项目路由层<\/h1>/);
  assert.match(html, /<h2>真正麻烦的是：AI 应该去哪里写<\/h2>/);
  assert.match(html, /PROJECTS\.md/);
});

test("filters articles by keyword and tag", async () => {
  const keywordResponse = await render("/search?q=AgentDock");
  const keywordHtml = await keywordResponse.text();
  assert.equal(keywordResponse.status, 200);
  assert.match(keywordHtml, /让网页版 GPT 控制自己的电脑/);

  const tagResponse = await render("/search?tag=MCP");
  const tagHtml = await tagResponse.text();
  assert.equal(tagResponse.status, 200);
  assert.match(tagHtml, /#MCP/);
  assert.match(tagHtml, /让网页版 GPT 控制自己的电脑/);
});

test("renders About from Markdown at the About route", async () => {
  const response = await render("/about");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>About<\/h1>/);
  assert.match(html, /你好，我是 Meng。/);
  assert.match(html, /<article class="markdown-body article-content">/);
});


test("persists atomic article counts and rejects invalid writes", async () => {
  const path = `/api/views/${encodeURIComponent("我给AI搭了一个跨设备项目路由层")}`;
  const read = () => worker.fetch(path).then((r) => r.json());
  assert.deepEqual(await read(), { views: 0 });
  const origin = `http://${worker.address}:${worker.port}`;
  const results = await Promise.all(Array.from({ length: 10 }, () =>
    fetch(`${origin}${path}`, { method: "POST", headers: { origin } })));
  assert.ok(results.every((r) => r.status === 200));
  assert.deepEqual(await read(), { views: 10 });
  assert.deepEqual(await read(), { views: 10 });
  assert.equal((await worker.fetch(path, { method: "POST", headers: { origin: "https://other.example" } })).status, 403);
  assert.equal((await fetch(`${origin}/api/views/missing`, { method: "POST", headers: { origin } })).status, 404);
  assert.deepEqual(await read(), { views: 10 });
});
