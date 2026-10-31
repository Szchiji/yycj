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
  // 排序：最新上架（默认）/ 评价多。放在「地区」面板顶部，首页布局不变；本次会话内记住。
  function getSort() { try { const v = sessionStorage.getItem("yycj_sort") || ""; return (v === "reviews" || v === "near") ? v : ""; } catch (e) { return ""; } }
  function setSort(v) { try { if (v === "reviews" || v === "near") sessionStorage.setItem("yycj_sort", v); else sessionStorage.removeItem("yycj_sort"); } catch (e) {} }
  // 价格档 / 标签 / 营业中 / 距离：跟地区一样，按城市记在本次会话里
  function filtKey() { return "yycj_filt_" + curCity(); }
  function getFilt() {
    try { return JSON.parse(sessionStorage.getItem(filtKey()) || "{}") || {}; } catch (e) { return {}; }
  }
  function setFilt(patch) {
    const o = Object.assign({}, getFilt(), patch || {});
    ["price", "tags", "open", "radius", "at", "lat", "lng", "cpn"].forEach((k) => { if (!o[k]) delete o[k]; });
    try {
      if (Object.keys(o).length) sessionStorage.setItem(filtKey(), JSON.stringify(o));
      else sessionStorage.removeItem(filtKey());
    } catch (e) {}
  }
  function clearFilt() { try { sessionStorage.removeItem(filtKey()); } catch (e) {} setSort(""); setArea(""); }
  function activeFiltCount() {
    const f = getFilt();
    return [getArea(), f.price, f.tags, f.open, f.radius, f.cpn].filter(Boolean).length;
  }
  let lastFacets = null, facetsCity = "", qTimer = 0, locBusy = false;
  function token() { return localStorage.getItem("yycj_token") || ""; }
  function cacheKey(city, qq) {
    const f = getFilt();
    return "yycj_hc_" + (city || "") + "_" + (qq || "") + "_" + getArea() + "_" + getSort()
      + "_" + (f.price || "") + "_" + (f.tags || "") + "_" + (f.open || "") + "_" + (f.radius || "") + "_" + (f.at || "") + "_" + (f.cpn || "");
  }
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
  let pinsSeen = true, touching = false;
  function stopTimer() { if (carouselTimer) { clearTimeout(carouselTimer); carouselTimer = 0; } }
  // The carousel timer only runs while it can actually be seen: home view shown, page visible,
  // carousel on screen, not being touched. Otherwise no timer is pending at all.
  function canRun() { return !paused && !touching && pinsSeen && homeVisible(); }
  function arm() {
    if (!canRun()) { stopTimer(); return; }
    if (!carouselTimer) carouselTimer = setTimeout(tick, carouselMs);
  }
  function pauseMedia() {
    document.querySelectorAll("video").forEach((v) => { try { v.pause(); } catch (e) {} });
    paused = true;
    stopTimer();
  }
  function resumeWork() {
    paused = false;
    arm();
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
  function fullCover(item) {
    if (item && item.cover_url) {
      const s = String(item.cover_url);
      if (s.startsWith("http") || s.startsWith("/")) return s;
      return "/api/media/file/" + encodeURIComponent(s);
    }
    return window.yycjCoverOf ? window.yycjCoverOf(item) : "";
  }
  // cards are ~120–170 css px wide: ask for a 480 px thumbnail instead of the full photo
  function cover(item) {
    const s = fullCover(item);
    return window.yycjThumb ? window.yycjThumb(s, 480) : s;
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
    return "<img class=\"" + cls + "\" src=\"" + esc(src) + "\" alt=\"\" width=\"400\" height=\"530\" loading=\"" + load + "\" decoding=\"async\"" + (eager ? " fetchpriority=\"high\"" : "") + " />";
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
    // 按距离时，右上角地区标签换成「区 · 约Nkm」（只显示取整后的距离，不暴露坐标）
    const loc = t.distance ? [t.district || t.city, t.distance].filter(Boolean).join(" · ") : [t.city, t.district].filter(Boolean).join("·");
    const tag = String((t.tags && t.tags[0]) || "").replace(/^#+/, "");
    const n = t.media_count || (t.media && t.media.length) || (t.photos && t.photos.length) || 0;
    const pin = t.feed_pinned ? "<span class=\"badge\">置顶</span>" : "";
    // 优惠 (option A): a small 「惠」 pill in the title row, like 置顶 — card size unchanged
    const cpn = t.coupon && window.__yycjCouponMode && window.__yycjCouponMode("badge") ? "<span class=\"badge-cpn\" title=\"" + esc(t.coupon.text || "") + "\">惠</span>" : "";
    const open = t.open_text ? "<span class=\"badge-open st-" + esc(t.open_code || "") + "\">" + esc(t.open_text) + "</span>" : "";
    return "<div class=\"feed-card compact cover-card\" data-id=\"" + esc(t.lamp_id) + "\"><div class=\"cover-wrap\">" +
      imgTag(img, "thumb", idx < 3) +
      "<button class=\"fav-btn\" type=\"button\" data-fav=\"" + esc(t.lamp_id) + "\">♡</button>" +
      open +
      (loc ? "<span class=\"badge-loc\">" + esc(loc) + "</span>" : "") +
      (tag ? "<span class=\"badge-tag\">" + esc(tag) + "</span>" : "") +
      (n ? "<span class=\"badge-n\">" + n + "图</span>" : "") +
      "</div><div class=\"body\"><h3>" + pin + cpn + esc(t.title || "") + "</h3><div class=\"muted price\">" + esc(t.price_text || "面议") + (fmtHours(t.hours_text) ? "<span class=\"st-hours\"> · " + esc(fmtHours(t.hours_text)) + "</span>" : "") + "</div></div></div>";
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
      feed.innerHTML = lastItems.length ? lastItems.map((t, i) => cardHtml(t, i)).join("") : "<p class='muted'>" + (activeFiltCount() ? "没有符合筛选的上架" : "暂无上架") + "</p>";
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
    arm();
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
      if (getSort()) params.set("sort", getSort());
      const f = getFilt();
      if (f.price) params.set("price", f.price);
      if (f.tags) params.set("tags", f.tags);
      if (f.open) params.set("open", "1");
      if (f.cpn) params.set("coupon", "1");
      if (f.radius) params.set("radius", String(f.radius));
      if (f.lat && f.lng) { params.set("lat", String(f.lat)); params.set("lng", String(f.lng)); }
      else if (f.at) params.set("at", f.at);
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
    const so = getSort();
    const f = getFilt();
    const nAct = activeFiltCount();
    if (btn) {
      const lbl = btn.querySelector(".area-lbl");
      if (lbl) {
        if (nAct) lbl.textContent = "筛选·" + nAct;
        else if (so === "near") lbl.textContent = "附近";
        else if (so === "reviews") lbl.textContent = "评价多";
        else lbl.textContent = k ? areaLabel(k) : "筛选▾";
      }
      btn.classList.toggle("on", !!(nAct || so));
      btn.classList.toggle("long", true);
      btn.setAttribute("aria-label", "筛选" + (nAct ? "，已选" + nAct + "项" : ""));
    }
    const panel = $("#areaPanel");
    if (!panel || panel.classList.contains("hidden")) return;
    const d = lastAreas || { total: 0, items: [] };
    const facets = lastFacets || { price_bands: [], tags: [], radii: [3, 5, 10], geo_districts: [], located: 0 };
    const pickedTags = new Set(String(f.tags || "").split(",").filter(Boolean));
    const sortRow = "<div class=\"sort-row\" role=\"radiogroup\" aria-label=\"排序\"><span class=\"sort-k\">排序</span>" +
      "<button type=\"button\" class=\"sort-opt" + (!so ? " on" : "") + "\" data-sort=\"\">最新</button>" +
      "<button type=\"button\" class=\"sort-opt" + (so === "reviews" ? " on" : "") + "\" data-sort=\"reviews\">评价多</button>" +
      "<button type=\"button\" class=\"sort-opt" + (so === "near" ? " on" : "") + "\" data-sort=\"near\">距我近</button></div>";
    const areaChips = ["<button type=\"button\" class=\"area-chip" + (k ? "" : " on") + "\" data-area=\"\">全部<i>" + (d.total || 0) + "</i></button>"]
      .concat((d.items || []).map((x) => "<button type=\"button\" class=\"area-chip" + (x.key === k ? " on" : "") + "\" data-area=\"" + esc(x.key) + "\">" + esc(x.key) + "<i>" + x.count + "</i></button>"));
    const priceChips = (facets.price_bands || []).map((b) =>
      "<button type=\"button\" class=\"area-chip" + (f.price === b.key ? " on" : "") + "\" data-price=\"" + esc(b.key) + "\">" + esc(b.label) + "<i>" + b.count + "</i></button>"
    ).join("") || "<span class=\"muted\">暂无标价</span>";
    const tagChips = (facets.tags || []).map((t) =>
      "<button type=\"button\" class=\"area-chip" + (pickedTags.has(t.tag) ? " on" : "") + "\" data-tag=\"" + esc(t.tag) + "\">" + esc(t.tag) + "<i>" + t.count + "</i></button>"
    ).join("") || "<span class=\"muted\">暂无标签</span>";
    const openChip = "<button type=\"button\" class=\"area-chip" + (f.open ? " on" : "") + "\" data-open=\"1\">营业中</button>" +
      // 优惠 (option B): 「有优惠」 next to 营业中
      (window.__yycjCouponMode && window.__yycjCouponMode("filter") ? "<button type=\"button\" class=\"area-chip" + (f.cpn ? " on" : "") + "\" data-cpn=\"1\">有优惠</button>" : "");
    const hasLoc = !!(f.lat && f.lng) || !!f.at;
    const nearRow = "<div class=\"filt-row\"><span class=\"sort-k\">附近</span>" +
      "<button type=\"button\" class=\"sort-opt" + (hasLoc ? " on" : "") + "\" data-loc=\"1\">" + (hasLoc ? (f.at ? ("以" + f.at + "为中心") : "已定位") : "用我的位置") + "</button>" +
      (hasLoc ? "<button type=\"button\" class=\"sort-opt\" data-loc=\"0\">清除</button>" : "") + "</div>" +
      (hasLoc ? "<div class=\"area-chips\">" + [3,5,10].map((r) =>
        "<button type=\"button\" class=\"area-chip" + (String(f.radius) === String(r) ? " on" : "") + "\" data-radius=\"" + r + "\">" + r + "km</button>"
      ).join("") + "</div>" : (facets.geo_districts && facets.geo_districts.length
        ? "<div class=\"area-chips near-pick\"><span class=\"muted\" style=\"width:100%\">或选一个区作中心：</span>" +
          facets.geo_districts.map((g) => "<button type=\"button\" class=\"area-chip" + (f.at === g.key ? " on" : "") + "\" data-at=\"" + esc(g.key) + "\">" + esc(g.key) + "</button>").join("") + "</div>"
        : ""));
    panel.innerHTML = sortRow +
      "<div class=\"filt-sec\"><div class=\"sort-k\">地区</div><div class=\"area-chips\">" + areaChips.join("") + "</div></div>" +
      "<div class=\"filt-sec\"><div class=\"sort-k\">价格</div><div class=\"area-chips\">" + priceChips + "</div></div>" +
      "<div class=\"filt-sec\"><div class=\"sort-k\">标签</div><div class=\"area-chips\">" + tagChips + "</div></div>" +
      "<div class=\"filt-sec\"><div class=\"sort-k\">状态</div><div class=\"area-chips\">" + openChip + "</div></div>" +
      "<div class=\"filt-sec\">" + nearRow + "</div>" +
      "<div class=\"filt-actions\"><button type=\"button\" class=\"btn\" data-filt-reset=\"1\">重置</button>" +
      "<button type=\"button\" class=\"btn primary\" data-filt-apply=\"1\">查看结果</button></div>";
  }
  async function ensureFacets() {
    const city = curCity();
    if (lastFacets && facetsCity === city) return;
    try {
      const data = await api("/api/home/facets?city=" + encodeURIComponent(city));
      lastFacets = data; facetsCity = city;
    } catch (e) { lastFacets = lastFacets || { price_bands: [], tags: [], radii: [3, 5, 10], geo_districts: [] }; }
  }
  function askLocation() {
    if (locBusy) return;
    locBusy = true;
    const done = (lat, lng) => { setFilt({ lat: +(+lat).toFixed(2), lng: +(+lng).toFixed(2), at: "" }); locBusy = false; paintArea(); };
    const fail = () => { locBusy = false; paintArea(); try { window.__yycjToast && window.__yycjToast("定位失败，可选区作中心"); } catch (e) {} };
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.LocationManager && tg.LocationManager.getLocation) {
        tg.LocationManager.init(() => {
          try { tg.LocationManager.getLocation((loc) => loc && loc.latitude != null ? done(loc.latitude, loc.longitude) : fail()); }
          catch (e) { fail(); }
        });
        return;
      }
    } catch (e) {}
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((p) => done(p.coords.latitude, p.coords.longitude), fail, { enableHighAccuracy: false, timeout: 8000 });
    } else fail();
  }
  async function toggleArea(open) {
    const panel = $("#areaPanel");
    if (!panel) return;
    const on = open == null ? panel.classList.contains("hidden") : open;
    panel.classList.toggle("hidden", !on);
    $("#btnArea")?.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) await ensureFacets();
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
      // overlay inside the search row (absolute) so the page never shifts
      row.appendChild(panel);
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
  window.__yycjFeedUrl = function () {
    const params = new URLSearchParams({ limit: "12", offset: "0" });
    const qq = ($("#homeQ") && $("#homeQ").value.trim()) || q || "";
    const city = localStorage.getItem("yycj_city") || "";
    if (qq) params.set("q", qq);
    if (city) params.set("city", city);
    if (getArea()) params.set("district", getArea());
    if (getSort()) params.set("sort", getSort());
    const f = getFilt();
    if (f.price) params.set("price", f.price);
    if (f.tags) params.set("tags", f.tags);
    if (f.open) params.set("open", "1");
    if (f.cpn) params.set("coupon", "1");
    if (f.radius) params.set("radius", String(f.radius));
    if (f.lat && f.lng) { params.set("lat", String(f.lat)); params.set("lng", String(f.lng)); }
    else if (f.at) params.set("at", f.at);
    return "/api/home?" + params.toString();
  };
  window.__yycjCloseArea = function () { toggleArea(false); };
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
    else if (!(ev.target.closest && ev.target.closest("#areaPanel")) && $("#areaPanel") && !$("#areaPanel").classList.contains("hidden")) {
      // tap outside just closes the overlay (doesn't also open a card underneath)
      ev.preventDefault(); ev.stopPropagation(); toggleArea(false); return;
    }
    const sortBtn = ev.target.closest && ev.target.closest("#areaPanel [data-sort]");
    if (sortBtn) {
      const v = sortBtn.getAttribute("data-sort") || "";
      setSort(v);
      if (v === "near" && !(getFilt().lat || getFilt().at)) askLocation();
      paintArea();
      return;
    }
    const chip = ev.target.closest && ev.target.closest("#areaPanel [data-area]");
    if (chip) { setArea(chip.getAttribute("data-area") || ""); paintArea(); return; }
    const priceChip = ev.target.closest && ev.target.closest("#areaPanel [data-price]");
    if (priceChip) {
      const key = priceChip.getAttribute("data-price") || "";
      setFilt({ price: getFilt().price === key ? "" : key }); paintArea(); return;
    }
    const tagChip = ev.target.closest && ev.target.closest("#areaPanel [data-tag]");
    if (tagChip) {
      const t = tagChip.getAttribute("data-tag") || "";
      const cur = new Set(String(getFilt().tags || "").split(",").filter(Boolean));
      if (cur.has(t)) cur.delete(t); else if (cur.size < 5) cur.add(t);
      setFilt({ tags: [...cur].join(",") }); paintArea(); return;
    }
    if (ev.target.closest && ev.target.closest("#areaPanel [data-cpn]")) {
      setFilt({ cpn: getFilt().cpn ? "" : "1" }); paintArea(); return;
    }
    if (ev.target.closest && ev.target.closest("#areaPanel [data-open]")) {
      setFilt({ open: getFilt().open ? "" : "1" }); paintArea(); return;
    }
    if (ev.target.closest && ev.target.closest("#areaPanel [data-loc=\"1\"]")) { askLocation(); return; }
    if (ev.target.closest && ev.target.closest("#areaPanel [data-loc=\"0\"]")) {
      setFilt({ lat: "", lng: "", at: "", radius: "" }); if (getSort() === "near") setSort(""); paintArea(); return;
    }
    const atChip = ev.target.closest && ev.target.closest("#areaPanel [data-at]");
    if (atChip) {
      setFilt({ at: atChip.getAttribute("data-at") || "", lat: "", lng: "", radius: getFilt().radius || "5" });
      paintArea(); return;
    }
    const radChip = ev.target.closest && ev.target.closest("#areaPanel [data-radius]");
    if (radChip) {
      const r = radChip.getAttribute("data-radius") || "";
      setFilt({ radius: getFilt().radius === r ? "" : r }); paintArea(); return;
    }
    if (ev.target.closest && ev.target.closest("#areaPanel [data-filt-reset]")) {
      clearFilt(); lastFacets = null; paintArea(); return;
    }
    if (ev.target.closest && ev.target.closest("#areaPanel [data-filt-apply]")) {
      toggleArea(false); loadFeed(true); return;
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
      clearFilt();
      lastAreas = null;
      lastFacets = null;
      facetsCity = "";
      toggleArea(false);
      q = "";
      if ($("#homeQ")) $("#homeQ").value = "";
      loadFeed(true);
    }
  }, true);
  mountGuide();
  const qInput = $("#homeQ");
  if (qInput && !qInput.dataset.debounced) {
    qInput.dataset.debounced = "1";
    qInput.addEventListener("input", () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { q = (qInput.value || "").trim(); loadFeed(true); }, 320);
    });
    qInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); clearTimeout(qTimer); q = (qInput.value || "").trim(); loadFeed(true); }
    });
  }
  function tick() {
    carouselTimer = 0;
    if (!canRun()) return;
    const pins = $("#pins");
    if (pins && !pins.classList.contains("hidden") && pins.querySelector(".pin-card")) {
      const card = pins.querySelector(".pin-card");
      const step = card ? card.offsetWidth + 10 : 160;
      if (pins.scrollLeft + pins.clientWidth >= pins.scrollWidth - 16) pins.scrollLeft = 0;
      else pins.scrollLeft += step;
    }
    arm();
  }
  (function watchCarousel() {
    document.addEventListener("visibilitychange", arm);
    const view = $("#view-home");
    if (view && window.MutationObserver) new MutationObserver(arm).observe(view, { attributes: true, attributeFilter: ["class"] });
    const pins = $("#pins");
    if (pins && window.IntersectionObserver) {
      new IntersectionObserver((es) => { pinsSeen = es.some((e) => e.isIntersecting); arm(); }).observe(pins);
    }
    if (pins) {
      pins.addEventListener("touchstart", () => { touching = true; stopTimer(); }, { passive: true });
      const up = () => { touching = false; stopTimer(); arm(); };
      pins.addEventListener("touchend", up, { passive: true });
      pins.addEventListener("touchcancel", up, { passive: true });
    }
    arm();
  })();
  async function boot() {
    if (window.__yycjHomeBooted) return;
    window.__yycjHomeBooted = true;
    for (let i = 0; i < 40 && !token(); i += 1) await new Promise((r) => setTimeout(r, 150));
    if (token()) await loadFeed(true);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
