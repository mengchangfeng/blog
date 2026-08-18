---
title: 让 GPT 按计划自动推进项目：任务板 + 定时任务的开发工作流
date: 2026-08-18
description: 把 Roadmap、Task Board、Git、测试和 Decision Inbox 组合起来，让 GPT 按项目真实状态定时领取任务、开发、验收、集成并自动继续推进。
tags: [ChatGPT, AI Agent, 自动化开发, Git, 项目管理]
---

## 我想解决的不是“让 GPT 每小时写一次代码”

最近我在尝试一件事：**把一个项目规划好以后，不再每次手动告诉 GPT“下一步做什么”，而是让它按照任务板和项目状态，定时继续往前开发。**

我现在的 Episode 项目已经开始这么跑了。

最开始看起来，这件事似乎只需要一个定时任务：

```text
每小时继续开发这个项目。
```

但真正跑起来以后，很快会发现问题不在“怎么定时调用 GPT”，而在于：

- GPT 怎么知道项目现在做到哪里？
- 上一轮有没有做到一半的任务？
- 哪些任务现在真的可以开始？
- 某个 Task 是“代码写了”，还是已经测试并合入 main？
- 我自己或者另一个 Agent 正在修改同一个项目怎么办？
- 遇到产品方向和架构选择时，GPT 应该自己做决定，还是停下来问我？
- 下一次定时任务启动时，应该相信聊天记忆，还是重新读取项目状态？

所以最后真正做的并不是“给 GPT 加一个闹钟”，而是先把项目整理成一个 **GPT 随时可以接手、随时可以恢复、知道什么时候该继续、什么时候必须停止的系统**。

现在的工作流大概是：

```text
我负责：
需求 / 产品方向 / 重大架构决策

GPT 负责：
规划
↓
拆 Task
↓
任务板
↓
定时领取任务
↓
独立开发
↓
测试
↓
Git 提交
↓
集成 main
↓
更新项目状态
↓
继续下一 Task
```

## 第一步：不再把聊天记录当项目状态

普通的 GPT 开发方式经常是：

```text
我：继续开发。
GPT：好的，我先看看项目……
```

做完一轮，过几个小时回来：

```text
我：继续。
```

然后模型重新回忆或者推断：

- 上次做到哪了；
- 哪些东西已经完成；
- 下一步是什么；
- 当前路线有没有改过；
- 有没有其他 Agent 正在处理某个任务。

短任务问题不大，但项目持续几天、几周以后，让模型从几十轮聊天里猜“现在应该做什么”，本身就是一个很危险的设计。

所以我现在给定时任务的一条核心规则是：

> 始终以项目文档和当前 Git 状态为事实来源，不依赖聊天上下文或上一次运行的记忆。

也就是说，聊天可以用来讨论，但**不能成为项目的数据库**。

Episode 目前用几份职责明确的文档保存状态：

```text
AGENTS.md
README.md
docs/status.md
docs/roadmap.md
docs/task-board.md
docs/needs-decision.md
```

其中最关键的是四份：

```text
docs/status.md          当前真实产品状态 / 当前阶段
docs/roadmap.md         阶段顺序 / 阶段目标
docs/task-board.md      当前阶段的具体任务 / Owner / 依赖 / 合并状态
docs/needs-decision.md  等待我决定、会阻塞开发的问题
```

这几份文档彼此不抢职责。

## `status.md`：项目现在到底在哪里

`status.md` 只回答一个问题：

> **当前真实状态是什么？**

例如 Episode 目前是：

```text
P0-P3  validated prototypes
R1     Core Reset                 NEXT
```

里面会记录当前已经建立了哪些核心能力、现在唯一 READY 的任务是什么、测试基线如何，以及当前不能继续做哪些远期内容。

它不会承担完整未来规划，也不会堆满所有历史 TODO。

这样任何一个新的 Agent 进入项目时，都可以先快速获得一个“现在”的快照。

## `roadmap.md`：大的开发顺序

另一个文档 `roadmap.md` 负责更长期的阶段顺序。

Episode 当前主路线大致是：

```text
R1  Core Reset
R2  Learner Model: Evidence + KnowledgeState
R3  Batch AI Knowledge + Explicit Practice
R4  Assistance Engine
R5  Episode Source + Desktop Complete Validation
R6  Sync Foundation + Server MVP
R7  Mobile
R8  Mobile / Content Expansion
R9  Browser Extension + Web/PWA
...
```

它回答的是：

