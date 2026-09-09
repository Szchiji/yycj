(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#0b1020"); } catch (_) {}
  }

  const state = { token: localStorage.getItem("yycj_token") || "", isAdmin: false };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function toast(msg, isErr) {
    const el = $("#status");
    el.textContent = msg || "";
    el.className = isErr ? "muted" : "muted";
    el.style.color = isErr ? "#f31260" : "#3dd68c";
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
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

  async function login() {
    const initData = (tg && tg.initData) || "";
    if (!initData && state.token) {
      const me = await api("/api/me");
      state.isAdmin = !!me.is_admin;
      return state.isAdmin;
    }
    if (!initData) throw new Error("请在 Telegram 内打开（缺少 initData）");
    const data = await api("/api/auth", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
    state.token = data.token;
    state.isAdmin = !!data.is_admin;
    localStorage.setItem("yycj_token", state.token);
    return state.isAdmin;
  }

  function showTab(name) {
    ["posts", "reviews", "reports", "homeops"].forEach((t) => {
      $(`#tab-${t}`).classList.toggle("hidden", t !== name);
    });
    $$(".admin-tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  }

  function mediaSummary(d) {
    const media = d.media || [];
    const photos = d.photos || [];
    const n = media.length || photos.length;
    return `媒体 ${n}`;
  }

  async function refresh() {
    const [posts, reviews, reports, shadow, home] = await Promise.all([
      api("/api/admin/posts/pending"),
      api("/api/admin/reviews/pending"),
      api("/api/admin/reports/pending"),
      api("/api/admin/shadow"),
      api("/api/admin/homepage"),
    ]);

    $("#adminPosts").innerHTML = (posts.items || []).map((p) => {
      const d = p.lamp_data || {};
      const mediaHtml = (d.media || d.photos || []).slice(0, 4).map((m) => {
        const url = typeof m === "string" ? m : m.url;
        if (!url || !String(url).startsWith("http")) return "";
        const isVid = typeof m === "object" && m.type === "video";
        return isVid
          ? `<video controls src="${escapeHtml(url)}" style="max-width:100%;border-radius:8px;margin:4px 0"></video>`
          : `<img src="${escapeHtml(url)}" alt="" style="max-width:100%;border-radius:8px;margin:4px 0" />`;
      }).join("");
      return `<div class="card">
        <div class="muted">${escapeHtml(p.post_id)}</div>
        <strong>${escapeHtml(d.title || "")}</strong>
        <div class="muted">${escapeHtml(d.city || "")} ${escapeHtml(d.district || "")} · 用户 ${p.user_id}
          · ${escapeHtml(d.publisher_role || "")} · ${mediaSummary(d)}</div>
        <div class="muted">价位 ${escapeHtml(d.price_text || "")} · 标签 ${escapeHtml((d.tags || []).join(" "))}</div>
        <p>${escapeHtml(d.description || "")}</p>
        ${mediaHtml}
        <div class="row">
          <button class="btn primary" data-admin="post-ok" data-id="${escapeHtml(p.post_id)}">通过</button>
          <button class="btn" data-admin="post-pin" data-id="${escapeHtml(p.post_id)}">通过并置顶</button>
          <button class="btn danger" data-admin="post-no" data-id="${escapeHtml(p.post_id)}">拒绝</button>
        </div>
      </div>`;
    }).join("") || "<p class='muted'>无待审资料</p>";

    $("#adminReviews").innerHTML = (reviews.items || []).map((r) => `
      <div class="card">
        <div class="muted">${escapeHtml(r.review_id)}</div>
        <div>★${r.stars} · 客人 ${r.guest_id} · 灯笼 <code>${escapeHtml(r.lamp_id)}</code></div>
        <p>${escapeHtml(r.text || "")}</p>
        <div class="muted">${(r.photos || []).length} 张图</div>
        <div class="row">
          <button class="btn primary" data-admin="rev-ok" data-id="${escapeHtml(r.review_id)}">通过</button>
          <button class="btn danger" data-admin="rev-brush" data-id="${escapeHtml(r.review_id)}">拒绝刷评</button>
          <button class="btn danger" data-admin="rev-no" data-id="${escapeHtml(r.review_id)}">拒绝</button>
        </div>
      </div>
    `).join("") || "<p class='muted'>无待审评价</p>";

    $("#adminReports").innerHTML = (reports.items || []).map((r) => `
      <div class="card">
        <div class="muted">${escapeHtml(r.report_id)}</div>
        <div>灯笼 <code>${escapeHtml(r.lamp_id)}</code></div>
        <div class="muted">举报人 ${r.reporter_id} · ${escapeHtml(r.reason || "")}</div>
        <p>${escapeHtml(r.description || "")}</p>
        <div class="row">
          <button class="btn primary" data-admin="rep-ok" data-id="${escapeHtml(r.report_id)}">采纳</button>
          <button class="btn danger" data-admin="rep-no" data-id="${escapeHtml(r.report_id)}">驳回</button>
        </div>
      </div>
    `).join("") || "<p class='muted'>无待审举报</p>";

    $("#adminShadow").innerHTML = (shadow.items || []).map((u) => `
      <div class="card"><strong>${u.user_id}</strong> · ${escapeHtml(u.tier || "")}
        <div class="muted">${u.lanhua_score} · ${u.shadow_days || 0} 天 · ${escapeHtml(u.shadow_reason || "")}</div>
      </div>
    `).join("") || "<p class='muted'>无遮蔽用户</p>";

    const settings = home.settings || {};
    $("#annText").value = settings.announcement_text || "";
    $("#annOn").checked = !!settings.announcement_enabled;
    $("#citiesInput").value = (settings.enabled_cities || []).join(", ");

    $("#adminPins").innerHTML = (home.pins || []).map((p) => {
      const l = p.lamp || {};
      return `<div class="card row" style="justify-content:space-between">
        <div>
          <strong>#${p.sort_order} ${escapeHtml(l.title || p.lamp_id)}</strong>
          <div class="muted">${escapeHtml(p.lamp_id)} · 过期 ${escapeHtml(p.expires_at || "无")}</div>
        </div>
        <button class="btn danger" data-admin="pin-del" data-id="${p.id}">移除</button>
      </div>`;
    }).join("") || "<p class='muted'>暂无精选</p>";
  }

  document.body.addEventListener("click", async (ev) => {
    const tab = ev.target.closest(".admin-tabs .tab");
    if (tab) {
      showTab(tab.dataset.tab);
      return;
    }
    const btn = ev.target.closest("button[data-admin]");
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.admin;
    try {
      if (act === "post-ok") await api(`/api/admin/posts/${encodeURIComponent(id)}/approve`, { method: "POST", body: "{}" });
      if (act === "post-pin") await api(`/api/admin/posts/${encodeURIComponent(id)}/approve-pin`, {
        method: "POST", body: JSON.stringify({ expires_hours: 72 }),
      });
      if (act === "post-no") await api(`/api/admin/posts/${encodeURIComponent(id)}/reject`, { method: "POST", body: "{}" });
      if (act === "rev-ok") await api(`/api/admin/reviews/${encodeURIComponent(id)}/approve`, { method: "POST", body: "{}" });
      if (act === "rev-no") await api(`/api/admin/reviews/${encodeURIComponent(id)}/reject`, { method: "POST", body: "{}" });
      if (act === "rev-brush") await api(`/api/admin/reviews/${encodeURIComponent(id)}/brush`, { method: "POST", body: "{}" });
      if (act === "rep-ok") await api(`/api/admin/reports/${encodeURIComponent(id)}/accept`, { method: "POST", body: "{}" });
      if (act === "rep-no") await api(`/api/admin/reports/${encodeURIComponent(id)}/reject`, { method: "POST", body: "{}" });
      if (act === "pin-del") await api(`/api/admin/homepage/pins/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast("已处理");
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnAnn").addEventListener("click", async () => {
    try {
      await api("/api/admin/homepage/announcement", {
        method: "POST",
        body: JSON.stringify({ text: $("#annText").value, enabled: $("#annOn").checked }),
      });
      toast("公告已保存");
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnCities").addEventListener("click", async () => {
    try {
      const cities = $("#citiesInput").value.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
      await api("/api/admin/homepage/cities", {
        method: "POST",
        body: JSON.stringify({ cities }),
      });
      toast("城市已保存");
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnPin").addEventListener("click", async () => {
    try {
      const hoursRaw = $("#pinHours").value;
      const body = {
        lamp_id: $("#pinLampId").value.trim(),
        sort_order: 0,
        expires_hours: hoursRaw === "" ? null : parseInt(hoursRaw, 10),
      };
      await api("/api/admin/homepage/pins", { method: "POST", body: JSON.stringify(body) });
      toast("置顶已更新");
      $("#pinLampId").value = "";
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnSeed").addEventListener("click", async () => {
    try {
      const data = await api("/api/admin/seed-demo", { method: "POST", body: "{}" });
      toast(data.seeded ? "已种子演示数据" : (data.reason || "未种子"));
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#adjForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const data = await api("/api/admin/credit/adjust", {
        method: "POST",
        body: JSON.stringify({
          user_id: parseInt($("#adjUser").value, 10),
          delta: parseInt($("#adjDelta").value, 10),
          note: $("#adjNote").value.trim(),
        }),
      });
      toast(`已调整 → ${data.user.lanhua_score}`);
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnRefresh").addEventListener("click", async () => {
    try { await refresh(); toast("已刷新"); }
    catch (e) { toast(e.message || String(e), true); }
  });

  (async () => {
    try {
      const ok = await login();
      if (!ok) {
        $("#gate").innerHTML = "<p style='color:#f31260'>需要管理员权限（ADMIN_IDS）</p>";
        return;
      }
      $("#gate").classList.add("hidden");
      $("#console").classList.remove("hidden");
      await refresh();
      toast("管理台就绪");
    } catch (e) {
      $("#gate").innerHTML = `<p style="color:#f31260">${escapeHtml(e.message || String(e))}</p>`;
    }
  })();
})();
