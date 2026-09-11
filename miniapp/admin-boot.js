(() => {
  const st = document.getElementById("yycj-admin-scroll") || document.createElement("style");
  st.id = "yycj-admin-scroll";
  st.textContent = `html,body,body.admin-body{
    height:auto!important;max-height:none!important;min-height:100%!important;
    overflow:auto!important;overflow-y:scroll!important;
    -webkit-overflow-scrolling:touch!important;position:static!important;
  }
  #app,#boot,#gate,#console,.admin-shell,.admin-main{
    height:auto!important;max-height:none!important;
    overflow:visible!important;
  }
  .admin-main{min-height:70vh;padding-bottom:80px!important;}`;
  document.head.appendChild(st);
  const unlock = () => {
    [document.documentElement, document.body].forEach((el) => {
      if (!el) return;
      el.style.setProperty("height", "auto", "important");
      el.style.setProperty("max-height", "none", "important");
      el.style.setProperty("overflow", "auto", "important");
      el.style.setProperty("overflow-y", "scroll", "important");
      el.style.setProperty("position", "static", "important");
    });
  };
  unlock();
  setTimeout(unlock, 300);
  setTimeout(unlock, 1200);
  ["admin-side.js", "admin-chats.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911aq";
    document.head.appendChild(s);
  });
})();
