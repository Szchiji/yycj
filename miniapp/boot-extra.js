(() => {
  if (window.__yycjBootExtra) return;
  window.__yycjBootExtra = true;
  const st = document.getElementById("yycj-home-hide") || document.createElement("style");
  st.id = "yycj-home-hide";
  st.textContent = "#topMeta,.top-meta{display:none!important;}";
  document.head.appendChild(st);
  document.getElementById("topMeta")?.classList.add("hidden");
  ["scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js", "detail-polish.js", "sheet-fix.js", "me-polish.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911be";
    document.head.appendChild(s);
  });
})();
