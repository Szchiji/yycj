(() => {
  if (window.__yycjPubFields) return;
  window.__yycjPubFields = true;
  function extraWrap() {
    let el = document.getElementById("pubExtras");
    if (el) return el;
    const form = document.getElementById("publishForm");
    if (!form) return null;
    el = document.createElement("div");
    el.id = "pubExtras";
    const btn = form.querySelector("button[type=submit]");
    form.insertBefore(el, btn || null);
    return el;
  }
  async function load() {
    const wrap = extraWrap();
    if (!wrap) return;
    let fields = [];
    try {
      const token = localStorage.getItem("yycj_token") || "";
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      fields = Array.isArray(data.listing_fields) ? data.listing_fields : [];
    } catch (e) {}
    wrap.innerHTML = fields.filter((f) => f && f.key).map((f) => {
      const k = String(f.key).replace(/"/g, "");
      return `<label>${k}</label><input data-extra="${k}" maxlength="64" placeholder="${k}" />`;
    }).join("");
  }
  const origFetch = window.fetch;
  window.fetch = function (url, opt) {
    try {
      const u = String(url || "");
      if ((u.includes("/api/posts") || u.includes("/api/me/listings")) && opt && typeof opt.body === "string") {
        const extras = {};
        document.querySelectorAll("[data-extra]").forEach((inp) => {
          const v = (inp.value || "").trim();
          if (v) extras[inp.getAttribute("data-extra")] = v;
        });
        const body = JSON.parse(opt.body);
        body.extras = extras;
        opt = Object.assign({}, opt, { body: JSON.stringify(body) });
      }
    } catch (e) {}
    return origFetch.apply(this, [url, opt]);
  };
  setTimeout(load, 600);
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-nav") === "publish") setTimeout(load, 200);
  });
})();
