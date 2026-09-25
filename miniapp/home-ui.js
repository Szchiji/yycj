(() => {
  if (window.__yycjHomeUi) return;
  window.__yycjHomeUi = true;
  const $ = (s) => document.querySelector(s);
  let offset = 0, q = "", lastItems = [], lastPins = [], cities = [];
  let carouselMs = 4000, carouselTimer = 0;
  const TUTORIAL = ["右上角选城市，首页只看当前城。","点轮播或卡片进详情，下方缩略图可切换。","客人可收藏、分享、想聊聊；老师/商家在上架提交资料。","分享链接发给好友后，先进机器人再点「打开资料」。","想聊聊是匿名会话，会显示代称。","兰花令是口碑分，说明在「我的」。"];
  const st = document.createElement("style");
  st.textContent = `#topMeta,.top-meta{display:none!important;}
.search-row{display:flex;align-items:center;gap:6px;}
#btnGuide{flex:none;height:36px;padding:0 10px;border-radius:18px;border:1px solid #3a4668;background:#1a2340;color:#c9d4ff;font-size:.8rem;}
.bottom-nav{position:fixed!important;left:0;right:0;bottom:0;z-index:80!important;}`;
  document.head.appendChild(st);
  function token() { return localStorage.getItem("yycj_token") || ""; }
  async function api(path) {
    const r = await fetch(path, { headers: { Authorization: "Bearer " + token() } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || r.statusText || ("HTTP " + r.status));
    return data;
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&","<":"<",">":">",'"':'"',"'":"&#39;" }[c]));
  }
  function cover(item) {
    if (window.yycjCoverOf) return window.yycjCoverOf(item);
    const media = item.media || [];
    for (let i = 0; i < media.length; i += 1) {
      const m = media[i] || {};
      const raw = m.preview_url || m.thumb_file_id || m.file_id || m.url || "";
      if (m.type === "video") {
        const t = String(m.thumb_file_id || m.preview_url || "");
        if (t && !t.startsWith("BAAC")) return t.startsWith("http") || t.startsWith("/") ? t : "/api/media/file/" + encodeURIComponent(t);
        continue;
      }
      if (raw) return String(raw).startsWith("http") || String(raw).startsWith("/") ? raw : "/api/media/file/" + encodeURIComponent(raw);
    }
    return "";
  }
  function fillCities(list, current) {
    cities = list && list.length ? list : cities;
    const drop = $("#cityDrop");
    if (drop) {
      drop.innerHTML = (cities || []).map((c) =>
        "<button type=\"button\" class=\"city-opt" + (c === current ? " on" : "") + "\" data-city=\"" + esc(c) + "\">" + esc(c) + "</button>"
      ).join("") || "<div class='muted' style='padding:8px'>暂无城市</div>";
    }
    const btn = $("#btnCity");
    if (btn) btn.textContent = (current || cities[0] || "城市") + " ▾";
    const sheet = $("#cityList");
    if (sheet) {
      sheet.innerHTML = (cities || []).map((c) =>
        "<button class=\"role-btn\" data-city=\"" + esc(c) + "\" type=\"button\">" + esc(c) + "</button>"
      ).join("");
    }
  }
  function cardHtml(t) {
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
  function pinHtml(p) {
    const t = (p && p.lamp) || p || {};
    const img = cover(t);
    return "<div class=\"pin-card short\" data-id=\"" + esc(t.lamp_id || "") + "\">" +
      (img ? "<img class=\"pin-cover\" src=\"" + esc(img) + "\" alt=\"\" />" : "<div class=\"pin-cover ph\"></div>") +
      "<div class=\"pin-copy\"><b>" + esc(t.title || "") + "</b></div></div>";
  }
  function tickCarousel() {
    clearTimeout(carouselTimer);
    const pins = $("#pins");
    if (pins && !pins.classList.contains("hidden") && pins.querySelector(".pin-card") && pins.dataset.userScroll !== "1") {
      const card = pins.querySelector(".pin-card");
      const step = card ? card.getBoundingClientRect().width + 10 : 160;
      if (pins.scrollLeft + pins.clientWidth >= pins.scrollWidth - 16) pins.scrollTo({ left: 0, behavior: "smooth" });
      else pins.scrollBy({ left: step, behavior: "smooth" });
    }
    if (pins) pins.dataset.userScroll = "0";
    carouselTimer = setTimeout(tickCarousel, carouselMs);
  }
  function paint() {
    const feed = $("#feed");
    if (feed) {
      feed.classList.add("has-cover", "yycj-on");
      if (lastItems.length) feed.innerHTML = lastItems.map(cardHtml).join("");
      else feed.innerHTML = "<p class='muted' style='grid-column:1/-1;padding:20px 8px'>" + (q ? "没有匹配的资料" : "暂无上架") + "</p>";
    }
    const pins = $("#pins");
    if (pins) {
      pins.innerHTML = lastPins.map(pinHtml).join("");
      pins.classList.toggle("hidden", !lastPins.length || !!q);
    }
  }
  async function loadFeed(reset, noCity) {
    if (!token()) return;
    try {
      if (reset) offset = 0;
      const city = noCity ? "" : (localStorage.getItem("yycj_city") || "");
      q = (($("#homeQ") && $("#homeQ").value.trim()) || q || "");
      const params = new URLSearchParams({ limit: "12", offset: String(offset) });
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      const data = await api("/api/home?" + params.toString());
      window.__yycjHome = data;
      window.__yycjHomeItems = data.items || [];
      if (data.city) localStorage.setItem("yycj_city", data.city);
      fillCities(data.enabled_cities || cities, data.city || city);
      const sec = Number(data.carousel_interval_sec || 4);
      carouselMs = Math.max(2, Math.min(20, sec || 4)) * 1000;
      lastPins = q ? [] : (data.pins || []);
      const batch = data.items || [];
      lastItems = reset || offset === 0 ? batch : lastItems.concat(batch);
      offset += batch.length;
      paint();
      $("#btnLoadMore")?.classList.toggle("hidden", !data.has_more);
      const ann = $("#announce");
      if (ann) {
        if (data.announcement && data.announcement.text) {
          ann.classList.remove("hidden");
          ann.innerHTML = "<span>" + esc(data.announcement.text) + "</span>";
        }
      }
    } catch (e) {
      if (!noCity) return loadFeed(reset, true);
      const feed = $("#feed");
      if (feed && !feed.querySelector("[data-id]")) {
        feed.innerHTML = "<p class='muted' style='grid-column:1/-1;padding:20px 8px'>加载失败，点底栏首页重试</p>";
      }
    }
  }
  function mountGuide() {
    const row = document.querySelector(".search-row");
    if (row && !$("#btnGuide")) {
      const btn = document.createElement("button");
      btn.id = "btnGuide";
      btn.type = "button";
      btn.textContent = "教程";
      row.insertBefore(btn, row.firstChild);
    }
    if (!$("#guideSheet")) {
      const sheet = document.createElement("div");
      sheet.id = "guideSheet";
      sheet.className = "sheet hidden";
      sheet.innerHTML = "<div class=\"sheet-panel\"><h3>操作教程</h3><ul>" + TUTORIAL.map((x) => "<li>" + x + "</li>").join("") + "</ul><button class=\"btn block primary\" id=\"guideClose\" type=\"button\">知道了</button></div>";
      document.body.appendChild(sheet);
    }
  }
  window.__yycjReloadHome = function () { loadFeed(true); };
  document.addEventListener("click", (ev) => {
    if (ev.target.id === "btnSearch") { q = ($("#homeQ") && $("#homeQ").value.trim()) || ""; loadFeed(true); }
    if (ev.target.id === "btnLoadMore") loadFeed(false);
    if (ev.target.closest && ev.target.closest("[data-nav='home']")) loadFeed(true);
    if (ev.target.id === "btnGuide") { ev.preventDefault(); $("#guideSheet")?.classList.remove("hidden"); $("#guideSheet")?.classList.add("open"); }
    if (ev.target.id === "guideClose" || ev.target.id === "guideSheet") {
      $("#guideSheet")?.classList.add("hidden");
      $("#guideSheet")?.classList.remove("open");
    }
    if (ev.target.id === "btnCity" || (ev.target.closest && ev.target.closest("#btnCity"))) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!$("#cityDrop")?.innerHTML) fillCities(cities, localStorage.getItem("yycj_city") || "");
      $("#cityDrop")?.classList.toggle("hidden");
    }
    const opt = ev.target.closest && ev.target.closest("#cityDrop [data-city], #cityList [data-city]");
    if (opt) {
      localStorage.setItem("yycj_city", opt.getAttribute("data-city") || "");
      $("#cityDrop")?.classList.add("hidden");
      if ($("#homeQ")) $("#homeQ").value = "";
      q = "";
      loadFeed(true);
    }
  }, true);
  document.getElementById("pins")?.addEventListener("touchstart", () => {
    const pins = document.getElementById("pins");
    if (pins) pins.dataset.userScroll = "1";
  }, { passive: true });
  mountGuide();
  tickCarousel();
  async function boot() {
    for (let i = 0; i < 50 && !token(); i += 1) await new Promise((r) => setTimeout(r, 100));
    if (token()) await loadFeed(true);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
