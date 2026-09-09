(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#0b1020"); } catch (_) {}
  }

  const state = { token: localStorage.getItem("yycj_token") || "", isAdmin: false };
  const $ = (sel) => document.querySelector(sel);

  function toast(msg, isErr) {
    const el = $("#status");
    el.textContent = msg || "";
    el.className = isErr ? "err" : "ok";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
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
    if (!initData && state.token) {
      const me = await api("/api/me");
      state.isAdmin = !!me.is_admin;
      return state.isAdmin;
    }
    if (!initData) {
      throw new Error("请在 Telegram 内打开（缺少 initData）");
    }
    const data = await api("/api/auth", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
    state.token = data.token;
    state.isAdmin = !!data.is_admin;
    localStorage.setItem("yycj_token", state.token);
    return state.isAdmin;
  }

  async function adminAction(path) {
    await api(path, { method: "POST", body: "{}" });
    toast("已处理");
    await refresh();
  }

  async function refresh() {
    const [posts, reports, shadow] = await Promise.all([
      api("/api/admin/posts/pending"),
      api("/api/admin/reports/pending"),
      api("/api/admin/shadow"),
    ]);

    $("#adminPosts").innerHTML = (posts.items || []).map((p) => {
      const d = p.lamp_data || {};
      return `<div class="card"><div class="meta">${escapeHtml(p.post_id)}</div>
        <strong>${escapeHtml(d.title || "")}</strong>
        <div class="meta">${escapeHtml(d.city || "")} · 用户 ${p.user_id} · 图 ${(d.photos || []).length}</div>
        <p>${escapeHtml((d.description || "").slice(0, 200))}</p>
        <div class="row">
          <button class="btn primary" data-admin="post-ok" data-id="${escapeHtml(p.post_id)}">通过上架</button>
          <button class="btn danger" data-admin="post-no" data-id="${escapeHtml(p.post_id)}">拒绝</button>
        </div></div>`;
    }).join("") || "<p class='meta'>无待审投稿</p>";

    $("#adminReports").innerHTML = (reports.items || []).map((r) => `
      <div class="card"><div class="meta">${escapeHtml(r.report_id)}</div>
      <div>灯笼 <code>${escapeHtml(r.lamp_id)}</code></div>
      <div class="meta">举报人 ${r.reporter_id} · ${escapeHtml(r.reason || "")}</div>
      <p>${escapeHtml((r.description || "").slice(0, 200))}</p>
      <div class="row">
        <button class="btn primary" data-admin="rep-ok" data-id="${escapeHtml(r.report_id)}">采纳（下架+奖惩）</button>
        <button class="btn danger" data-admin="rep-no" data-id="${escapeHtml(r.report_id)}">驳回（扣举报人）</button>
      </div></div>
    `).join("") || "<p class='meta'>无待审报告</p>";

    $("#adminShadow").innerHTML = (shadow.items || []).map((u) => `
      <div class="card">
        <strong>${u.user_id}</strong> · ${escapeHtml(u.tier || "")}
        <div class="meta">${u.lanhua_score} 分 · 剩余 ${u.shadow_days || 0} 天</div>
        <div class="meta">${escapeHtml(u.shadow_reason || "")}</div>
      </div>
    `).join("") || "<p class='meta'>当前无遮蔽用户</p>";
  }

  async function lookupSession() {
    const sid = $("#sessId").value.trim();
    if (!sid) throw new Error("请填写 session_id");
    const data = await api(`/api/admin/sessions/${encodeURIComponent(sid)}/messages?limit=100`);
    const s = data.session || {};
    const msgs = data.messages || [];
    const head = `<div class="meta">status=${escapeHtml(s.status || "")} · msgs=${msgs.length} · Q=${s.quality_score ?? "-"}</div>`;
    const body = msgs.map((m) => {
      const t = (m.created_at || "").toString().replace("T", " ").slice(5, 16);
      const media = m.media_type || "text";
      const content = escapeHtml((m.content || "").slice(0, 160));
      const fid = m.file_id ? ` <code>${escapeHtml(String(m.file_id).slice(0, 24))}</code>` : "";
      return `<div class="card"><div class="meta">[${escapeHtml(t)}] ${escapeHtml(m.from_role)}/${escapeHtml(media)}${fid}</div><div>${content}</div></div>`;
    }).join("") || "<p class='meta'>无落库消息</p>";
    $("#sessOut").innerHTML = head + body;
  }

  document.body.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-admin]");
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.admin;
    try {
      if (act === "post-ok") await adminAction(`/api/admin/posts/${encodeURIComponent(id)}/approve`);
      if (act === "post-no") await adminAction(`/api/admin/posts/${encodeURIComponent(id)}/reject`);
      if (act === "rep-ok") await adminAction(`/api/admin/reports/${encodeURIComponent(id)}/accept`);
      if (act === "rep-no") await adminAction(`/api/admin/reports/${encodeURIComponent(id)}/reject`);
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#adjForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const body = {
        user_id: parseInt($("#adjUser").value, 10),
        delta: parseInt($("#adjDelta").value, 10),
        note: $("#adjNote").value.trim(),
      };
      const data = await api("/api/admin/credit/adjust", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast(`已调整：${data.user.user_id} → ${data.user.lanhua_score}`);
      await refresh();
    } catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnRefresh").addEventListener("click", async () => {
    try { await refresh(); toast("已刷新"); }
    catch (e) { toast(e.message || String(e), true); }
  });

  $("#btnSess").addEventListener("click", async () => {
    try { await lookupSession(); toast("已查询"); }
    catch (e) { toast(e.message || String(e), true); }
  });

  (async () => {
    try {
      const ok = await login();
      if (!ok) {
        $("#gate").innerHTML = "<p class='err'>需要管理员权限（ADMIN_IDS）。非管理员无法使用本页。</p>";
        return;
      }
      $("#gate").classList.add("hidden");
      $("#console").classList.remove("hidden");
      await refresh();
      toast("管理控制台已就绪");
    } catch (e) {
      $("#gate").innerHTML = `<p class="err">${escapeHtml(e.message || String(e))}</p>`;
      toast(e.message || String(e), true);
    }
  })();
})();
