(() => {
  const raw = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const p = raw(url, opts);
    if (String(url || "").indexOf("/api/home") === 0) {
      p.then((r) => r.clone().json().then((data) => {
        window.__yycjHomeItems = data.items || [];
        setTimeout(paint, 40);
      }).catch(() => {}));
    }
    return p;
  };
  function paint() {
    (window.__yycjHomeItems || []).forEach((t) => {
      const wrap = document.querySelector("#feed [data-id=\"" + t.lamp_id + "\"] .cover-wrap");
      if (!wrap || wrap.querySelector(".badge-shop")) return;
      if (t.shop && t.shop.text) {
        const s = document.createElement("span");
        s.className = "badge-shop " + (t.shop.code || "");
        s.textContent = t.shop.text;
        wrap.appendChild(s);
      }
    });
  }
  document.addEventListener("click", () => setTimeout(paint, 200), true);
})();
