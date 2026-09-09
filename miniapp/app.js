(() => {
  Promise.all([
    fetch("./app.p1.js?v=20260910b").then((r) => {
      if (!r.ok) throw new Error("app.p1 " + r.status);
      return r.text();
    }),
    fetch("./app.p2.js?v=20260910b").then((r) => {
      if (!r.ok) throw new Error("app.p2 " + r.status);
      return r.text();
    }),
  ])
    .then(([a, b]) => {
      const s = document.createElement("script");
      s.textContent = a + b;
      document.body.appendChild(s);
    })
    .catch((e) => {
      const el = document.getElementById("bootMsg");
      if (el) el.textContent = "脚本加载失败：" + (e && e.message ? e.message : String(e));
      const retry = document.getElementById("bootRetry");
      if (retry) retry.classList.remove("hidden");
    });
})();
