import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the article list homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Meng — Writing<\/title>/i);
  assert.match(html, /让网页版 GPT 控制自己的电脑/);
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
  assert.match(html, /<h2>“无限 token”到底是什么意思<\/h2>/);
  assert.match(html, /<pre><code class="language-bash">/);
  assert.doesNotMatch(html, /All writing|back-link/);
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
