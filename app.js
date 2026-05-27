(function () {
  const button = document.getElementById("recordButton");
  const drawer = document.getElementById("recordDrawer");

  if (button && drawer) {
    button.addEventListener("click", function () {
      const shouldShow = drawer.hasAttribute("hidden");
      drawer.toggleAttribute("hidden", !shouldShow);
      button.textContent = shouldShow ? "收起记录" : "查询记录";
    });
  }

  const api = document.body.dataset.clientApi;
  if (!api) {
    return;
  }

  loadQueryResult().catch(function () {
    setText("securityCode", "查询失败");
    setText("currentCount", "当前查询次数暂时无法获取");
    setText("firstTime", "首次查询时间暂时无法获取");
  });

  async function loadQueryResult() {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("code")) {
      params.set("code", createDemoCode());
    }

    const response = await fetch(`${api}?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Query request failed");
    }

    const data = await response.json();
    setText("securityCode", data.code);
    setText("currentCount", `当前是第 ${data.currentQueryCount} 次查询`);
    setText("firstTime", `首次查询时间是 ${data.visitorFirstTime}`);
    setText("recordCode", data.code);
    setText("recordVisitor", data.visitor);
    setText("recordCurrentCount", `第 ${data.currentQueryCount} 次`);
    setText("recordVisitorCount", `${data.visitorQueryCount} 次`);
    setText("recordFirstTime", data.visitorFirstTime);
    setText("recordLastTime", data.visitorLastTime);
  }

  function createDemoCode() {
    return `BX${new Date().toISOString().slice(0, 10).replaceAll("-", "")}1688`;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }
})();
