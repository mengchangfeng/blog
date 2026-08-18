---
title: 让 GPT 按任务板继续开发：我的定时开发工作流
date: 2026-08-18
description: 我给 Episode 项目加了一套基于项目文档、Task Board、Git worktree 和定时任务的开发流程，让 GPT 能按项目真实状态继续开发，而不是每次等我说“下一步”。
tags: [ChatGPT, AI Agent, 自动化开发, Git, 项目管理]
---

## 我想解决的问题

最近我在开发 Episode，一个用来看剧学英语的项目。

我平时的开发方式基本是：和 GPT 讨论需求，让它改代码，做完以后再告诉它下一步做什么。

项目小的时候没什么问题。项目变大以后，我发现自己花了不少时间在重复一件事：

```text
继续开发。
```

于是我想试试另一种方式：项目路线确定以后，让 GPT 每小时回来一次，自己读取项目状态，找到当前能做的任务，继续开发。

定时调用 GPT 很简单。真正麻烦的是另外几个问题：

```text
现在做到哪里？
上一个任务做完了吗？
哪个任务现在可以开始？
另一个 Agent 有没有正在改同一块代码？
什么情况下应该停下来问我？
```

这些问题如果靠聊天记录解决，跑几轮以后就很容易乱。

所以我最后做的事情不是写一个很复杂的 Prompt，而是先把项目状态整理清楚。

## 不让聊天记录保存项目状态

Episode 现在主要用这些文件：

```text
AGENTS.md
README.md
docs/status.md
docs/roadmap.md
docs/task-board.md
docs/needs-decision.md
```

其中四份文件各管一件事：

```text
status.md          项目现在做到哪里
roadmap.md         后面按什么顺序做
task-board.md      当前有哪些具体任务可以执行
needs-decision.md  哪些问题需要我决定
```

定时 Agent 每次启动都重新读这些文件，再检查 Git。

我给它的规则很简单：

> 项目文档和当前 Git 状态是事实来源，不依赖聊天上下文，也不依赖上一次运行的记忆。

这条规则后来比我想象中重要。

Agent 很容易记得“我刚刚已经做完了”，但工程上真正有用的是：代码有没有 commit，任务有没有 merge，main 上的测试有没有通过。

## Roadmap 不能直接拿来开发

Roadmap 里的任务通常还是太大。

例如：

```text
R2  Evidence + KnowledgeState
```

人看到这句话大概知道下一阶段要做什么，但让 Agent 直接执行就太模糊了。

所以真正执行的是 `task-board.md`。

Episode 当前的 R2 被拆成：

```text
R2-01  Evidence / KnowledgeState contracts 与纯 projector      READY
R2-02  Interaction → Evidence 与重算 / 查询 use cases          BLOCKED
R2-03  Evidence / KnowledgeState SQLite                         BLOCKED
R2-04  LearningClient 接线与 R2 验收                            BLOCKED
```

`R2-02` 依赖 `R2-01`，所以 R2-01 没有完成以前，Agent 不能提前去做 R2-02。

每个 Task 还会写清楚：

```text
ID
Status
Owner
Depends On
Allowed Paths
Acceptance
```

例如一个任务只能修改哪些目录、需要通过哪些测试、什么结果才算完成，都直接放在任务板里。

这样定时任务不需要自己猜“下一步是什么”。它只需要找当前依赖已经满足的 READY Task。

## 一个 Task 一个 worktree

项目开始允许多个 Agent 工作以后，还有一个问题：不能让所有人都直接在 main 上改。

现在的规则是：

```text
一个 Task
=
一个 Owner
+
一个 Branch
+
一个 Worktree
```

Worker 只在自己的 worktree 里开发。

流程是：

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
Integrator review
↓
merge main
↓
main 再测试
↓
Task DONE
```

这里我专门把 `DONE` 定义得比较严格。

代码写完不算 DONE，单独 worktree 里的测试通过也不算。

至少要满足：

```text
实现完成
测试通过
Git commit
合入 main
main 验收通过
```

否则下一轮 Agent 可能会把一个还没真正进入主线的任务当成依赖继续往下做。

## 每小时醒来以后做什么

项目状态整理好以后，定时任务本身反而很简单。

我现在让 Scheduled Developer + Integrator 每小时执行一次。

每轮先读：

```text
AGENTS.md
status.md
roadmap.md
task-board.md
needs-decision.md
当前 Task 需要的相关文档
```

然后检查：

```text
git status
git worktree list
main HEAD
```

任务领取顺序固定：

```text
1. 先恢复 Owner 是 scheduled-agent 的 IN_PROGRESS / REVIEW 任务
2. BLOCKED 任务只有阻塞解除以后才恢复
3. 没有可恢复任务，再领取 READY Task
4. 不领取已有其他 Owner 的任务
5. 不处理依赖没有完成的任务
6. 如果会和其他 Agent 当前工作明显冲突，就停止
```

一轮最多顺序处理 3 个 Task ID。

每完成一个 Task，不直接凭刚才的上下文继续往下冲，而是重新读取 task-board 和 Git 状态，再决定下一个任务。

这一点看起来有点笨，但很稳定。

## 需要做决定的时候就停

我不希望 Agent 在所有情况下都自动继续。

有些事情本来就应该由我决定，例如：

```text
产品行为要不要改变
Domain 边界要不要调整
两个架构方案都合理
现有 spec 无法推出唯一答案
继续开发会实际改变项目方向
```

这种问题写进：

```text
docs/needs-decision.md
```

对应 Task 标成 `BLOCKED`。

例如：

```text
ND-001
是否把同步模型改成 Server authoritative？

方案 A：local-first + event sync
方案 B：server authoritative

Agent 推荐：A
Decision：等待用户
```

定时任务看到这里就停。

我回来以后只需要处理真正需要判断的事情，不需要再手动告诉它“现在继续写 R2-02”。

## 现在跑到哪里

这套流程目前已经在 Episode 里实际使用。

R1 Core Reset 的任务已经全部完成并通过阶段验收：

```text
R1-01  DONE
R1-02  DONE
R1-03  DONE
R1-04  DONE
R1-05  DONE
R1-06  DONE
R1-07  DONE
```

项目现在进入 R2，当前唯一 READY 的任务是：

```text
R2-01  Evidence / KnowledgeState contracts 与纯 projector
```

后面的 R2-02、R2-03、R2-04 还在等前置任务完成。

这也是我想要的效果：Agent 不需要知道我昨天和它聊了什么，只要打开项目，就能知道现在应该做 R2-01，而不是 R1，也不是提前跑去做 R3。

## 定时任务其实是最后一层

现在回头看，这套工作流里最简单的部分反而是“每小时运行一次 GPT”。

真正让它能持续工作的，是这些东西：

```text
Roadmap
Task Board
Owner
Dependencies
Git / Worktree
Tests
Acceptance
Decision Inbox
```

这些信息明确以后，定时 Agent 每次只需要回答一个问题：

> 按照项目现在的真实状态，有没有一个已经确定、现在可以继续做的任务？

有就做。

没有就停。

需要我决定，就把问题留下来。

我现在更愿意把它理解成：不是让 AI 自己决定怎么做一个项目，而是让 AI 持续执行已经决定好的工程工作。
