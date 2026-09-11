(() => {
  ["admin-side.js", "admin-chats.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911ac";
    document.head.appendChild(s);
  });
})();
