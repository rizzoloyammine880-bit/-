(function () {
  const button = document.getElementById("recordButton");
  const drawer = document.getElementById("recordDrawer");
  const api = document.body.dataset.clientApi;

  let statusText = "查询记录";

  if (button && drawer) {
    button.addEventListener("click", function () {
      const shouldShow = drawer.hasAttribute("hidden");
      drawer.toggleAttribute("hidden", !shouldShow);
      button.textContent = shouldShow ? "收起记录" : statusText;
    });
  }

  loadQueryResult();

  async function loadQueryResult() {
    const params = new URLSearchParams(window.location.search);
    const code = normalizeCode(params.get("code"));
    const visitor = normalizeVisitor(params.get("wx") || params.get("openid")) || getLocalVisitorId();

    if (!code) {
      renderResult({
        code: "未检测到防伪码",
        visitor,
        currentQueryCount: "--",
        visitorQueryCount: "--",
        visitorFirstTime: "--",
        visitorLastTime: "--",
        status: "未检测到防伪码",
      });
      return;
    }

    setText("securityCode", code);

    try {
      const data = await fetchServerResult(params, code, visitor);
      renderResult({
        code: data.code || code,
        visitor: data.visitor || visitor,
        currentQueryCount: data.currentQueryCount || 1,
        visitorQueryCount: data.visitorQueryCount || 1,
        visitorFirstTime: data.visitorFirstTime || formatDateTime(new Date()),
        visitorLastTime: data.visitorLastTime || formatDateTime(new Date()),
        status: Number(data.currentQueryCount) === 1 ? "首次查询" : "重复查询",
      });
    } catch (error) {
      renderResult(buildLocalResult(code, visitor));
    }
  }

  async function fetchServerResult(params, code, visitor) {
    if (!api) {
      throw new Error("No server API configured");
    }

    const requestParams = new URLSearchParams(params);
    requestParams.set("code", code);
    if (!requestParams.get("wx") && !requestParams.get("openid")) {
      requestParams.set("wx", visitor);
    }

    const response = await fetch(`${api}?${requestParams.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Server API unavailable");
    }

    return response.json();
  }

  function buildLocalResult(code, visitor) {
    const key = `anti-counterfeit-demo:${code}`;
    const now = new Date();
    const fallback = {
      code,
      currentQueryCount: 0,
      firstQueryAt: now.toISOString(),
      visitors: {},
    };
    const record = readJson(key, fallback);

    if (!record.visitors[visitor]) {
      record.visitors[visitor] = {
        count: 0,
        firstQueryAt: now.toISOString(),
        lastQueryAt: now.toISOString(),
      };
    }

    record.currentQueryCount = Number(record.currentQueryCount || 0) + 1;
    record.lastQueryAt = now.toISOString();
    record.visitors[visitor].count += 1;
    record.visitors[visitor].lastQueryAt = now.toISOString();
    localStorage.setItem(key, JSON.stringify(record));

    return {
      code,
      visitor,
      currentQueryCount: record.currentQueryCount,
      visitorQueryCount: record.visitors[visitor].count,
      visitorFirstTime: formatDateTime(record.firstQueryAt),
      visitorLastTime: formatDateTime(record.visitors[visitor].lastQueryAt),
      status: record.currentQueryCount === 1 ? "首次查询" : "重复查询",
    };
  }

  function renderResult(data) {
    statusText = data.status;
    setText("securityCode", data.code);
    setText(
      "currentCount",
      data.currentQueryCount === "--" ? "当前查询次数 --" : `当前是第 ${data.currentQueryCount} 次查询`,
    );
    setText("firstTime", `首次查询时间是 ${data.visitorFirstTime}`);
    setText("recordCode", data.code);
    setText("recordVisitor", data.visitor);
    setText(
      "recordCurrentCount",
      data.currentQueryCount === "--" ? "--" : `第 ${data.currentQueryCount} 次`,
    );
    setText("recordVisitorCount", data.visitorQueryCount === "--" ? "--" : `${data.visitorQueryCount} 次`);
    setText("recordFirstTime", data.visitorFirstTime);
    setText("recordLastTime", data.visitorLastTime);

    if (button && drawer && drawer.hasAttribute("hidden")) {
      button.textContent = statusText;
    }
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? value : fallback;
    } catch (error) {
      return fallback;
    }
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

  function getLocalVisitorId() {
    const key = "anti-counterfeit-demo-visitor";
    const cached = localStorage.getItem(key);
    if (cached) {
      return cached;
    }

    const id = `WX-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    localStorage.setItem(key, id);
    return id;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    const parts = new Intl.DateTimeFormat("zh-CN", {
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

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }
})();
