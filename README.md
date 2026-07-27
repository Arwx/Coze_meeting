# 会议主持人工作台（本地演示）

一个纯前端的会议助手演示页：屏幕共享 + 实时语音转写（ASR）+ 结构化纪要 + 历史纪要查询。
ASR 走 **Coze 官方实时语音转写**，纪要/保存/查询走 **Coze 工作流**。

## 本地运行

麦克风采集和语音识别只能在**安全上下文**下工作。`http://localhost` 算安全上下文，
而直接双击打开的 `file://` **不算**，会导致麦克风被拦、ASR 无法启动。所以务必用本地服务器打开。

需要 Node.js（已内置零依赖脚本，无需 npm install）：

```bash
node scripts/serve.mjs
```

然后在浏览器打开 <http://localhost:8000/meeting-host-demo.html>，点“开始会议”。
想换端口：`node scripts/serve.mjs 5173`。

> 也可以用任意静态服务器，例如 `npx serve` 或 `python -m http.server 8000`，只要通过 `localhost` 访问即可。

## 配置

密钥放在 `config.local.js`（已被 `.gitignore` 忽略，不会提交）。首次使用可从 `config.js` 复制一份：

```js
// config.local.js
window.MEETING_HOST_CONFIG = {
  coze: {
    baseUrl: "https://api.coze.cn",
    pat: "pat_你的PersonalAccessToken",
    workflows: {
      generateMinutes: "工作流ID",
      saveMinutes: "工作流ID",
      searchMinutes: "工作流ID",
      receiveTranscript: "" // 可选：转写清洗工作流
    }
  }
};
```

## 关于 ASR（语音转写）

- **用的是 Coze 官方实时语音转写**（SDK `@coze/api` 的 `WsTranscriptionClient`，从 CDN 动态加载），
  浏览器可直连 `wss://ws.coze.cn`，**无需后端代理、无需新增工作流**。
- 只需一个 **PAT**，且该 PAT 需具备**语音/音频相关权限**（在 Coze 控制台创建 PAT 时勾选，
  建议直接勾全部权限）。这是最常见的“ASR 连不上”原因。
- 若 Coze ASR 启动失败，会自动降级到浏览器自带的 Web Speech API。
  ⚠️ 注意：浏览器 Web Speech 依赖 Google 语音服务器，**中国大陆直连通常无法访问（报 `network`）**，
  所以正式使用请以 Coze ASR 为准。

> 安全提醒：PAT 直接写在浏览器可读的 `config.local.js` 里，任何能打开页面/开发者工具的人都能看到它。
> 本方案仅适合本地演示，请勿把带真实 PAT 的页面公开部署。
