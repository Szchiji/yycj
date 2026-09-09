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

  function showBoot(msg) {
    const boot = $("#boot");
    if (!boot) return;
    boot.classList.remove("hidden");
    $("#gate")?.classList.add("hidden");
    $("#app")?.classList.add("hidden");
    if (msg != null) {
      const el = $("#bootMsg");
      if (el) el.textContent = msg;
    }
  }

  function hideBoot() {
    $("#boot")?.classList.add("hidden");
    const retry = $("#bootRetry");
    if (retry) retry.classList.add("hidden");
  }

  function showBootError(msg) {
    showBoot(msg || "连接失败，请重试");
    const retry = $("#bootRetry");
    if (retry) retry.classList.remove("hidden");
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitForInitData(timeoutMs = 3500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const cur = window.Telegram && window.Telegram.WebApp;
      const initData = (cur && cur.initData) || "";
      if (initData) return initData;
      await sleep(100);
    }
    const cur = window.Telegram && window.Telegram.WebApp;
    return (cur && cur.initData) || "";
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
    showBoot("正在连接…");
    const initData = await waitForInitData(3500);
    if (!initData) {
      showBootError("未检测到 Telegram 登录信息。请在 Telegram 内通过「打开首页」进入，不要用外部浏览器打开。");
      return false;
    }
    try {
      showBoot("正在登录…");
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
      showBootError(`登录失败：${e.message || String(e)}`);
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
    hideBoot();
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
        <div class="row" style="margin:8px 0">
          <span class="score">${rep.score ?? l.authenticity_score ?? "-"}</span>
          <span class="muted">口碑分</span>
          <button class="btn" id="btnRules" type="button">计分规则</button>
        </div>
        <div class="media-grid">${mediaHtml}</div>
        <p>${escapeHtml(l.description || "")}</p>
        <div class="row">
          <button class="btn primary" id="detailChat" type="button">想聊聊</button>
          <button class="btn" id="detailReport" type="button">举报</button>
          <button class="btn" id="detailReview" type="button">写评价</button>
        </div>
      </div>
      <h3 style="font-size:1rem">评价</h3>
      ${reviews}`;

    navTo("detail");
    $("#detailChat").onclick = () => requestChat(l.lamp_id);
    $("#detailReport").onclick = () => submitReport(l.lamp_id);
    $("#detailReview").onclick = () => {
      $("#revLampId").value = l.lamp_id;
      navTo("review");
    };
    $("#btnRules").onclick = () => showRules(rep.rules || state.scoringRules);
  }

  function showRules(rules) {
    if (!rules) return;
    $("#rulesTitle").textContent = rules.title || "口碑分说明";
    $("#rulesList").innerHTML = (rules.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("");
    $("#rulesSheet").classList.remove("hidden");
  }

  async function requestChat(lampId) {
    const data = await api("/api/sessions/request", {
      method: "POST",
      body: JSON.stringify({ lamp_id: lampId }),
    });
    toast(data.message || "已发送");
    if (tg && tg.showAlert) tg.showAlert(data.message || "已发送想聊聊邀请");
  }

  async function submitReport(lampId) {
    const reason = (tg && tg.showPopup)
      ? "用户举报"
      : prompt("举报原因（如：虚假信息）") || "";
    if (!reason) return;
    const description = prompt("补充说明（可选）") || "";
    await api("/api/reports", {
      method: "POST",
      body: JSON.stringify({ lamp_id: lampId, reason, description }),
    });
    toast("举报已提交，等待审核");
  }

  function parseMediaTextarea(raw) {
    const lines = (raw || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const media = [];
    for (const line of lines) {
      if (line.toLowerCase().startsWith("video|")) {
        media.push({ type: "video", url: line.slice(6).trim() });
      } else {
        media.push({ type: "image", url: line });
      }
    }
    return media.slice(0, 9);
  }

  async function submitPublish(ev) {
    ev.preventDefault();
    const role = state.user && state.user.role;
    if (role !== "teacher" && role !== "merchant") {
      toast("请先切换为老师或商家身份", true);
      return;
    }
    const tags = $("#pubTags").value.trim().split(/\s+/).filter(Boolean).slice(0, 5);
    const media = parseMediaTextarea($("#pubMedia").value);
    const body = {
      city: $("#pubCity").value,
      title: $("#pubTitle").value.trim(),
      price_text: $("#pubPrice").value.trim(),
      district: $("#pubDistrict").value.trim(),
      approx_label: $("#pubApprox").value.trim(),
      tags,
      description: $("#pubDesc").value.trim(),
      media,
    };
    const digits = (body.price_text || "").replace(/\D/g, "");
    if (digits) body.price = parseInt(digits, 10);
    if (state.lat != null) body.approx_lat = state.lat;
    if (state.lng != null) body.approx_lng = state.lng;
    const data = await api("/api/posts", { method: "POST", body: JSON.stringify(body) });
    toast(`已提交审核 ${data.post_id.slice(0, 8)}…`);
    $("#publishForm").reset();
    fillCitySelect();
  }

  async function loadMe() {
    const data = await api("/api/me");
    state.user = data.user;
    state.isAdmin = !!data.is_admin;
    const u = data.user || {};
    $("#meCard").innerHTML = `
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="muted">身份</div>
          <div class="score" style="font-size:1.2rem">${escapeHtml(ROLE_LABEL[u.role] || "未设置")}</div>
        </div>
        <span class="badge">${escapeHtml(u.tier || "")} · ${u.lanhua_score ?? "-"}</span>
      </div>
      ${u.is_shadowed ? `<p class="muted">月影遮蔽中 · ${u.shadow_days || 0} 天</p>` : ""}
    `;
    $("#adminEntry").classList.toggle("hidden", !state.isAdmin);
    const revs = data.reviews || [];
    $("#myReviews").innerHTML = revs.length
      ? revs.map((r) => `<div class="muted">${escapeHtml(r.status)} · ★${r.stars} · ${escapeHtml((r.text || "").slice(0, 40))}</div>`).join("")
      : `<p class="muted">暂无评价记录</p>`;
    $("#publishTitle").textContent = (u.role === "merchant") ? "商家发布" : "发布资料";
  }

  // events
  $$(".role-btn[data-role]").forEach((b) => b.addEventListener("click", async () => {
    try {
      await setRole(b.dataset.role);
      showGate(false);
      await afterRole();
    } catch (e) { toast(e.message || String(e), true); }
  }));

  $$("[data-switch]").forEach((b) => b.addEventListener("click", async () => {
    try {
      await setRole(b.dataset.switch);
      toast(`已切换为${ROLE_LABEL[b.dataset.switch]}`);
      await loadMe();
      const v = roleDefaultView(b.dataset.switch);
      if (v === "publish") {
        navTo("publish");
        fillCitySelect();
      } else {
        navTo("home");
        await loadHome();
      }
    } catch (e) { toast(e.message || String(e), true); }
  }));

  $$(".nav-item").forEach((b) => b.addEventListener("click", async () => {
    const name = b.dataset.nav;
    navTo(name);
    try {
      if (name === "home") await loadHome();
      if (name === "me") await loadMe();
      if (name === "publish") {
        if (!state.user || (state.user.role !== "teacher" && state.user.role !== "merchant")) {
          toast("发布需老师或商家身份，请到「我的」切换", true);
        }
        fillCitySelect();
      }
    } catch (e) { toast(e.message || String(e), true); }
  }));

  $("#btnCity").addEventListener("click", () => {
    fillCitySelect();
    $("#citySheet").classList.remove("hidden");
  });
  $("#cityClose").addEventListener("click", () => $("#citySheet").classList.add("hidden"));
  $("#cityList").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-city]");
    if (!b) return;
    state.city = b.dataset.city;
    localStorage.setItem("yycj_city", state.city);
    $("#citySheet").classList.add("hidden");
    try { await loadHome(); } catch (e) { toast(e.message || String(e), true); }
  });

  $("#pins").addEventListener("click", async (ev) => {
    const card = ev.target.closest("[data-id]");
    if (!card) return;
    try { await openDetail(card.dataset.id); } catch (e) { toast(e.message || String(e), true); }
  });
  $("#feed").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-act]");
    const card = ev.target.closest("[data-id]");
    if (!card) return;
    const id = card.dataset.id;
    try {
      if (!btn || btn.dataset.act === "detail") await openDetail(id);
      else if (btn.dataset.act === "chat") await requestChat(id);
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnBackHome").addEventListener("click", () => navTo("home"));
  $("#rulesClose").addEventListener("click", () => $("#rulesSheet").classList.add("hidden"));
  $("#publishForm").addEventListener("submit", async (ev) => {
    try { await submitPublish(ev); } catch (e) { toast(e.message || String(e), true); }
  });
  $("#reviewForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const photos = $("#revPhotos").value.trim().split(/\s+/).filter(Boolean);
      await api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          lamp_id: $("#revLampId").value,
          stars: parseInt($("#revStars").value, 10) || 5,
          text: $("#revText").value.trim(),
          photos,
        }),
      });
      toast("评价已提交，待审核");
      $("#reviewForm").reset();
      navTo("me");
      await loadMe();
    } catch (e) { toast(e.message || String(e), true); }
  });

  async function afterRole() {
    await tryGeo();
    const role = state.user && state.user.role;
    const view = roleDefaultView(role);
    navTo(view);
    if (view === "home") await loadHome();
    else {
      await loadHome().catch(() => {});
      fillCitySelect();
    }
    await loadMe().catch(() => {});
  }

  async function boot() {
    try {
      const ok = await login();
      if (!ok) return;
      hideBoot();
      if (!state.user || !state.user.role) {
        showGate(true);
        return;
      }
      showGate(false);
      await afterRole();
    } catch (e) {
      showBootError(`启动失败：${e.message || String(e)}`);
    }
  }

  const bootRetry = $("#bootRetry");
  if (bootRetry) {
    bootRetry.addEventListener("click", () => {
      bootRetry.classList.add("hidden");
      boot();
    });
  }

  boot();
})();
