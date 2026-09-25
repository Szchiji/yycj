(() => {
  if (window.__yycjLive) return;
  window.__yycjLive = true;
  const raw = window.fetch.bind(window);
  window.fetch = function (url, opt) {
    const u = String(url || "");
    opt = opt ? Object.assign({}, opt) : {};
    const get = !opt.method || String(opt.method).toUpperCase() === "GET";
    if (get && u.indexOf("/api/") === 0 && u.indexOf("_=") < 0) {
      opt.cache = "no-store";
      url = u + (u.indexOf("?") >= 0 ? "&" : "?") + "_=" + (localStorage.getItem("yycj_bust") || "1");
    }
    return raw(url, opt);
  };
  window.yycjMarkDirty = function () {
    localStorage.setItem("yycj_bust", String(Date.now()));
    window.__yycjDirty = true;
  };
  window.yycjRefreshViews = function () {
    if (window.__yycjLampCache) {
      Object.keys(window.__yycjLampCache).forEach((k) => { delete window.__yycjLampCache[k]; });
    }
    if (typeof window.__yycjReloadHome === "function") window.__yycjReloadHome();
    document.getElementById("btnRefresh")?.click();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && window.__yycjDirty) {
      window.__yycjDirty = false;
      window.yycjRefreshViews();
    }
  });
})();
