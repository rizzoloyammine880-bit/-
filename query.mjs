import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ error: "Only GET is supported" }, 405);
  }

  const url = new URL(request.url);
  const code = normalizeCode(url.searchParams.get("code")) || createDemoCode();
  const visitor = resolveVisitor(request, url);
  const query = await registerQuery(code, visitor.id);
  const responseHeaders = { ...headers };

  if (visitor.cookie) {
    responseHeaders["Set-Cookie"] = `visitor_id=${visitor.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
  }

  return json({
    code,
    visitor: visitor.id,
    currentQueryCount: query.currentQueryCount,
    visitorQueryCount: query.visitorQueryCount,
    visitorFirstTime: formatDateTime(query.visitorFirstQueryAt),
    visitorLastTime: formatDateTime(query.visitorLastQueryAt),
  }, 200, responseHeaders);
}

async function registerQuery(code, visitor) {
  const store = getStore({ name: "anti-counterfeit-records", consistency: "strong" });
  const now = new Date().toISOString();
  const key = `codes/${encodeURIComponent(code)}.json`;
  const record = (await store.get(key, { type: "json" })) || {
    totalCount: 0,
    firstQueryAt: now,
    lastQueryAt: now,
    visitors: {},
  };

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

  await store.setJSON(key, record);

  return {
    currentQueryCount: record.totalCount,
    visitorQueryCount: visitorRecord.count,
    visitorFirstQueryAt: visitorRecord.firstQueryAt,
    visitorLastQueryAt: visitorRecord.lastQueryAt,
  };
}

function resolveVisitor(request, url) {
  const fromQuery = normalizeVisitor(url.searchParams.get("wx") || url.searchParams.get("openid"));
  if (fromQuery) {
    return { id: fromQuery, cookie: false };
  }

  const cookies = parseCookies(request.headers.get("cookie") || "");
  if (cookies.visitor_id) {
    return { id: normalizeVisitor(cookies.visitor_id), cookie: false };
  }

  return {
    id: `WX-${cryptoRandomHex(5)}`,
    cookie: true,
  };
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
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}年${map.month}月${map.day}日${map.hour}时${map.minute}分`;
}

function cryptoRandomHex(bytes) {
  return randomBytes(bytes).toString("hex").toUpperCase();
}

function json(payload, status = 200, customHeaders = headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: customHeaders,
  });
}
