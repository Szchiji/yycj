(() => {
  const $ = (s) => document.querySelector(s);
  let offset = 0;
  let q = "";
  let carouselTimer = null;
  let booted = false;
  let painting = false;
  let cta = "想聊聊";
  let cities = [];

  function token() {
    return localStorage.getItem("yycj_token") || "";
  }
  async function api(path) {
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || r.statusText);
    return data;
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function mediaSrc(u) {
    const s = String(u || "").trim();
    if (!s || s.startsWith("data:")) return "";
    if (s.startsWith("http") || s.startsWith("/")) return s;
    if (s.startsWith("file_id:")) return mediaSrc(s.slice(8));
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function isVideoUrl(u) {
    const s = String(u || "");
    return s.startsWith("BAAC") || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(s);
  }
  function cover(item) {
    for (const m of item.media || []) {
      const raw = (m && (m.file_id || m.url)) || "";
      if ((m && m.type) === "video" || isVideoUrl(raw)) continue;
      const u = mediaSrc((m && (m.preview_url || m.file_id || m.url)) || "");
      if (u) return u;
    }
    for (const p of item.photos || []) {
      if (isVideoUrl(p)) continue;
      const u = mediaSrc(p);
      if (u) return u;
    }
    return null;
  }
  function mediaCount(item) {
    const n = (item.media && item.media.length) || (item.photos && item.photos.length) || 0;
    return n;
  }
  function renderHeader(data) {
    const c = data.contacts || {};
    const brand = $("#brandTitle");
    if (brand) {
      if (c.bot_url) {
        brand.setAttribute("href", c.bot_url);
        brand.setAttribute("target", "_blank");
      } else brand.removeAttribute("href");
    }
    const admin = $("#topAdmin");
    if (admin) {
      if (c.show_admin && c.admin_url) {
        admin.textContent = c.admin_label || "管理员";
        admin.setAttribute("href", c.admin_url);
        admin.classList.remove("hidden");
      } else admin.classList.add("hidden");
    }
    cta = data.chat_cta_label || "想聊聊";
    cities = data.enabled_cities || cities;
    const city = data.city || localStorage.getItem("yycj_city") || "";
    if (city) localStorage.setItem("yycj_city", city);
    const btn = $("#btnCity");
    if (btn) btn.textContent = `${city || "城市"} ▾`;
    renderCityDrop(city);
  }
  function renderCityDrop(current) {
    const drop = $("#cityDrop");
    if (!drop) return;
    drop.innerHTML = (cities || []).map((c) =>
      `<button type="button" class="city-opt${c === current ? " on" : ""}" data-city="${esc(c)}">${esc(c)}</button>`
    ).join("") || `<div class="muted">暂无城市</div>`;
  }
  function startCarousel(sec) {
    const el = $("#pins");
    if (!el || el.children.length < 2) return;
    clearInterval(carouselTimer);
    const step = () => {
      const w = el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width + 8 : 160;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: w, behavior: "smooth" });
    };
    carouselTimer = setInterval(step, Math.max(2, sec || 4) * 1000);
  }
  function pinHtml(p) {
    const t = (p && p.lamp) || {};
    const img = cover(t);
    return `<div class="pin-card short" data-id="${esc(t.lamp_id || "")}">
      <span class="badge-pin">精选</span>
      ${img ? `<img class="thumb" loading="lazy" decoding="async" src="${esc(img)}" alt="" />` : ""}
      <div class="pin-copy"><b>${esc(t.title || "")}</b><span>${esc(t.city || "")}${t.price_text ? " · " + esc(t.price_text) : ""}</span></div>
    </div>`;
  }
  function cardHtml(t) {
    const img = cover(t);
    const loc = [t.city, t.district].filter(Boolean).join("·");
    const tag = (t.tags && t.tags[0]) || "";
    const n = mediaCount(t);
    const pin = t.feed_pinned ? '<span class="badge">置顶</span>' : "";
    return `<div class="feed-card compact cover-card" data-id="${esc(t.lamp_id)}">
      <div class="cover-wrap">
        ${img ? `<img class="thumb" loading="lazy" decoding="async" src="${esc(img)}" alt="" />` : `<div class="thumb ph"></div>`}
        <button class="fav-btn" type="button" data-fav="${esc(t.lamp_id)}">♡</button>
        ${loc ? `<span class="badge-loc">${esc(loc)}</span>` : ""}
        ${tag ? `<span class="badge-tag">${esc(tag)}</span>` : ""}
        ${n ? `<span class="badge-n">${n}图</span>` : ""}
      </div>
      <div class="body">
        <h3>${pin}${esc(t.title || "")}</h3>
        <div class="muted price">${esc(t.price_text || "面议")}</div>
      </div>
    </div>`;
  }
  async function loadFeed(reset) {
    if (!token() || painting) return null;
    painting = true;
    try {
      if (reset) offset = 0;
      const city = localStorage.getItem("yycj_city") || "";
      const params = new URLSearchParams();
      if (city) params.set("city", city);
      if (q) params.set("q", q);
      params.set("limit", "6");
      params.set("offset", String(offset));
      const data = await api(`/api/home?${params}`);
      renderHeader(data);
      const pins = $("#pins");
      if (pins) {
        pins.innerHTML = (data.pins || []).map(pinHtml).join("");
        pins.classList.toggle("hidden", !(data.pins || []).length);
      }
      const feed = $("#feed");
      if (feed) {
        const html = (data.items || []).map(cardHtml).join("") || '<div class="empty card"><p class="muted">这里暂时还没有内容</p></div>';
        if (reset || offset === 0) feed.innerHTML = html;
        else feed.insertAdjacentHTML("beforeend", (data.items || []).map(cardHtml).join(""));
      }
      offset += (data.items || []).length;
      const more = $("#btnLoadMore");
      if (more) more.classList.toggle("hidden", !data.has_more);
      startCarousel(data.carousel_interval_sec);
      return data;
    } finally {
      setTimeout(() => { painting = false; }, 80);
    }
  }

  document.addEventListener("click", async (ev) => {
    if (ev.target.id === "btnSearch") {
      q = ($("#homeQ") && $("#homeQ").value.trim()) || "";
      try { await loadFeed(true); } catch (e) { console.warn(e); }
    }
    if (ev.target.id === "btnLoadMore") {
      try { await loadFeed(false); } catch (e) { console.warn(e); }
    }
    if (ev.target.id === "btnCity" || ev.target.closest("#btnCity")) {
      ev.preventDefault();
      ev.stopPropagation();
      $("#cityDrop")?.classList.toggle("hidden");
    }
    const opt = ev.target.closest("#cityDrop [data-city]");
    if (opt) {
      localStorage.setItem("yycj_city", opt.getAttribute("data-city") || "");
      $("#cityDrop")?.classList.add("hidden");
      try { await loadFeed(true); } catch (e) { console.warn(e); }
    }
    if (!ev.target.closest(".city-wrap")) $("#cityDrop")?.classList.add("hidden");
  });

  async function boot() {
    if (booted) return;
    for (let i = 0; i < 30 && !token(); i += 1) await new Promise((r) => setTimeout(r, 160));
    if (!token()) return;
    booted = true;
    try { await loadFeed(true); } catch (e) { console.warn(e); }
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
