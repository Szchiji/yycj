(() => {
  ["share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911ah";
    document.head.appendChild(s);
  });
  if (!document.getElementById("yycj-pin-size")) {
    const st = document.createElement("style");
    st.id = "yycj-pin-size";
    st.textContent = `#topMeta{display:none!important;}#pins .pin-card{flex:0 0 48%!important;width:48%!important;min-width:48%!important;aspect-ratio:3/4!important;height:auto!important;max-height:none!important;}`;
    document.head.appendChild(st);
  }
})();
