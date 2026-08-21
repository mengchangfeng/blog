---
title: 让网页版 GPT 控制自己的电脑：AgentDock MCP 与固定域名实战
date: 2026-08-17
description: 用 AgentDock 把网页版 ChatGPT 接入自己的电脑，先跑通 MCP，再按需增加固定域名、VPS、Nginx 和反向 SSH。
tags: [AgentDock, ChatGPT, MCP, AI Agent, 反向隧道, Nginx, macOS]
---

这篇先完成一个最小目标：

> 让网页版 ChatGPT 通过 AgentDock 调用自己电脑上的文件、Shell、Git 和浏览器。

完整、持续更新的教程和脱敏配置放在：

[GPT-TaskBoard](https://github.com/mengchangfeng/GPT-TaskBoard)

AgentDock 官方项目：

[uvwt/agentdock](https://github.com/uvwt/agentdock)

## 连接链路

最基础的链路是：

```text
网页版 ChatGPT
    ↓ HTTPS + OAuth
公网 MCP 地址
    ↓
AgentDock
    ↓
文件 / Shell / Git / 浏览器
```

AgentDock 是电脑上的 MCP 运行层。它不负责聊天模型，也不负责项目任务状态，只负责把允许的电脑能力提供给 ChatGPT 调用。

如果只是第一次验证，不需要先准备服务器。先用 AgentDock 的临时公网地址把整条链路跑通就够了。

## 安装 AgentDock

macOS 可以直接使用官方图形应用：

[AgentDock Releases](https://github.com/uvwt/agentdock/releases/latest)

安装后启动 AgentDock，先确认服务状态正常。

本机默认地址通常是：

```text
http://127.0.0.1:8765/mcp
```

先验证健康检查：

```bash
curl -fsS http://127.0.0.1:8765/healthz
```

这一步不通，就先处理 AgentDock 本机服务，不要继续排查域名和 ChatGPT。

## 选择公网连接方式

网页版 ChatGPT 无法直接访问电脑上的 `127.0.0.1`，所以需要一个公网可访问的 MCP 地址。

常用方式有三种：

| 方式 | 适合场景 | 主要限制 |
|---|---|---|
| 仅本机 | MCP 客户端也在这台电脑 | 网页版 ChatGPT 无法访问 |
| 临时公网地址 | 第一次测试 | 地址可能变化 |
| 固定域名 | 长期使用 | 需要额外配置 |

第一次实践建议先用临时公网地址。

目标不是先把基础设施配完整，而是先确认：

```text
ChatGPT → MCP → AgentDock → 电脑
```

这条链路真的可用。

## 在 ChatGPT 中连接

AgentDock 开启公网访问后，会提供公网 MCP 地址和 OAuth 密码。

在 ChatGPT 的插件 / 开发者相关设置里创建 MCP 连接，填入类似：

```text
https://your-public-host.example/mcp
```

连接时按 OAuth 页面完成授权。

界面入口可能会变化，具体以 AgentDock 官方文档为准：

[使用 ChatGPT 连接 AgentDock](https://uvwt.github.io/agentdock-docs/zh-CN/docs/guides/chatgpt)

凭据不要放进聊天、截图、Issue 或 Git。

## 用真实调用验证

显示“已连接”不代表工具调用一定正常。

我建议从只读到写入逐层验证。

先看服务信息：

```text
调用 AgentDock 的 server_info，只返回服务版本和系统信息，不修改任何内容。
```

再读一个测试目录：

```text
列出指定测试目录的第一层文件，不读取其他目录，不修改任何内容。
```

然后测试文件和 Git：

```text
读取测试目录中的 README.md，再查看该仓库的 git status，保持只读。
```

再跑一个无副作用命令：

```text
在指定测试目录打印当前路径并查看 Git 分支，不安装软件，不修改文件。
```

最后只在专门的测试目录做一次受控写入：

```text
创建 mcp-smoke.txt，写入一行 smoke test，读回确认后停止。不要操作其他路径。
```

这些都正常以后，文件、Shell、Git 这条链路基本就通了。

## 实际开发时怎么用

接好以后，可以直接让 ChatGPT 自己去读项目。

例如：

```text
查看 /Users/xxx/project/demo。
先读 AGENTS.md 和项目文档，再检查 git status。
根据当前任务完成修改，运行测试并提交 Git。
```

项目代码、文档、Git、日志和进程都留在电脑上。

ChatGPT 需要什么就重新读取什么，不需要每次把整个项目复制进聊天上下文。

## 进阶：固定域名 + VPS

如果需要长期使用固定地址，可以再加 VPS、Nginx 和反向 SSH。

链路变成：

```text
ChatGPT
  ↓ HTTPS + OAuth
agent.example.com
  ↓
VPS Nginx :443
  ↓
VPS 127.0.0.1:18765
  ↓ reverse SSH
电脑 127.0.0.1:8765
  ↓
AgentDock
```

电脑不需要固定公网 IP，也不需要把 AgentDock 端口直接暴露到公网。

公网只访问 HTTPS，VPS 上的转发端口和电脑上的 AgentDock 都只监听回环地址。

### 先手动验证反向 SSH

在电脑上建立隧道：

```bash
ssh -NT \
  -o BatchMode=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -i /ABSOLUTE/PATH/TO/TUNNEL_KEY \
  -R 127.0.0.1:18765:127.0.0.1:8765 \
  agentdock-tunnel@VPS_HOSTNAME
```

在 VPS 验证：

```bash
curl -fsS http://127.0.0.1:18765/healthz
```

这一步成功以后再配 Nginx。

### Nginx 转发 HTTPS

核心就是把公网请求转发到：

```text
http://127.0.0.1:18765
```

MCP 和 OAuth 需要的路径都要正常转发，包括：

```text
/mcp
/register
/oauth/*
/.well-known/*
```

完整脱敏配置放在 GPT-TaskBoard 的：

```text
config-examples/
```

### 让隧道自动恢复

长期使用不要手动挂一个 SSH 终端。

macOS 可以用 LaunchAgent 维护反向 SSH。关键点不是“配置文件存在”，而是实际验证：

```text
SSH 断开
↓
LaunchAgent 自动拉起
↓
VPS 18765 恢复
↓
公网 healthz 恢复
```

完整示例同样放在仓库教程里。

## 常见问题

### 502

先检查 VPS 上的上游：

```bash
curl http://127.0.0.1:18765/healthz
```

这里不通就先处理 SSH 隧道，不要先查 Nginx。

### `remote port forwarding failed`

先看端口是否已经被旧 SSH 会话占用：

```bash
sudo ss -lntp | grep 18765
```

### ChatGPT 显示已连接但工具不能用

不要只看 OAuth 跳转是否成功。

重新按顺序验证：

```text
server_info
↓
读取测试目录
↓
git status
↓
无副作用命令
↓
受控写入
```

### 临时公网地址失效

临时 Tunnel 地址发生变化是正常情况。需要长期固定地址时，再配置固定域名方案。

## 完整教程

博客这里只保留主线和关键命令。

持续更新的完整教程、配置示例和下一步任务板工作流都在：

[github.com/mengchangfeng/GPT-TaskBoard](https://github.com/mengchangfeng/GPT-TaskBoard)

下一篇继续处理 ChatGPT 已经能操作电脑之后的问题：怎么让它每次都能从项目文档和 Git 恢复状态，领取任务并持续开发。