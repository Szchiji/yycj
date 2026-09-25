(() => {
  if (window.__yycjHomePaint) return;
  window.__yycjHomePaint = true;
  function token() { return localStorage.getItem("yycj_token") || ""; }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&","<":"<",">":">",'"':'"',"'":"&#39;" }[c]));
  }
  function src(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.indexOf("http") === 0 || s.indexOf("/") === 0) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function cover(item) {
    if (window.yycjCoverOf) return window.yycjCoverOf(item);
    const media = item.media || [];
    for (let i = 0; i < media.length; i += 1) {
      const m = media[i] || {};
      if (m.type === "video") {
        const t = src(m.thumb_file_id || m.preview_url || "");
        if (t) return t;
        continue;
      }
      const u = src(m.preview_url || m.file_id || m.url || "");
      if (u) return u;
    }
    const photos = item.photos || [];
    for (let i = 0; i < photos.length; i += 1) {
      const u = src(photos[i]);
      if (u) return u;
    }
    return "";
  }
  function card(t) {
    const img = cover(t);
    const loc = [t.city, t.district].filter(Boolean).join("·");
    const tag = (t.tags && t.tags[0]) || "";
    const n = (t.media && t.media.length) || (t.photos && t.photos.length) || 0;
    const pin = t.feed_pinned ? "<span class=\"badge\">置顶</span>" : "";
    return "<div class=\"feed-card compact cover-card\" data-id=\"" + esc(t.lamp_id) + "\"><div class=\"cover-wrap\">" +
      (img ? "<img class=\"thumb\" src=\"" + esc(img) + "\" alt=\"\" loading=\"lazy\" />" : "<div class=\"thumb ph\"></div>") +
      "<button class=\"fav-btn\" type=\"button\" data-fav=\"" + esc(t.lamp_id) + "\">♡</button>" +
      (loc ? "<span class=\"badge-loc\">" + esc(loc) + "</span>" : "") +
      (tag ? "<span class=\"badge-tag\">" + esc(tag) + "</span>" : "") +
      (n ? "<span class=\"badge-n\">" + n + "图</span>" : "") +
      "</div><div class=\"body\"><h3>" + pin + esc(t.title || "") + "</h3><div class=\"muted price\">" + esc(t.price_text || "面议") + "</div></div></div>";
  }
  function pin(p) {
    const t = (p && p.lamp) || p || {};
    const img = cover(t);
    return "<div class=\"pin-card short\" data-id=\"" + esc(t.lamp_id || "") + "\">" +
      (img ? "<img class=\"pin-cover\" src=\"" + esc(img) + "\" alt=\"\" />" : "<div class=\"pin-cover ph\"></div>") +
      "<div class=\"pin-copy\"><b>" + esc(t.title || "") + "</b></div></div>";
  }
  function paint(data) {
    const items = data.items || [];
    const pins = data.pins || [];
    const feed = document.getElementById("feed");
    const pinBox = document.getElementById("pins");
    if (feed) {
      feed.classList.add("has-cover", "yycj-on");
      feed.innerHTML = items.map(card).join("");
    }
    if (pinBox) {
      pinBox.innerHTML = pins.map(pin).join("");
      pinBox.classList.toggle("hidden", !pins.length);
    }
    const more = document.getElementById("btnLoadMore");
    if (more) more.classList.toggle("hidden", !data.has_more);
    window.__yycjHomeItems = items;
    window.__yycjHome = Object.assign({}, window.__yycjHome || {}, data);
  }
  async function load() {
    const tok = token();
    if (!tok) return;
    const city = localStorage.getItem("yycj_city") || "";
    const q = (document.getElementById("homeQ") && document.getElementById("homeQ").value.trim()) || "";
    const params = new URLSearchParams({ limit: "12", offset: "0" });
    if (city) params.set("city", city);
    if (q) params.set("q", q);
    const r = await fetch("/api/home?" + params, { headers: { Authorization: "Bearer " + tok } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || "home failed");
    paint(data);
  }
  window.__yycjReloadHome = function () { load().catch(() => {}); };
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.id === "btnSearch") load().catch(() => {});
    if (ev.target && ev.target.closest && ev.target.closest("[data-nav='home']")) load().catch(() => {});
  });
  async function boot() {
    for (let i = 0; i < 40 && !token(); i += 1) await new Promise((r) => setTimeout(r, 120));
    try { await load(); } catch (e) {}
    setTimeout(() => load().catch(() => {}), 1200);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
