(() => {
  if (window.__yycjLive) return;
  window.__yycjLive = true;
  const raw = window.fetch.bind(window);
  window.fetch = function (url, opt) {
    const u = String(url || "");
    opt = opt ? Object.assign({}, opt) : {};
    const get = !opt.method || String(opt.method).toUpperCase() === "GET";
    if (get && u.indexOf("/api/") === 0) {
      opt.cache = "no-store";
      const join = u.indexOf("?") >= 0 ? "&" : "?";
      url = u + join + "_=" + (localStorage.getItem("yycj_bust") || Date.now());
    }
    return raw(url, opt);
  };
  window.yycjMarkDirty = function () {
    localStorage.setItem("yycj_bust", String(Date.now()));
  };
  window.yycjRefreshViews = function () {
    if (window.__yycjLampCache) {
      Object.keys(window.__yycjLampCache).forEach((k) => { delete window.__yycjLampCache[k]; });
    }
    if (typeof window.__yycjReloadHome === "function") window.__yycjReloadHome();
    document.getElementById("btnRefresh")?.click();
    const id = document.getElementById("detail")?.getAttribute("data-lamp");
    if (id && typeof window.openLamp === "function") {
      const view = document.getElementById("view-detail");
      if (view && !view.classList.contains("hidden")) window.openLamp(id);
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") window.yycjRefreshViews();
  });
  window.addEventListener("pageshow", () => window.yycjRefreshViews());
  window.addEventListener("storage", (e) => {
    if (e.key === "yycj_bust") window.yycjRefreshViews();
  });
})();
