---
title: 我给 AI 搭了一个跨设备项目路由层
date: 2026-09-08
description: 从服务器随手记录目录开始，我用 Git、PROJECTS.md、AGENTS.md、MCP 和 Codex 把 Mac 与常驻服务器接成跨设备项目路由，并为 Windows GPU 节点预留执行入口。
tags: [ChatGPT, AI Agent, Codex, MCP, Git, 多设备开发]
---

## 真正麻烦的是：AI 应该去哪里写

最近我一直在用网页版 GPT，通过 MCP 控制自己的 Mac 和云服务器，也把 Windows GPU 节点放进同一套设备规划里。

做到后面，我发现最麻烦的问题已经不是“AI 会不会写代码”。

真正麻烦的是：

> 它应该去哪里写？

我的 Mac 上有四十多个项目和资料目录。Episode 有主仓，也有几个专项 worktree，还有一整个参考源码目录。答疑 Agent、选型助手、AgentDock、少儿编程课程又分别在不同仓库里。

如果我只说一句：

> 修复 B 站视频 transcript 点击以后不能跳转的问题。

AI 应该自己知道这是 Episode，应该进入 `episode-learning`，而不是 `episode-design-references`，也不是一个已经结束的 TMDB worktree。

但如果我说：

> 检查 Episode 公网 healthz 和 API 连通性。

项目还是 Episode，执行设备却应该变成服务器。

再比如跑 faster-whisper、CUDA 或 Windows Worker，项目没有变，设备又应该切到那台 4070 Windows 电脑。

所以我最近做的这套东西，本质上不是一个笔记软件，也不是一个任务板。

它是一个很小的项目路由层。

这篇记录一下，它是怎么从“服务器上放个随手记录目录”，慢慢变成一个跨设备项目路由层的。

## 最开始只是想在服务器上随手记点东西

一开始的需求很简单。

服务器一直在线，我想在上面放一个目录，平时想到什么就先记下来。有些很小的技术问题，也可以顺手让 Codex 验证一下。

第一版目录大概是这样：

```text
workspace/
├── inbox/
├── ideas/
├── experiments/
├── notes/
├── snippets/
└── AGENTS.md
```

我还在服务器上装了 Codex CLI，通过设备授权登录 ChatGPT。这样网页版 GPT 可以经过服务器 MCP 调用：

```text
ChatGPT
  ↓
服务器 MCP
  ↓
codex exec
  ↓
workspace
```

这套东西很快就跑通了。

问题也很快出现了。

我的想法不是只在服务器上产生。Mac 是主开发机，Windows 跑 GPU 和 Worker，手机上也可能临时记一句。如果每台设备都建自己的 inbox，最后就会有三套记录。

而且我发现，把“记录想法”和“做实验”放在同一个仓里，会让边界越来越模糊。

今天在 `idea` 下面写一个 Python 文件验证接口，明天再放一个小前端。过一阵子，这个随手记录目录就会悄悄长成第二个开发目录。

这不是我想要的。

真实项目已经有自己的 README、架构、进度、测试和 Git 历史。一个想法仓不应该再复制一套。

所以我把第一版服务器 workspace 退役了。

历史没有删，只是不再往里面放新东西。

## 把 idea 变成 control plane

新的 `idea` 是一个独立的私有 Git 仓。

Mac 上是：

```text
/Users/mengchangfeng/project/idea
```

服务器上是：

```text
/srv/agentdock/project/idea
```

Windows 后面恢复连接以后也会 clone 同一个仓。

这个仓只做四件事：

```text
记录
整理
归档
路由
```

不写产品代码，不放 Demo，不做 PoC，也不维护真实项目的第二份技术文档。

目录很简单：

```text
idea/
├── inbox/
├── ideas/
├── archive/
├── docs/devices/
├── PROJECTS.md
├── AGENTS.md
└── tools/capture.py
```

这里最关键的不是目录，而是边界。

当我说“记录一下”，内容进入 `idea`。

当我说“开始做”“验证一下”“修复这个问题”，工作立刻离开 `idea`，进入真实项目。

也就是说：

```text
idea 是控制面
项目仓是执行面
```

这个区分解决了很多问题。

服务器可以一直在线帮我记录、整理、判断项目归属，但不会因为它方便，就在一个临时目录里长出新的产品实现。

## 一条想法一个文件

跨设备以后，Git 冲突是一个很现实的问题。

最直觉的做法是每个月一个文件：

```text
inbox/2026-09.md
```

Mac、Windows、服务器都往这个文件追加。

