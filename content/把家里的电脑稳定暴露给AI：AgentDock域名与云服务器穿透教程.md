---
title: 让网页版 GPT 控制自己的电脑：AgentDock MCP 与固定域名实战
date: 2026-08-17
description: 在电脑上启动 AgentDock MCP，让网页版 ChatGPT 调用文件、终端、Git 和浏览器工具，再用域名、云服务器与反向 SSH 建立固定入口。
tags: [AgentDock, ChatGPT, MCP, AI Agent, 反向隧道, Nginx, macOS]
---

## 一句话结论

这篇文章真正要完成的事情，不是“做一条内网穿透”，而是：**在自己的电脑上启动一个 MCP 工具服务，让网页版 ChatGPT 能够读取文件、执行命令、操作 Git、调用浏览器，并把长任务留在真实电脑上继续运行。**

域名和云服务器只是把这项能力安全、稳定地送到网页 GPT 面前的网络入口。

最终链路如下：

```text
网页版 ChatGPT
       │  推理、规划、发起工具调用
       ▼
远程 MCP： https://agent.example.com/mcp
                │
        HTTPS / OAuth
                │
                ▼
云服务器 Nginx :443
                │
服务器 127.0.0.1:18765
                │
         反向 SSH 隧道
                ▼
Mac AgentDock：127.0.0.1:8765
                │
                ▼
文件 · Shell · Git · 浏览器 · Skills · 长任务
```

这里有三层职责：

- **ChatGPT 是大脑**：理解目标、拆解步骤、决定何时调用工具；
- **AgentDock 是手和工作台**：在真实电脑上读写文件、运行程序并保存任务状态；
- **域名和服务器是门**：把本地 MCP 变成网页 ChatGPT 能连接的固定 HTTPS 地址。

本文以 macOS、Ubuntu 24.04、Nginx 和 AgentDock 为例。示例中的域名、IP、用户名和路径都是占位符，请替换成自己的值。

## 目标：给网页 GPT 一台真正能操作的电脑

