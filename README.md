# Meng Blog

个人博客内容仓。

## 内容目录

- `content/*.md`：网站公开文章，按 frontmatter 构建页面。
- `写作风格.md`：博客文章共同遵循的写作风格。

## 开发

本项目基于 vinext、Cloudflare 与 Markdown 内容构建。

The site runs on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

`wrangler.jsonc` 定义 Worker 入口，本地 D1 绑定由 `vite.config.ts` 注入。

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## 文章点击数

文章详情在浏览器加载后通过 POST 计数一次，刷新或重新打开会再次计数；列表和搜索仅通过 GET 读取。计数是页面浏览次数，不是独立访客数，历史访问不回填。服务端校验文章存在和同源请求，使用 D1 原子递增；未连接数据库或请求失败时显示 `— 次点击`，不影响阅读。

`.openai/hosting.json` 已启用 `DB`，迁移在 `drizzle/`，构建会打包进 `dist/.openai/` 供 Sites 部署应用。Git 推送本身不代表数据库已经部署。使用独立 Cloudflare 部署时，需要绑定真实 D1 数据库并先应用迁移，不能使用本地占位数据库 ID。

本地初始化（先执行 `npm run build`）：

```bash
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --file drizzle/0000_loud_siren.sql
npm run dev
```

`npm test` 在本地 Worker / D1 环境中验证页面渲染、并发计数、只读请求和无效写入；测试使用独立临时数据库。
