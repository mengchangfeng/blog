# 技术播客稿

这里保存技术播客的口播稿和 show notes，不直接参与博客网站的 `content/*.md` 构建。

## 当前稿件

- [我给 AI 搭了一个跨设备项目路由层](我给AI搭了一个跨设备项目路由层.md) — 2026-09-08，draft，约 20–25 分钟。

## 格式

每篇稿件使用 Markdown，frontmatter 至少包含：

```yaml
---
title: 标题
date: YYYY-MM-DD
description: 一句话简介
tags: [标签1, 标签2]
format: podcast-script
status: draft
duration: 预计时长
---
```

正文标题从 `##` 开始。写作风格继续遵循根目录 `写作风格.md`，但优先保证口播自然：短句、少列表、少书面套话，代码和路径只保留理解主线所需的部分。

如果一篇播客稿需要同时发布为网站文章，应在 `content/` 单独整理发布版，不让网站文章和口播稿长期共用同一文件。
