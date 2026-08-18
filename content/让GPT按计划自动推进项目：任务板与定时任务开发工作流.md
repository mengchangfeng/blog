---
title: 定时开发工作流：让 GPT 自己领任务继续开发
date: 2026-08-18
description: 用项目文档、任务板、Git worktree 和定时任务，让 GPT 按已经确定的项目计划持续开发，遇到需要决策的问题再停下来找我。
tags: [ChatGPT, AI Agent, 自动化开发, Git, 项目管理]
---

最近高强度用网页 GPT 连接电脑 MCP 做开发。

之前用 Codex 的时候，我也折腾过任务板、定时任务这类东西，比如 [dashi-taskboard](https://github.com/chuspeeism/dashi-taskboard)。思路挺有意思，但 Codex 本身有额度限制，所以一直有点舍不得让它没事就跑。

现在换成网页 GPT 开发以后，基本没有剩余用量焦虑了。对话太多时 OpenAI 偶尔还是会弹会话限制，不过对我现在的使用方式来说，已经可以让 AI 持续推进那些项目框架和开发方向都讨论清楚的任务。

所以我最近给项目加了一套定时开发工作流。

这套工作流的脱敏参考实现放在 [GPT-TaskBoard](https://github.com/mengchangfeng/GPT-TaskBoard)，电脑 MCP 运行时使用 [AgentDock](https://github.com/uvwt/agentdock)。前者负责任务状态、Git/worktree 和验收，后者负责让网页 GPT 触达真实电脑。

## 先把项目文档整理好

定时任务不是最重要的。

首先得保证 Agent 每次打开项目，都能知道这个项目是什么、现在做到哪、应该怎么开发。

我自己的项目一般会维护这些文档：

```text
AGENTS.md
README.md
progress.md
architecture.md
modules.md
```

具体叫什么没关系。网上关于 Agent 项目文档的方案也很多，按自己的习惯来就行。

关键是不要让项目的重要状态只存在聊天记录里。

在这个基础上，为了让 Agent 可以自动往下推进，我又增加了几类信息：

```text
status.md          现在做到哪了？
roadmap.md         后面准备怎么做？
task-board.md      现在具体有哪些任务可以做？
needs-decision.md  哪些事情必须等我决定？
```

也不一定非得是这几个文件。

本质上只要把开发顺序、依赖关系、任务边界和验收标准写清楚就行。

## Agent 从任务板领任务

Roadmap 负责方向，真正执行的是 Task Board。

每个任务会有自己的状态、Owner、依赖和验收条件。Agent 启动以后，不需要重新猜“下一步该做什么”，只需要找到当前可以领取的 READY Task。

为了避免多个 Agent 同时改一块代码，我现在的规则是：

```text
一个 Task
=
一个 Owner
+
一个 Git branch
+
一个 worktree
```

Agent 领取任务以后就在自己的 worktree 里做。

```text
领取任务
↓
创建 branch / worktree
↓
开发
↓
测试
↓
commit
↓
合入 main
↓
main 再验收
↓
DONE
```

这样多个 Agent 可以同时工作，又不会都直接在 main 上改。

代码写完也不算任务完成。只有真正合进 main，并且 main 上的验收通过以后，Task 才会变成 `DONE`。

## 需要我决定的事情单独留下来

另外我会维护一个 `needs-decision.md`。

它专门放 Agent 不应该自己决定的问题，比如产品行为要不要改、核心架构要不要调整、两个方案都能做但需要选一个。

碰到这类问题，Agent 把任务标记成 `BLOCKED`，把问题和几个方案写进去，然后停下来等我处理。

普通 bug、实现细节和能自己解决的技术问题不用找我。

我想自动化的是已经确定的工程工作，而不是把项目方向也交给 AI 自己决定。

## 然后再加定时任务

前面的东西准备好以后，定时任务本身就很简单了。

我现在是每小时触发一次。Agent 醒来以后重新读取项目文档和 Git 状态，先恢复自己没做完的任务；没有的话再领取新的 READY Task。

一个任务做完以后，也不会直接根据上一段聊天继续往下冲，而是重新读取 Task Board 和 Git，再判断下一步。

Agent 可以忘记上一轮发生了什么，项目不能忘。

下面是我现在实际在用的定时任务提示词。

## 定时任务 Prompt

```text
继续开发 xx 项目。

你是该项目的 Scheduled Developer + Integrator。

每轮开始先阅读：

- AGENTS.md
- docs/status.md
- docs/roadmap.md
- docs/task-board.md
- docs/needs-decision.md（如果存在）
- 当前阶段和当前 Task 要求阅读的相关文档

然后检查：

- git status
- git worktree list
- 当前 main HEAD

始终以项目文档和当前 Git 状态为事实来源，不依赖聊天上下文或上一次运行的记忆。如果项目文档结构发生变化，以 AGENTS.md 的最新约定为准。

任务恢复与领取优先级：

1. 优先恢复 Owner 为 scheduled-agent 的 IN_PROGRESS / REVIEW / BLOCKED 任务。
2. BLOCKED 任务只有在阻塞条件已经解除时才能恢复。
3. 没有可恢复任务时，才从 task-board 领取 READY 任务。
4. 不得领取已有其他 Owner 的任务。
5. 不得处理依赖尚未完成的任务。
6. 如果下一任务会与其他 Agent 当前工作产生明显冲突，停止本轮。

每轮优先完整完成一个 Task；条件允许时可以继续后续任务，最多处理 5 个 Task ID。不要为了达到任务数量上限而降低实现、测试、文档或验收质量。

对于每个 Task：

1. 按项目规则领取任务并更新 task-board 状态。
2. 基于最新 main 创建该 Task 独立 branch/worktree。
3. 完成实现。
4. 完成项目要求的测试和验收。
5. 维护因本 Task 发生变化的必要项目文档。
6. 在 Task branch 提交 Git。
7. 按项目规定的 Integrator 流程集成进入 main。
8. 在 main 上重新执行必要验收。
9. 只有 main 验收通过后才能将 Task 标记为 DONE。
10. 清理已经完成的 worktree/branch。
11. 解锁依赖任务。

不得直接在 main 上开发。

如果下一任务依赖刚完成任务，必须先完成前一任务的 main 集成和验收，然后基于最新 main 创建新的 branch/worktree，不得复用旧 Task worktree。

不得覆盖、reset、stash、删除用户或其他 Agent 的未提交工作。

完成一个 Task 后，重新读取：

- docs/task-board.md
- 必要的 status/roadmap
- docs/needs-decision.md（如果存在）
- git status
- git worktree list
- 最新 main HEAD

不要凭上一任务的上下文直接领取下一任务。重新判断是否存在 scheduled-agent 可恢复任务、新的 READY 任务、其他 Agent 新领取任务、新依赖关系或修改冲突，确认安全后才能继续。

如果没有 READY 任务：

- 如果当前阶段目标、架构和验收标准已经由项目文档明确，可以根据当前阶段目标拆出下一批小型、可独立验收、依赖明确的任务，并更新 task-board。
- 拆分后，如果本轮尚未达到 5 个 Task ID 上限，可以继续领取其中 READY 的任务。
- 如果下一步需要重新决定产品方向、核心架构、Domain 边界、重大技术路线或未在 roadmap/spec 中确定的新需求，不得自行扩展项目。

遇到需要用户决策的问题时：

1. 将问题写入 docs/needs-decision.md。
2. 每个问题使用独立 ID，例如 ND-001。
3. 至少记录：Status、Related Task、Raised、问题、为什么需要决策、可选方案、各方案影响、Agent 推荐方案、Decision（留空等待用户）。
4. 只记录真正需要用户判断的产品/架构/重大技术问题；普通 bug、实现细节、可自行解决的技术问题不要写进去。
5. 对应 Task 标记为 BLOCKED，并写清恢复条件。
6. 不得自行代替用户做该决策。
7. 保存当前安全进度后停止本轮。

用户后续完成决策后：

- 小型执行决策写回对应 Task/spec，并将 ND 标记 RESOLVED。
- 重要架构决策同步写入 docs/decisions.md / ADR，再将 ND 标记 RESOLVED。
- 只有阻塞条件解除后才能恢复对应 BLOCKED Task。

如果当前阶段任务已经完成，不要只根据 task-board 判断阶段完成。按照项目文档规定的阶段验收标准重新检查实现、测试、文档和 Git 状态。

验收通过后更新 status/roadmap，记录阶段完成，并根据已经明确的下一阶段目标生成第一批任务；如果存在明确 READY 任务且本轮尚未达到上限，可以继续下一阶段。

满足任意一项时停止本轮：

- 已处理 5 个 Task ID。
- 没有 READY / 可恢复任务。
- 当前任务存在无法自行解决的真实 blocker。
- 下一任务与其他 Agent 当前工作冲突。
- 下一步需要用户进行产品或架构决策。
- Git 状态无法安全继续。

每轮结束最后检查：

- git status
- git worktree list
- task-board 状态
- docs/needs-decision.md 是否有新增 OPEN 问题

确保任务状态与实际 Git 状态一致。

输出简短摘要：

- 本轮处理的 Task ID 和结果
- 测试 / 验收结果
- main 集成和 commit
- 下一 READY Task，或停止原因
- 如新增 NEEDS_DECISION，列出 ND ID 和问题标题

项目文档和 Git 是下一轮恢复工作的唯一事实来源。
```

这套东西实现起来其实没有多复杂。

项目文档负责保存状态，Task Board 负责告诉 Agent 现在能做什么，Git/worktree 负责隔离开发，定时任务只是每隔一段时间把 Agent 叫回来重新检查一次。

有活就继续做，没有就停，需要我决定就把问题留下来。
