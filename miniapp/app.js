(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#0b1020"); } catch (_) {}
  }

  const state = {
    token: localStorage.getItem("yycj_token") || "",
    user: null,
    isAdmin: false,
    lamps: [],
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(msg, isErr) {
    const el = $("#status");
    el.textContent = msg || "";
    el.className = isErr ? "err" : "ok";
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
    const res = await fetch(path, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      const detail = (data && (data.detail || data.message)) || res.statusText;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return data;
  }

  async function login() {
    const initData = (tg && tg.initData) || "";
    if (!initData) {
      toast("请在 Telegram 内打开 Mini App（缺少 initData）。开发调试可稍后对接。", true);
      return false;
    }
    const data = await api("/api/auth", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
    state.token = data.token;
    state.user = data.user;
    state.isAdmin = !!data.is_admin;
    localStorage.setItem("yycj_token", state.token);
    renderMe();
    if (state.isAdmin) $("#adminTab").classList.remove("hidden");
    toast("已登录");
    return true;
  }

  function renderMe() {
    const u = state.user;
    if (!u) {
      $("#creditCard").innerHTML = "<p class='meta'>尚未登录</p>";
      return;
    }
    const shadow = u.is_shadowed
      ? `<span class="badge shadow">遮蔽 ${u.shadow_days || 0} 天</span>`
      : `<span class="badge">正常</span>`;
    $("#creditCard").innerHTML = `
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="meta">兰花令 · ${u.tier || "-"}</div>
          <div class="score">${u.lanhua_score ?? "-"} <span class="meta">/ 1000</span></div>
        </div>
        ${shadow}
      </div>
      <div class="meta" style="margin-top:8px">获得 ${u.total_earned || 0} · 扣除 ${u.total_deducted || 0}</div>
      ${u.shadow_reason ? `<div class="meta">原因：${escapeHtml(u.shadow_reason)}</div>` : ""}
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function showPanel(name) {
    $$(".panel").forEach((p) => p.classList.add("hidden"));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.panel === name));
    const el = document.querySelector(`#panel-${name}`);
    if (el) el.classList.remove("hidden");
  }

  async function loadCredit() {
    const data = await api("/api/me/credit");
    state.user = data.user;
    renderMe();
    const hist = data.history || [];
    $("#history").innerHTML = hist.length
      ? hist.map((h) => {
          const sign = h.delta >= 0 ? "+" : "";
          const t = (h.time || "").toString().replace("T", " ").slice(5, 16);
          return `<div class="card"><div class="row" style="justify-content:space-between">
            <strong>${sign}${h.delta}</strong><span class="meta">${escapeHtml(t)}</span></div>
            <div class="meta">${escapeHtml(h.reason || h.action || "")}</div></div>`;
        }).join("")
      : "<p class='meta'>暂无流水</p>";
  }

  async function searchLamps() {
    const q = $("#q").value.trim();
    const city = $("#city").value.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    params.set("limit", "20");
    const data = await api(`/api/lamps?${params}`);
    state.lamps = data.items || [];
    renderLamps();
  }

  function renderLamps() {
    const box = $("#lampList");
    if (!state.lamps.length) {
      box.innerHTML = "<p class='meta'>没有找到灯笼</p>";
      return;
    }
    box.innerHTML = state.lamps.map((l) => `
      <div class="card" data-id="${escapeHtml(l.lamp_id)}">
        <h3>${escapeHtml(l.title || "未命名")}</h3>
        <div class="meta">📍 ${escapeHtml(l.city || "-")} · 💰 ${escapeHtml(l.price_text || l.price || "面议")} · ✅ ${l.authenticity_score ?? "-"}%</div>
        <div class="meta">${escapeHtml((l.tags || []).join(" · ") || "无标签")}</div>
        <p>${escapeHtml((l.description || "").slice(0, 120))}</p>
        <div class="row">
          <button class="btn primary" data-act="detail">详情</button>
          <button class="btn" data-act="session">发起会话</button>
          <button class="btn" data-act="report">报告</button>
        </div>
      </div>
    `).join("");
  }

  async function openDetail(id) {
    const data = await api(`/api/lamps/${encodeURIComponent(id)}`);
    const l = data.lamp;
    $("#detail").innerHTML = `
      <div class="card">
        <h3>${escapeHtml(l.title || "")}</h3>
        <div class="meta">ID <code>${escapeHtml(l.lamp_id)}</code></div>
        <div class="meta">📍 ${escapeHtml(l.city || "-")} · 💰 ${escapeHtml(l.price_text || l.price || "面议")}</div>
        <p>${escapeHtml(l.description || "")}</p>
        <div class="row">
          <button class="btn primary" id="detailSession">发起月影会话</button>
          <button class="btn" id="detailReport">报告此灯笼</button>
        </div>
      </div>`;
    showPanel("detail");
    $("#detailSession").onclick = () => requestSession(l.lamp_id);
    $("#detailReport").onclick = () => {
      $("#reportLampId").value = l.lamp_id;
      showPanel("report");
    };
  }

  async function requestSession(lampId) {
    const data = await api("/api/sessions/request", {
      method: "POST",
      body: JSON.stringify({ lamp_id: lampId }),
    });
    toast(data.message || "已发送邀请");
    if (tg && tg.showAlert) tg.showAlert(data.message || "已发送邀请");
  }

  async function submitPost(ev) {
    ev.preventDefault();
    const body = {
      city: $("#postCity").value.trim(),
      title: $("#postTitle").value.trim(),
      price_text: $("#postPrice").value.trim(),
      tags: $("#postTags").value.trim().split(/\s+/).filter(Boolean),
      description: $("#postDesc").value.trim(),
      photos: [],
    };
    const digits = (body.price_text || "").replace(/\D/g, "");
    if (digits) body.price = parseInt(digits, 10);
    const data = await api("/api/posts", { method: "POST", body: JSON.stringify(body) });
    toast(`投稿已提交：${data.post_id.slice(0, 8)}…`);
    $("#postForm").reset();
  }

  async function submitReport(ev) {
    ev.preventDefault();
    const body = {
      lamp_id: $("#reportLampId").value.trim(),
      reason: $("#reportReason").value.trim(),
      description: $("#reportDesc").value.trim(),
    };
    const data = await api("/api/reports", { method: "POST", body: JSON.stringify(body) });
    toast(`报告已提交：${data.report_id.slice(0, 8)}…`);
    $("#reportForm").reset();
  }

  async function loadAdmin() {
    const [posts, reports, shadow] = await Promise.all([
      api("/api/admin/posts/pending"),
      api("/api/admin/reports/pending"),
      api("/api/admin/shadow"),
    ]);
    $("#adminPosts").innerHTML = (posts.items || []).map((p) => {
      const d = p.lamp_data || {};
      return `<div class="card"><div class="meta">${escapeHtml(p.post_id)}</div>
        <strong>${escapeHtml(d.title || "")}</strong>
        <div class="meta">${escapeHtml(d.city || "")} · 用户 ${p.user_id}</div>
        <p>${escapeHtml((d.description || "").slice(0, 160))}</p>
        <div class="meta">请在 Bot 通知里点通过/拒绝</div></div>`;
    }).join("") || "<p class='meta'>无待审投稿</p>";

    $("#adminReports").innerHTML = (reports.items || []).map((r) => `
      <div class="card"><div class="meta">${escapeHtml(r.report_id)}</div>
      <div>灯笼 <code>${escapeHtml(r.lamp_id)}</code></div>
      <div class="meta">举报人 ${r.reporter_id} · ${escapeHtml(r.reason || "")}</div>
      <p>${escapeHtml((r.description || "").slice(0, 160))}</p>
      <div class="meta">请在 Bot 通知里点采纳/驳回</div></div>
    `).join("") || "<p class='meta'>无待审报告</p>";

    $("#adminShadow").innerHTML = (shadow.items || []).map((u) => `
      <div class="card row" style="justify-content:space-between">
        <div><strong>${u.user_id}</strong> · ${escapeHtml(u.tier || "")}
          <div class="meta">${u.lanhua_score} 分 · 剩余 ${u.shadow_days || 0} 天</div>
          <div class="meta">${escapeHtml(u.shadow_reason || "")}</div>
        </div>
      </div>
    `).join("") || "<p class='meta'>当前无遮蔽用户</p>";
  }

  async function adjustCredit(ev) {
    ev.preventDefault();
    const body = {
      user_id: parseInt($("#adjUser").value, 10),
      delta: parseInt($("#adjDelta").value, 10),
      note: $("#adjNote").value.trim(),
    };
    const data = await api("/api/admin/credit/adjust", {
      method: "POST",
      body: JSON.stringify(body),
    });
    toast(`已调整：用户 ${data.user.user_id} → ${data.user.lanhua_score}`);
    await loadAdmin();
  }

  // events
  $$(".tab").forEach((t) => t.addEventListener("click", async () => {
    const name = t.dataset.panel;
    showPanel(name);
    try {
      if (name === "credit") await loadCredit();
      if (name === "search") await searchLamps();
      if (name === "admin") await loadAdmin();
    } catch (e) { toast(e.message || String(e), true); }
  }));

  $("#btnSearch").addEventListener("click", async () => {
    try { await searchLamps(); toast(`找到 ${(state.lamps || []).length} 条`); }
    catch (e) { toast(e.message || String(e), true); }
  });

  $("#lampList").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    const card = btn.closest("[data-id]");
    const id = card && card.dataset.id;
    if (!id) return;
    try {
      if (btn.dataset.act === "detail") await openDetail(id);
      if (btn.dataset.act === "session") await requestSession(id);
      if (btn.dataset.act === "report") {
        $("#reportLampId").value = id;
        showPanel("report");
      }
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#postForm").addEventListener("submit", async (ev) => {
    try { await submitPost(ev); } catch (e) { toast(e.message || String(e), true); }
  });
  $("#reportForm").addEventListener("submit", async (ev) => {
    try { await submitReport(ev); } catch (e) { toast(e.message || String(e), true); }
  });
  $("#adjForm").addEventListener("submit", async (ev) => {
    try { await adjustCredit(ev); } catch (e) { toast(e.message || String(e), true); }
  });

  (async () => {
    try {
      const ok = await login();
      if (ok) {
        await loadCredit();
        showPanel("credit");
      }
    } catch (e) {
      toast(e.message || String(e), true);
    }
  })();
})();
