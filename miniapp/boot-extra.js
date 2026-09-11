(() => {
  ["scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911as";
    document.head.appendChild(s);
  });
})();
