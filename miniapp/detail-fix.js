(() => {
  if (window.__yycjDetail) return;
  window.__yycjDetail = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  window.__yycjLampCache = window.__yycjLampCache || {};
  let sharedOpened = false;
  if (!document.getElementById("yycj-gallery-css")) {
    const st = document.createElement("style");
    st.id = "yycj-gallery-css";
    st.textContent = `#detail .media-grid{display:none!important;}
#yycjGallery{margin:8px 0 10px;position:relative;z-index:2;}
#yycjGallery .gallery-hero{width:100%;border-radius:14px;overflow:hidden;background:#0b0f18;min-height:240px;position:relative;}
#yycjGallery .gallery-hero img,#yycjGallery .gallery-hero video{width:100%;max-height:360px;object-fit:contain;background:#0b0f18;display:block;}
#yycjGallery .gallery-thumbs{display:flex;gap:6px;overflow-x:auto;margin-top:8px;-webkit-overflow-scrolling:touch;}
#yycjGallery .g-thumb{position:relative;flex:0 0 54px;width:54px;height:54px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#1a2233;z-index:3;}
#yycjGallery .g-thumb.on{border-color:#7ea8ff;}
#yycjGallery .g-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
#yycjGallery .g-thumb .play,#yycjGallery .hero-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.28);font-size:18px;pointer-events:none;}
#detailInfo{margin:8px 0 96px;}
#detailInfo h2{margin:0 0 8px;font-size:1.35rem;}
#detailInfo .muted{margin:4px 0;}
#detailInfo .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
#detailInfo .row .btn{flex:1;min-width:72px;border-radius:18px;}
#yycjTags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}
#yycjTags .tag{display:inline-block;padding:2px 8px;border-radius:999px;background:#6d4aff;color:#fff;font-size:11px;}
#yycjExtras .ex-line{display:flex;gap:8px;margin:6px 0;}
#yycjExtras .ex-k{opacity:.7;min-width:3em;}
#yycjExtras a{color:#8ec8ff;}`;
    document.head.appendChild(st);
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 2800);
  }
  function host() {
    const view = document.getElementById("view-detail");
    if (!view) return null;
    let el = document.getElementById("yycjGallery");
    if (!el) {
      el = document.createElement("div");
      el.id = "yycjGallery";
      const detail = document.getElementById("detail");
      if (detail) view.insertBefore(el, detail);
      else view.appendChild(el);
    }
    return el;
  }
  function srcOf(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.toLowerCase().startsWith("file_id:")) return srcOf(s.slice(8).trim());
    if (s.startsWith("http") || s.startsWith("/")) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function isVideo(m, raw) {
    const t = (m && m.type) || "";
    const u = String(raw || (m && (m.file_id || m.url)) || "");
    return t === "video" || u.startsWith("BAAC") || u.startsWith("BQAC") || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(u);
  }
  function collect(lamp) {
    const out = [];
    (lamp.media || []).forEach((m) => {
      const raw = String((m && (m.file_id || m.url)) || "").trim();
      const src = srcOf(raw);
      if (!src) return;
      const vid = isVideo(m, raw);
      let poster = srcOf(m && (m.thumb_file_id || m.thumbnail || m.preview_url || ""));
      if (poster && isVideo({}, poster)) poster = "";
      out.push({ type: vid ? "video" : "image", src, poster, raw });
    });
    if (!out.length) (lamp.photos || []).forEach((p) => {
      const src = srcOf(p);
      if (src) out.push({ type: isVideo({}, p) ? "video" : "image", src, poster: "", raw: p });
    });
    return out;
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
  function extrasHtml(extras) {
    const data = extras && typeof extras === "object" ? extras : {};
    const keys = Object.keys(data).filter((k) => !String(k).startsWith("_") && String(data[k] || "").trim() && k !== "标签");
    return keys.map((k) => {
      const val = String(data[k]);
      const href = tgHref(val);
      const v = href ? `<a class="tg-link" href="${esc(href)}" data-tg="${esc(href)}">${esc(val)}</a>` : esc(val);
      return `<div class="ex-line"><span class="ex-k">${esc(k)}</span><span class="ex-v">${v}</span></div>`;
    }).join("");
  }
  function ctaOn() {
    const v = (window.__yycjHomeData || {}).show_chat_cta;
    return !(v === false || v === 0 || v === "0" || v === "false");
  }
  function ctaLabel() {
    return String((window.__yycjHomeData || {}).chat_cta_label || "想聊聊").slice(0, 32);
  }
  function infoHtml(lamp, reviews) {
    const id = esc(lamp.lamp_id || "");
    const loc = [lamp.city, lamp.district, lamp.approx_label].filter(Boolean).join(" · ");
    const tags = (lamp.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("");
    const chat = ctaOn() ? `<button class="btn primary" id="detailChat" type="button" data-lamp="${id}">${esc(ctaLabel())}</button>` : "";
    const rev = (reviews || []).map((t) => {
      const stars = "★".repeat(t.stars || 0) + "☆".repeat(Math.max(0, 5 - (t.stars || 0)));
      return `<div class="card" style="margin:8px 0"><div class="muted">${stars}</div><p>${esc(t.text || "")}</p></div>`;
    }).join("") || "<p class='muted'>暂无评价</p>";
    return `<div class="card" id="detailInfo">
      <h2>${esc(lamp.title || "")}</h2>
      <div class="muted">📍 ${esc(loc || "")}</div>
      <div class="muted">💰 ${esc(lamp.price_text || "面议")}</div>
      <div id="yycjTags">${tags}</div>
      <div id="yycjExtras">${extrasHtml(lamp.extras)}</div>
      <p>${esc(lamp.description || "")}</p>
      <div class="row">
        <button class="btn" id="detailReport" type="button" data-report="${id}">举报</button>
        <button class="btn" id="detailReview" type="button" data-review="${id}">写评价</button>
        <button class="btn" id="detailShare" type="button" data-share="${id}">分享</button>
        ${chat}
      </div>
      <h3 style="font-size:1rem;margin:16px 0 6px">评价</h3>
      ${rev}
    </div>`;
  }
  function render(items, lampId, idx, play) {
    const el = host();
    if (!el || !items.length) return;
    if (idx < 0 || idx >= items.length) idx = 0;
    const cur = items[idx];
    el.dataset.lamp = lampId || "";
    const poster = cur.poster || "";
    let hero;
    if (cur.type === "video" && play) {
      hero = `<video src="${cur.src}" ${poster ? `poster="${poster}"` : ""} playsinline controls preload="metadata"></video>`;
    } else if (cur.type === "video") {
      hero = `${poster ? `<img src="${poster}" alt="" />` : `<div style="height:240px;background:#111"></div>`}<span class="hero-play">▶</span>`;
    } else {
      hero = `<img src="${cur.src}" alt="" />`;
    }
    el.innerHTML = `<div class="gallery-hero">${hero}</div>
      <div class="gallery-thumbs">${items.map((m, i) => `<button type="button" class="g-thumb${i === idx ? " on" : ""}" data-g="${i}">${
        m.type === "video"
          ? `${m.poster ? `<img src="${m.poster}" alt="" />` : ""}<span class="play">▶</span>`
          : `<img src="${m.src}" alt="" />`
      }</button>`).join("")}</div>`;
    el.querySelectorAll("[data-g]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const n = Number(btn.getAttribute("data-g") || 0);
        render(items, lampId, n, items[n] && items[n].type === "video");
      });
    });
    const heroBox = el.querySelector(".gallery-hero");
    if (heroBox && cur.type === "video" && !play) {
      heroBox.addEventListener("click", (ev) => { ev.preventDefault(); render(items, lampId, idx, true); });
    }
  }
  async function paint(id) {
    if (!id) return;
    if (window.__yycjOpenLamp === id && document.getElementById("detailInfo")) return;
    window.__yycjOpenLamp = id;
    const box = document.getElementById("detail");
    if (box) box.setAttribute("data-lamp", id);
    const cached = window.__yycjLampCache[id];
    if (cached && (cached.lamp || cached.item)) {
      const lamp = cached.lamp || cached.item || cached;
      render(collect(lamp), id, 0, false);
      if (box) box.innerHTML = infoHtml(lamp, cached.reviews || []);
    }
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token() },
      });
      const data = await r.json();
      window.__yycjLampCache[id] = data;
      const lamp = data.lamp || data.item || data;
      render(collect(lamp), id, 0, false);
      if (box) box.innerHTML = infoHtml(lamp, data.reviews || []);
    } catch (e) { console.warn(e); }
  }
  function shareUrl(id) {
    const bot = ((window.__yycjHomeData || {}).contacts || {}).bot_username || "";
    if (bot) return "https://t.me/" + String(bot).replace(/^@/, "") + "?startapp=" + encodeURIComponent(id);
    return location.origin + "/app/go.html?lamp=" + encodeURIComponent(id);
  }
  function openTgChat(href) {
    if (!href) return;
    if (typeof window.__yycjPauseUi === "function") window.__yycjPauseUi();
    document.querySelectorAll("video").forEach((v) => { try { v.pause(); } catch (e) {} });
    const tg = window.Telegram && window.Telegram.WebApp;
    try {
      if (tg && tg.openTelegramLink && /t\.me\/|tg:\/\//i.test(href)) {
        tg.openTelegramLink(href);
        return;
      }
    } catch (e) {}
    toast("链接已准备：" + href);
    try { navigator.clipboard.writeText(href); } catch (e) {}
  }
  window.openLamp = function (id) {
    window.__yycjBack = window.__yycjBack || "home";
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-detail")?.classList.remove("hidden");
    paint(id);
  };
  document.addEventListener("click", async (ev) => {
    const a = ev.target.closest("a[data-tg], #yycjExtras a");
    if (a) {
      ev.preventDefault();
      ev.stopPropagation();
      openTgChat(a.getAttribute("data-tg") || a.getAttribute("href") || "");
      return;
    }
    if (ev.target.closest("#detailShare")) {
      ev.preventDefault();
      const id = ev.target.closest("#detailShare").getAttribute("data-share") || window.__yycjOpenLamp;
      const url = shareUrl(id);
      try { await navigator.clipboard.writeText(url); toast("链接已复制，发给好友"); }
      catch (e) { toast(url); }
      return;
    }
    if (ev.target.closest("#detailReview")) {
      ev.preventDefault();
      const id = ev.target.closest("#detailReview").getAttribute("data-review") || window.__yycjOpenLamp;
      const hid = document.getElementById("revLampId");
      if (hid) hid.value = id || "";
      document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
      document.getElementById("view-review")?.classList.remove("hidden");
      return;
    }
    if (ev.target.closest("#detailReport")) {
      ev.preventDefault();
      const id = ev.target.closest("#detailReport").getAttribute("data-report") || window.__yycjOpenLamp;
      const reason = window.prompt("举报原因", "不实信息") || "";
      if (!reason.trim() || !id) return;
      try {
        const r = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
          body: JSON.stringify({ lamp_id: id, reason: reason.trim() }),
        });
        const data = await r.json().catch(() => ({}));
        toast(r.ok ? (data.message || "已提交举报") : (data.detail || "举报失败"));
      } catch (e) { toast(String(e)); }
      return;
    }
    if (ev.target.closest("#detailChat,.g-thumb,[data-fav],[data-unfav]")) return;
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    ev.preventDefault();
    ev.stopPropagation();
    window.openLamp(card.getAttribute("data-id"));
  }, true);
  async function openShared() {
    if (sharedOpened) return;
    const tg = window.Telegram && window.Telegram.WebApp;
    const q = new URLSearchParams(location.search);
    const id = (tg && tg.initDataUnsafe && (tg.initDataUnsafe.start_param || tg.initDataUnsafe.startParam)) || q.get("lamp") || "";
    if (!id) return;
    sharedOpened = true;
    for (let i = 0; i < 40 && !token(); i += 1) await new Promise((r) => setTimeout(r, 150));
    if (token()) window.openLamp(id);
  }
  if (document.readyState === "complete") openShared();
  else window.addEventListener("load", openShared);
})();
