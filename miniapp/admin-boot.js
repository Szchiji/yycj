(() => {
  ["admin-hydrate.js", "admin-fill.js"].forEach((name) => {
    if (document.querySelector('script[src*="' + name + '"]')) return;
    const s = document.createElement("script");
    s.src = "./" + name + "?v=20260911aa";
    document.body.appendChild(s);
  });
})();
