(() => {
  ["scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js", "detail-polish.js", "sheet-fix.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911ax";
    document.head.appendChild(s);
  });
  const st = document.getElementById("yycj-nav-pin") || document.createElement("style");
  st.id = "yycj-nav-pin";
  st.textContent = `#app{overflow:visible!important;height:auto!important;transform:none!important;}
.bottom-nav{position:fixed!important;left:0;right:0;bottom:0;z-index:80!important;}
.sheet{z-index:120!important;}
#pins .pin-card{flex:0 0 34%!important;width:34%!important;min-width:34%!important;aspect-ratio:3/4!important;}
#feed .cover-wrap .thumb,#feed .cover-card img.thumb,#favList .cover-wrap .thumb{height:168px!important;min-height:168px!important;max-height:168px!important;object-fit:cover!important;width:100%!important;}`;
  document.head.appendChild(st);
})();
