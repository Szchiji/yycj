(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#0b1020"); } catch (_) {}
  }

  const state = { token: localStorage.getItem("yycj_token") || "", isAdmin: false };
  const $ = (s) => document.querySelector(s);

  function toast(msg, isErr) {
    const el = $("#status");
    el.textContent = msg || "";
    el.style.color = isErr ? "#f31260" : "#3dd68c";
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function mediaSrc(m) {
    if (!m) return null;
    const url = typeof m === "string" ? m : (m.url || m.file_id || "");
    if (!url) return null;
    if (String(url).startsWith("http")) return url;
    if (m.preview_url) return m.preview_url;
    return `/api/media/file/${encodeURIComponent(url)}`;
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

  function mediaSummary(d) {
    const media = d.media || [];
    const photos = d.photos || [];
    return `媒体 ${media.length || photos.length}`;
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
        const src = mediaSrc(m);
        if (!src) return "";
        const isVid = typeof m === "object" && m.type === "video";
        return isVid
          ? `<video controls src="${escapeHtml(src)}" style="max-width:100%;border-radius:8px;margin:4px 0"></video>`
          : `<img src="${escapeHtml(src)}" alt="" style="max-width:100%;border-radius:8px;margin:4px 0" />`;
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
          <button class="btn" data-admin="post-pin" data-id="${escapeHtml(p.post_id)}">通过并上轮播</button>
          <button class="btn danger" data-admin="post-no" data-id="${escapeHtml(p.post_id)}">拒绝</button>
        </div>
      </div>`;
    }).join("") || "<p class='muted'>无待审资料</p>";

    $("#adminReviews").innerHTML = (reviews.items || []).map((r) => `
      <div class="card">
        <div class="muted">${escapeHtml(r.review_id)}</div>
        <div>★${r.stars} · 客人 ${r.guest_id} · 资料 <code>${escapeHtml(r.lamp_id)}</code></div>
        <p>${escapeHtml(r.text || "")}</p>
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
        <div>资料 <code>${escapeHtml(r.lamp_id)}</code></div>
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
    if ($("#annText")) $("#annText").value = settings.announcement_text || "";
    if ($("#annOn")) $("#annOn").checked = !!settings.announcement_enabled;
    if ($("#citiesInput")) $("#citiesInput").value = (settings.enabled_cities || []).join(", ");
    if ($("#opsPageSize")) $("#opsPageSize").value = settings.home_feed_page_size || 3;
    if ($("#opsCta")) $("#opsCta").value = settings.chat_cta_label || "想聊聊";
    if ($("#opsWelcome")) $("#opsWelcome").value = settings.bot_welcome_text || "";
    if ($("#opsMediaMax")) $("#opsMediaMax").value = settings.media_max_count || 9;
    if ($("#opsReviewAudit")) $("#opsReviewAudit").checked = settings.review_require_audit !== false;

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

    const feedPins = home.feed_pins || [];
    if ($("#adminFeedPins")) {
      $("#adminFeedPins").innerHTML = feedPins.map((fp) => `
        <div class="card row" style="justify-content:space-between">
          <div><strong>${escapeHtml(fp.title || fp.lamp_id)}</strong>
            <div class="muted">${escapeHtml(fp.city || "")} · ${escapeHtml(fp.lamp_id)}</div></div>
          <button class="btn danger" data-admin="feed-unpin" data-id="${escapeHtml(fp.lamp_id)}">取消</button>
        </div>
      `).join("") || "<p class='muted'>暂无卡片置顶</p>";
    }

    const approved = home.approved_lamps || [];
    const fillSel = (selId) => {
      const sel = $(selId);
      if (!sel) return;
      const opts = [`<option value="">选择资料…</option>`];
      for (const it of approved) {
        opts.push(`<option value="${escapeHtml(it.lamp_id)}">${escapeHtml(it.title || it.lamp_id)} · ${escapeHtml(it.city || "")}</option>`);
      }
      sel.innerHTML = opts.join("");
    };
    fillSel("#pinLampId");
    fillSel("#feedPinLampId");
  }

  document.body.addEventListener("click", async (ev) => {
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
      if (act === "feed-unpin") await api("/api/admin/homepage/feed-pins", {
        method: "POST", body: JSON.stringify({ lamp_id: id, pinned: false }),
      });
      toast("已处理");
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnPin")?.addEventListener("click", async () => {
    try {
      const hoursRaw = $("#pinHours").value;
      const body = {
        lamp_id: $("#pinLampId").value.trim(),
        sort_order: 0,
        expires_hours: hoursRaw === "" ? null : parseInt(hoursRaw, 10),
      };
      await api("/api/admin/homepage/pins", { method: "POST", body: JSON.stringify(body) });
      toast("已上轮播");
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnSeed")?.addEventListener("click", async () => {
    try {
      const data = await api("/api/admin/seed-demo", { method: "POST", body: "{}" });
      toast(data.seeded ? "演示数据已填充" : (data.reason || "未种子"));
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#adjForm")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const data = await api("/api/admin/credit/adjust", {
        method: "POST",
        body: JSON.stringify({
          user_id: parseInt($("#adjUser").value, 10),
          delta: parseInt($("#adjDelta").value, 10),
          note: ($("#adjNote").value || "").trim(),
        }),
      });
      toast(`已调整 → ${data.user.lanhua_score}`);
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnRefresh")?.addEventListener("click", async () => {
    try { await refresh(); toast("已刷新"); }
    catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnFeedPinAdd")?.addEventListener("click", async () => {
    try {
      const lamp_id = ($("#feedPinLampId")?.value || "").trim();
      if (!lamp_id) return toast("请选择资料", true);
      await api("/api/admin/homepage/feed-pins", { method: "POST", body: JSON.stringify({ lamp_id, pinned: true }) });
      toast("已卡片置顶");
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnFeedPinDel")?.addEventListener("click", async () => {
    try {
      const lamp_id = ($("#feedPinLampId")?.value || "").trim();
      if (!lamp_id) return toast("请选择资料", true);
      await api("/api/admin/homepage/feed-pins", { method: "POST", body: JSON.stringify({ lamp_id, pinned: false }) });
      toast("已取消置顶");
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnOpsSave")?.addEventListener("click", async () => {
    try {
      const cities = ($("#citiesInput").value || "").split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
      await api("/api/admin/homepage/ops", {
        method: "POST",
        body: JSON.stringify({
          announcement_text: $("#annText").value,
          announcement_enabled: $("#annOn").checked,
          cities,
          home_feed_page_size: parseInt($("#opsPageSize").value, 10) || 3,
          chat_cta_label: $("#opsCta").value || "想聊聊",
          bot_welcome_text: $("#opsWelcome").value || "",
          media_max_count: parseInt($("#opsMediaMax").value, 10) || 9,
          review_require_audit: $("#opsReviewAudit").checked,
        }),
      });
      toast("设置已保存");
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
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
