(() => {
  function paint() {
    (window.__yycjHomeItems || []).forEach((t) => {
      if (!t || !t.lamp_id || !t.shop || !t.shop.text) return;
      const card = document.querySelector('#feed [data-id="' + t.lamp_id + '"] .cover-wrap');
      if (!card || card.querySelector(".badge-shop")) return;
      const s = document.createElement("span");
      s.className = "badge-shop " + (t.shop.code || "");
      s.textContent = t.shop.text;
      card.appendChild(s);
    });
  }
  const raw = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const p = raw(url, opts);
    try {
      if (String(url || "").indexOf("/api/home") >= 0) {
        p.then((r) => r.clone().json().then((data) => {
          window.__yycjHomeItems = data.items || [];
          setTimeout(paint, 50);
        }).catch(() => {}));
      }
    } catch (e) {}
    return p;
  };
  setInterval(paint, 2000);
})();
