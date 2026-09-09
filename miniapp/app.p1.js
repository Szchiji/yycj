(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#0b1020"); } catch (_) {}
  }

  const ROLE_LABEL = { guest: "客人", teacher: "老师", merchant: "商家" };
  const state = {
    token: localStorage.getItem("yycj_token") || "",
    user: null,
    isAdmin: false,
    city: localStorage.getItem("yycj_city") || "",
    cities: [],
    lat: null,
    lng: null,
    home: null,
    scoringRules: null,
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function toast(msg, isErr) {
    const el = $("#toast");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
    el.classList.toggle("err", !!isErr);
    if (msg) setTimeout(() => el.classList.add("hidden"), 2800);
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(path, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const detail = (data && (data.detail || data.message)) || res.statusText;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return data;
  }

  function firstMediaUrl(lamp) {
    const media = lamp.media || [];
    for (const m of media) {
      if (m && m.url && String(m.url).startsWith("http")) return m.url;
    }
    for (const p of lamp.photos || []) {
      if (String(p).startsWith("http")) return p;
    }
    return null;
  }

  async function login() {
    const B = window.__yycjBoot;
    B.showBoot("正在连接…");
    const initData = await B.waitForInitData(3500);
    if (!initData) {
      B.showBootError("未检测到 Telegram 登录信息。请在 Telegram 内通过「打开首页」进入，不要用外部浏览器打开。");
      return false;
    }
    try {
      B.showBoot("正在登录…");
      const data = await api("/api/auth", {
        method: "POST",
        body: JSON.stringify({ initData }),
      });
      state.token = data.token;
      state.user = data.user;
      state.isAdmin = !!data.is_admin;
      localStorage.setItem("yycj_token", state.token);
      return true;
    } catch (e) {
      B.showBootError(`登录失败：${e.message || String(e)}`);
      return false;
    }
  }

  async function setRole(role) {
    const data = await api("/api/me/role", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    state.user = data.user;
    localStorage.setItem("yycj_role", role);
    return data;
  }

  function showGate(show) {
    window.__yycjBoot?.hideBoot();
    $("#gate").classList.toggle("hidden", !show);
    $("#app").classList.toggle("hidden", show);
  }

  function navTo(name) {
    $$(".view").forEach((v) => v.classList.add("hidden"));
    const el = $(`#view-${name}`);
    if (el) el.classList.remove("hidden");
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
  }

  function roleDefaultView(role) {
    if (role === "teacher" || role === "merchant") return "publish";
    return "home";
  }

  async function tryGeo() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve();
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.lat = pos.coords.latitude;
          state.lng = pos.coords.longitude;
          resolve();
        },
        () => resolve(),
        { timeout: 4000, maximumAge: 600000 },
      );
    });
  }

  async function loadHome() {
    const params = new URLSearchParams();
    if (state.city) params.set("city", state.city);
    if (state.lat != null) params.set("lat", String(state.lat));
    if (state.lng != null) params.set("lng", String(state.lng));
    params.set("limit", "30");
    const data = await api(`/api/home?${params}`);
    state.home = data;
    state.cities = data.enabled_cities || [];
    state.scoringRules = data.scoring_rules;
    if (data.city && !state.city) {
      state.city = data.city;
      localStorage.setItem("yycj_city", state.city);
    }
    $("#btnCity").textContent = `${state.city || "城市"} ▾`;
    $("#topMeta").textContent = state.user
      ? `${ROLE_LABEL[state.user.role] || "未设身份"} · 兰花令 ${state.user.tier || ""}`
      : "";

    const ann = data.announcement;
    const annEl = $("#announce");
    if (ann && ann.text) {
      annEl.classList.remove("hidden");
      annEl.innerHTML = `<span>${escapeHtml(ann.text)}</span>`;
    } else {
      annEl.classList.add("hidden");
    }

    const pins = data.pins || [];
    $("#pins").innerHTML = pins.map((p) => {
      const l = p.lamp || {};
      const thumb = firstMediaUrl(l);
      return `<div class="pin-card" data-id="${escapeHtml(l.lamp_id)}">
        <span class="badge-pin">精选</span>
        ${thumb ? `<img class="thumb" src="${escapeHtml(thumb)}" alt="" />` : ""}
        <h3>${escapeHtml(l.title || "")}</h3>
        <div class="muted">📍 ${escapeHtml(l.city || "")}${l.district ? " · " + escapeHtml(l.district) : ""}
          ${l.fuzzy_distance ? " · " + escapeHtml(l.fuzzy_distance) : ""}</div>
        <div class="muted">💰 ${escapeHtml(l.price_text || "面议")} · 口碑 ${l.authenticity_score ?? "-"}</div>
      </div>`;
    }).join("");

    const items = data.items || [];
    $("#feed").innerHTML = items.length ? items.map((l) => {
      const thumb = firstMediaUrl(l);
      return `<div class="feed-card" data-id="${escapeHtml(l.lamp_id)}">
        ${thumb ? `<img class="thumb" src="${escapeHtml(thumb)}" alt="" />` : ""}
        <h3>${escapeHtml(l.title || "")}</h3>
        <div class="muted">📍 ${escapeHtml(l.city || "")}${l.district ? " · " + escapeHtml(l.district) : ""}
          ${l.fuzzy_distance ? " · " + escapeHtml(l.fuzzy_distance) : ""}</div>
        <div class="muted">💰 ${escapeHtml(l.price_text || "面议")} · 🏷 ${escapeHtml((l.tags || []).join(" ") || "无标签")}</div>
        <p>${escapeHtml((l.description || "").slice(0, 80))}</p>
        <div class="row">
          <button class="btn primary" data-act="detail" type="button">查看</button>
          <button class="btn" data-act="chat" type="button">想聊聊</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty card"><p class="muted">这里暂时还没有内容</p></div>`;

    fillCitySelect();
  }

  function fillCitySelect() {
    const list = $("#cityList");
    list.innerHTML = (state.cities || []).map((c) =>
      `<button class="role-btn" data-city="${escapeHtml(c)}" type="button">${escapeHtml(c)}</button>`
    ).join("") || `<p class="muted">暂无开放城市</p>`;
    const sel = $("#pubCity");
    if (sel) {
      sel.innerHTML = (state.cities || []).map((c) =>
        `<option value="${escapeHtml(c)}" ${c === state.city ? "selected" : ""}>${escapeHtml(c)}</option>`
      ).join("");
    }
  }

  async function openDetail(id) {
    const params = new URLSearchParams();
    if (state.lat != null) params.set("lat", String(state.lat));
    if (state.lng != null) params.set("lng", String(state.lng));
    const q = params.toString() ? `?${params}` : "";
    const data = await api(`/api/lamps/${encodeURIComponent(id)}${q}`);
    const l = data.lamp;
    const rep = data.reputation || {};
    const media = (l.media && l.media.length) ? l.media : (l.photos || []).map((u) => ({ type: "image", url: u }));
    const mediaHtml = media.map((m) => {
      const url = m.url || "";
      if (!String(url).startsWith("http")) {
        return `<div class="muted">file_id: <code>${escapeHtml(String(url).slice(0, 40))}</code></div>`;
      }
      if (m.type === "video") {
        return `<video controls src="${escapeHtml(url)}"></video>`;
      }
      return `<img src="${escapeHtml(url)}" alt="" />`;
    }).join("");

    const reviews = (data.reviews || []).map((r) =>
      `<div class="card"><div class="muted">${"★".repeat(r.stars || 0)}${"☆".repeat(5 - (r.stars || 0))}</div>
       <p>${escapeHtml(r.text || "")}</p></div>`
    ).join("") || `<p class="muted">暂无评价</p>`;

    $("#detail").innerHTML = `
      <div class="card">
        <h3>${escapeHtml(l.title || "")}</h3>
        <div class="muted">📍 ${escapeHtml(l.city || "")}${l.district ? " · " + escapeHtml(l.district) : ""}
          ${l.fuzzy_distance ? " · " + escapeHtml(l.fuzzy_distance) : ""}
          ${l.approx_label ? " · " + escapeHtml(l.approx_label) : ""}</div>
        <div class="muted">💰 ${escapeHtml(l.price_text || "面议")} · 🏷 ${escapeHtml((l.tags || []).join(" ") || "")}</div>