单设备很好用，多设备就不太稳。两台机器如果同时追加，下一次 pull 很容易在文件尾部产生冲突。

最后我改成一条想法一个文件：

```text
inbox/2026-09/
├── 20260908-204000-000000-server.md
├── 20260909-091523-123456-mac.md
└── 20260909-101102-654321-win.md
```

文件里只保留时间、设备、状态和原始内容：

```yaml
---
timestamp: 2026-09-08T21:20:05.876398+08:00
device: server
status: raw
---
```

不同设备大多数时候只是新增不同文件，Git 不需要合并同一段文本。

记录命令也很小：

```bash
python3 tools/capture.py "想到的内容"
```

写入前 pull，写入后 commit、push。

服务器没有保存我的完整 GitHub 凭证，只给 `idea` 这个私有仓配了一把 repo-scoped deploy key。它只对这个仓有读写权限。

服务器还保留了一份 bare mirror，用来本地恢复，但跨设备的权威 remote 仍然是 GitHub。

这部分没有数据库，也没有同步服务。

Git 就够了。

## PROJECTS.md 负责回答“这是什么项目”

记录同步以后，下一个问题是项目识别。

我在 `idea` 里放了一个 `PROJECTS.md`，Mac 和服务器的项目根目录都建立固定入口：

```text
project/PROJECTS.md -> idea/PROJECTS.md
```

这个文件不是简单的目录清单。

它会记录：

```text
canonical project
项目链接
职责和自然语言关键词
每台设备上的 checkout
更适合在哪台设备执行
主仓、worktree、参考源码和生产部署的边界
```

例如 Episode 会命中这些描述：播放器、字幕、B 站、YouTube、TED、ASR、CTC、词典、学习卡片、TMDB、登录、跨端。

答疑 Agent 会命中：DFRobot、FAQ、产品参数、兼容性、知识图谱、RuleChecker、Knowledge API。

当我没有说项目名时，Agent 先读这个索引，而不是靠聊天记忆猜。

但是一旦路由完成，`PROJECTS.md` 就失去优先级。

Agent 必须进入真实项目，再读那个项目自己的：

```text
AGENTS.md
README.md
architecture
progress
spec
```

索引只负责带路，不负责描述项目内部真相。

## 项目和设备要分两次判断

这是整套系统里我最喜欢的一点。

以前我容易把“项目在哪里”和“任务在哪做”混成一件事。

实际上它们是两个问题：

```text
用户需求
  ↓
属于哪个 canonical project？
  ↓
这类任务更适合哪台设备？
  ↓
那台设备有没有真实 checkout？
  ↓
进入项目，读取项目规则，开始工作
```

同一个 Episode，可以出现完全不同的执行路径。

修复 Mac 播放器交互：

```text
Episode → Mac
```

检查公网 API：

```text
Episode → Server
```

跑 CUDA ASR 基准：

```text
Episode → Windows
```

我做过一次真实烟测，只给服务器 Codex 两句话，不提供项目名。

第一句是：

> 修复 B 站视频 transcript 点击后不能跳转。

它返回：

```text
project=Episode; device=Mac
```

第二句是：

> 检查 Episode 公网 healthz 和 API 连通性。

它返回：

```text
project=Episode; device=Server
```

项目识别和设备选择都对了。

这比“所有事都去主开发机”更实用，也比“服务器一直在线，所以都在服务器做”更安全。

## AGENTS.md 把路由变成默认行为

只有一个索引文件还不够。

如果每次都要我提醒 Agent 先读它，这个系统很快就会失效。

所以我在 Codex 的全局规则里加了入口。

Mac 是：

```text
~/.codex/AGENTS.md
```

服务器也有自己的全局 `AGENTS.md`。

规则很直接：

```text
只记录
→ idea/inbox

开发、修复、验证
→ 先读 PROJECTS.md
→ 找 canonical project
→ 选设备
→ 进入真实 checkout
→ 再读项目级 AGENTS.md
```

这样我在任何目录启动 Codex，项目路由都不是临时 Prompt，而是持久规则。

同时，项目自己的 `AGENTS.md` 仍然拥有更具体的约束。

全局规则决定去哪里。

项目规则决定到了以后怎么干。

## 服务器一直在线，但不是万能开发机

服务器承担的工作现在很明确：

```text
随手记录
整理和归类
项目判断
纯文本和静态分析
无 GUI 小脚本
HTTP / API / 网络验证
Linux 服务和定时任务
```

但它不能直接在 `idea` 里写产品代码，也不能为了方便去改生产部署目录。

