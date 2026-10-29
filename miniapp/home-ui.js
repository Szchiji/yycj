(() => {
  if (window.__yycjHomeUi) return;
  window.__yycjHomeUi = true;
  const $ = (s) => document.querySelector(s);
  let offset = 0, q = "", lastItems = [], lastPins = [], cities = [], lastAreas = null;
  let carouselMs = 4000, carouselTimer = 0, paused = false;
  const TUTORIAL = ["右上角选城市，左上「地区」按区筛选。","点卡片进详情。","客人可收藏分享；老师在上架提交。"];
  // 地区筛选：单选，本次会话内记住（按城市），切城市自动清空。只筛信息流，轮播不变。
  function curCity() { return localStorage.getItem("yycj_city") || ""; }
  function getArea() {
    try { const o = JSON.parse(sessionStorage.getItem("yycj_area") || "null"); return o && o.city === curCity() ? String(o.key || "") : ""; }
    catch (e) { return ""; }
  }
  function setArea(key) {
    try { if (key) sessionStorage.setItem("yycj_area", JSON.stringify({ city: curCity(), key })); else sessionStorage.removeItem("yycj_area"); } catch (e) {}
  }
  function token() { return localStorage.getItem("yycj_token") || ""; }
  function cacheKey(city, qq) { return "yycj_hc_" + (city || "") + "_" + (qq || "") + "_" + getArea(); }
  function readCache(city, qq) {
    try {
      const raw = sessionStorage.getItem(cacheKey(city, qq));
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || Date.now() - Number(o.t || 0) > 60000) return null;
      return o.d || null;
    } catch (e) { return null; }
  }
  function writeCache(city, qq, data) {
    try { sessionStorage.setItem(cacheKey(city, qq), JSON.stringify({ t: Date.now(), d: data })); } catch (e) {}
  }
  function homeVisible() {
    const view = $("#view-home");
    return view && !view.classList.contains("hidden") && !document.hidden;
  }
  function pauseMedia() {
    document.querySelectorAll("video").forEach((v) => { try { v.pause(); } catch (e) {} });
    paused = true;
    if (carouselTimer) { clearTimeout(carouselTimer); carouselTimer = 0; }
  }
  function resumeWork() {
    paused = false;
    if (!carouselTimer) carouselTimer = setTimeout(tick, carouselMs);
  }
  window.__yycjPauseUi = pauseMedia;
  window.__yycjResumeUi = resumeWork;
  async function api(path) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(path, { headers: { Authorization: "Bearer " + token() }, signal: ctl.signal });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || r.statusText || ("HTTP " + r.status));
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }
  function cover(item) {
    if (item && item.cover_url) {
      const s = String(item.cover_url);
      if (s.startsWith("http") || s.startsWith("/")) return s;
      return "/api/media/file/" + encodeURIComponent(s);
    }
    return window.yycjCoverOf ? window.yycjCoverOf(item) : "";
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
  }
  function imgTag(src, cls, eager) {
    if (!src) return "<div class=\"" + cls + " ph\"></div>";
    const load = eager ? "eager" : "lazy";
    return "<img class=\"" + cls + "\" src=\"" + esc(src) + "\" alt=\"\" width=\"400\" height=\"530\" loading=\"" + load + "\" decoding=\"async\" />";
  }
  // Card hours, compact (full label with 次日 stays on the detail page):
  // "10-22" -> "10–22点", "20:00–次日04:00" -> "20–04点", "9:30~21:00" -> "9:30–21点"; unparsable text is shown as-is.
  function fmtHours(raw) {
    const s = String(raw || "").trim().replace(/：/g, ":");
    if (!s) return "";
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*[-–—~～至到]\s*(?:次日)?\s*(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return s;
    const a = m[2] && m[2] !== "00" ? m[1] + ":" + m[2] : m[1];
    const b = m[4] && m[4] !== "00" ? m[3] + ":" + m[4] : m[3];
    return a.padStart(2, "0") + "–" + b.padStart(2, "0") + "点";
  }
  function cardHtml(t, idx) {
    const img = cover(t);
    const loc = [t.city, t.district].filter(Boolean).join("·");
    const tag = String((t.tags && t.tags[0]) || "").replace(/^#+/, "");
    const n = t.media_count || (t.media && t.media.length) || (t.photos && t.photos.length) || 0;
    const pin = t.feed_pinned ? "<span class=\"badge\">置顶</span>" : "";
    const open = t.open_text ? "<span class=\"badge-open st-" + esc(t.open_code || "") + "\">" + esc(t.open_text) + "</span>" : "";
    return "<div class=\"feed-card compact cover-card\" data-id=\"" + esc(t.lamp_id) + "\"><div class=\"cover-wrap\">" +
      imgTag(img, "thumb", idx < 3) +
      "<button class=\"fav-btn\" type=\"button\" data-fav=\"" + esc(t.lamp_id) + "\">♡</button>" +
      open +
      (loc ? "<span class=\"badge-loc\">" + esc(loc) + "</span>" : "") +
      (tag ? "<span class=\"badge-tag\">" + esc(tag) + "</span>" : "") +
      (n ? "<span class=\"badge-n\">" + n + "图</span>" : "") +
      "</div><div class=\"body\"><h3>" + pin + esc(t.title || "") + "</h3><div class=\"muted price\">" + esc(t.price_text || "面议") + (fmtHours(t.hours_text) ? "<span class=\"st-hours\"> · " + esc(fmtHours(t.hours_text)) + "</span>" : "") + "</div></div></div>";
  }
  function pinHtml(p, idx) {
    const t = (p && p.lamp) || p || {};
    // 轮播只放封面 + 称呼，不显示营业状态 / 营业时间
    return "<div class=\"pin-card short\" data-id=\"" + esc(t.lamp_id || "") + "\">" +
      imgTag(cover(t), "pin-cover", idx === 0) +
      "<div class=\"pin-copy\"><b>" + esc(t.title || "") + "</b></div></div>";
  }
  function paint() {
    const feed = $("#feed");
    if (feed) {
      feed.classList.add("has-cover");
      feed.innerHTML = lastItems.length ? lastItems.map((t, i) => cardHtml(t, i)).join("") : "<p class='muted'>" + (getArea() ? "这个区域暂无上架" : "暂无上架") + "</p>";
    }
    const pins = $("#pins");
    if (pins) {
      pins.innerHTML = lastPins.map((p, i) => pinHtml(p, i)).join("");
      pins.classList.toggle("hidden", !lastPins.length || !!q);
    }
    if (typeof window.__yycjPaintFav === "function") window.__yycjPaintFav();
  }
  function applyData(data, reset) {
    window.__yycjHomeData = data;
    if (data.city) localStorage.setItem("yycj_city", data.city);
    fillCities(data.enabled_cities || cities, data.city || localStorage.getItem("yycj_city") || "");
    carouselMs = Math.max(3000, Math.min(12000, Number(data.carousel_interval_sec || 4) * 1000));
    lastPins = q ? [] : (data.pins || []);
    if (data.districts) lastAreas = data.districts;
    paintArea();
    const batch = data.items || [];
    lastItems = reset || offset === 0 ? batch : lastItems.concat(batch);
    offset = lastItems.length;
    paint();
    $("#btnLoadMore")?.classList.toggle("hidden", !data.has_more);
    const ann = $("#announce");
    if (ann && data.announcement && data.announcement.text) {
      ann.classList.remove("hidden");
      ann.innerHTML = "<span>" + esc(data.announcement.text) + "</span>";
    }
  }
  async function loadFeed(reset) {
    if (!token() || document.hidden) return;
    paused = false;
    try {
      if (reset) offset = 0;
      const city = localStorage.getItem("yycj_city") || "";
      q = (($("#homeQ") && $("#homeQ").value.trim()) || q || "");
      if (reset) {
        const cached = readCache(city, q);
        if (cached && (cached.items || cached.pins)) applyData(cached, true);
      }
      const params = new URLSearchParams({ limit: "12", offset: String(offset && !reset ? offset : 0) });
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      if (getArea()) params.set("district", getArea());
      const data = await api("/api/home?" + params.toString());
      applyData(data, reset);
      writeCache(data.city || city, q, data);
    } catch (e) {
      const feed = $("#feed");
      if (feed && !feed.querySelector("[data-id]")) feed.innerHTML = "<p class='muted'>加载失败，点底栏首页重试</p>";
    }
  }
  function areaLabel(k) { return k.length <= 3 ? k : k.slice(0, 2) + "…"; }
  function paintArea() {
    const btn = $("#btnArea");
    const k = getArea();
    if (btn) {
      const lbl = btn.querySelector(".area-lbl");
      if (lbl) lbl.textContent = k ? areaLabel(k) : "地区▾";
      btn.classList.toggle("on", !!k);
      btn.classList.toggle("long", k.length > 2);
      btn.setAttribute("aria-label", k ? "地区：" + k : "地区筛选");
    }
    const panel = $("#areaPanel");
    if (!panel || panel.classList.contains("hidden")) return;
    const d = lastAreas || { total: 0, items: [] };
    const chips = ["<button type=\"button\" class=\"area-chip" + (k ? "" : " on") + "\" data-area=\"\">全部<i>" + (d.total || 0) + "</i></button>"]
      .concat((d.items || []).map((x) => "<button type=\"button\" class=\"area-chip" + (x.key === k ? " on" : "") + "\" data-area=\"" + esc(x.key) + "\">" + esc(x.key) + "<i>" + x.count + "</i></button>"));
    panel.innerHTML = "<div class=\"area-chips\">" + chips.join("") + "</div>" +
      ((d.items || []).length ? "" : "<p class=\"muted area-empty\">这个城市的资料还没填区域</p>");
  }
  function toggleArea(open) {
    const panel = $("#areaPanel");
    if (!panel) return;
    const on = open == null ? panel.classList.contains("hidden") : open;
    panel.classList.toggle("hidden", !on);
    $("#btnArea")?.setAttribute("aria-expanded", on ? "true" : "false");
    paintArea();
  }
  function mountGuide() {
    const row = document.querySelector(".search-row");
    if (row && !$("#btnArea")) {
      const btn = document.createElement("button");
      btn.id = "btnArea";
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      // invisible "教程" keeps the old button's exact size; the visible label sits on top
      btn.innerHTML = "<span class=\"area-sz\" aria-hidden=\"true\">教程</span><span class=\"area-lbl\">地区▾</span>";
      row.insertBefore(btn, row.firstChild);
      const panel = document.createElement("div");
      panel.id = "areaPanel";
      panel.className = "area-panel hidden";
      row.insertAdjacentElement("afterend", panel);
    }
    const me = $("#view-me");
    if (me && !$("#meTutorial")) {
      const card = document.createElement("div");
      card.id = "meTutorial";
      card.className = "card";
      card.innerHTML = "<button class=\"btn block\" id=\"btnTutorial\" type=\"button\">使用教程</button>";
      me.appendChild(card);
    }
    if (!$("#guideSheet")) {
      const sheet = document.createElement("div");
      sheet.id = "guideSheet";
      sheet.className = "sheet hidden";
      sheet.innerHTML = "<div class=\"sheet-panel\"><h3>教程</h3><ul>" + TUTORIAL.map((x) => "<li>" + x + "</li>").join("") + "</ul><button class=\"btn block\" id=\"guideClose\" type=\"button\">知道了</button></div>";
      document.body.appendChild(sheet);
    }
  }
  window.__yycjLoadHome = function () { paused = false; return loadFeed(true); };
  window.__yycjReloadHome = window.__yycjLoadHome;
  document.addEventListener("click", (ev) => {
    if (ev.target.id === "btnSearch") { q = ($("#homeQ") && $("#homeQ").value.trim()) || ""; loadFeed(true); }
    if (ev.target.id === "btnLoadMore") loadFeed(false);
    if (ev.target.closest && ev.target.closest("[data-nav='home']")) {
      if (lastItems.length) paint();
      else loadFeed(true);
    }
    if (ev.target.closest && ev.target.closest("#btnArea")) { ev.preventDefault(); toggleArea(); }
    const chip = ev.target.closest && ev.target.closest("#areaPanel [data-area]");
    if (chip) {
      setArea(chip.getAttribute("data-area") || "");
      toggleArea(false);
      loadFeed(true);
    }
    if (ev.target.id === "btnTutorial") { ev.preventDefault(); $("#guideSheet")?.classList.remove("hidden"); }
    if (ev.target.id === "guideClose" || ev.target.id === "guideSheet") $("#guideSheet")?.classList.add("hidden");
    if (ev.target.id === "btnCity" || (ev.target.closest && ev.target.closest("#btnCity"))) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!$("#cityDrop")?.innerHTML) fillCities(cities, localStorage.getItem("yycj_city") || "");
      $("#cityDrop")?.classList.toggle("hidden");
    }
    const opt = ev.target.closest && ev.target.closest("#cityDrop [data-city]");
    if (opt) {
      localStorage.setItem("yycj_city", opt.getAttribute("data-city") || "");
      $("#cityDrop")?.classList.add("hidden");
      setArea("");
      lastAreas = null;
      toggleArea(false);
      q = "";
      if ($("#homeQ")) $("#homeQ").value = "";
      loadFeed(true);
    }
  }, true);
  mountGuide();
  function tick() {
    carouselTimer = 0;
    if (paused || !homeVisible()) {
      carouselTimer = setTimeout(tick, carouselMs);
      return;
    }
    const pins = $("#pins");
    if (pins && !pins.classList.contains("hidden") && pins.querySelector(".pin-card")) {
      const card = pins.querySelector(".pin-card");
      const step = card ? card.offsetWidth + 10 : 160;
      if (pins.scrollLeft + pins.clientWidth >= pins.scrollWidth - 16) pins.scrollLeft = 0;
      else pins.scrollLeft += step;
    }
    carouselTimer = setTimeout(tick, carouselMs);
  }
  setTimeout(tick, 4000);
  async function boot() {
    if (window.__yycjHomeBooted) return;
    window.__yycjHomeBooted = true;
    for (let i = 0; i < 40 && !token(); i += 1) await new Promise((r) => setTimeout(r, 150));
    if (token()) await loadFeed(true);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
