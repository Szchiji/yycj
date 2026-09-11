(() => {
  ["keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911ao";
    document.head.appendChild(s);
  });
  const st = document.getElementById("yycj-pin-size") || document.createElement("style");
  st.id = "yycj-pin-size";
  st.textContent = `html,body{background:#0b1020!important;}
#topMeta,#filterBar,#searchHint{display:none!important;}`;
  if (!st.parentNode) document.head.appendChild(st);
  document.getElementById("filterBar")?.remove();
  document.getElementById("searchHint")?.remove();
})();
