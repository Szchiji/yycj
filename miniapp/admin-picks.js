(() => {
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }
  function mediaSrc(item) {
    const lamp = (item && item.lamp) || item || {};
    const list = lamp.media || [];
    for (const m of list) {
      if ((m && m.type) === "video") continue;
      const raw = String((m && (m.preview_url || m.file_id || m.url)) || "").trim();
      if (!raw) continue;
      if (raw.startsWith("http") || raw.startsWith("/")) return raw;
      return "/api/media/file/" + encodeURIComponent(raw);
    }
    for (const p of lamp.photos || []) {
      const raw = String(p || "").trim();
      if (!raw || raw.startsWith("BAAC")) continue;
      if (raw.startsWith("http") || raw.startsWith("/")) return raw;
      return "/api/media/file/" + encodeURIComponent(raw);
    }
    return "";
  }
  async function api(path, opt) {
    const r = await fetch(path, Object.assign({
      headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
    }, opt || {}));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || r.statusText);
    return data;
  }
  function card(item, btnHtml) {
    const src = mediaSrc(item);
    return `<div class="card row" style="align-items:center;gap:8px">
      ${src ? `<img class="admin-thumb" src="${esc(src)}" alt="" />` : `<div class="admin-thumb ph"></div>`}
      <div style="flex:1;min-width:0">
        <strong>${esc(item.title || item.lamp_id || "")}</strong>
        <div class="muted">${esc(item.city || "")} · ${esc(item.lamp_id || "")}</div>
      </div>
      ${btnHtml}
    </div>`;
  }
  async function paintCurrent() {
    const home = await api("/api/admin/homepage");
    const lamps = {};
    (home.approved_lamps || []).forEach((x) => { lamps[x.lamp_id] = x; });
    (home.pins || []).forEach((p) => { if (p.lamp) lamps[p.lamp.lamp_id] = p.lamp; });
    if ($("#adminFeedPins")) {
      $("#adminFeedPins").innerHTML = (home.feed_pins || []).map((fp) => {
        const item = Object.assign({}, lamps[fp.lamp_id] || {}, fp);
        return card(item, `<button class="btn danger" data-admin="feed-unpin" data-id="${esc(fp.lamp_id)}">取消</button>`);
      }).join("") || "<p class='muted'>暂无卡片置顶</p>";
    }
    if ($("#adminPins")) {
      $("#adminPins").innerHTML = (home.pins || []).map((p) => {
        const item = Object.assign({}, p.lamp || {}, { lamp_id: (p.lamp && p.lamp.lamp_id) || p.lamp_id });
        return card(item, `<button class="btn danger" data-admin="pin-del" data-id="${p.id}">移除</button>`);
      }).join("") || "<p class='muted'>暂无轮播</p>";
    }
    return home;
  }
  async function search(q, boxId, kind) {
    const box = $(boxId);
    if (!box) return;
    const data = await api("/api/admin/listings");
    const items = (data.items || []).filter((x) => {
      if ((x.status || "active") !== "active") return false;
      if (!q) return true;
      const blob = `${x.title || ""} ${x.city || ""} ${x.lamp_id || ""}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    }).slice(0, 20);
    box.innerHTML = items.map((x) => card(x,
      kind === "pin"
        ? `<button class="btn primary" data-pick-pin="${esc(x.lamp_id)}">上轮播</button>`
        : `<button class="btn primary" data-pick-feed="${esc(x.lamp_id)}">置顶</button>`
    )).join("") || "<p class='muted'>无匹配</p>";
  }
  document.getElementById("btnFeedPinSearch")?.addEventListener("click", () => {
    search(("#feedPinQ" && $("#feedPinQ").value) || "", "#feedPinResults", "feed").catch((e) => alert(e.message));
  });
  document.getElementById("btnPinSearch")?.addEventListener("click", () => {
    search((("#pinQ" && $("#pinQ").value) || ""), "#pinResults", "pin").catch((e) => alert(e.message));
  });
  document.addEventListener("click", async (ev) => {
    const feed = ev.target.closest("[data-pick-feed]");
    const pin = ev.target.closest("[data-pick-pin]");
    try {
      if (feed) {
        await api("/api/admin/homepage/feed-pins", {
          method: "POST",
          body: JSON.stringify({ lamp_id: feed.getAttribute("data-pick-feed"), pinned: true }),
        });
        await paintCurrent();
      }
      if (pin) {
        const hoursRaw = ($("#pinHours") && $("#pinHours").value) || "";
        await api("/api/admin/homepage/pins", {
          method: "POST",
          body: JSON.stringify({
            lamp_id: pin.getAttribute("data-pick-pin"),
            sort_order: 0,
            expires_hours: hoursRaw === "" ? null : parseInt(hoursRaw, 10),
          }),
        });
        await paintCurrent();
      }
    } catch (e) { alert(e.message || String(e)); }
  });
  document.getElementById("btnRefresh")?.addEventListener("click", () => setTimeout(() => paintCurrent().catch(() => {}), 700));
  setTimeout(() => paintCurrent().catch(() => {}), 1800);
})();