> **项目大的推进顺序是什么？**

这和 `status.md` 必须分开。

否则很容易出现一份 README 同时维护今天的进度、下一周计划、半年后的构想和几次历史讨论结果。最后人看不懂，Agent 更难可靠判断。

## 第二步：Roadmap 不能直接拿来开发，要继续拆成 Task

只有 Roadmap 还是不够。

比如：

```text
R1：重构 Language Core
```

对人来说大概能理解，但对一个要自动执行的 Agent 来说，范围还是太大。

它很容易一次修改几十个文件，最后得到一个“看起来完成了，但不知道完成到什么程度”的巨型提交。

所以我增加了一份真正用于执行的：

```text
docs/task-board.md
```

当前 R1 已经被拆成：

```text
R1-01  建立跨来源 Core contracts             DONE
R1-02  建立 generic Application ports        DONE
R1-03  Episode Source 从 Core 抽离            DONE
R1-04  Language Core SQLite                  IN_PROGRESS
R1-05  Generic LearningClient                DONE
R1-06  删除 legacy 主链                     BLOCKED
R1-07  R1 集成验收                          BLOCKED
```

定时 Agent 当前正在做的是一个明确的：

```text
R1-04
```

而不是“继续重构”。

每个 Task 都会带这些信息：

```text
ID
Task
Status
Owner
Depends On
Allowed Paths
Acceptance
```

例如 R1-04 的边界大致是：

```text
Task:
新 Language Core SQLite 与 ContentRepository

Depends On:
R1-02

Allowed Paths:
packages/application/src/content.ts
adapters/node-sqlite/src/language-store.ts
对应 tests / exports

Acceptance:
Source → Segment → Encounter 外键与同源校验正确
Interaction append-only
重复事实不可变
数据库 reopen 正常
排序 / JSON / lookup 测试通过
```

这样 Agent 拿到的不是一句模糊需求，而是一张施工单。

## Task Board 最重要的不是 TODO，而是依赖关系

我以前也经常让 AI 写 TODO List。

后来发现，TODO List 和可以自动执行的 Task Board 差别很大。

真正决定 Agent 能不能自动往前走的，是：

```text
Depends On
```

比如：

```text
R1-04
  ↓
R1-06
  ↓
R1-07
  ↓
R2-01
```

这意味着即使 GPT 很想提前开始 R2，也不能做。

因为：

```text
R2-01 Depends On R1-07
```

而 R1-07 还没有完成。

于是开发过程从：

> GPT 猜下一步应该干什么

变成：

> GPT 根据确定的依赖图判断当前哪些任务允许执行。

这对定时执行尤其重要。

**没有依赖关系的定时 Agent，很容易变成每小时自动制造技术债。**

## 第三步：一个 Task 对应一个 Branch、Worktree 和 Owner

开始让 Agent 自动工作以后，很快还会遇到另一个问题：

> 如果我自己或者另外一个 Agent 此时也在开发怎么办？

Episode 现在规定：

```text
一个 Task
=
一个 Branch
+
一个 Worktree
+
一个 Owner
```

比如当前实际存在：

```text
main

codex/r1-04-language-core-sqlite
└── /Users/.../episode-learning-r1-04
```

定时 Agent 不允许直接在 main 上开发。

标准流程变成：

```text
最新 main
   ↓
创建 Task branch / worktree
   ↓
开发
   ↓
测试
   ↓
commit
   ↓
Integrator 验收
   ↓
merge main
   ↓
main 再测试一次
   ↓
Task DONE
```

这里有一个很关键的定义：

> **代码写完不等于 Task DONE。**

至少需要：

```text
实现完成
+ 自动化测试通过
+ Git commit
+ 集成 main
+ main 再次验收通过
```

任务才真正完成。

否则下一次定时任务很可能建立在一个“上一轮 Agent 以为已经完成、实际还没有进入主线”的状态上。

## 第四步：Scheduled Developer 还必须兼任 Integrator

如果只有自动写代码，其实还是不够。

Worker 很容易出现这种结果：

```text
我的 Task 测试通过了。
```

但是一合进 main：

```text
炸了。
```

所以我现在给定时任务的角色不是单纯 Developer，而是：

```text
Scheduled Developer + Integrator
```

一个 Task 完成以后，它还必须继续完成：

