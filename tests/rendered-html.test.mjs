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
  assert.match(html, /把复杂的事，讲清楚/);
  assert.doesNotMatch(html, /WRITING \/ ALL NOTES/);
  assert.match(html, /搜索文章/);
  assert.match(html, /search\?tag=/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("renders a Markdown article", async () => {
  const response = await render("/posts/%E6%8A%8A%E5%A4%8D%E6%9D%82%E7%9A%84%E4%BA%8B%E8%AE%B2%E6%B8%85%E6%A5%9A");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<article class="markdown-body article-content">/);
  assert.match(html, /<h2>先建立一张地图<\/h2>/);
  assert.match(html, /<pre><code class="language-ts">/);
  assert.doesNotMatch(html, /All writing|back-link/);
});

test("filters articles by keyword and tag", async () => {
  const keywordResponse = await render("/search?q=Markdown");
  const keywordHtml = await keywordResponse.text();
  assert.equal(keywordResponse.status, 200);
  assert.match(keywordHtml, /没有找到相关文章|搜索：Markdown/);

  const tagResponse = await render("/search?tag=%E9%9A%8F%E7%AC%94");
  const tagHtml = await tagResponse.text();
  assert.equal(tagResponse.status, 200);
  assert.match(tagHtml, /#随笔/);
  assert.match(tagHtml, /把复杂的事，讲清楚/);
  assert.match(tagHtml, /安静地做事，也是一种生产力/);
});

test("renders About from Markdown at the About route", async () => {
  const response = await render("/about");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>About<\/h1>/);
  assert.match(html, /你好，我是 Meng。/);
  assert.match(html, /<article class="markdown-body article-content">/);
});
