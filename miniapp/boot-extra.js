(() => {
  ["share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911af";
    document.head.appendChild(s);
  });
})();
