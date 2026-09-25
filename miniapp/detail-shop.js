(() => {
  if (window.__yycjDetailShop) return;
  window.__yycjDetailShop = true;
  window.__yycjLampCache = window.__yycjLampCache || {};
  if (!document.getElementById("yycj-shop-css")) {
    const st = document.createElement("style");
    st.id = "yycj-shop-css";
    st.textContent = "#view-detail{padding-bottom:92px;}#detailChrome{display:flex;justify-content:space-between;align-items:center;margin:4px 0 8px;}#detailChrome .right{display:flex;gap:8px;}#detailDock{position:fixed;left:12px;right:12px;bottom:62px;z-index:85;}#detailDock .btn{width:100%;height:44px;border-radius:22px;}#detail .kv{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.92rem;}#detail .kv .k{opacity:.62;min-width:3.2em;}#detail .kv .v{flex:1;word-break:break-all;}#detail .shop-open{color:#3ddc97;font-weight:600;}#detail .shop-rest,#detail .shop-wait{color:#9aa4b8;}#feed .badge-shop{position:absolute;left:6px;top:34px;z-index:3;font-size:10px;padding:2px 6px;border-radius:999px;}#feed .badge-shop.open{background:#1f8a5b;color:#fff;}#feed .badge-shop.rest,#feed .badge-shop.wait{background:rgba(0,0,0,.55);color:#ddd;}";
    document.head.appendChild(st);
  }
  function tgHref(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (/^(https?:\/\/|tg:\/\/)/i.test(s)) return s;
    if (s.startsWith("t.me/")) return "https://" + s;
    if (s.startsWith("@")) return "https://t.me/" + s.slice(1);
    if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(s)) return "https://t.me/" + s;
    return "";
  }
  function valHtml(val) {
    const safe = String(val || "").replace(/[<>]/g, "");
    const href = tgHref(val);
    if (href) return "<a class=\"tg-link\" href=\"" + href + "\" data-tg=\"" + href + "\">" + safe + "</a>";
    return safe;
  }
  function chrome(id) {
    const view = document.getElementById("view-detail");
    if (!view) return;
    let bar = document.getElementById("detailChrome");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "detailChrome";
      const back = document.getElementById("btnBackHome");
      if (back) view.insertBefore(bar, back);
      else view.insertBefore(bar, view.firstChild);
    }
    const back = document.getElementById("btnBackHome");
    bar.innerHTML = "<div class=\"left\"></div><div class=\"right\"><button class=\"btn\" type=\"button\" data-fav=\"" + (id || "") + "\" id=\"detailFavTop\">收藏</button><button class=\"btn\" type=\"button\" data-share=\"" + (id || "") + "\" id=\"detailShareTop\">分享</button></div>";
    if (back && back.parentNode !== bar.querySelector(".left")) bar.querySelector(".left").appendChild(back);
  }
  function dock(id, own) {
    let el = document.getElementById("detailDock");
    if (!el) {
      el = document.createElement("div");
      el.id = "detailDock";
      document.getElementById("app") && document.getElementById("app").appendChild(el);
    }
    const on = !((window.__yycjHome || {}).show_chat_cta === false);
    const label = String((window.__yycjHome || {}).chat_cta_label || "想聊聊");
    if (!on && !own) { el.innerHTML = ""; return; }
    el.innerHTML = own
      ? "<button class=\"btn\" type=\"button\" id=\"detailEditSelf\">编辑资料</button>"
      : "<button class=\"btn primary\" type=\"button\" id=\"detailChat\">" + label + "</button>";
    el.style.display = document.getElementById("view-detail") && document.getElementById("view-detail").classList.contains("hidden") ? "none" : "";
  }
  function paintShop(lamp) {
    const card = document.querySelector("#detail .card") || document.getElementById("detail");
    if (!card) return;
    const shop = lamp.shop || {};
    const extras = lamp.extras || {};
    const rows = [];
    const loc = [lamp.city, lamp.district, lamp.approx_label].filter(Boolean).join(" · ");
    if (loc) rows.push(["地区", loc]);
    if (lamp.price_text) rows.push(["价位", lamp.price_text]);
    Object.keys(extras).forEach((k) => {
      if (String(k).startsWith("_")) return;
      if (!String(extras[k] || "").trim()) return;
      if (k === "标签") return;
      rows.push([k, extras[k]]);
    });
    let box = document.getElementById("yycjKv");
    if (!box) {
      box = document.createElement("div");
      box.id = "yycjKv";
      const p = card.querySelector("p");
      if (p) card.insertBefore(box, p);
      else card.appendChild(box);
    }
    box.innerHTML = rows.map((kv) => "<div class=\"kv\"><span class=\"k\">" + kv[0] + "</span><span class=\"v\">" + valHtml(kv[1]) + "</span></div>").join("");
    let st = document.getElementById("yycjShop");
    if (!st) {
      st = document.createElement("div");
      st.id = "yycjShop";
      box.insertAdjacentElement("afterend", st);
    }
    if (shop.text) {
      const cls = shop.code === "open" ? "shop-open" : "shop-rest";
      st.innerHTML = "<div class=\"" + cls + "\">" + shop.text + (shop.hours ? " · " + shop.hours : "") + "</div>";
    } else st.innerHTML = "";
    const extrasBox = document.getElementById("yycjExtras");
    if (extrasBox) extrasBox.remove();
  }
  function sync() {
    const id = window.__yycjOpenLamp || (document.getElementById("detail") && document.getElementById("detail").getAttribute("data-lamp")) || "";
    const pack = (window.__yycjLampCache || {})[id] || {};
    const lamp = pack.lamp || pack;
    chrome(id);
    const me = JSON.parse(localStorage.getItem("yycj_user") || "{}");
    const own = !!(me && lamp && lamp.user_id && String(me.user_id) === String(lamp.user_id));
    dock(id, own);
    if (lamp && lamp.title) paintShop(lamp);
    const view = document.getElementById("view-detail");
    const dockEl = document.getElementById("detailDock");
    if (dockEl) dockEl.style.display = view && !view.classList.contains("hidden") ? "" : "none";
  }
  const _fetch = window.fetch;
  window.fetch = function () {
    const p = _fetch.apply(this, arguments);
    try {
      const u = String(arguments[0] || "");
      if (u.indexOf("/api/lamps/") >= 0) {
        p.then((r) => r.clone().json().then((data) => {
          const lamp = data.lamp || data;
          if (lamp && lamp.lamp_id) {
            window.__yycjLampCache = window.__yycjLampCache || {};
            window.__yycjLampCache[lamp.lamp_id] = data;
          }
          setTimeout(sync, 60);
        }).catch(() => {}));
      }
    } catch (e) {}
    return p;
  };
  document.addEventListener("click", () => setTimeout(sync, 200), true);
  const view = document.getElementById("view-detail");
  if (view) new MutationObserver(() => sync()).observe(view, { childList: true, subtree: false, attributes: true, attributeFilter: ["class"] });
})();
