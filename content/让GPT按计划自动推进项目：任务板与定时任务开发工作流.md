---
title: 定时开发工作流：让 GPT 自己领任务继续开发
date: 2026-08-18
description: 用项目文档、任务板、Git worktree 和定时任务，让 GPT 从真实项目状态恢复工作、领取任务、开发、测试并完成验收。
tags: [ChatGPT, AI Agent, 自动化开发, Git, 项目管理]
---

这篇解决一个问题：

> 网页版 ChatGPT 已经能操作电脑以后，怎样让它每次重新开始时，都知道项目做到哪里、现在能做什么、什么才算完成。

完整、持续更新的教程、Prompt 和项目模板放在：

[GPT-TaskBoard](https://github.com/mengchangfeng/GPT-TaskBoard)

电脑 MCP 运行时使用 [AgentDock](https://github.com/uvwt/agentdock)。

如果 ChatGPT 还不能稳定读取电脑上的文件、Git 和命令，先完成上一篇 AgentDock MCP 连接教程。

## 最小闭环

整个流程可以先看成这样：

```text
读取项目文档 + Git
        ↓
恢复自己的未完成任务
        ↓ 没有可恢复任务
领取一个 READY Task
        ↓
独立 branch + worktree
        ↓
实现 / 测试 / 文档 / commit
        ↓
review + 合入 main
        ↓
main 重新验收
        ↓
Task → DONE
        ↓
重新读取项目状态
```

定时器只负责再次唤醒 Agent。

真正负责保存项目状态的是项目文档和 Git。

## 项目里先把这些信息写清楚

文件名不重要，但这些职责需要能被 Agent 找到：

```text
AGENTS.md           Agent 入口和协作规则
status / progress   当前做到哪里
roadmap             后面按什么顺序推进
task-board          当前有哪些可执行任务
needs-decision      哪些问题必须等人决定
spec / plan         复杂任务的边界和验收
```

已有项目如果已经有自己的 `progress`、`plan`、`spec`、ADR 或 Issue 系统，就直接复用。

不要为了套模板再造一套重复的事实来源。

核心规则只有一句：

> 项目文档和 Git 是事实来源，聊天记录不是。

## Task Board 负责告诉 Agent 现在能做什么

一个可执行 Task 至少要表达：

```text
ID
Task
Status
Owner
Depends On
Allowed Paths
Acceptance
```

状态可以保持很简单：

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

如果遇到真实阻塞：

```text
IN_PROGRESS / REVIEW
        ↓
     BLOCKED
        ↓ 恢复条件满足
IN_PROGRESS / REVIEW
```

`READY` 才表示当前可以领取。

`DONE` 也不是“代码写完了”，而是已经完成规定的集成和验收。

## 一个 Task 对应一个 branch 和 worktree

为了避免多个 Agent 或人工修改互相覆盖，我现在按这个粒度隔离：

```text
一个 Task
=
一个 Owner
+
一个 branch
+
一个 worktree
```

任务领取以后：

```text
领取 READY Task
↓
创建 branch / worktree
↓
开发
↓
测试
↓
commit
↓
review
↓
合入 main
↓
main 再验收
↓
DONE
```

业务实现不直接在 `main` 上开发。

一个任务结束以后，新任务基于最新 `main` 创建新的 branch/worktree，不复用旧工作区继续往下冲。

## 什么才算 DONE

默认至少包括：

```text
实现满足 Acceptance
+ 任务范围测试通过
+ 必要文档已同步
+ Task branch 已提交
+ review 通过
+ 已合入 main
+ main 必要验收通过
+ Task Board 与 Git 状态一致
```

所以：

```text
Agent 说写完了
```

不等于：

```text
Task DONE
```

阶段完成也一样。某阶段所有 Task DONE 后，还要重新执行阶段级构建、测试、文档和人工 Gate。

## 需要人决定的问题单独留下

产品行为、核心 Domain、重要架构、重大技术路线这类问题，不让 Agent 自己替人做决定。

遇到这种情况：

```text
创建 ND-xxx
↓
记录问题 / 方案 / 影响 / 推荐 / 恢复条件
↓
对应 Task → BLOCKED
↓
保存当前安全进度
↓
停止
```

普通 bug、局部实现细节和已有文档能推导出的选择，不需要进 Decision Inbox。

## 先手动跑通一个任务

不要一接入 Task Board 就立刻创建定时任务。

先选一个小 Task，完整跑一次：

```text
READY
↓
领取
↓
worktree
↓
实现
↓
测试
↓
commit
↓
review
↓
main
↓
DONE
```

这个闭环跑通以后，再加 Scheduler。

这样出现问题时容易知道是任务规则的问题，还是定时唤醒的问题。

## 再加定时任务

Scheduler 本身很简单。

它每隔一段时间把 Agent 叫回来，然后 Agent 重新读取：

```text
项目文档
Task Board
Decision Inbox
Git status
Git worktree list
main HEAD
```

先恢复自己已有的 `IN_PROGRESS` / `REVIEW`，没有可恢复任务时再领取新的 `READY`。

每完成一个 Task，都重新读取磁盘状态，再判断下一步。

不要凭上一轮聊天记忆直接继续。

## Scheduled Developer 的核心逻辑

完整 Prompt 放在仓库：

[`templates/prompts/scheduled-developer.md`](https://github.com/mengchangfeng/GPT-TaskBoard/blob/main/templates/prompts/scheduled-developer.md)

博客这里只保留主干：

```text
每轮开始：
- 读取 Agent 入口、状态、路线图、任务板和 Decision Inbox
- 检查 git status / worktree / main HEAD

任务优先级：
1. 恢复自己的 IN_PROGRESS / REVIEW
2. BLOCKED 只有恢复条件满足才继续
3. 没有可恢复任务时领取 READY
4. 不领取其他 Owner 的任务
5. 不处理未满足依赖的任务

对于每个 Task：
- 领取并记录 Owner / branch / worktree
- 基于最新 main 创建独立工作区
- 实现、测试、文档、commit
- review
- 合入 main
- main 再验收
- 通过后才标 DONE

每完成一个 Task：
- 重新读取 Task Board 和 Git
- 再判断有没有下一个 READY

需要产品或架构决策：
- 写入 needs-decision
- Task → BLOCKED
- 停止
```

定时任务只负责“再来检查一次”。

项目能不能继续，由磁盘上的事实状态决定。

## 接入已有项目

GPT-TaskBoard 仓库提供了接入现有项目的 Prompt：

[`templates/prompts/adopt-workflow.md`](https://github.com/mengchangfeng/GPT-TaskBoard/blob/main/templates/prompts/adopt-workflow.md)

它的原则不是复制一套固定目录，而是先检查目标项目已经存在的：

```text
AGENTS.md / agent.md
README
architecture / spec / ADR
progress / status / roadmap
task / todo / issue system
git status / log / worktree
```

只有缺少必要职责时才补文档。

## 最终结构

这套工作流里，各层只负责自己的事情：

```text
ChatGPT        理解任务、调用工具、实现
AgentDock      文件 / Shell / Git / 浏览器
项目文档       当前状态、计划、任务、决策
Git/worktree   隔离修改、保存提交
Tests          提供完成证据
Scheduler      定时唤醒
```

完整教程、模板、Prompt 和示例：

[github.com/mengchangfeng/GPT-TaskBoard](https://github.com/mengchangfeng/GPT-TaskBoard)
