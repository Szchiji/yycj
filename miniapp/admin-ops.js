(() => {
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  async function api(path, opt={}) {
    const r = await fetch(path, Object.assign({
      headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
    }, opt));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || r.statusText);
    return data;
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }

  document.addEventListener("click", async (ev) => {
    if (ev.target && ev.target.id === "btnOpsSave") {
      try {
        const chats = (($("#opsChats") && $("#opsChats").value) || "").split("\n").map((line) => {
          const p = line.split("|").map((x) => x.trim());
          if (!p[0]) return null;
          return { chat_id: p[0], title: p[1] || "", url: p[2] || "", required: true };
        }).filter(Boolean);
        await api("/api/admin/settings/extra", {
          method: "POST",
          body: JSON.stringify({
            listing_days: parseInt($("#opsListingDays")?.value, 10) || 30,
            carousel_interval_sec: parseInt($("#opsCarouselSec")?.value, 10) || 4,
            admin_contact: $("#opsAdminContact")?.value || "",
            show_bot_link: $("#opsShowBot") ? $("#opsShowBot").checked : true,
            show_admin_link: $("#opsShowAdmin") ? $("#opsShowAdmin").checked : true,
            required_chats: chats,
          }),
        });
      } catch (e) { console.warn(e); }
    }
  }, true);

  $("#btnSyncBot")?.addEventListener("click", async () => {
    try {
      const r = await api("/api/admin/bot-identity/refresh", { method: "POST", body: "{}" });
      alert("已同步 @" + ((r.identity || {}).username || ""));
    } catch (e) { alert(e.message || String(e)); }
  });

  async function loadListings() {
    const box = $("#adminListings");
    if (!box) return;
    try {
      const listed = await api("/api/admin/listings");
      box.innerHTML = (listed.items || []).map((x) => `
        <div class="card">
          <strong>${esc(x.title || "")}</strong>
          <div class="muted">${esc(x.city || "")} · ${esc(x.status || "")} · 到期 ${esc(x.expires_at || "-")}</div>
          <div class="row">
            <button class="btn" data-list="renew" data-id="${esc(x.lamp_id)}">续期30天</button>
            <button class="btn" data-list="relist" data-id="${esc(x.lamp_id)}">重新上架</button>
            <button class="btn danger" data-list="unlist" data-id="${esc(x.lamp_id)}">下架</button>
          </div>
        </div>`).join("") || "<p class='muted'>暂无资料</p>";
    } catch (e) { box.innerHTML = "<p class='muted'>列表加载失败</p>"; }
  }
  $("#adminListings")?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-list]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-list");
    try {
      if (act === "renew") await api(`/api/admin/listings/${id}/renew`, { method: "POST", body: JSON.stringify({ days: 30 }) });
      if (act === "unlist") await api(`/api/admin/listings/${id}/unlist`, { method: "POST", body: JSON.stringify({ reason: "admin" }) });
      if (act === "relist") await api(`/api/admin/listings/${id}/relist`, { method: "POST", body: "{}" });
      await loadListings();
    } catch (e) { alert(e.message || String(e)); }
  });

  async function renderUsers() {
    const data = await api("/api/admin/users?q=" + encodeURIComponent($("#userQ")?.value || ""));
    if ($("#adminUsers")) {
      $("#adminUsers").innerHTML = (data.items || []).map((u) => `
        <div class="card">
          <div><strong>${u.user_id}</strong> @${esc(u.username || "-")} · ${esc(u.full_name || "")}</div>
          <div class="muted">${esc(u.role || "-")} · ${u.lanhua_score} · ${u.is_banned ? "已拉黑" : "正常"}</div>
          <div class="row">
            <button class="btn danger" data-ban="1" data-id="${u.user_id}">拉黑</button>
            <button class="btn" data-ban="0" data-id="${u.user_id}">解除</button>
          </div>
        </div>`).join("") || "<p class='muted'>无结果</p>";
    }
  }
  $("#btnUserSearch")?.addEventListener("click", () => renderUsers().catch((e) => alert(e.message || e)));
  $("#adminUsers")?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-ban]");
    if (!btn) return;
    try {
      await api("/api/admin/users/ban", {
        method: "POST",
        body: JSON.stringify({ user_id: parseInt(btn.getAttribute("data-id"), 10), banned: btn.getAttribute("data-ban") === "1", reason: "admin" }),
      });
      await renderUsers();
    } catch (e) { alert(e.message || String(e)); }
  });

  setTimeout(() => { loadListings().catch(() => {}); }, 1500);
})();