AgentDock 是一个面向 AI Agent 的工具运行时，可以通过 MCP 提供文件、命令、Git、浏览器和任务执行能力。它本身不负责聊天或模型推理，而是让远端 AI 客户端在明确权限边界内操作真实电脑。安装与平台说明见 [AgentDock 官方文档](https://uvwt.github.io/agentdock-docs/zh-CN/docs/getting-started/install)。

传统网页聊天只能根据你粘贴进去的文本回答。它不知道项目当前有哪些文件，也看不到运行日志，更不能自己执行测试。接入电脑 MCP 后，对话会变成另一种工作方式：

```text
你：检查这个项目为什么启动失败，修复后运行测试。

ChatGPT：
1. 调用文件搜索工具了解项目结构；
2. 读取配置和错误日志；
3. 调用 Shell 复现问题；
4. 修改指定文件；
5. 运行测试并读取真实输出；
6. 汇报修改、验证结果和仍存在的风险。
```

文件没有被永久复制到聊天窗口里，命令也不是模型“想象出来”的。AgentDock 在你的电脑上执行操作，再把结构化结果返回给 ChatGPT。

这特别适合：

- 在网页 ChatGPT 中维护本地项目，而不必反复复制代码和日志；
- 用手机发出任务，让家里或办公室的电脑执行构建、检查和部署；
- 让同一段对话调用多台电脑或服务器上的不同 AgentDock；
- 把耗时任务留在真实环境中运行，稍后继续读取状态；
- 复用电脑已有的 Git、SSH、浏览器登录状态和开发工具。

如果 MCP 客户端和 AgentDock 在同一台电脑上，本地地址就够用：

```text
http://127.0.0.1:8765/mcp
```

但网页版 ChatGPT 运行在远端，无法访问你电脑的 `127.0.0.1`，所以还需要一个它能连接的 HTTPS MCP 入口。常见选择有两种：

1. **Cloudflare Tunnel**：配置少，适合快速使用；Quick Tunnel 地址会变化，Named Tunnel 则需要 Cloudflare 托管域名。
2. **自己的云服务器**：域名和入口完全由自己管理，适合已经有 VPS、Nginx 和 HTTPS 运维经验的人。

本文先把电脑 MCP 和网页 ChatGPT 的使用逻辑讲清楚，再实现第二种固定入口。

## “无限 token”到底是什么意思

把这类方案称为“无限 token”很有吸引力，但字面上并不准确。

AgentDock 不会取消 ChatGPT 套餐限制、消息次数限制或模型上下文窗口，也不应该被用来绕过任何服务规则。它带来的变化是：**工作状态和大文件留在电脑上，模型按需调用工具，不必把整个代码库、全部日志和每次命令输出都反复粘贴进对话。**

例如，一个包含十万行代码的仓库不需要一次性进入模型上下文。ChatGPT 可以先搜索文件名，再读取少量相关代码，执行测试后只接收必要输出；AgentDock 还能截断过长结果，并保存长任务状态。这会显著减少上下文浪费，让同一段对话更像“操作远程工作站”，而不是“不断上传材料”。

AgentDock 项目把其中一个价值描述为：在真实环境中写代码、改配置、运行命令和部署，而不依赖专用 Codex coding quota。但对用户来说，更准确的说法仍然是：

> 不是 token 真的无限，而是把 AI 的上下文用在判断上，把文件、进程和任务状态放在电脑上。

## 准备条件与成功标准

你需要准备：

- 一台运行 macOS 的电脑；
- 一台有固定公网 IP 的 Linux 云服务器；
- 一个自己控制 DNS 的域名；
- 云服务器的 SSH 管理权限；
- 公网可以访问服务器的 80/443 端口。

下面统一使用这些示例值：

```text
域名：agent.example.com
服务器 IP：203.0.113.10
服务器管理员：ubuntu
AgentDock 本地端口：8765
服务器隧道端口：18765
隧道专用账号：agentdock-tunnel
```

完成后至少应满足：

- `https://agent.example.com/healthz` 返回 HTTP 200；
- `https://agent.example.com/mcp` 匿名访问返回 HTTP 401；
- OAuth 元数据里的 issuer 是固定域名；
- Mac 重新登录或 SSH 断线后，隧道能够自动恢复；
- 服务器的 18765 端口只监听 `127.0.0.1`。

## 在 Mac 上启动 AgentDock MCP

普通用户应优先使用官方 macOS DMG，不需要自己编译 Go 和 Swift 项目。打开 [AgentDock Releases](https://github.com/uvwt/agentdock/releases/latest)，下载：

```text
AgentDock-macos-universal.dmg
AgentDock-macos-universal.dmg.sha256
```

先校验下载文件：

```bash
shasum -a 256 -c AgentDock-macos-universal.dmg.sha256
```

看到 `OK` 后，打开 DMG，把 `AgentDock.app` 拖到 `/Applications`。如果当前版本尚未经过 Apple 公证，第一次启动可在 Finder 中右键应用并选择“打开”，不要关闭整个 Gatekeeper。

第一次配置先选择“仅本机”。启动成功后验证：

```bash
curl http://127.0.0.1:8765/healthz
```

预期返回：

```json
{"ok":true,"version":"0.7.4"}
```

版本号可能随着发布更新，以实际安装版本为准。

打开 AgentDock 控制面板后，可以看到三类关键信息：

- **本地 MCP URL**：默认是 `http://127.0.0.1:8765/mcp`；
- **Bearer Token**：适合支持自定义请求头的 MCP 客户端；
- **OAuth 密码与公网 Origin**：用于需要浏览器授权流程的远程客户端。

AgentDock 的工具权限很高。它可以执行 Shell、修改文件和调用 Git，所以应把“匿名 MCP 能否访问”列为启动后的第一项安全测试：

```bash
curl -o /dev/null -w '%{http_code}\n' \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"local-check","version":"1"}}}' \
  http://127.0.0.1:8765/mcp
```

如果已经启用 Bearer Token，匿名请求应返回 401。

## 网页版 ChatGPT 如何连接电脑 MCP

当固定 HTTPS 地址准备好后，网页 ChatGPT 可以把它添加成远程 MCP 连接。根据 OpenAI 在 2026 年 8 月的官方说明，测试 MCP 服务器的入口位于开发者模式：

1. 打开 ChatGPT 的 **Settings**；
2. 进入 **Security and login**；
3. 开启 **Developer mode**；
4. 打开 **ChatGPT Plugins**；
5. 创建连接，在 **Connection** 中选择公网端点；
6. 填写完整 MCP URL，例如 `https://agent.example.com/mcp`；
7. 检查 ChatGPT 发现的工具、描述和认证信息；
8. 新建对话，从工具菜单中启用这条 MCP 连接。

官方同时说明，开发者模式是否可用会受账号和工作区策略影响，界面位置也可能继续调整。应以 [OpenAI 官方 Connect and test your plugin 文档](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt) 为准。

首次连接时，ChatGPT 会读取 MCP 服务暴露的工具清单。不要急着下达“帮我整理整台电脑”这种宽泛任务，先做几个低风险验证：

```text
列出允许访问的工作目录，不修改任何文件。

读取某个项目的 Git 状态，只汇报未提交文件。

运行 agentdock --version 和系统信息，只返回摘要。

在指定测试目录创建 hello.txt，写入 hello，然后读回来。
```

这些任务分别验证了目录边界、只读 Git、命令执行和最小写入闭环。

## 网页 GPT 控制电脑的正确使用方式

MCP 接通以后，提示词最好包含四类信息：目标、范围、权限和验收标准。

一个容易失控的请求是：

```text
帮我把项目弄好。
```

更合适的请求是：

```text
检查 ~/Projects/demo 为什么无法启动。
先只读取代码、配置、Git 状态和错误日志，不要修改。
找出原因后给出最小修复方案，等我确认再改。
成功标准是 npm test 和 npm run build 都通过。
不要提交或推送 Git。
```

如果希望它直接执行，也可以明确授权：

```text
修复 ~/Projects/demo 当前的启动错误。
允许修改该仓库内文件和安装项目依赖，不允许修改系统网络设置。
修复后运行测试与构建，更新 README，并只提交本次相关文件，不要推送。
```

几个值得坚持的规则：

- 先让工具读取真实状态，再讨论方案；
- 写明允许操作的目录，不要默认授权整个用户目录；
- 删除、覆盖、推送、部署、发消息等动作单独确认；
- 要求返回命令退出码、测试结果和最终 Git diff；
- 长任务要有明确完成条件，而不是无限循环尝试；
- 不把密码、私钥、Token 显示在聊天、截图或公开日志中。

## 为什么还需要域名和云服务器

本地 MCP 已经证明 AgentDock 能控制电脑，但网页版 ChatGPT 仍然无法访问 `127.0.0.1`。域名和服务器解决的是“从网页到电脑”的网络可达性，不是 Agent 能力本身。

域名不应该直接指向家里电脑不断变化的 IP。更稳定的做法是：域名始终指向一台有固定公网 IP 的云服务器，再让电脑主动建立一条到服务器的反向 SSH 隧道。

这个固定入口保持三个边界：

- 家里的电脑不需要固定公网 IP，也不需要路由器端口映射；
- 云服务器只公开 80/443，隧道端口只监听服务器回环地址；
- AgentDock 继续只监听 Mac 的 `127.0.0.1`，不直接暴露给局域网或公网。

## 配置域名解析

在 DNS 服务商处添加 A 记录：

```text
类型：A
主机记录：agent
记录值：203.0.113.10
TTL：600
```

注意，这条记录指向的是云服务器，不是家里的电脑。

使用公共 DNS 检查：

```bash
dig +short A agent.example.com
```

如果电脑使用了 Clash 等 Fake-IP 模式，本地可能看到 `198.18.0.0/16` 地址。这不一定代表公网 DNS 配错，可以通过 DNS over HTTPS 或在其他网络上复核权威结果。

## 先跑通一次反向 SSH

不要一开始就写自启动服务。先用现有服务器管理账号验证最小链路：

```bash
ssh -NT \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -i ~/.ssh/server-admin.pem \
  -R 127.0.0.1:18765:127.0.0.1:8765 \
  ubuntu@203.0.113.10
```

`-R` 的含义是：让服务器的 `127.0.0.1:18765` 通过当前 SSH 连接转发到 Mac 的 `127.0.0.1:8765`。OpenSSH 对远程转发的完整定义可参考 [`ssh -R` 手册](https://man.openbsd.org/ssh#R)。

保持这个终端不要关闭，另开一个终端登录服务器并检查：

```bash
curl http://127.0.0.1:18765/healthz
```

如果这里不能返回 AgentDock 的健康响应，先不要配置 Nginx。常见原因包括：

- Mac 上 AgentDock 没有启动；
- 服务器 SSH 禁止 `AllowTcpForwarding`；
- 18765 已被其他进程占用；
- `ExitOnForwardFailure` 已经在原终端给出了明确错误。

## 不要长期使用管理员密钥

最小闭环成功以后，应建立一个没有 sudo 权限的专用账号和专用密钥。

在 Mac 生成密钥：

```bash
ssh-keygen -t ed25519 \
  -C "agentdock-reverse-tunnel" \
  -f ~/.ssh/agentdock_tunnel_ed25519
```

在服务器创建账号：

```bash
sudo useradd --create-home --shell /bin/bash agentdock-tunnel
sudo install -d -m 700 \
  -o agentdock-tunnel \
  -g agentdock-tunnel \
  /home/agentdock-tunnel/.ssh
```

把公钥内容写入：

```text
/home/agentdock-tunnel/.ssh/authorized_keys
```

并在公钥前增加限制：

```text
restrict,port-forwarding,permitlisten="127.0.0.1:18765" ssh-ed25519 AAAA... agentdock-reverse-tunnel
```

最后修正权限并锁定密码登录：

```bash
sudo chown -R agentdock-tunnel:agentdock-tunnel /home/agentdock-tunnel/.ssh
sudo chmod 600 /home/agentdock-tunnel/.ssh/authorized_keys
sudo passwd -l agentdock-tunnel
```

这样即使隧道密钥泄露，它也不能获得 sudo 权限，并且只能申请指定的服务器回环监听端口。

再次测试：

```bash
ssh -NT \
  -o BatchMode=yes \
  -o ExitOnForwardFailure=yes \
  -i ~/.ssh/agentdock_tunnel_ed25519 \
  -R 127.0.0.1:18765:127.0.0.1:8765 \
  agentdock-tunnel@203.0.113.10
```

## 让 macOS 自动保持隧道

创建：

```text
~/Library/LaunchAgents/com.example.agentdock-reverse-tunnel.plist
```

内容如下：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.example.agentdock-reverse-tunnel</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/ssh</string>
    <string>-NT</string>
    <string>-o</string><string>BatchMode=yes</string>
    <string>-o</string><string>ExitOnForwardFailure=yes</string>
    <string>-o</string><string>ServerAliveInterval=30</string>
    <string>-o</string><string>ServerAliveCountMax=3</string>
    <string>-o</string><string>ConnectTimeout=10</string>
    <string>-o</string><string>StrictHostKeyChecking=yes</string>
    <string>-i</string>
    <string>/Users/yourname/.ssh/agentdock_tunnel_ed25519</string>
    <string>-R</string>
    <string>127.0.0.1:18765:127.0.0.1:8765</string>
    <string>agentdock-tunnel@203.0.113.10</string>
  </array>

  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>/Users/yourname/Library/Logs/AgentDock/reverse-tunnel.out.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/yourname/Library/Logs/AgentDock/reverse-tunnel.err.log</string>
</dict>
</plist>
```

加载并检查：

```bash
plutil -lint ~/Library/LaunchAgents/com.example.agentdock-reverse-tunnel.plist

launchctl bootstrap gui/$(id -u) \
  ~/Library/LaunchAgents/com.example.agentdock-reverse-tunnel.plist

launchctl print \
  gui/$(id -u)/com.example.agentdock-reverse-tunnel
```

主动测试恢复能力：

```bash
launchctl kickstart -k \
  gui/$(id -u)/com.example.agentdock-reverse-tunnel
```

LaunchAgent 会在用户登录后运行。如果要求“机器开机但无人登录时也能访问”，需要改成 LaunchDaemon，并重新设计密钥、文件归属和运行用户，不能简单把同一个 plist 搬到 `/Library/LaunchDaemons`。

## 在云服务器配置 Nginx

新建：

```text
/etc/nginx/sites-available/agent.example.com
```

配置如下：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name agent.example.com;

    location / {
        proxy_pass http://127.0.0.1:18765;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

MCP 的 Streamable HTTP 可能保持较长连接，因此这里关闭代理缓冲并提高读写超时。各指令含义可参考 [Nginx 反向代理模块文档](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)。

启用配置：

```bash
sudo ln -s \
  /etc/nginx/sites-available/agent.example.com \
  /etc/nginx/sites-enabled/agent.example.com

sudo nginx -t
sudo systemctl reload nginx
```

先验证 HTTP 路由：

```bash
curl http://agent.example.com/healthz
```

每次都应先执行 `nginx -t`，不要让一个新站点的语法错误影响服务器上的其他业务。

## 申请 HTTPS 证书

安装了 Certbot 和 Nginx 插件后执行：

```bash
sudo certbot --nginx \
  -d agent.example.com \
  --non-interactive \
  --redirect
```

Certbot 会申请证书、更新 Nginx 并设置 HTTP 到 HTTPS 的跳转。首次安装和不同发行版的命令应以 [Certbot 官方指引](https://certbot.eff.org/instructions) 为准。

检查证书和自动续期：

```bash
sudo certbot certificates
systemctl is-active certbot.timer
```

此时应能访问：

```bash
curl https://agent.example.com/healthz
```

## 把 AgentDock 切换到固定域名

先确认反向 SSH、Nginx 和 HTTPS 已经全部通过，再修改 AgentDock。不要在公网链路尚未打通时提前打开 OAuth。

在 AgentDock 中关闭临时 Cloudflare Tunnel，保留本地监听地址。然后编辑：

```text
~/Library/Application Support/AgentDock/agentdock.env
```

确认这些值：

```bash
AGENTDOCK_HOST='127.0.0.1'
AGENTDOCK_PORT='8765'
AGENTDOCK_OAUTH_ENABLED='true'
AGENTDOCK_SERVER_URL='https://agent.example.com'
```

原有的以下值必须保留，不要复制到文章、Issue、截图或 Git：

```text
AGENTDOCK_AUTH_TOKEN
AGENTDOCK_OAUTH_PASSWORD
AGENTDOCK_OAUTH_TOKEN_SECRET
```

同时确认：

```text
~/Library/Application Support/AgentDock/cloudflared.env
```

内容为：

```bash
AGENTDOCK_TUNNEL_MODE='none'
```

重启 Core：

```bash
/Applications/AgentDock.app/Contents/Helpers/agentdock \
  service restart \
  --runtime-root "$HOME/Library/Application Support/AgentDock"
```

退出并重新打开 AgentDock 控制面板，让它重新读取运行状态。界面应显示固定公网 MCP：

```text
https://agent.example.com/mcp
```

## 完整验收

### 1. 本地 Core

```bash
curl http://127.0.0.1:8765/healthz
```

### 2. 服务器隧道

```bash
sudo ss -lntp | grep 127.0.0.1:18765
curl http://127.0.0.1:18765/healthz
```

监听结果必须是 `127.0.0.1:18765`，不能是 `0.0.0.0:18765`。

### 3. 公网 HTTPS

```bash
curl -i https://agent.example.com/healthz
```

应返回 HTTP 200。

### 4. OAuth issuer

```bash
curl -sS \
  https://agent.example.com/.well-known/oauth-authorization-server \
  | jq .issuer
```

应返回：

```text
"https://agent.example.com"
```

### 5. 匿名 MCP

```bash
curl -o /dev/null -w '%{http_code}\n' \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"public-check","version":"1"}}}' \
  https://agent.example.com/mcp
