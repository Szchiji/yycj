(() => {
  ["home-lock.js", "scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js", "detail-polish.js", "sheet-fix.js", "me-polish.js"].forEach((name) => {
    const s = document.createElement("script");
    s.src = "./" + name + "?v=20260911ba";
    document.head.appendChild(s);
  });
})();
