(() => {
  ["scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js", "detail-polish.js", "sheet-fix.js", "me-polish.js"].forEach((name) => {
    const s = document.createElement("script");
    s.src = "./" + name + "?v=20260911az";
    document.head.appendChild(s);
  });
  const st = document.getElementById("yycj-nav-pin") || document.createElement("style");
  st.id = "yycj-nav-pin";
  st.textContent = `#pins .pin-card{flex:0 0 30%!important;width:30%!important;min-width:30%!important;aspect-ratio:3/4!important;}
#feed .cover-wrap .thumb,#feed .cover-card img.thumb,#favList .cover-wrap .thumb{height:148px!important;min-height:148px!important;max-height:148px!important;object-fit:cover!important;width:100%!important;}
#meGuide{display:none!important;}`;
  document.head.appendChild(st);
})();
