(() => {
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  let listingCache = [];
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
  function matchQ(item, q) {
    if (!q) return true;
    const blob = `${item.title || ""} ${item.city || ""} ${item.lamp_id || ""} ${item.status || ""}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  }

  document.getElementById("adminSide")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-pane]");
    if (!btn) return;
    document.querySelectorAll("#adminSide [data-pane]").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".admin-pane").forEach((p) => p.classList.toggle("active", p.id === "pane-" + btn.dataset.pane));
  });

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

  function renderListingCards(items) {
    const box = $("#adminListings");
    if (!box) return;
    box.innerHTML = (items || []).map((x) => `
      <div class="pick-item">
        <div class="meta">
          <strong>${esc(x.title || "")}</strong>
          <div class="muted">${esc(x.city || "")} · ${esc(x.status || "")} · ${esc((x.lamp_id || "").slice(0,8))}</div>
          <div class="muted">到期 ${esc(x.expires_at || "-")}</div>
        </div>
        <div class="row">
          <button class="btn" data-list="renew" data-id="${esc(x.lamp_id)}">续期</button>
          <button class="btn" data-list="relist" data-id="${esc(x.lamp_id)}">上架</button>
          <button class="btn danger" data-list="unlist" data-id="${esc(x.lamp_id)}">下架</button>
        </div>
      </div>`).join("") || "<p class='muted'>暂无资料</p>";
  }
  function renderPick(boxId, items, action) {
    const box = $(boxId);
    if (!box) return;
    box.innerHTML = (items || []).map((x) => `
      <div class="pick-item">
        <div class="meta">
          <strong>${esc(x.title || "")}</strong>
          <div class="muted">${esc(x.city || "")} · ${esc(x.status || "")} · ${esc((x.lamp_id || "").slice(0,8))}</div>
        </div>
        <button class="btn primary" data-pick="${action}" data-id="${esc(x.lamp_id)}">${action === "pin" ? "置顶" : "上轮播"}</button>
      </div>`).join("") || "<p class='muted'>无匹配</p>";
  }
  async function loadListings() {
    try {
      const listed = await api("/api/admin/listings");
      listingCache = listed.items || [];
      renderListingCards(listingCache);
      renderPick("#feedPinResults", listingCache.filter((x) => x.status === "active"), "pin");
      renderPick("#pinResults", listingCache.filter((x) => x.status === "active"), "carousel");
    } catch (e) {
      if ($("#adminListings")) $("#adminListings").innerHTML = "<p class='muted'>列表加载失败</p>";
    }
  }
  $("#btnListingSearch")?.addEventListener("click", () => {
    const q = ($("#listingQ")?.value || "").trim();
    renderListingCards(listingCache.filter((x) => matchQ(x, q)));
  });
  $("#btnFeedPinSearch")?.addEventListener("click", () => {
    const q = ($("#feedPinQ")?.value || "").trim();
    renderPick("#feedPinResults", listingCache.filter((x) => x.status === "active" && matchQ(x, q)), "pin");
  });
  $("#btnPinSearch")?.addEventListener("click", () => {
    const q = ($("#pinQ")?.value || "").trim();
    renderPick("#pinResults", listingCache.filter((x) => x.status === "active" && matchQ(x, q)), "carousel");
  });

  $("#feedPinResults")?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-pick='pin']");
    if (!btn) return;
    try {
      await api("/api/admin/homepage/feed-pins", {
        method: "POST",
        body: JSON.stringify({ lamp_id: btn.getAttribute("data-id"), pinned: true }),
      });
      document.getElementById("btnRefresh")?.click();
      await loadListings();
    } catch (e) { alert(e.message || String(e)); }
  });
  $("#pinResults")?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-pick='carousel']");
    if (!btn) return;
    try {
      const hoursRaw = $("#pinHours")?.value;
      await api("/api/admin/homepage/pins", {
        method: "POST",
        body: JSON.stringify({
          lamp_id: btn.getAttribute("data-id"),
          sort_order: 0,
          expires_hours: hoursRaw === "" ? null : parseInt(hoursRaw, 10),
        }),
      });
      document.getElementById("btnRefresh")?.click();
      await loadListings();
    } catch (e) { alert(e.message || String(e)); }
  });

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
        <div class="pick-item">
          <div class="meta">
            <div><strong>${u.user_id}</strong> @${esc(u.username || "-")} · ${esc(u.full_name || "")}</div>
            <div class="muted">${esc(u.role || "-")} · ${u.lanhua_score} · ${u.is_banned ? "已拉黑" : "正常"}</div>
          </div>
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

  setTimeout(() => { loadListings().catch(() => {}); }, 1600);
})();