```

应返回 401，而不是 200。AgentDock 能执行命令和写文件，公网入口不能匿名开放。

### 6. 鉴权后的 MCP 初始化

为避免把令牌写入 Shell 历史，可以交互式输入：

```bash
read -s AGENTDOCK_TOKEN

curl -sS \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Authorization: Bearer $AGENTDOCK_TOKEN" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"public-check","version":"1"}}}' \
  https://agent.example.com/mcp

unset AGENTDOCK_TOKEN
```

正常响应应包含 AgentDock 的 `serverInfo`。

## 常见故障

### 公网返回 502

Nginx 已工作，但无法访问上游。按顺序检查：

```text
Mac AgentDock 是否健康
→ Mac LaunchAgent 是否运行
→ 服务器 127.0.0.1:18765 是否监听
→ 服务器 curl 该端口是否成功
→ Nginx error.log
```

### 域名返回了其他网站或 404

检查 Nginx 是否加载了正确的 `server_name`：

```bash
sudo nginx -T | grep -n -A20 -B3 'server_name agent.example.com'
```

也可以绕过公网 DNS，在服务器本机验证站点选择：

```bash
curl --noproxy '*' \
  --resolve agent.example.com:80:127.0.0.1 \
  http://agent.example.com/healthz
```

### `remote port forwarding failed`

通常是 18765 已被旧 SSH 会话占用。先检查：

```bash
sudo ss -lntp | grep 18765
```

不要盲目改成另一个公网端口，更不要把反向转发绑定到 `0.0.0.0`。

### AgentDock 报 OAuth 缺少 `AGENTDOCK_SERVER_URL`

说明 OAuth 已开启，但固定公网 Origin 尚未写入或写错。`AGENTDOCK_SERVER_URL` 必须是完整 Origin：

```text
https://agent.example.com
```

不要附加 `/mcp`，也不要只填写域名片段。

### Mac 重启后不能访问

LaunchAgent 只会在用户登录后运行。先检查：

```bash
launchctl print gui/$(id -u)/com.example.agentdock-reverse-tunnel
tail -50 ~/Library/Logs/AgentDock/reverse-tunnel.err.log
```

重点检查私钥权限、服务器 host key、用户名以及 `ExitOnForwardFailure` 报错。

### 临时 `trycloudflare.com` 域名突然失效

Quick Tunnel 地址本来就可能在 Tunnel 重启后变化，旧域名出现 NXDOMAIN 属于预期行为。如果需要长期稳定入口，应使用 Named Tunnel 或本文的固定服务器方案，不要把 Quick Tunnel URL 写死在客户端配置中。

## 安全清单

上线前逐项确认：

- [ ] AgentDock 只监听 Mac 的 `127.0.0.1`；
- [ ] 服务器 18765 只监听 `127.0.0.1`；
- [ ] UFW/安全组没有开放 18765；
- [ ] Nginx 只通过 HTTPS 对外提供 MCP；
- [ ] 匿名 MCP 请求返回 401；
- [ ] OAuth issuer 与固定域名完全一致；
- [ ] 隧道使用无 sudo 的专用账号和专用密钥；
- [ ] `authorized_keys` 限制了 `permitlisten`；
- [ ] 私钥权限是 600；
- [ ] Token、OAuth 密码和 Secret 没有进入 Git、截图或日志；
- [ ] Certbot 自动续期正常；
- [ ] 已实际测试 SSH 断线后的自动恢复。

## 结语

穿透本身不是最难的部分。真正需要设计的是边界：谁拥有固定公网入口，哪一个端口可以被访问，隧道账号能做什么，AgentDock 如何鉴权，以及断线以后能否恢复。

把域名放在云服务器，把主动连接留在家里的电脑，把转发端口限制在两端回环地址，再让 Nginx 只负责 HTTPS，这套结构没有要求家庭网络具备固定 IP，也没有让 AgentDock 直接暴露在公网。它只是用几层职责单一、容易检查的成熟组件，拼出了一条稳定且可审计的访问路径。