1. 检查 diff 是否超出 Task scope；
2. 执行任务要求的测试；
3. 提交 Task branch；
4. 按 Integrator 流程集成 main；
5. 在 main 再跑一次必要验收；
6. 只有 main 通过后才能把 Task 标记为 DONE；
7. 清理完成的 worktree / branch；
8. 解锁依赖这个 Task 的后续任务。

更重要的是，完成一个 Task 后，它不会凭刚刚的上下文直接冲向下一个任务。

我要求它重新读取：

```text
docs/task-board.md
docs/status.md
docs/roadmap.md
docs/needs-decision.md

git status
git worktree list
main HEAD
```

然后重新判断：

- 有没有自己需要恢复的任务；
- 有没有新的 READY Task；
- 有没有其他 Agent 刚刚领取了任务；
- 依赖关系有没有变化；
- 下一个任务会不会发生冲突。

这个设计实际上是在故意削弱模型的“连续记忆”。

因为对于工程项目来说：

> **重新读取磁盘上的事实，通常比相信上一轮 Agent 的记忆可靠。**

## 第五步：最后才给它加定时任务

前面的状态、任务、依赖、Git 和验收都建立好以后，定时任务反而只是最后很薄的一层。

我目前给 Episode 设置的是：

```text
每小时执行一次
```

每次唤醒之后，Scheduled Developer 首先阅读：

```text
AGENTS.md
status.md
roadmap.md
task-board.md
needs-decision.md
当前阶段 / 当前 Task 的相关文档
```

然后检查：

```text
git status
git worktree list
main HEAD
```

接着按照固定优先级寻找工作。

```text
1. scheduled-agent 有没有 IN_PROGRESS / REVIEW 任务？
   → 优先恢复

2. 有没有 BLOCKED 任务，而且阻塞条件已经解除？
   → 可以恢复

3. 没有可恢复任务时，有没有 READY Task？
   → 领取

4. 都没有？
   → 如果当前阶段目标已经足够明确，可以继续拆出下一批小 Task

5. 如果下一步需要新的产品 / 架构决策？
   → 停止，不自行扩展
```

每一轮最多处理 3 个 Task ID。

这个限制不是因为 Agent 一次只能做三个任务，而是为了避免一次定时执行范围无限扩张。

## 我最关心的其实是：什么时候必须停下来

一开始我最担心的并不是 GPT 不够自动。

反而是：

> **它太自动。**

例如项目做到某一步突然出现两个都合理的方案：

```text
方案 A：
local-first + event sync

方案 B：
Server authoritative
```

如果 Agent 自己觉得 B 更先进，然后凌晨三点顺手把架构改了，第二天起来项目路线可能已经完全变了。

所以我又增加了一份：

```text
docs/needs-decision.md
```

它相当于：

> **Agent → 人类的 Decision Inbox**

只有这些问题才允许进入这里：

- 产品行为需要重新决定；
- Core Domain 边界发生变化；
- 有多个合理的重大架构方案；
- 当前 spec / architecture 无法推出答案；
- 继续开发意味着 Agent 实际上在替我做重大决策。

例如：

```text
ND-001 — 是否将同步模型改为 Server authoritative

Related Task:
R6-02

方案 A：
Local-first + event sync

方案 B：
Server authoritative

Agent 推荐：
A

Decision:
等待用户
```

同时对应 Task 会变成：

```text
R6-02 → BLOCKED
```

定时任务到这里就结束。

等我回来做决定。

也就是说，我想实现的并不是：

> AI 可以完全不需要我。

而是：

> **只有真正需要我做决定的时候，它才停下来找我。**

这两者差别很大。

## 人的工作开始从“催下一步”变成“处理不确定性”

以前我的开发循环更像：

```text
想到功能
↓
告诉 GPT
↓
GPT 写
↓
我告诉 GPT 下一步
↓
继续
```

现在慢慢变成：

```text
我：
决定产品目标
决定重要架构
调整 Roadmap
处理 needs-decision

GPT：
拆任务
实现
测试
提交
集成
维护项目状态
继续执行已经确定的计划
```

我开始越来越少需要说：

```text
继续开发。
```

理论上，只要：

```text
Roadmap 足够明确
Task 可以执行
Acceptance 可以验证
没有需要人类决策的问题
```

项目就能沿着已经确定的方向自己继续往前走。

## 这套东西本质上是一个状态机

如果把各种 Agent 概念都去掉，整个系统其实非常朴素。

Task 只有几个主要状态：

```text
BACKLOG
   ↓
READY
   ↓
IN_PROGRESS
   ↓
REVIEW
   ↓
DONE
```

异常情况：

