(() => {
  if (window.__yycjDetailShop) return;
  window.__yycjDetailShop = true;
  window.__yycjLampCache = window.__yycjLampCache || {};
  if (!document.getElementById("yycj-shop-css")) {
    const st = document.createElement("style");
    st.id = "yycj-shop-css";
    st.textContent = "#view-detail{padding-bottom:92px;}#detailChrome{display:flex;justify-content:space-between;align-items:center;margin:4px 0 8px;}#detailChrome .right{display:flex;gap:8px;}#detailDock{position:fixed;left:12px;right:12px;bottom:62px;z-index:90;}#detailDock .btn{width:100%;height:44px;border-radius:22px;}#detail .kv{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06);}#detail .shop-open{color:#3ddc97;font-weight:600;}#detail .shop-rest{color:#9aa4b8;}#feed .badge-shop{position:absolute;left:6px;top:34px;z-index:3;font-size:10px;padding:2px 6px;border-radius:999px;}#feed .badge-shop.open{background:#1f8a5b;color:#fff;}#feed .badge-shop.rest,#feed .badge-shop.wait{background:rgba(0,0,0,.55);color:#ddd;}";
    document.head.appendChild(st);
  }
  function detailOn() {
    const v = document.getElementById("view-detail");
    return !!(v && !v.classList.contains("hidden"));
  }
  function tgHref(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (/^(https?:\/\/|tg:\/\/)/i.test(s)) return s;
    if (s.startsWith("@")) return "https://t.me/" + s.slice(1);
    if (s.startsWith("t.me/")) return "https://" + s;
    return "";
  }
  function valHtml(val) {
    const safe = String(val || "").replace(/[<>]/g, "");
    const href = tgHref(val);
    return href ? "<a class=\"tg-link\" href=\"" + href + "\" data-tg=\"" + href + "\">" + safe + "</a>" : safe;
  }
  function paintShop(lamp) {
    const card = document.querySelector("#detail .card") || document.getElementById("detail");
    if (!card || !lamp) return;
    const extras = lamp.extras || {};
    const shop = lamp.shop || {};
    const rows = [];
    const loc = [lamp.city, lamp.district, lamp.approx_label].filter(Boolean).join(" · ");
    if (loc) rows.push(["地区", loc]);
    if (lamp.price_text) rows.push(["价位", lamp.price_text]);
    Object.keys(extras).forEach((k) => {
      if (String(k).startsWith("_")) return;
      if (!String(extras[k] || "").trim()) return;
      rows.push([k, extras[k]]);
    });
    let box = document.getElementById("yycjKv");
    if (!box) {
      box = document.createElement("div");
      box.id = "yycjKv";
      card.appendChild(box);
    }
    box.innerHTML = rows.map((kv) => "<div class=\"kv\"><span class=\"k\">" + kv[0] + "</span><span class=\"v\">" + valHtml(kv[1]) + "</span></div>").join("");
    let st = document.getElementById("yycjShop");
    if (!st) {
      st = document.createElement("div");
      st.id = "yycjShop";
      box.insertAdjacentElement("afterend", st);
    }
    st.innerHTML = shop.text ? ("<div class=\"" + (shop.code === "open" ? "shop-open" : "shop-rest") + "\">" + shop.text + (shop.hours ? " · " + shop.hours : "") + "</div>") : "";
  }
  function dock(id) {
    let el = document.getElementById("detailDock");
    if (!el) {
      el = document.createElement("div");
      el.id = "detailDock";
      document.body.appendChild(el);
    }
    if (!detailOn()) { el.style.display = "none"; return; }
    const label = String((window.__yycjHome || {}).chat_cta_label || "想聊聊");
    const hide = (window.__yycjHome || {}).show_chat_cta === false;
    el.style.display = hide ? "none" : "block";
    el.innerHTML = hide ? "" : "<button class=\"btn primary\" type=\"button\" id=\"detailChat\">" + label + "</button>";
  }
  function sync() {
    if (!detailOn()) {
      const el = document.getElementById("detailDock");
      if (el) el.style.display = "none";
      return;
    }
    const id = window.__yycjOpenLamp || "";
    const pack = (window.__yycjLampCache || {})[id] || {};
    paintShop(pack.lamp || pack);
    dock(id);
  }
  const raw = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const p = raw(url, opts);
    const u = String(url || "");
    if (u.indexOf("/api/lamps/") >= 0) {
      p.then((r) => r.clone().json().then((data) => {
        const lamp = data.lamp || data;
        if (lamp && lamp.lamp_id) {
          window.__yycjLampCache[lamp.lamp_id] = data;
          window.__yycjOpenLamp = lamp.lamp_id;
          setTimeout(sync, 80);
        }
      }).catch(() => {}));
    }
    return p;
  };
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]")) {
      setTimeout(sync, 300);
    }
    if (ev.target && ev.target.closest && ev.target.closest("[data-nav]")) {
      const el = document.getElementById("detailDock");
      if (el) el.style.display = "none";
    }
  });
})();
