(() => {
  ["scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911av";
    document.head.appendChild(s);
  });
  const st = document.getElementById("yycj-nav-pin") || document.createElement("style");
  st.id = "yycj-nav-pin";
  st.textContent = `#app{overflow:visible!important;height:auto!important;transform:none!important;}
.bottom-nav{position:fixed!important;left:0;right:0;bottom:0;z-index:80!important;}
#feed .cover-wrap .thumb,#feed .cover-card img.thumb,#favList .cover-wrap .thumb{height:220px!important;min-height:220px!important;object-fit:cover!important;width:100%!important;}
#yycjGallery .gallery-hero{min-height:280px!important;}
#yycjGallery .gallery-hero img,#yycjGallery .gallery-hero video{
  width:100%!important;max-height:72vh!important;min-height:280px!important;
  object-fit:contain!important;
}
#yycjGallery .g-thumb{flex-basis:72px!important;width:72px!important;height:72px!important;}`;
  document.head.appendChild(st);
})();
