(() => {
  ["share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911aj";
    document.head.appendChild(s);
  });
  const st = document.getElementById("yycj-pin-size") || document.createElement("style");
  st.id = "yycj-pin-size";
  st.textContent = `#topMeta{display:none!important;}
#homeSearch,.search-row{display:flex;gap:8px;align-items:center;margin:8px 0;}
#homeSearch input,.search-row input{flex:1;margin:0;}
#pins .pin-card{flex:0 0 38%!important;width:38%!important;min-width:38%!important;aspect-ratio:3/4!important;height:auto!important;max-height:none!important;}
#feed .cover-wrap .thumb,#feed .cover-card img.thumb,#favList .cover-wrap .thumb{height:148px!important;min-height:148px!important;max-height:148px!important;}`;
  if (!st.parentNode) document.head.appendChild(st);
})();
