(() => {
  const $ = (s) => document.querySelector(s);
  let offset = 0;
  let q = "";
  let booted = false;
  let painting = false;
  let lastItems = [];
  let lastPins = [];
  let lastHtml = "";

  function token() { return localStorage.getItem("yycj_token") || ""; }
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
    if (s.toLowerCase().startsWith("file_id:")) return mediaSrc(s.slice(8));
    if (s.startsWith("http") || s.startsWith("/")) return s;
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
    return (item.media && item.media.length) || (item.photos && item.photos.length) || 0;
  }
  function cardHtml(t) {
    const img = cover(t);
    const loc = [t.city, t.district].filter(Boolean).join("·");
    const tag = (t.tags && t.tags[0]) || "";
    const n = mediaCount(t);
    const pin = t.feed_pinned ? '<span class="badge">置顶</span>' : "";
    return `<div class="feed-card compact cover-card" data-id="${esc(t.lamp_id)}">
      <div class="cover-wrap">
        ${img ? `<img class="thumb" loading="lazy" src="${esc(img)}" alt="" />` : `<div class="thumb ph"></div>`}
        <button class="fav-btn" type="button" data-fav="${esc(t.lamp_id)}">♡</button>
        ${loc ? `<span class="badge-loc">${esc(loc)}</span>` : ""}
        ${tag ? `<span class="badge-tag">${esc(tag)}</span>` : ""}
        ${n ? `<span class="badge-n">${n}图</span>` : ""}
      </div>
      <div class="body"><h3>${pin}${esc(t.title || "")}</h3><div class="muted price">${esc(t.price_text || "面议")}</div></div>
    </div>`;
  }
  function pinHtml(p) {
    const t = (p && p.lamp) || {};
    const img = cover(t);
    return `<div class="pin-card short" data-id="${esc(t.lamp_id || "")}">
      <span class="badge-pin">精选</span>
      ${img ? `<img class="thumb" loading="lazy" src="${esc(img)}" alt="" />` : ""}
      <div class="pin-copy"><b>${esc(t.title || "")}</b></div>
    </div>`;
  }
  function paintAll() {
    const feed = $("#feed");
    if (!feed || !lastItems.length) return;
    const html = lastItems.map(cardHtml).join("");
    if (html === lastHtml && feed.querySelector(".cover-card")) return;
    lastHtml = html;
    feed.innerHTML = html;
    const pins = $("#pins");
    if (pins && lastPins.length) {
      pins.innerHTML = lastPins.map(pinHtml).join("");
      pins.classList.remove("hidden");
    }
  }
  async function loadFeed(reset) {
    if (!token() || painting) return;
    painting = true;
    try {
      if (reset) offset = 0;
      const params = new URLSearchParams();
      const city = localStorage.getItem("yycj_city") || "";
      if (city) params.set("city", city);
      if (q) params.set("q", q);
      params.set("limit", "6");
      params.set("offset", String(offset));
      const data = await api(`/api/home?${params}`);
      lastPins = data.pins || [];
      const batch = data.items || [];
      lastItems = (reset || offset === 0) ? batch : lastItems.concat(batch);
      offset += batch.length;
      lastHtml = "";
      paintAll();
      $("#btnLoadMore")?.classList.toggle("hidden", !data.has_more);
    } finally {
      painting = false;
    }
  }
  document.addEventListener("click", (ev) => {
    if (ev.target.id === "btnSearch") { q = ($("#homeQ") && $("#homeQ").value.trim()) || ""; loadFeed(true); }
    if (ev.target.id === "btnLoadMore") loadFeed(false);
    if (ev.target.closest("[data-nav='home']")) {
      requestAnimationFrame(() => paintAll());
    }
    if (ev.target.id === "btnCity" || ev.target.closest("#btnCity")) {
      ev.preventDefault(); $("#cityDrop")?.classList.toggle("hidden");
    }
    const opt = ev.target.closest("#cityDrop [data-city]");
    if (opt) {
      localStorage.setItem("yycj_city", opt.getAttribute("data-city") || "");
      $("#cityDrop")?.classList.add("hidden");
      loadFeed(true);
    }
  });
  async function boot() {
    if (booted) return;
    for (let i = 0; i < 40 && !token(); i += 1) await new Promise((r) => setTimeout(r, 120));
    if (!token()) return;
    booted = true;
    await loadFeed(true);
    setTimeout(paintAll, 200);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
