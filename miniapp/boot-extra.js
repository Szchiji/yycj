(() => {
  if (window.__yycjBootExtra) return;
  window.__yycjBootExtra = true;
  const st = document.getElementById("yycj-home-hide") || document.createElement("style");
  st.id = "yycj-home-hide";
  st.textContent = "#feed:not(.yycj-on),#pins:not(.yycj-on){visibility:hidden!important;}";
  document.head.appendChild(st);
  setInterval(() => {
    const feed = document.getElementById("feed");
    const pins = document.getElementById("pins");
    if (feed && feed.querySelector(".cover-card,.cover-wrap")) feed.classList.add("yycj-on");
    if (pins && (pins.querySelector(".pin-card") || pins.classList.contains("hidden"))) pins.classList.add("yycj-on");
  }, 120);
  ["scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js", "detail-polish.js", "sheet-fix.js", "me-polish.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911bc";
    document.head.appendChild(s);
  });
})();
