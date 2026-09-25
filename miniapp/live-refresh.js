(() => {
  window.yycjMarkDirty = function () {
    try { localStorage.setItem("yycj_bust", String(Date.now())); } catch (e) {}
  };
  window.yycjRefreshViews = function () {
    if (typeof window.__yycjPaintHomeNow === "function") window.__yycjPaintHomeNow();
    else if (typeof window.__yycjReloadHome === "function") window.__yycjReloadHome();
  };
})();
