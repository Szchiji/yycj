(() => {
  if (window.__yycjBootExtra) return;
  window.__yycjBootExtra = true;
  const st = document.createElement("style");
  st.textContent = "#topMeta,.top-meta{display:none!important;}#yycjGallery .gallery-hero video{width:100%;background:#111;}";
  document.head.appendChild(st);
  ["carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "home-head.js", "search-ui.js", "detail-polish.js", "sheet-fix.js", "me-polish.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911bf";
    document.head.appendChild(s);
  });
})();
