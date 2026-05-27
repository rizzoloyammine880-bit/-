const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "query-records.json");
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

http
  .createServer((request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

      if (url.pathname === "/") {
        serveStatic(response, "/index.html");
        return;
      }

      if (url.pathname === "/query") {
        renderQueryPage(request, response, url);
        return;
      }

      if (url.pathname === "/api/record") {
        renderRecordJson(request, response, url);
        return;
      }

      serveStatic(response, url.pathname);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("服务器错误");
    }
  })
  .listen(port, host, () => {
    console.log(`Dynamic anti-counterfeit server running at http://${host}:${port}`);
  });

function renderQueryPage(request, response, url) {
  const code = normalizeCode(url.searchParams.get("code")) || createDemoCode();
  const visitor = resolveVisitor(request, response, url);
  const query = registerQuery(code, visitor);

  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(pageHtml({
    code,
    visitor,
    currentQueryCount: query.currentQueryCount,
    visitorQueryCount: query.visitorQueryCount,
    visitorFirstTime: formatDateTime(query.visitorFirstQueryAt),
    visitorLastTime: formatDateTime(query.visitorLastQueryAt),
  }));
}

function renderRecordJson(request, response, url) {
  const code = normalizeCode(url.searchParams.get("code"));
  const visitor = normalizeVisitor(url.searchParams.get("wx") || url.searchParams.get("openid"));
  const store = readStore();
  const record = code ? store.codes[code] : null;
  const visitorRecord = record && visitor ? record.visitors[visitor] : null;

  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({
    code,
    visitor,
    exists: Boolean(record),
    currentQueryCount: record ? record.totalCount : 0,
    visitorQueryCount: visitorRecord ? visitorRecord.count : 0,
    visitorFirstQueryAt: visitorRecord ? visitorRecord.firstQueryAt : null,
    visitorLastQueryAt: visitorRecord ? visitorRecord.lastQueryAt : null,
  }));
}

function registerQuery(code, visitor) {
  const store = readStore();
  const now = new Date().toISOString();

  if (!store.codes[code]) {
    store.codes[code] = {
      totalCount: 0,
      firstQueryAt: now,
      lastQueryAt: now,
      visitors: {},
    };
  }

  const record = store.codes[code];
  if (!record.visitors[visitor]) {
    record.visitors[visitor] = {
      count: 0,
      firstQueryAt: now,
      lastQueryAt: now,
    };
  }

  const visitorRecord = record.visitors[visitor];
  record.totalCount += 1;
  record.lastQueryAt = now;
  visitorRecord.count += 1;
  visitorRecord.lastQueryAt = now;

  writeStore(store);

  return {
    currentQueryCount: record.totalCount,
    visitorQueryCount: visitorRecord.count,
    visitorFirstQueryAt: visitorRecord.firstQueryAt,
    visitorLastQueryAt: visitorRecord.lastQueryAt,
  };
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.codes) {
      return parsed;
    }
  } catch (error) {
    // The data file is created after the first successful query.
  }

  return { codes: {} };
}

function writeStore(store) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), "utf8");
}

function resolveVisitor(request, response, url) {
  const fromQuery = normalizeVisitor(url.searchParams.get("wx") || url.searchParams.get("openid"));
  if (fromQuery) {
    return fromQuery;
  }

  const cookies = parseCookies(request.headers.cookie || "");
  if (cookies.visitor_id) {
    return normalizeVisitor(cookies.visitor_id);
  }

  const generated = `WX-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  response.setHeader("Set-Cookie", `visitor_id=${generated}; Path=/; HttpOnly; SameSite=Lax`);
  return generated;
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((cookies, item) => {
    const index = item.indexOf("=");
    if (index > -1) {
      cookies[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
    }
    return cookies;
  }, {});
}

function serveStatic(response, pathname) {
  const filePath = path.resolve(root, `.${decodeURIComponent(pathname)}`);

  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("未找到页面");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": "public, max-age=3600",
  });
  fs.createReadStream(filePath).pipe(response);
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 36);
}

function normalizeVisitor(value) {
  return String(value || "")
    .trim()
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 64);
}

function createDemoCode() {
  return `BX${new Date().toISOString().slice(0, 10).replaceAll("-", "")}1688`;
}

function formatDateTime(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}年${map.month}月${map.day}日${map.hour}时${map.minute}分`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pageHtml(data) {
  const code = escapeHtml(data.code);
  const visitor = escapeHtml(data.visitor);
  const visitorFirstTime = escapeHtml(data.visitorFirstTime);
  const visitorLastTime = escapeHtml(data.visitorLastTime);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>防伪查询</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="page-shell">
      <section class="brand-visual" aria-label="品牌展示">
        <img src="/assets/reference.png" alt="品牌宣传图" />
      </section>

      <section class="query-panel">
        <div class="halo" aria-hidden="true"></div>

        <header class="query-title">
          <h1>防伪查询</h1>
          <p>SECURITY ENQUIRIES</p>
        </header>

        <article class="result-card">
          <p class="greeting">您好，您所查询的防伪码是</p>
          <div class="code-strip" id="securityCode">${code}</div>
          <p class="auth-text">是授权商品防伪系统登记的有效编码</p>
          <p class="thanks">感谢您的查询！</p>

          <div class="scan-status">
            <p id="currentCount">当前是第 ${data.currentQueryCount} 次查询</p>
            <p id="firstTime">首次查询时间是 ${visitorFirstTime}</p>
          </div>
        </article>

        <button class="record-button" id="recordButton" type="button">查询记录</button>

        <section class="record-drawer" id="recordDrawer" hidden>
          <div class="record-row">
            <span>防伪编码</span>
            <strong>${code}</strong>
          </div>
          <div class="record-row">
            <span>扫码微信</span>
            <strong>${visitor}</strong>
          </div>
          <div class="record-row">
            <span>当前查询次数</span>
            <strong>第 ${data.currentQueryCount} 次</strong>
          </div>
          <div class="record-row">
            <span>本微信查询</span>
            <strong>${data.visitorQueryCount} 次</strong>
          </div>
          <div class="record-row">
            <span>首次查询时间</span>
            <strong>${visitorFirstTime}</strong>
          </div>
          <div class="record-row">
            <span>最近查询时间</span>
            <strong>${visitorLastTime}</strong>
          </div>
        </section>

        <footer class="support">
          <p>技术支持：中企防伪</p>
          <p>Copyright 2010-2026 All Rights Reserved</p>
        </footer>
      </section>
    </main>

    <script src="/app.js"></script>
  </body>
</html>`;
}
