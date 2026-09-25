(() => {
  if (window.__yycjHomeUi) return;
  window.__yycjHomeUi = true;
  const nativeFetch = window.fetch.bind(window);
  let homeInflight = null;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String((init && init.method) || "GET").toUpperCase();
    if (method === "GET" && url.indexOf("/api/home") !== -1) {
      if (homeInflight) return homeInflight.then((r) => r.clone());
      homeInflight = nativeFetch(input, init).then((r) => {
        homeInflight = null;
        return r;
      }, (e) => { homeInflight = null; throw e; });
      return homeInflight.then((r) => r.clone());
    }
    return nativeFetch(input, init);
  };
  const $ = (s) => document.querySelector(s);
  let offset = 0, q = "", lastItems = [], lastPins = [], cities = [];
  let carouselMs = 4000, carouselTimer = 0;
  const TUTORIAL = ["右上角选城市。","点卡片进详情。","客人可收藏分享；老师在上架提交。"];
  function token() { return localStorage.getItem("yycj_token") || ""; }
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
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&","<":"<",">":">",'"':'"',"'":"&#39;" }[c]));
  }
  function cover(item) {
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
  function cardHtml(t) {
    const img = cover(t);
    const loc = [t.city, t.district].filter(Boolean).join("·");
    const tag = (t.tags && t.tags[0]) || "";
    const n = (t.media && t.media.length) || (t.photos && t.photos.length) || 0;
    const pin = t.feed_pinned ? "<span class=\"badge\">置顶</span>" : "";
    return "<div class=\"feed-card compact cover-card\" data-id=\"" + esc(t.lamp_id) + "\"><div class=\"cover-wrap\">" +
      (img ? "<img class=\"thumb\" src=\"" + esc(img) + "\" alt=\"\" loading=\"lazy\" decoding=\"async\" />" : "<div class=\"thumb ph\"></div>") +
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
      (img ? "<img class=\"pin-cover\" src=\"" + esc(img) + "\" alt=\"\" decoding=\"async\" />" : "<div class=\"pin-cover ph\"></div>") +
      "<div class=\"pin-copy\"><b>" + esc(t.title || "") + "</b></div></div>";
  }
  function paint() {
    const feed = $("#feed");
    if (feed) {
      feed.classList.add("has-cover");
      feed.innerHTML = lastItems.length ? lastItems.map(cardHtml).join("") : "<p class='muted'>暂无上架</p>";
    }
    const pins = $("#pins");
    if (pins) {
      pins.innerHTML = lastPins.map(pinHtml).join("");
      pins.classList.toggle("hidden", !lastPins.length || !!q);
    }
    if (typeof window.__yycjPaintFav === "function") window.__yycjPaintFav();
  }
  async function loadFeed(reset) {
    if (!token()) return;
    try {
      if (reset) offset = 0;
      const city = localStorage.getItem("yycj_city") || "";
      q = (($("#homeQ") && $("#homeQ").value.trim()) || q || "");
      const params = new URLSearchParams({ limit: "12", offset: String(offset) });
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      const data = await api("/api/home?" + params.toString());
      if (data.city) localStorage.setItem("yycj_city", data.city);
      fillCities(data.enabled_cities || cities, data.city || city);
      carouselMs = Math.max(2000, Math.min(20000, Number(data.carousel_interval_sec || 4) * 1000));
      lastPins = q ? [] : (data.pins || []);
      const batch = data.items || [];
      lastItems = reset || offset === 0 ? batch : lastItems.concat(batch);
      offset += batch.length;
      paint();
      $("#btnLoadMore")?.classList.toggle("hidden", !data.has_more);
      const ann = $("#announce");
      if (ann && data.announcement && data.announcement.text) {
        ann.classList.remove("hidden");
        ann.innerHTML = "<span>" + esc(data.announcement.text) + "</span>";
      }
    } catch (e) {
      const feed = $("#feed");
      if (feed && !feed.querySelector("[data-id]")) feed.innerHTML = "<p class='muted'>加载失败，点底栏首页重试</p>";
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
      sheet.innerHTML = "<div class=\"sheet-panel\"><h3>教程</h3><ul>" + TUTORIAL.map((x) => "<li>" + x + "</li>").join("") + "</ul><button class=\"btn block\" id=\"guideClose\" type=\"button\">知道了</button></div>";
      document.body.appendChild(sheet);
    }
  }
  window.__yycjReloadHome = function () { loadFeed(true); };
  document.addEventListener("click", (ev) => {
    if (ev.target.id === "btnSearch") { q = ($("#homeQ") && $("#homeQ").value.trim()) || ""; loadFeed(true); }
    if (ev.target.id === "btnLoadMore") loadFeed(false);
    if (ev.target.closest && ev.target.closest("[data-nav='home']")) loadFeed(true);
    if (ev.target.id === "btnGuide") { ev.preventDefault(); $("#guideSheet")?.classList.remove("hidden"); }
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
      q = "";
      if ($("#homeQ")) $("#homeQ").value = "";
      loadFeed(true);
    }
  }, true);
  mountGuide();
  function tick() {
    const pins = $("#pins");
    if (pins && !pins.classList.contains("hidden") && pins.querySelector(".pin-card")) {
      const card = pins.querySelector(".pin-card");
      const step = card ? card.getBoundingClientRect().width + 10 : 160;
      if (pins.scrollLeft + pins.clientWidth >= pins.scrollWidth - 16) pins.scrollTo({ left: 0, behavior: "smooth" });
      else pins.scrollBy({ left: step, behavior: "smooth" });
    }
    carouselTimer = setTimeout(tick, carouselMs);
  }
  tick();
  async function boot() {
    for (let i = 0; i < 40 && !token(); i += 1) await new Promise((r) => setTimeout(r, 150));
    if (token()) await loadFeed(true);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
