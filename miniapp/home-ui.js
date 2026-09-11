(() => {
  const $ = (s) => document.querySelector(s);
  let offset = 0, q = "", painting = false, lastItems = [], lastPins = [];
  function token() { return localStorage.getItem("yycj_token") || ""; }
  async function api(path) {
    const r = await fetch(path, { headers: { Authorization: "Bearer " + token() } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || r.statusText);
    return data;
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }
  function mediaSrc(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.toLowerCase().startsWith("file_id:")) return mediaSrc(s.slice(8));
    if (s.startsWith("http") || s.startsWith("/")) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function isVideo(u) {
    const s = String(u || "");
    return s.startsWith("BAAC") || /\.(mp4|mov|webm)(\?|$)/i.test(s);
  }
  function cover(item) {
    for (const m of item.media || []) {
      const raw = (m && (m.file_id || m.url)) || "";
      if ((m && m.type) === "video" || isVideo(raw)) continue;
      const u = mediaSrc((m && (m.preview_url || m.file_id || m.url)) || "");
      if (u) return u;
    }
    for (const p of item.photos || []) {
      if (isVideo(p)) continue;
      const u = mediaSrc(p);
      if (u) return u;
    }
    return "";
  }
  function cardHtml(t) {
    const img = cover(t);
    const loc = [t.city, t.district].filter(Boolean).join("·");
    const tag = (t.tags && t.tags[0]) || "";
    const n = (t.media && t.media.length) || (t.photos && t.photos.length) || 0;
    const pin = t.feed_pinned ? '<span class="badge">置顶</span>' : "";
    return `<div class="feed-card compact cover-card" data-id="${esc(t.lamp_id)}">
      <div class="cover-wrap">
        ${img ? `<img class="thumb" src="${esc(img)}" alt="" style="height:200px;object-fit:cover;width:100%" />` : `<div class="thumb ph" style="height:200px"></div>`}
        <button class="fav-btn" type="button" data-fav="${esc(t.lamp_id)}">♡</button>
        ${loc ? `<span class="badge-loc">${esc(loc)}</span>` : ""}
        ${tag ? `<span class="badge-tag">${esc(tag)}</span>` : ""}
        ${n ? `<span class="badge-n">${n}图</span>` : ""}
      </div>
      <div class="body"><h3>${pin}${esc(t.title || "")}</h3><div class="muted price">${esc(t.price_text || "面议")}</div></div>
    </div>`;
  }
  function pinHtml(p) {
    const t = (p && p.lamp) || p || {};
    const img = cover(t);
    const bg = img ? ` style="background-image:url('${esc(img)}')"` : "";
    return `<div class="pin-card short" data-id="${esc(t.lamp_id || "")}"${bg}><div class="pin-copy"><b>${esc(t.title || "")}</b></div></div>`;
  }
  function paint() {
    const feed = $("#feed");
    if (feed && lastItems.length) {
      feed.classList.add("has-cover");
      feed.innerHTML = lastItems.map(cardHtml).join("");
    }
    const pins = $("#pins");
    if (pins && lastPins.length) {
      pins.innerHTML = lastPins.map(pinHtml).join("");
      pins.classList.remove("hidden");
    }
  }
  function broken() {
    const feed = $("#feed");
    const pins = $("#pins");
    return !!((lastItems.length && feed && !feed.querySelector(".cover-wrap")) || (lastPins.length && pins && !pins.querySelector(".pin-copy")));
  }
  async function loadFeed(reset) {
    if (!token() || painting) return;
    painting = true;
    try {
      if (reset) offset = 0;
      const city = localStorage.getItem("yycj_city") || "";
      const params = new URLSearchParams({ limit: "6", offset: String(offset) });
      if (city) params.set("city", city);
      if (q) params.set("q", q);
      const data = await api("/api/home?" + params);
      if (data.city) localStorage.setItem("yycj_city", data.city);
      const btn = $("#btnCity");
      if (btn) btn.textContent = (data.city || city || "城市") + " ▾";
      lastPins = data.pins || [];
      const batch = data.items || [];
      lastItems = reset || offset === 0 ? batch : lastItems.concat(batch);
      offset += batch.length;
      paint();
      $("#btnLoadMore")?.classList.toggle("hidden", !data.has_more);
    } catch (e) { console.warn(e); }
    finally { painting = false; }
  }
  document.addEventListener("click", (ev) => {
    if (ev.target.id === "btnSearch") { q = ($("#homeQ") && $("#homeQ").value.trim()) || ""; loadFeed(true); }
    if (ev.target.id === "btnLoadMore") loadFeed(false);
    if (ev.target.closest("[data-nav='home']")) loadFeed(true);
    if (ev.target.id === "btnCity" || ev.target.closest("#btnCity")) {
      ev.preventDefault(); ev.stopPropagation();
      $("#citySheet")?.classList.add("hidden");
      $("#cityDrop")?.classList.toggle("hidden");
    }
    const opt = ev.target.closest("#cityDrop [data-city]");
    if (opt) {
      localStorage.setItem("yycj_city", opt.getAttribute("data-city") || "");
      $("#cityDrop")?.classList.add("hidden");
      loadFeed(true);
    }
  }, true);
  async function boot() {
    for (let i = 0; i < 50 && !token(); i += 1) await new Promise((r) => setTimeout(r, 100));
    if (token()) await loadFeed(true);
    ["#feed", "#pins"].forEach((sel) => {
      const el = $(sel);
      if (el) new MutationObserver(() => { if (!painting && broken()) paint(); }).observe(el, { childList: true });
    });
    setTimeout(() => { if (broken()) paint(); }, 400);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
