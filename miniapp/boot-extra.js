(() => {
  ["scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911at";
    document.head.appendChild(s);
  });
  const st = document.getElementById("yycj-nav-pin") || document.createElement("style");
  st.id = "yycj-nav-pin";
  st.textContent = `#app{overflow:visible!important;height:auto!important;transform:none!important;}.bottom-nav{position:fixed!important;left:0!important;right:0!important;bottom:0!important;transform:none!important;z-index:80!important;}`;
  document.head.appendChild(st);
})();