```text
IN_PROGRESS
   ↓
BLOCKED
   ↓
等待依赖 / 等待人类 Decision
   ↓
恢复执行
```

定时任务只是在：

```text
每小时触发一次状态机
```

GPT 根据项目当前状态决定这一次允许发生什么状态转移。

所以我现在觉得，所谓“让 AI 自动开发一个项目”，核心并不是设计一个特别聪明的 Prompt。

更重要的是先设计好：

```text
State
Transition
Constraint
Acceptance
Recovery
```

也就是：

**状态、状态转移、约束、验收、恢复。**

## 为什么我反而希望 Agent 少依赖记忆

现在定时 Prompt 里有两条我觉得很重要的约束：

> 始终以项目文档和当前 Git 状态为事实来源，不依赖聊天上下文或上一次运行的记忆。

以及：

> 不要凭上一个任务的上下文直接领取下一个任务。

这看起来好像有点反直觉。

我们一直希望 AI 拥有更长的上下文、更强的记忆。

但在软件工程里，我现在反而希望：

```text
Memory        → 尽量少依赖
Project State → 尽量明确
```

因为真正可靠的是：

```text
Git commit
Task status
Tests
Architecture docs
Acceptance criteria
```

而不是：

> “我记得上一轮好像已经改过这个东西。”

这和人类开发其实也是一样的。

一个半年没有参与项目的人，如果只需要：

```text
git clone
↓
读 AGENTS
↓
读 status
↓
读 roadmap
↓
读 task-board
```

就能很快接手，本身就说明项目状态维护得比较健康。

Agent 只是把这个要求进一步放大了。

## Episode 当前实际跑到了哪里

现在这套流程已经不是纸面设计。

当前 R1 的任务板实际是：

```text
R1-01  DONE
R1-02  DONE
R1-03  DONE
R1-04  IN_PROGRESS
R1-05  DONE
R1-06  BLOCKED
R1-07  BLOCKED
```

定时 Agent 当前拥有：

```text
R1-04
```

并且已经建立对应的独立 worktree。

R1-04 完成并进入 main 后，后续依赖任务才会逐渐解除。

R1 全部验收完成以后：

```text
R2 Evidence / KnowledgeState
```

才会真正开始。

如果中途碰到需要重新决定产品或者架构的问题，它不会自己选一个方向继续冲，而是把问题写进：

```text
needs-decision.md
```

然后停止。

这基本就是我现在想要的自动开发形态。

## 我现在对“AI 自动编程”的理解也变了

以前看到 Autonomous Coding Agent，我首先想到的是：

> 给它一个需求，它自己把整个软件写出来。

现在我觉得，更现实也更有价值的形态可能是：

```text
人把方向规划清楚
↓
AI 把确定性的工程工作持续推进
↓
碰到真正的不确定性再把控制权交还给人
```

并不需要一次让 Agent 独立完成整个项目。

如果每天有十几个小时我根本不在电脑前，而任务板里恰好还有大量：

```text
目标明确
依赖明确
接口明确
验收明确
```

的工程任务，那么这些时间完全可以利用起来。

比如某一轮处理实现，下一轮完成测试和集成，再下一轮领取刚解锁的后续任务。

如果顺利，它继续。

如果遇到：

```text
ND-003
需要重新决定某个 Domain 行为
```

它就停在那里。

第二天我打开项目，不需要先翻十几段 Agent 对话。

只需要看：

```text
status.md
task-board.md
needs-decision.md
git log
```

就知道发生了什么。

## 最后：自动化的前提不是 Agent 更聪明，而是项目更结构化

这段时间最大的感受是：

**想让 GPT 长期自动工作，首先要做的不是继续增强 Prompt，而是把项目整理成机器可以可靠读取的形状。**

也就是把那些以前只存在开发者脑子里的东西：

```text
现在做到哪了
下一步是什么
哪个任务依赖哪个任务
什么算完成
哪些文件不能碰
什么时候应该问我
```

全部显式化。

一旦这些信息真正存在项目里：

```text
Roadmap
+
Task Board
+
Git
+
Tests
+
Docs
+
Decision Inbox
```

定时任务其实只是最后很薄的一层。

它只是每隔一段时间回来问一句：

> **按照当前项目真实状态，现在有没有一件确定可以继续做的事情？**

有，就做。

没有，就停。

需要人决定，就留下问题。

然后等下一次唤醒。

这可能才是我目前见过最接近“项目自己往前推进”的开发方式。
