(() => {
  if (window.__yycjHomeUi) return;
  window.__yycjHomeUi = true;
  const $ = (s) => document.querySelector(s);
  let offset = 0, q = "", painting = false, lastItems = [], lastPins = [], cities = [];
  let carouselMs = 4000, carouselTimer = 0;
  const TUTORIAL = [
    "右上角选城市，首页只看当前城。",
    "点轮播或卡片进详情，下方缩略图可切换。",
    "客人可收藏、分享、想聊聊；老师/商家在上架提交资料。",
    "分享链接发给好友后，先进机器人再点「打开资料」。",
    "想聊聊是匿名会话，会显示代称。",
    "兰花令是口碑分，说明在「我的」。",
  ];
  const st = document.createElement("style");
  st.textContent = `#topMeta,.top-meta{display:none!important;}
#pins{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;}
#pins .pin-card{flex:0 0 30%!important;width:30%!important;min-width:30%!important;aspect-ratio:3/4!important;height:auto!important;position:relative;overflow:hidden;border-radius:14px;scroll-snap-align:start;}
#pins .pin-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
#pins .pin-copy{position:absolute;left:0;right:0;bottom:0;padding:24px 8px 8px;background:linear-gradient(transparent,rgba(0,0,0,.72));color:#fff;z-index:2;font-size:12px;}
#feed.has-cover,#favList{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:8px!important;}
#feed .cover-wrap .thumb,#favList .cover-wrap .thumb{width:100%!important;height:148px!important;object-fit:cover!important;display:block;border-radius:12px 12px 0 0;}
.search-row{display:flex;align-items:center;gap:6px;}
.search-row input{flex:1;min-width:0;height:36px;margin:0;}
#btnGuide{flex:none;height:36px;padding:0 10px;border-radius:18px;border:1px solid #3a4668;background:#1a2340;color:#c9d4ff;font-size:.8rem;white-space:nowrap;}
.sheet{z-index:120!important;}
.sheet-panel{margin-bottom:78px!important;max-height:70vh;overflow:auto;}
.bottom-nav{position:fixed!important;left:0;right:0;bottom:0;z-index:80!important;}`;
  document.head.appendChild(st);
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
  function fillCities(list, current) {
    cities = list && list.length ? list : cities;
    const drop = $("#cityDrop");
    if (drop) {
      drop.innerHTML = (cities || []).map((c) =>
        `<button type="button" class="city-opt${c === current ? " on" : ""}" data-city="${esc(c)}">${esc(c)}</button>`
      ).join("") || "<div class='muted' style='padding:8px'>暂无城市</div>";
    }
    const btn = $("#btnCity");
    if (btn) btn.textContent = (current || "城市") + " ▾";
  }
  function cardHtml(t) {
    const img = cover(t);
    const loc = [t.city, t.district].filter(Boolean).join("·");
    const tag = (t.tags && t.tags[0]) || "";
    const n = (t.media && t.media.length) || (t.photos && t.photos.length) || 0;
    const pin = t.feed_pinned ? '<span class="badge">置顶</span>' : "";
    return `<div class="feed-card compact cover-card" data-id="${esc(t.lamp_id)}">
      <div class="cover-wrap">
        ${img ? `<img class="thumb" src="${esc(img)}" alt="" loading="lazy" decoding="async" />` : `<div class="thumb ph"></div>`}
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
    return `<div class="pin-card short" data-id="${esc(t.lamp_id || "")}">${img ? `<img class="pin-cover" src="${esc(img)}" alt="" />` : ""}<div class="pin-copy"><b>${esc(t.title || "")}</b></div></div>`;
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
      feed.classList.add("has-cover");
      feed.innerHTML = lastItems.length ? lastItems.map(cardHtml).join("") : (q ? "<p class='muted'>没有匹配的资料</p>" : "");
    }
    const pins = $("#pins");
    if (pins) {
      pins.innerHTML = lastPins.map(pinHtml).join("");
      pins.classList.toggle("hidden", !lastPins.length || !!q);
    }
  }
  async function loadFeed(reset) {
    if (!token() || painting) return;
    painting = true;
    try {
      if (reset) offset = 0;
      const city = localStorage.getItem("yycj_city") || "";
      q = (($("#homeQ") && $("#homeQ").value.trim()) || q || "");
      const params = new URLSearchParams({ limit: "12", offset: String(offset) });
      if (q) params.set("q", q);
      if (city) params.set("city", city);
      const data = await api("/api/home?" + params);
      fillCities(data.enabled_cities || cities, data.city || city);
      const sec = Number(data.carousel_interval_sec || 4);
      carouselMs = Math.max(2, Math.min(20, sec || 4)) * 1000;
      lastPins = q ? [] : (data.pins || []);
      const batch = data.items || [];
      lastItems = reset || offset === 0 ? batch : lastItems.concat(batch);
      offset += batch.length;
      paint();
      $("#btnLoadMore")?.classList.toggle("hidden", !data.has_more);
      bindHomeHead(data);
    } catch (e) { console.warn(e); }
    finally { painting = false; }
  }
  function openUrl(url) {
    if (!url) return false;
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openTelegramLink && /^https:\/\/t\.me\//i.test(url)) { tg.openTelegramLink(url); return true; }
    if (tg && tg.openLink) { tg.openLink(url); return true; }
    window.location.href = url;
    return true;
  }
  function bindHomeHead(home) {
    const contacts = (home && home.contacts) || {};
    const brand = $("#brandTitle");
    const admin = $("#topAdmin");
    if (home && home.user) localStorage.setItem("yycj_user", JSON.stringify(home.user));
    if (brand && !brand.dataset.bound) {
      brand.dataset.bound = "1";
      brand.style.cursor = "pointer";
      brand.addEventListener("click", (ev) => {
        ev.preventDefault();
        const url = contacts.bot_url || (contacts.bot_username ? ("https://t.me/" + String(contacts.bot_username).replace(/^@/, "")) : "");
        openUrl(url);
      });
    }
    if (admin) {
      admin.textContent = contacts.admin_label || "管理员";
      if (!admin.dataset.bound) {
        admin.dataset.bound = "1";
        admin.addEventListener("click", (ev) => {
          ev.preventDefault();
          if (home && home.is_admin) { location.href = "./admin.html?v=20260912a"; return; }
          openUrl(contacts.admin_url || "");
        });
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
    const input = $("#homeQ");
    if (input) input.placeholder = "搜花名 / 标签 / 城区 / 价位";
    if (!$("#guideSheet")) {
      const sheet = document.createElement("div");
      sheet.id = "guideSheet";
      sheet.className = "sheet hidden";
      sheet.innerHTML = `<div class="sheet-panel"><h3>操作教程</h3><ul>${TUTORIAL.map((x) => `<li>${x}</li>`).join("")}</ul><button class="btn block primary" id="guideClose" type="button">知道了</button></div>`;
      document.body.appendChild(sheet);
    }
  }
  window.__yycjReloadHome = () => loadFeed(true);
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-share]")) return;
    if (ev.target.closest("#feed [data-id], #pins [data-id]")) window.__yycjBack = "home";
    if (ev.target.id === "btnSearch") { q = ($("#homeQ") && $("#homeQ").value.trim()) || ""; loadFeed(true); }
    if (ev.target.id === "btnLoadMore") loadFeed(false);
    if (ev.target.closest("[data-nav='home']")) loadFeed(true);
    if (ev.target.id === "btnGuide") { ev.preventDefault(); $("#guideSheet")?.classList.remove("hidden"); }
    if (ev.target.id === "guideClose" || ev.target.id === "guideSheet") $("#guideSheet")?.classList.add("hidden");
    if (ev.target.id === "rulesClose" || ev.target.id === "rulesSheet") $("#rulesSheet")?.classList.add("hidden");
    if (ev.target.id === "btnCity" || ev.target.closest("#btnCity")) {
      ev.preventDefault();
      ev.stopPropagation();
      $("#citySheet")?.classList.add("hidden");
      if (!$("#cityDrop")?.innerHTML) fillCities(cities, localStorage.getItem("yycj_city") || "");
      $("#cityDrop")?.classList.toggle("hidden");
    }
    const opt = ev.target.closest("#cityDrop [data-city]");
    if (opt) {
      localStorage.setItem("yycj_city", opt.getAttribute("data-city") || "");
      $("#cityDrop")?.classList.add("hidden");
      if ($("#homeQ")) $("#homeQ").value = "";
      q = "";
      loadFeed(true);
    }
  }, true);
  $("#pins")?.addEventListener("touchstart", () => {
    const pins = $("#pins");
    if (pins) pins.dataset.userScroll = "1";
  }, { passive: true });
  mountGuide();
  tickCarousel();
  ["share.js", "keyboard-fix.js", "deep-open.js", "detail-polish.js", "me-polish.js", "home-head.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260912a";
    document.head.appendChild(s);
  });
  async function boot() {
    for (let i = 0; i < 50 && !token(); i += 1) await new Promise((r) => setTimeout(r, 100));
    if (token()) await loadFeed(true);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
