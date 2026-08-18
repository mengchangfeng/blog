---
title: 让网页版 GPT 控制自己的电脑：AgentDock MCP 与固定域名实战
date: 2026-08-17
description: 我把 Mac 上的 AgentDock MCP 通过反向 SSH、Nginx 和固定域名暴露给网页版 ChatGPT，这样网页 GPT 可以直接操作本地文件、终端、Git 和浏览器。
tags: [AgentDock, ChatGPT, MCP, AI Agent, 反向隧道, Nginx, macOS]
---

最近主要用网页 GPT 配合电脑 MCP 做开发。

体验和单纯聊天差别挺大。以前代码、日志、Git 状态都要复制到对话里，现在可以直接让 GPT 去电脑上看：读项目文件、跑命令、改代码、测试、提交 Git，甚至操作浏览器。

我用的是 [AgentDock](https://github.com/uvwt/agentdock)。

本文对应的工作流仓库是 [GPT-TaskBoard](https://github.com/mengchangfeng/GPT-TaskBoard)，用于保存任务板、Git/worktree、定时开发和验收规则；AgentDock 只负责提供本机 MCP 运行时。

本地跑起来很简单，真正麻烦的是另一件事：

> 网页版 GPT 怎么稳定访问我家里 Mac 上的 MCP？

AgentDock 默认只监听：

```text
http://127.0.0.1:8765/mcp
```

这对本机客户端没问题，但网页版 GPT 访问不到我的 `127.0.0.1`。

AgentDock 可以临时开 Cloudflare Tunnel，不过我希望地址固定下来。最后用了一台自己的云服务器做中转：Mac 主动连服务器，服务器提供固定域名和 HTTPS。

现在链路是这样的：

```text
网页版 ChatGPT
        ↓
https://agent.example.com/mcp
        ↓
云服务器 Nginx :443
        ↓
127.0.0.1:18765
        ↓
反向 SSH
        ↓
Mac AgentDock :8765
        ↓
文件 / Shell / Git / 浏览器
```

家里不需要固定公网 IP，也不用在路由器上开端口。

下面记录一下我实际怎么做的。

## 先把 AgentDock 在本机跑通

普通使用直接装官方 macOS 版本就行，下载地址：

[AgentDock Releases](https://github.com/uvwt/agentdock/releases/latest)

启动以后先只验证本机：

```bash
curl http://127.0.0.1:8765/healthz
```

能正常返回以后，再确认 MCP 地址：

```text
http://127.0.0.1:8765/mcp
```

这一步先不要急着做公网。

我后面排查问题时发现，把链路一层一层拆开会省很多事：本地 AgentDock 没跑通，就不要先折腾 Nginx；反向 SSH 没跑通，也不要先看域名。

## 为什么我没有直接暴露家里的电脑

最直接的做法当然是把家里电脑端口暴露到公网。

我没这么做。

我的结构里：

```text
AgentDock     只监听 Mac 的 127.0.0.1:8765
SSH 转发端口 只监听服务器的 127.0.0.1:18765
公网          只开放 Nginx 的 80 / 443
```

也就是说，AgentDock 本身始终没有直接暴露在公网。

域名只指向云服务器，Mac 主动建立一条到服务器的 SSH 连接。

## 先手动跑一条反向 SSH

假设：

```text
云服务器：203.0.113.10
AgentDock 本地端口：8765
服务器转发端口：18765
```

先在 Mac 上执行：

```bash
ssh -NT \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -R 127.0.0.1:18765:127.0.0.1:8765 \
  ubuntu@203.0.113.10
```

这里最关键的是：

```text
-R 127.0.0.1:18765:127.0.0.1:8765
```

意思就是服务器上的 `127.0.0.1:18765` 转发到 Mac 的 `127.0.0.1:8765`。

保持 SSH 不断，在服务器上测试：

```bash
curl http://127.0.0.1:18765/healthz
```

如果这里能拿到 AgentDock 的响应，最核心的一段已经通了。

如果不通，我会按这个顺序检查：

```text
Mac 的 AgentDock 是否正常
↓
SSH 有没有报 remote port forwarding failed
↓
服务器 18765 有没有被占用
↓
sshd 是否允许 TCP forwarding
```

## 给隧道单独建一个账号

手动测试时用自己的服务器账号没问题，长期运行我还是给它单独建了一个账号和 SSH Key。

Mac 上生成密钥：

```bash
ssh-keygen -t ed25519 \
  -C "agentdock-reverse-tunnel" \
  -f ~/.ssh/agentdock_tunnel_ed25519
```

服务器创建账号：

```bash
sudo useradd --create-home --shell /bin/bash agentdock-tunnel
sudo install -d -m 700 \
  -o agentdock-tunnel \
  -g agentdock-tunnel \
  /home/agentdock-tunnel/.ssh
```

把公钥放进：

```text
/home/agentdock-tunnel/.ssh/authorized_keys
```

我还给这把 Key 限制了监听范围：

```text
restrict,port-forwarding,permitlisten="127.0.0.1:18765" ssh-ed25519 AAAA... agentdock-reverse-tunnel
```

然后：

```bash
sudo chown -R agentdock-tunnel:agentdock-tunnel /home/agentdock-tunnel/.ssh
sudo chmod 600 /home/agentdock-tunnel/.ssh/authorized_keys
sudo passwd -l agentdock-tunnel
```

这样这个账号就是专门拿来建立隧道的，不需要 sudo，也不需要密码登录。

重新测试：

```bash
ssh -NT \
  -o BatchMode=yes \
  -o ExitOnForwardFailure=yes \
  -i ~/.ssh/agentdock_tunnel_ed25519 \
  -R 127.0.0.1:18765:127.0.0.1:8765 \
  agentdock-tunnel@203.0.113.10
```

## 域名只指向云服务器

DNS 这边很普通。

例如：

```text
agent.example.com → 203.0.113.10
```

加一条 A 记录即可。

验证：

```bash
dig +short A agent.example.com
```

这里指向的是云服务器，不是家里的 Mac。

## Nginx 把 HTTPS 转给 SSH 隧道

服务器上新建一个 Nginx 站点：

```text
/etc/nginx/sites-available/agent.example.com
```

核心配置：

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

启用以后：

```bash
sudo ln -s \
  /etc/nginx/sites-available/agent.example.com \
  /etc/nginx/sites-enabled/agent.example.com

sudo nginx -t
sudo systemctl reload nginx
```

先测试 HTTP：

```bash
curl http://agent.example.com/healthz
```

这时候如果返回 502，通常不是域名问题，而是 Nginx 连不到 `127.0.0.1:18765`。回头检查 SSH 隧道就行。

## 再加 HTTPS

我这里直接用 Certbot：

```bash
sudo certbot --nginx \
  -d agent.example.com \
  --redirect
```

完成以后测试：

```bash
curl https://agent.example.com/healthz
```

到这里，公网入口就已经有了。

```text
https://agent.example.com/mcp
```

## 让 SSH 隧道自动恢复

手动开一个 SSH 窗口显然不适合长期用。

我在 macOS 里放了一个 LaunchAgent：

```text
~/Library/LaunchAgents/com.example.agentdock-reverse-tunnel.plist
```

内容大概这样：

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
    <string>-i</string>
    <string>/Users/yourname/.ssh/agentdock_tunnel_ed25519</string>
    <string>-R</string>
    <string>127.0.0.1:18765:127.0.0.1:8765</string>
    <string>agentdock-tunnel@203.0.113.10</string>
  </array>

  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
```

加载：

```bash
plutil -lint ~/Library/LaunchAgents/com.example.agentdock-reverse-tunnel.plist

launchctl bootstrap gui/$(id -u) \
  ~/Library/LaunchAgents/com.example.agentdock-reverse-tunnel.plist
```

查看状态：

```bash
launchctl print \
  gui/$(id -u)/com.example.agentdock-reverse-tunnel
```

我还会手动 kill 一次 SSH 或 kickstart 一次，确认它真的能自己恢复，而不是“配置文件看起来没问题”。

LaunchAgent 是用户登录以后运行。如果需要 Mac 开机但没人登录时也能访问，那是另一套 LaunchDaemon 配置，我目前没有混在这里处理。

## AgentDock 切到固定公网地址

前面的公网链路全部跑通以后，再去改 AgentDock 的公网 Origin。

配置文件：

```text
~/Library/Application Support/AgentDock/agentdock.env
```

核心是：

```bash
AGENTDOCK_HOST='127.0.0.1'
AGENTDOCK_PORT='8765'
AGENTDOCK_OAUTH_ENABLED='true'
AGENTDOCK_SERVER_URL='https://agent.example.com'
```

如果之前开过临时 Cloudflare Tunnel，我这里会把它关掉，避免同时维护两套公网地址。

原来的 Token、OAuth Password、Secret 都继续保留在本地配置里，不要复制到博客、Git 或截图里。

然后重启 AgentDock Core。

最终对外的 MCP 地址就是：

```text
https://agent.example.com/mcp
```

## 在网页版 GPT 里连接

最后就是在 ChatGPT 里添加这条远程 MCP 连接。

我填的是：

```text
https://agent.example.com/mcp
```

ChatGPT 的入口和界面以后可能会调整，我就不在这里把菜单位置写得特别死。按官方的 MCP / Plugin 连接流程添加公网地址即可：

[OpenAI：Connect and test your plugin](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)

第一次接好以后，我不会马上让它改项目，先做几个很小的测试：

```text
列出指定目录
读取一个文件
查看某个仓库的 git status
运行一个无副作用的命令
在测试目录创建文件再读回来
```

这些都正常以后，文件、Shell、Git 这条链路基本就通了。

## 我现在怎么用

接好以后，网页 GPT 就不只是聊天窗口了。

比如我可以直接说：

```text
查看 /Users/xxx/project/demo。
先读 AGENTS.md 和项目文档，再检查 git status。
分析当前问题，修复以后运行测试并提交 Git。
```

GPT 会自己去读电脑上的项目，而不是让我把几十个文件复制进聊天。

这也是我后面做定时开发工作流的基础：项目和运行状态都留在真实电脑上，GPT 每次重新读取，再继续工作。

所谓“伪无限 token”对我来说主要也是这个意思——不是模型真的没有限制，而是不需要把整个项目反复塞进聊天上下文。文件、Git、日志、进程都在电脑上，模型只在需要的时候读取。

## 几个我实际遇到的问题

### 502

公网域名能访问 Nginx，但上游没通。

我一般直接按这个顺序查：

```text
Mac AgentDock
↓
SSH 隧道
↓
服务器 127.0.0.1:18765
↓
Nginx
```

服务器上先跑：

```bash
curl http://127.0.0.1:18765/healthz
```

这里不通就先别看 Nginx。

### `remote port forwarding failed`

大概率是 18765 已经被旧 SSH 会话占用了：

```bash
sudo ss -lntp | grep 18765
```

### Mac 重登以后访问不了

先看 LaunchAgent：

```bash
launchctl print gui/$(id -u)/com.example.agentdock-reverse-tunnel
```

再看 SSH Key、host key、用户名和端口是不是正常。

### Cloudflare 临时域名失效

Quick Tunnel 的地址本来就可能变化。如果只是临时测试没关系；我这次折腾固定域名，就是不想再处理这件事。

## 最后检查几个点

真正暴露出去之前，我会确认：

```text
AgentDock 仍然只监听 127.0.0.1:8765
服务器 18765 只监听 127.0.0.1
公网只开放 80 / 443
MCP 有鉴权
SSH 隧道使用单独账号和单独 Key
Token / Secret 没有进 Git
SSH 断线以后可以自动恢复
```

做到这里以后，这条链路就比较稳定了。

对我来说，AgentDock 最有用的不是“远程执行一条命令”，而是终于可以把网页 GPT 和自己的真实开发环境接起来。

GPT 负责想和调工具，电脑负责保存文件、Git、进程和项目状态。

后面再往上叠任务板、项目文档和定时任务，就可以让它不只操作电脑，还能持续接着项目往下做。
