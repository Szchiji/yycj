(() => {
  ["detail-autoplay.js", "share.js", "admin-side.js", "boot-rescue.js", "gallery-watch.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911ab";
    document.head.appendChild(s);
  });
})();
