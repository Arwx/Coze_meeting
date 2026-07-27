// 零依赖本地静态服务器（用于本地演示会议主持人工作台）。
//
// 用法：
//   node scripts/serve.mjs            # 默认 http://localhost:8000
//   node scripts/serve.mjs 5173       # 指定端口
//
// 为什么要用它：麦克风采集（getUserMedia）与语音识别只能在“安全上下文”下工作。
// http://localhost 被浏览器视为安全上下文，而直接双击打开的 file:// 不是，
// 会导致麦克风被拦、ASR 无法启动。所以本地务必通过这个服务器访问页面。

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = normalize(join(fileURLToPath(import.meta.url), "..", ".."));
const PORT = Number(process.argv[2]) || 8000;
const DEFAULT_FILE = "meeting-host-demo.html";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") {
      pathname = `/${DEFAULT_FILE}`;
    }

    // 防目录穿越：解析后必须仍在 ROOT 之内。
    const target = normalize(join(ROOT, pathname));
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
        .end(`404 Not Found: ${pathname}`);
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    }).end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
      .end(`500 Server Error: ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`本地服务器已启动：http://localhost:${PORT}/${DEFAULT_FILE}`);
  console.log("在浏览器打开上面的地址，然后点“开始会议”。按 Ctrl+C 停止。");
});