服务器要做真实项目开发，必须先有一个明确的开发 checkout，例如：

```text
/srv/agentdock/project/episode-learning
```

然后读这个 checkout 里的项目规则、改代码、跑测试、提交 Git。

如果 checkout 不存在，就路由回 Mac 或 Windows，或者先明确 provision 一份。

这个边界看起来有点严格，但很有用。

否则常驻服务器很容易因为“随手验证一下”，变成一个没人记得的分叉开发环境。

## Codex 是执行者，不是项目记忆

Mac 和服务器现在都装了 Codex CLI。

网页版 GPT 可以通过 MCP 调用：

```bash
codex exec -C <project-path> "任务"
```

我让 GPT 负责需求拆解、项目路由、设备选择和最终验收，Codex 负责在具体目录里读文件、改代码和跑命令。

这两层分开以后比较舒服。

Codex 不需要记住我所有项目，也不需要从几十个目录里自由发挥。它只要在已经选好的项目根目录里工作。

中间也踩了几个很具体的坑。

Mac 上 npm 安装看起来成功，但可执行入口缺了可选平台包。我最后用了 ChatGPT App 自带、签名验证通过的同版本 Codex 二进制，并补上 `codex-code-mode-host`。

服务器的记录脚本最初用了 `zoneinfo`，但那台机器还是 Python 3.8，直接报模块不存在。后来加了兼容逻辑，才在服务器真实跑通。

这些问题都不大，但它们说明了一件事：

“CLI 能启动”和“这台设备真的能参与工作流”不是一回事。

必须实际跑一次完整链路。

## 新项目现在会自动进入索引

系统搭好以后，我又发现一个很容易被忽略的问题。

项目索引如果靠我想起来再维护，迟早会过期。

所以现在增加了一条默认规则：

> 我只要贴入一个新的长期项目目录、Git 仓库 URL，或者明确说“这是一个新项目”，Agent 就先检查它，并自动在 `PROJECTS.md` 建立链接和路由条目。

登记时至少要写清楚：

```text
canonical name
canonical repository / local link
项目职责和自然语言关键词
Mac / Server / Windows 的实际 checkout
首选执行设备
它是主仓、worktree、参考源还是生产部署
```

如果我贴的只是一个第三方参考仓，就不能把它登记成主开发项目，而是放到只读来源里。

如果已经有同一个 canonical project，就更新原条目，不再造一个重复项目。

登记完成以后，`idea` 仓要 commit、push，让另外两台设备都能拿到新的路由。

这一步现在属于“接收新项目”的一部分，不再是以后有空再整理的文档工作。

## 我现在怎么用

日常使用已经很简单。

我说：

> 记录一下：Episode 可以考虑做双字幕版本比较。

系统只创建一条 idea 记录，不启动开发。

我接着说：

> 把刚才这个做个最小验证。

系统读取索引，判断属于 Episode，再根据验证内容选择 Mac、服务器或 Windows，进入真实项目。

我贴一个新仓库地址，说：

> 这个以后作为长期项目。

系统先读仓库的 README、AGENTS、Git remote 和分支，自动建立项目链接和关键词，再决定后续在哪台设备做。

我不用每次重复项目名，也不用记住每个 worktree 的路径。

## 这套系统不是什么

它不是 Notion 替代品。

不是完整项目管理系统。

不是把所有代码塞进一个 monorepo。

也不是一个“AI 永久记忆数据库”。

它只是把几个很容易出错的判断写进文件：

```text
这是什么
在哪里
去哪台设备
进入以后先读什么
```

这些信息用 Markdown 和 Git 保存，已经足够稳定。

Agent 可以忘记上一段对话，但下一次仍然能从同一个入口重新找到项目。

## 先保持小，先一直用

以前我更关注 Prompt 怎么写、模型选哪个、一个 Agent 能不能连续做很久。

多设备真正连起来以后，我开始更在意目录、边界和事实源。

AI 写错一段代码，通常还能通过测试发现。

AI 去错了项目、改了一个参考仓、在生产目录里顺手修了一下，后果反而更难追。

所以这套系统现在最重要的不是自动化程度，而是它把“去哪里工作”变成了一个可以检查、可以同步、可以版本化的决定。

目前 Mac 和服务器已经完整打通。Windows 的职责已经写进索引，第三端 clone 还要等连接恢复后完成。服务器上的真实项目 checkout 也会按需建立，不会一次性复制所有仓库。

先保持小，先一直用。

这比一开始就做一个复杂的个人 Agent 平台更适合我现在的状态。
